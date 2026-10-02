"""Append recent job postings to ``backend/data/live_postings.csv``.

Source
------
Remote OK's public API, ``https://remoteok.com/api``. It needs no key, no
account and no secret, which is why it was chosen: there is no credential to
invent and nothing to leak into a workflow log.

Access rules this script follows, and does not attempt to work around:

* ``remoteok.com/robots.txt`` publishes ``User-agent: * / Crawl-delay: 1 /
  Allow: /``, so the endpoint is permitted for a general client. The script makes
  **one** request per run and never loops over a result set.
* The API's own notice asks that Remote OK be named as a source and linked to
  with a plain follow link. ``backend/data/market_demand.py`` publishes the source
  name and homepage, and Career Bridge renders that follow link, so the
  obligation is met at the point of display.
* A 403, a 429, or a bot-challenge body is treated as "do not proceed". The
  script stops and reports. It never solves a challenge, never retries a refusal
  in a loop, and never rotates a header to get around an access control.
* Every run identifies itself with a descriptive User-Agent.

Fields
------
Only fields the feed actually carries are parsed. ``experience`` is part of the
documented feed schema but is absent from every current record, so
``experience_required`` is written empty and published as ``None``. It is never
inferred from a title, a tag or a salary band.

``skills_list`` holds the feed's own ``tags`` verbatim, as a JSON array so a tag
containing a comma survives a round trip. A tag is a label the source applied to
its own posting; it is not resolved against the artifact skill catalog and never
becomes a demand figure.

Freshness is the feed's ``date``, stored exactly as written. No date is
reformatted, defaulted, or filled in.

Relevance
---------
A posting is admitted when its **title** names one of the fixed keywords in
``SEARCH_KEYWORDS``, matched case-folded and word-bounded. Tags are not a
relevance test: the feed stamps a broad, near-identical tag dump onto listings
whose titles have nothing in common, and a tag-only match admits Business
Development and Sr Solutions Architect postings as though they were data roles.
Tags are still stored verbatim on every admitted row, because what the source
said about a posting is worth keeping even when it is not the reason the posting
was kept.

The live file is a projection of that rule, not an append-only log, so a run also
removes stored rows the current rule no longer admits and reports every removed
``job_id``.

What the file is
----------------
An observational sample of individual postings, never an estimate of the market.
It carries no frequency, share, percentage, growth figure or trend, and nothing
downstream may aggregate it into one. Three postings is three observations.

Running it
----------
    python -m backend.ml.scraper_daily --dry-run     # fetch, report, write nothing
    python -m backend.ml.scraper_daily               # fetch and merge into the CSV

Exit codes: ``0`` success, ``1`` failure. Nothing is written unless the fetch and
parse both succeed, so a failed run can never truncate or empty the file.
"""

import argparse
import csv
import json
import logging
import os
import re
import sys
import tempfile
import time
from pathlib import Path
from typing import Iterable, Optional

import httpx

from ..data.market_demand import (
    LIVE_COLUMNS,
    LIVE_FIELDS_NOT_PROVIDED,
    LIVE_POSTINGS_FILENAME,
    LIVE_SOURCE,
    LIVE_SOURCE_HOMEPAGE,
    LIVE_SOURCE_NAME,
    live_postings_path,
)


LOGGER = logging.getLogger("skillbridge.scraper")

API_URL = "https://remoteok.com/api"

#: robots.txt Crawl-delay is 1s; this is the floor between any two attempts.
MIN_REQUEST_INTERVAL_SECONDS = 1.0

#: One attempt per run by design. The retry is a courtesy for a transient
#: network fault only, and never applies to a refusal or a rate limit.
RETRY_ATTEMPTS = 2
RETRY_BACKOFF_SECONDS = 5.0
RETRYABLE_STATUS = {500, 502, 503, 504}

#: A refusal or a rate limit ends the run.
REFUSAL_STATUS = {401, 403, 407, 429}

#: Markers that mean a bot challenge is in front of the API. Seeing one is a
#: stop condition, not something to route around.
CHALLENGE_MARKERS = (
    "just a moment",
    "checking your browser",
    "cf-browser-verification",
    "captcha",
    "attention required",
    "access denied",
)

#: Fixed and stable. These are not tuned per run and are not randomized: two
#: runs a week apart ask the same question, so a change in the output reflects a
#: change in the source rather than a change in the query.
SEARCH_KEYWORDS: tuple[str, ...] = (
    "data scientist",
    "data analyst",
    "data engineer",
    "data science",
    "machine learning",
    "ml engineer",
    "artificial intelligence",
    "deep learning",
    "computer vision",
    "nlp",
    "python",
    "pandas",
    "numpy",
    "scikit-learn",
    "pytorch",
    "tensorflow",
    "sql",
    "spark",
    "airflow",
    "etl",
    "kubernetes",
    "docker",
    "aws",
    "gcp",
)

#: The whole keyword list as one alternation, built once at import time.
#:
#: The lookaround guards are load-bearing rather than cosmetic. Without them a
#: short keyword matches inside a longer unrelated word, and the filter would
#: admit exactly the rows it exists to reject: ``sql`` inside ``MySQL`` and
#: ``PostgreSQL``, ``etl`` inside ``Retail``, ``Travel`` and ``Hotel``, ``aws``
#: inside ``Laws``. A keyword is a word here, not a fragment of one.
_KEYWORD_PATTERN = re.compile(
    r"(?<!\w)(?:"
    + "|".join(re.escape(keyword.casefold()) for keyword in SEARCH_KEYWORDS)
    + r")(?!\w)"
)


class ScrapeError(RuntimeError):
    """Any condition that must stop the run without writing."""


class AccessRefused(ScrapeError):
    """The source refused or challenged the request. Never worked around."""


# --------------------------------------------------------------------- parsing


def matches_keywords(position: str) -> bool:
    """True when the posting's *title* names one of the fixed keywords.

    Title-only, on purpose.

    This was originally a tag match with a title fallback, and it was measured
    against the first captured sample before being changed. Tag matching is
    permissive to the point of being wrong for this source: the feed applies a
    broad, near-identical tag dump to listings whose titles have nothing to do
    with each other, including the generic ``virtual assistant`` / ``bus dev``
    listings. In the captured eight rows, tag matching admitted five postings on
    a tag alone, among them ``Business Development``, ``Sr Solutions Architect``
    and ``Java Developer``. Publishing those under "fresh signals" beside a data
    analyst is misleading in a way no caption can repair, so the rule now trusts
    the one field a poster actually wrote for the role.

    Matching is case-folded and word-bounded (see ``_KEYWORD_PATTERN``), so it is
    deterministic and a short keyword cannot match inside a longer word.

    Tags are still stored verbatim on a row that is admitted. They are evidence
    about the posting; they are not a relevance test.
    """
    return bool(_KEYWORD_PATTERN.search(" " + (position or "").casefold() + " "))


def normalize_posting(raw: dict) -> Optional[dict[str, str]]:
    """Map one feed record onto the live schema, or ``None`` to skip it.

    A record without an id or without a usable ``date`` is skipped rather than
    completed: a posting with no date cannot be placed in time, and inventing
    one is exactly what this layer must never do.
    """
    if not isinstance(raw, dict):
        return None

    job_id = str(raw.get("id") or "").strip()
    if not job_id:
        return None

    raw_tags = raw.get("tags")
    tags = [str(tag).strip() for tag in raw_tags if str(tag).strip()] if isinstance(raw_tags, list) else []

    position = str(raw.get("position") or "").strip()
    if not matches_keywords(position):
        return None

    posting_date = str(raw.get("date") or "").strip()
    if not posting_date:
        return None

    # The feed documents an `experience` field but does not currently populate
    # it. It is read when present and left empty otherwise; it is never derived.
    experience = str(raw.get("experience") or "").strip()

    return {
        "job_id": job_id,
        "job_title": position,
        "company": str(raw.get("company") or "").strip(),
        "location": str(raw.get("location") or "").strip(),
        "experience_required": experience,
        "skills_list": json.dumps(tags, ensure_ascii=False),
        "posting_date": posting_date,
    }


def parse_feed(payload: object) -> tuple[list[dict[str, str]], dict[str, int]]:
    """Turn a decoded API response into normalized rows and a counter report.

    ``not_matched`` is the keyword filter doing its job and is reported apart
    from ``unusable``, which counts records that could not have been stored at
    all: no id, or no date to place the posting in time. Conflating the two would
    make a healthy run look like it was dropping broken data.
    """
    if not isinstance(payload, list):
        raise ScrapeError("The source did not return a posting list.")

    rows: list[dict[str, str]] = []
    stats = {"postings": 0, "matched": 0, "not_matched": 0, "unusable": 0}

    for entry in payload:
        if not isinstance(entry, dict) or not entry.get("position"):
            # The feed leads with a metadata object carrying the terms notice.
            continue
        stats["postings"] += 1

        job_id = str(entry.get("id") or "").strip()
        posting_date = str(entry.get("date") or "").strip()
        if not job_id or not posting_date:
            stats["unusable"] += 1
            continue

        raw_tags = entry.get("tags")
        tags = [str(tag).strip() for tag in raw_tags if str(tag).strip()] if isinstance(raw_tags, list) else []
        position = str(entry.get("position") or "").strip()
        if not matches_keywords(position):
            stats["not_matched"] += 1
            continue

        # The feed documents an `experience` field but does not currently populate
        # it. It is read when present and left empty otherwise; never derived.
        rows.append(
            {
                "job_id": job_id,
                "job_title": position,
                "company": str(entry.get("company") or "").strip(),
                "location": str(entry.get("location") or "").strip(),
                "experience_required": str(entry.get("experience") or "").strip(),
                "skills_list": json.dumps(tags, ensure_ascii=False),
                "posting_date": posting_date,
            }
        )
        stats["matched"] += 1

    return rows, stats


# ------------------------------------------------------------------- fetching


def fetch_feed(
    timeout: float = 20.0,
    *,
    client: Optional[httpx.Client] = None,
    sleep=time.sleep,
) -> object:
    """Fetch the feed once, with the access rules this script follows.

    A retry happens only for a transient server fault, and never for a refusal,
    a rate limit or a challenge body.
    """
    headers = {
        "User-Agent": (
            "SkillBridge-Market-Data/0.1 "
            "(daily market freshness job; +https://github.com/skillbridge)"
        ),
        "Accept": "application/json",
    }
    owned = client is None
    http = client or httpx.Client(timeout=timeout, follow_redirects=True, headers=headers)
    try:
        last_error: Optional[Exception] = None
        for attempt in range(RETRY_ATTEMPTS):
            if attempt:
                sleep(max(MIN_REQUEST_INTERVAL_SECONDS, RETRY_BACKOFF_SECONDS * attempt))
            try:
                response = http.get(API_URL)
            except httpx.HTTPError as error:
                last_error = error
                LOGGER.warning("attempt %s failed: %s", attempt + 1, error)
                continue

            if response.status_code in REFUSAL_STATUS:
                raise AccessRefused(
                    f"The source returned HTTP {response.status_code}. "
                    "Not retrying: a refusal is not a transient fault."
                )

            if response.status_code in RETRYABLE_STATUS:
                last_error = ScrapeError(f"The source returned HTTP {response.status_code}.")
                LOGGER.warning("attempt %s got HTTP %s", attempt + 1, response.status_code)
                continue

            if response.status_code != 200:
                raise ScrapeError(f"The source returned an unexpected HTTP {response.status_code}.")

            body = response.text[:4096].casefold()
            for marker in CHALLENGE_MARKERS:
                if marker in body:
                    raise AccessRefused(
                        "The source served a bot challenge instead of the feed. "
                        "Stopping: this script does not solve challenges."
                    )

            try:
                return response.json()
            except ValueError as error:
                last_error = ScrapeError(f"The source response was not JSON: {error}")
                LOGGER.warning("attempt %s returned undecodable JSON", attempt + 1)

        raise ScrapeError(f"The feed could not be fetched after {RETRY_ATTEMPTS} attempts: {last_error}")
    finally:
        if owned:
            http.close()


# -------------------------------------------------------------------- storage


def read_existing(path: Path) -> tuple[list[dict[str, str]], int]:
    """Read the live file, skipping rows it cannot use.

    A missing file is not an error: it is the state before the first scrape. Rows
    without an id or without a ``posting_date`` are dropped and counted, because
    a half-written row must not be able to carry a fake date forward.
    """
    if not path.is_file():
        return [], 0

    rows: list[dict[str, str]] = []
    skipped = 0
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        fieldnames = reader.fieldnames or []
        missing = [column for column in LIVE_COLUMNS if column not in fieldnames]
        if missing:
            LOGGER.warning("%s has an unexpected header; ignoring it (%s)", path.name, ", ".join(missing))
            return [], 0
        for raw in reader:
            job_id = str(raw.get("job_id") or "").strip()
            posting_date = str(raw.get("posting_date") or "").strip()
            if not job_id or not posting_date:
                skipped += 1
                continue
            rows.append({column: str(raw.get(column) or "") for column in LIVE_COLUMNS})

    return rows, skipped


def merge_rows(
    existing: Iterable[dict[str, str]], incoming: Iterable[dict[str, str]]
) -> tuple[list[dict[str, str]], int, int]:
    """Merge fetched rows into the stored ones, deduplicated on ``job_id``.

    A repeated ``job_id`` is an update rather than a new posting, so the fetched
    row replaces the stored one and the pair counts as updated, not added. The
    merged file is ordered by ``job_id`` so the same inputs always produce the
    same bytes.
    """
    merged: dict[str, dict[str, str]] = {}
    for row in existing:
        job_id = row["job_id"].strip()
        if job_id:
            merged[job_id] = dict(row)

    stored_ids = set(merged)
    added = 0
    updated = 0
    unchanged = 0
    for row in incoming:
        job_id = row["job_id"].strip()
        if not job_id:
            continue
        if job_id not in merged:
            added += 1
        elif merged[job_id] != row:
            updated += 1
        else:
            unchanged += 1
        merged[job_id] = dict(row)

    ordered = [merged[key] for key in sorted(merged)]
    LOGGER.debug("merge: stored=%s added=%s updated=%s unchanged=%s", len(stored_ids), added, updated, unchanged)
    return ordered, added, updated


def apply_relevance(rows: list[dict[str, str]]) -> tuple[list[dict[str, str]], list[str]]:
    """Drop stored rows the *current* relevance rule no longer admits.

    The live file is a projection of the rule, not an append-only log. A posting
    admitted by an earlier, looser rule must stop being served once the rule is
    tightened, otherwise tightening the filter would change nothing a user can
    see until every stale row happened to age out. Every dropped ``job_id`` is
    returned so the caller can report it; nothing is dropped silently.

    This is a rule change being applied to real observations, not a correction of
    fabricated data. The postings were reported by the source and are recorded as
    reported — they simply no longer pass a filter the project now applies.
    """
    kept: list[dict[str, str]] = []
    dropped: list[str] = []
    for row in rows:
        if matches_keywords(row.get("job_title", "")):
            kept.append(row)
        else:
            dropped.append(row["job_id"])
    return kept, sorted(dropped)


def apply_retention(rows: list[dict[str, str]], max_rows: int) -> list[dict[str, str]]:
    """Keep the ``max_rows`` most recent postings when the operator asks for it.

    Disabled by default. Retention is an explicit, reported decision, because
    dropping real observations silently would be the same failure as inventing
    them. Ties break on ``job_id`` so a run cannot change which row survives.
    """
    if max_rows <= 0 or len(rows) <= max_rows:
        return rows
    kept = sorted(rows, key=lambda row: (row["posting_date"], row["job_id"]), reverse=True)[:max_rows]
    return sorted(kept, key=lambda row: row["job_id"])


def write_rows(path: Path, rows: Iterable[dict[str, str]]) -> int:
    """Write the header and rows atomically.

    The file is rendered beside the target and moved into place, so an
    interrupted run leaves the previous file intact instead of a truncated one.
    """
    materialized = list(rows)
    path.parent.mkdir(parents=True, exist_ok=True)

    handle = tempfile.NamedTemporaryFile(
        mode="w",
        encoding="utf-8",
        newline="",
        dir=str(path.parent),
        prefix=f"{path.name}.",
        suffix=".tmp",
        delete=False,
    )
    temporary = Path(handle.name)
    try:
        with handle:
            writer = csv.DictWriter(handle, fieldnames=list(LIVE_COLUMNS), lineterminator="\n")
            writer.writeheader()
            writer.writerows(materialized)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    except BaseException:
        temporary.unlink(missing_ok=True)
        raise

    return len(materialized)


# ------------------------------------------------------------------------ cli


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="scraper_daily",
        description="Append recent postings from the Remote OK public API to the live market file.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Fetch, parse and report without writing the CSV.",
    )
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=None,
        help="Directory holding live_postings.csv. Defaults to backend/data.",
    )
    parser.add_argument(
        "--max-rows",
        type=int,
        default=0,
        help="Keep only the N most recent postings. 0 keeps everything (default).",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=20.0,
        help="Per-request timeout in seconds (default 20).",
    )
    return parser


def main(argv: Optional[list[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

    path = live_postings_path(args.data_dir)
    LOGGER.info(
        "source=%s (%s) keywords=%d fields_not_provided=%s",
        LIVE_SOURCE_NAME,
        LIVE_SOURCE_HOMEPAGE,
        len(SEARCH_KEYWORDS),
        ", ".join(LIVE_FIELDS_NOT_PROVIDED),
    )

    try:
        payload = fetch_feed(args.timeout)
    except AccessRefused as error:
        LOGGER.error("%s", error)
        LOGGER.error("The live file was left untouched.")
        return 1
    except ScrapeError as error:
        LOGGER.error("fetch failed: %s", error)
        LOGGER.error("The live file was left untouched.")
        return 1

    try:
        rows, stats = parse_feed(payload)
    except ScrapeError as error:
        LOGGER.error("parse failed: %s", error)
        LOGGER.error("The live file was left untouched.")
        return 1

    existing, skipped_existing = read_existing(path)
    merged, added, updated = merge_rows(existing, rows)
    relevant, dropped_ids = apply_relevance(merged)
    retained = apply_retention(relevant, args.max_rows)
    dropped_by_retention = len(relevant) - len(retained)

    LOGGER.info(
        "feed postings=%s matched=%s not_matched=%s unusable=%s | stored_before=%s skipped_stored=%s",
        stats["postings"],
        stats["matched"],
        stats["not_matched"],
        stats["unusable"],
        len(existing),
        skipped_existing,
    )
    LOGGER.info("added=%s updated=%s total_after=%s", added, updated, len(retained))
    if dropped_ids:
        LOGGER.warning(
            "the current title rule no longer admits %s stored posting(s), removed: %s",
            len(dropped_ids),
            ", ".join(dropped_ids),
        )
    if dropped_by_retention:
        LOGGER.warning(
            "retention dropped %s posting(s) to honour --max-rows=%s", dropped_by_retention, args.max_rows
        )

    if args.dry_run:
        LOGGER.info("dry run: nothing written to %s", path)
        return 0

    try:
        written = write_rows(path, retained)
    except OSError as error:
        LOGGER.error("could not write %s: %s", path, error)
        return 1

    LOGGER.info("wrote %s row(s) to %s", written, path)
    return 0


if __name__ == "__main__":
    sys.exit(main())

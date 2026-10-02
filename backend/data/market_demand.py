"""Prepared market baseline and the live freshness layer, served side by side.

Two datasets with different authority live in this module and are never combined:

* ``corpus``, ``roles`` and ``skills`` are the finalized Notebook 1-5 artifacts:
  one prepared static baseline over the postings ``cleaned_postings.parquet``
  holds. This is the ranking the product already showed, and nothing live changes
  a figure in it.
* ``fresh_signals`` are individual recent observations read from
  ``backend/data/live_postings.csv``, the file ``backend/ml/scraper_daily.py``
  appends to. They are a small sample of real postings and are published as
  individual records: no frequency, no share, no percentage, no growth figure and
  no trend, because a sample this size cannot support one. The sample is
  observational, not representative — it is whatever a fixed title filter
  happened to admit from one public feed on one day, and it is not a picture of
  the market. It must never be aggregated into one.

``live_data_last_updated`` is the newest ``posting_date`` the live file actually
records. It is an observed date from the data, never a claim about when a scrape
ran, and it is ``null`` when there is no live file.

The prepared baseline is not derived here. Every prepared figure is read through
``build_role_curriculum_intelligence``, so this module cannot drift from
``/curriculum-intelligence/{role}`` by restating a field or re-deriving a role.

Deliberately not done: the live file is never joined to the artifacts. A live
posting does not add to a prepared posting count, and a live source tag is not
resolved against the artifact skill catalog, because doing either would let a
small live sample silently move the main ranking.
"""

import csv
import json
from datetime import datetime
from pathlib import Path
from typing import Optional

from . import loaders
from .adapters import artifact_roles, plannable_roles
from .curriculum_intelligence import build_role_curriculum_intelligence


LIVE_POSTINGS_FILENAME = "live_postings.csv"

#: The documented live schema, in order. The scraper writes exactly these.
LIVE_COLUMNS: tuple[str, ...] = (
    "job_id",
    "job_title",
    "company",
    "location",
    "experience_required",
    "skills_list",
    "posting_date",
)

#: Fields this source never reports. Stored as an empty cell and published as
#: ``None``, never inferred from the title, the tags or the company.
LIVE_FIELDS_NOT_PROVIDED: tuple[str, ...] = ("experience_required",)

LIVE_SOURCE = "remoteok"
LIVE_SOURCE_NAME = "Remote OK"
LIVE_SOURCE_HOMEPAGE = "https://remoteok.com"

#: Published so a reader can tell a sample from a census.
MARKET_NOT_AVAILABLE: tuple[str, ...] = (
    "live_opening_count",
    "live_demand_percentage",
    "live_growth_percentage",
    "live_salary",
    "live_ranking",
    "live_market_share",
    "trend_from_live_sample",
)


class LivePostingsError(Exception):
    """Raised only when the live file cannot be read at all."""


ROLE_LABELS = {"backend_ml_engineer": "Backend ML Engineer", "data_science": "Data Science"}


def _role_label(role: str) -> str:
    return ROLE_LABELS.get(role, role.replace("_", " ").title())


def live_postings_path(data_directory: Optional[Path] = None) -> Path:
    """Resolve ``backend/data/live_postings.csv``.

    This is the *data* directory, which is the parent of the artifacts directory
    and the only place the live file lives. It is deliberately a different
    parameter from the artifact directory the loaders take, because the two
    cannot be the same path.
    """
    base = Path(data_directory) if data_directory is not None else Path(__file__).resolve().parent
    return base / LIVE_POSTINGS_FILENAME


def _parse_posting_date(value: str) -> Optional[str]:
    """Return the ISO date string unchanged, or ``None`` if it is not a date.

    The value is stored and published exactly as the source wrote it. It is only
    checked, never reformatted, so a posting date is never rewritten or invented.
    """
    text = (value or "").strip()
    if not text:
        return None
    try:
        datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None
    return text


def _parse_skills_list(value: str) -> Optional[list[str]]:
    """Decode the stored ``skills_list`` JSON array.

    Returns ``None`` when the cell is not a JSON list, so a malformed cell drops
    the row instead of becoming a made-up skill list. An empty array is a valid
    recorded value: the source returned no tags.
    """
    text = (value or "").strip()
    if not text:
        return []
    try:
        decoded = json.loads(text)
    except json.JSONDecodeError:
        return None
    if not isinstance(decoded, list):
        return None
    return [str(tag).strip() for tag in decoded if str(tag).strip()]


def read_live_postings(
    data_directory: Optional[Path] = None,
) -> tuple[list[dict[str, object]], dict[str, object]]:
    """Read the live file into published records plus a read report.

    Returns ``([], ...)`` rather than raising for every condition a scheduled
    job can hit before the first successful scrape:

    ``status``
        ``absent`` no file yet, ``empty`` header only, ``no_valid_rows`` every
        row was unusable, otherwise ``ok``.
    ``skipped_rows``
        Rows dropped, with the reason counted. They are never partially kept.

    A row is usable only with a ``job_id`` (the deduplication key) and an
    ISO ``posting_date``. Everything else is optional and is published as
    ``None`` rather than guessed.
    """
    path = live_postings_path(data_directory)
    report: dict[str, object] = {
        "source": LIVE_SOURCE,
        "source_name": LIVE_SOURCE_NAME,
        "source_homepage": LIVE_SOURCE_HOMEPAGE,
        "file_present": False,
        "status": "absent",
        "row_count": 0,
        "skipped_rows": 0,
        "duplicates_collapsed": 0,
        "skip_reasons": {},
        "fields_not_provided_by_source": list(LIVE_FIELDS_NOT_PROVIDED),
    }

    if not path.is_file():
        return [], report

    report["file_present"] = True

    try:
        with path.open("r", encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            fieldnames = reader.fieldnames or []
            missing = [column for column in LIVE_COLUMNS if column not in fieldnames]
            if missing:
                # A header this module did not write is not something to guess at.
                report["status"] = "unexpected_header"
                report["skip_reasons"] = {f"missing_column:{column}": 1 for column in missing}
                report["skipped_rows"] = len(missing)
                return [], report

            rows = list(reader)
    except OSError as error:
        raise LivePostingsError(f"Could not read {path.name}: {error}") from error
    except csv.Error as error:
        report["status"] = "unreadable"
        report["skip_reasons"] = {f"csv_error:{type(error).__name__}": 1}
        report["skipped_rows"] = 1
        return [], report

    if not rows:
        report["status"] = "empty"
        return [], report

    reasons: dict[str, int] = {}

    def skip(reason: str) -> None:
        reasons[reason] = reasons.get(reason, 0) + 1

    records: list[dict[str, object]] = []
    for row in rows:
        job_id = (row.get("job_id") or "").strip()
        if not job_id:
            skip("missing_job_id")
            continue
        posting_date = _parse_posting_date(row.get("posting_date") or "")
        if posting_date is None:
            skip("missing_or_unparseable_posting_date")
            continue
        skills = _parse_skills_list(row.get("skills_list") or "")
        if skills is None:
            skip("malformed_skills_list")
            continue

        records.append(
            {
                "job_id": job_id,
                "job_title": (row.get("job_title") or "").strip(),
                "company": (row.get("company") or "").strip(),
                "location": (row.get("location") or "").strip() or None,
                "experience_required": (row.get("experience_required") or "").strip() or None,
                "skills_list": skills,
                "posting_date": posting_date,
            }
        )

    # Last row wins for a repeated job_id, so re-observing a posting updates it
    # instead of being discarded. The survivor order is then fixed by job_id, so
    # the same file always yields the same list.
    deduped: dict[str, dict[str, object]] = {}
    for record in records:
        deduped[str(record["job_id"])] = record
    ordered = [deduped[key] for key in sorted(deduped)]

    # Collapsing a duplicate is deduplication, not a malformed row, so the two
    # are counted separately.
    report["status"] = "ok" if ordered else "no_valid_rows"
    report["row_count"] = len(ordered)
    report["duplicates_collapsed"] = len(records) - len(ordered)
    report["skipped_rows"] = sum(reasons.values())
    report["skip_reasons"] = reasons
    return ordered, report


def _prepared_baseline(
    known: list[str],
    plannable: list[str],
    artifact_directory: Optional[Path],
) -> tuple[dict[str, object], list[dict[str, object]], list[dict[str, object]], list[str]]:
    """Flatten the per-role records into one cross-role view.

    Every prepared value comes straight from
    ``build_role_curriculum_intelligence``, so nothing here restates or
    re-derives an artifact field. Roles come back ordered by recorded posting
    count, which is the only cross-role figure the artifacts hold; that is a
    presentational sort, not a score.
    """
    roles: list[dict[str, object]] = []
    skills: list[dict[str, object]] = []
    corpus: dict[str, object] = {}
    artifacts: list[str] = []

    for role in known:
        record = build_role_curriculum_intelligence(role, directory=artifact_directory)
        role_corpus = record.get("corpus") if isinstance(record.get("corpus"), dict) else {}
        if not corpus:
            # role_postings is the only per-role field in the corpus block, so
            # every role reports the same bounds and one role records them fully.
            corpus = dict(role_corpus)
        if not artifacts:
            recorded = record.get("artifacts")
            artifacts = [str(name) for name in recorded] if isinstance(recorded, list) else []

        role_skills = record.get("skills") if isinstance(record.get("skills"), list) else []
        unrecorded_velocity = 0
        for skill in role_skills:
            if not isinstance(skill, dict):
                continue
            if skill.get("velocity_score") is None:
                unrecorded_velocity += 1
            skills.append(
                {
                    "role": role,
                    "role_label": _role_label(role),
                    "skill": skill.get("skill"),
                    "frequency": skill.get("frequency"),
                    "classification": skill.get("classification"),
                    "velocity_score": skill.get("velocity_score"),
                    "time_slices_used": skill.get("time_slices_used"),
                    "hours": skill.get("hours"),
                    "prerequisites": skill.get("prerequisites"),
                }
            )

        roles.append(
            {
                "id": role,
                "label": _role_label(role),
                "plannable": role in plannable,
                "postings": role_corpus.get("role_postings"),
                "skill_count": len(role_skills),
                "unrecorded_velocity": unrecorded_velocity,
            }
        )

    # A role whose count is unrecorded sorts after every role that has one,
    # rather than being treated as a zero.
    roles.sort(key=lambda entry: (-(entry["postings"] or -1), str(entry["id"])))
    return corpus, roles, skills, artifacts


def build_market_demand(
    *,
    artifact_directory: Optional[Path] = None,
    data_directory: Optional[Path] = None,
) -> dict[str, object]:
    """Assemble the prepared baseline and the live freshness layer.

    The prepared figures come from the same builder ``/curriculum-intelligence``
    uses, so the baseline a client reads here is identical to the one it would
    read role by role. Roles are ordered by recorded posting count because that
    is the only cross-role figure the artifacts hold; it is a presentational
    sort, not a score.

    Two directories are accepted separately because they are different places:
    ``artifact_directory`` is the finalized artifact set the loaders validate,
    and ``data_directory`` is where ``live_postings.csv`` may or may not exist.
    Overriding one never moves the other.
    """
    known = artifact_roles(directory=artifact_directory)
    plannable = plannable_roles(directory=artifact_directory)
    corpus, roles, skills, artifacts = _prepared_baseline(known, plannable, artifact_directory)

    fresh_signals, live_report = read_live_postings(data_directory=data_directory)
    fresh_signals.sort(key=lambda record: str(record["posting_date"]), reverse=True)

    newest = fresh_signals[0]["posting_date"] if fresh_signals else None

    return {
        "corpus": corpus,
        "roles": roles,
        "skills": skills,
        "known_roles": known,
        "plannable_roles": plannable,
        "artifacts": artifacts,
        "fresh_signals": fresh_signals,
        "live_data_last_updated": newest,
        "live": live_report,
        "not_available": list(MARKET_NOT_AVAILABLE),
        "layer_note": (
            "skills and roles are the prepared static baseline; fresh_signals are "
            "individual recent live observations and are never merged into them. The "
            "live layer is an observational sample, not a representative one: it "
            "supports no count, share, percentage or trend."
        ),
    }

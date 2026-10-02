"""Stage 12.1 — the live freshness layer stays separate and reports only what it has.

The prepared-baseline assertions compare back to the finalized artifacts rather
than to hand-written constants, so a fabricated frequency or posting count fails
instead of passing. The live-layer assertions assert the things that must never
happen: an invented date, a live row changing a prepared figure, or a live sample
being dressed up as a count, share, or trend.
"""

import csv
import io
import json

import pytest
from fastapi.testclient import TestClient

from backend.data import loaders
from backend.data.market_demand import (
    LIVE_COLUMNS,
    MARKET_NOT_AVAILABLE,
    build_market_demand,
    live_postings_path,
    read_live_postings,
)
from backend.data.loaders import load_skill_scores
from backend.main import app
from backend.ml import scraper_daily


client = TestClient(app)


def write_live(rows, header=LIVE_COLUMNS, directory=None) -> None:
    """Write a live file into ``directory`` (a tmp path in every test here).

    Tests never touch ``backend/data/live_postings.csv`` itself, so running the
    suite cannot disturb the file the scheduled job actually maintains.
    """
    path = live_postings_path(directory)
    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\n")
    writer.writerow(list(header))
    writer.writerows([list(row) for row in rows])
    path.write_text(buffer.getvalue(), encoding="utf-8")
    return path


VALID_ROW = [
    "1136217",
    "Data Analyst",
    "SEAhub Asia",
    "Kuala Lumpur",
    "",
    json.dumps(["analyst", "python", "sql"]),
    "2026-08-04T14:20:29+00:00",
]

#: One record shaped like the source feed, used for the scraper tests so the
#: parse path runs on source fields rather than on the already-normalized CSV.
FEED_POSTING = {
    "id": 1,
    "position": "Data Scientist",
    "company": "C",
    "location": "Remote",
    "tags": ["python"],
    "date": "2026-09-01T00:00:00+00:00",
}


# ------------------------------------------------------- 1. no live file yet


def test_missing_live_file_is_a_normal_empty_state(tmp_path) -> None:
    records, report = read_live_postings(data_directory=tmp_path)

    assert records == []
    assert report["status"] == "absent"
    assert report["file_present"] is False
    assert report["row_count"] == 0


def test_missing_live_file_yields_a_null_timestamp_and_no_fresh_signals(tmp_path) -> None:
    payload = build_market_demand(data_directory=tmp_path)

    assert payload["fresh_signals"] == []
    assert payload["live_data_last_updated"] is None


# --------------------------------------------------------- 2. empty / header


def test_header_only_file_is_reported_empty(tmp_path) -> None:
    write_live([], directory=tmp_path)

    records, report = read_live_postings(data_directory=tmp_path)

    assert records == []
    assert report["status"] == "empty"
    assert report["file_present"] is True


def test_unexpected_header_is_not_guessed_at(tmp_path) -> None:
    write_live([["1", "2", "3"]], header=("a", "b", "c"), directory=tmp_path)

    records, report = read_live_postings(data_directory=tmp_path)

    assert records == []
    assert report["status"] == "unexpected_header"


# ------------------------------------------------------------ 3. a valid file


def test_valid_rows_are_published_with_optional_fields_left_none(tmp_path) -> None:
    write_live([VALID_ROW], directory=tmp_path)

    records, report = read_live_postings(data_directory=tmp_path)

    assert report["status"] == "ok"
    assert report["row_count"] == 1
    assert records[0]["job_title"] == "Data Analyst"
    assert records[0]["skills_list"] == ["analyst", "python", "sql"]
    # experience_required is documented as not provided by the source and is
    # never inferred from the title or the tags.
    assert records[0]["experience_required"] is None


def test_missing_optional_text_publishes_none_not_empty_string(tmp_path) -> None:
    write_live([["1", "Data Analyst", "SEAhub", "", "", "[]", "2026-08-04T00:00:00+00:00"]], directory=tmp_path)

    records, _ = read_live_postings(data_directory=tmp_path)

    assert records[0]["location"] is None
    assert records[0]["skills_list"] == []


# ----------------------------------------------------- 4. duplicate job ids


def test_duplicate_job_id_collapses_to_the_last_row(tmp_path) -> None:
    first = ["1136217", "Data Analyst", "SEAhub", "Kuala Lumpur", "", "[]", "2026-08-04T14:20:29+00:00"]
    later = ["1136217", "Data Analyst", "SEAhub", "Kuala Lumpur", "", "[]", "2026-09-04T14:20:29+00:00"]
    write_live([first, later], directory=tmp_path)

    records, report = read_live_postings(data_directory=tmp_path)

    assert len(records) == 1
    assert records[0]["posting_date"] == "2026-09-04T14:20:29+00:00"
    # A collapsed duplicate is deduplication, not a malformed row.
    assert report["duplicates_collapsed"] == 1
    assert report["skipped_rows"] == 0


# ------------------------------------------------------- 5. malformed rows


def test_malformed_rows_are_skipped_without_poisoning_valid_ones(tmp_path) -> None:
    write_live(
        [
            ["", "No id", "Corp", "", "", "[]", "2026-08-04T00:00:00+00:00"],
            ["2", "Bad skills", "Corp", "", "", "not-json", "2026-08-04T00:00:00+00:00"],
            VALID_ROW,
        ],
        directory=tmp_path,
    )

    records, report = read_live_postings(data_directory=tmp_path)

    assert len(records) == 1
    assert records[0]["job_title"] == "Data Analyst"
    assert report["skip_reasons"]["missing_job_id"] == 1
    assert report["skip_reasons"]["malformed_skills_list"] == 1


def test_a_file_of_only_malformed_rows_reports_no_valid_rows(tmp_path) -> None:
    write_live([["", "No id", "Corp", "", "", "[]", "2026-08-04T00:00:00+00:00"]], directory=tmp_path)

    records, report = read_live_postings(data_directory=tmp_path)

    assert records == []
    assert report["status"] == "no_valid_rows"


# --------------------------------------------------------- 6. invalid dates


def test_an_unparseable_date_is_dropped_never_replaced(tmp_path) -> None:
    write_live([["1", "Data Analyst", "Corp", "", "", "[]", "not-a-date"]], directory=tmp_path)

    records, report = read_live_postings(data_directory=tmp_path)

    assert records == []
    assert report["skip_reasons"]["missing_or_unparseable_posting_date"] == 1


def test_a_valid_date_is_published_exactly_as_recorded(tmp_path) -> None:
    stamp = "2026-08-04T14:20:29+00:00"
    write_live([["1", "Data Analyst", "Corp", "", "", "[]", stamp]], directory=tmp_path)

    records, _ = read_live_postings(data_directory=tmp_path)

    assert records[0]["posting_date"] == stamp


# ------------------------------------------- 7. live_data_last_updated is honest


def test_timestamp_is_the_newest_posting_date_not_a_scrape_claim(tmp_path) -> None:
    write_live(
        [
            ["1", "Data Analyst", "Corp", "", "", "[]", "2026-08-04T14:20:29+00:00"],
            ["2", "ML Engineer", "Corp", "", "", "[]", "2026-09-16T19:00:02+00:00"],
            ["3", "Data Engineer", "Corp", "", "", "[]", "2026-08-22T00:00:12+00:00"],
        ],
        directory=tmp_path,
    )

    payload = build_market_demand(data_directory=tmp_path)

    assert payload["live_data_last_updated"] == "2026-09-16T19:00:02+00:00"


# --------------------------------------- 8. the static baseline never moves


def test_a_large_live_file_cannot_change_a_prepared_posting_count(tmp_path) -> None:
    clean = build_market_demand(data_directory=tmp_path / "empty")
    write_live(
        [
            [str(1000 + index), "Data Scientist", "Corp", "", "", "[]", "2026-09-01T00:00:00+00:00"]
            for index in range(500)
        ],
        directory=tmp_path,
    )

    noisy = build_market_demand(data_directory=tmp_path)

    assert len(noisy["fresh_signals"]) == 500
    assert noisy["corpus"]["role_postings"] == clean["corpus"]["role_postings"]
    assert [role["postings"] for role in noisy["roles"]] == [role["postings"] for role in clean["roles"]]


def test_prepared_skill_values_still_come_from_the_artifacts(tmp_path) -> None:
    payload = build_market_demand(data_directory=tmp_path)
    artifact_rows = {
        (row["role_category"], row["skill"]): row["frequency"] for row in load_skill_scores()
    }

    assert payload["skills"]
    for skill in payload["skills"]:
        key = (skill["role"], skill["skill"])
        if key in artifact_rows:
            assert skill["frequency"] == artifact_rows[key]


# ------------------------------------------ 9. skills and fresh signals are apart


def test_the_two_layers_are_separate_keys(tmp_path) -> None:
    # A tag that appears in no prepared skill, so it can only enter the payload
    # through the live layer.
    exotic = json.dumps(["kubernetes", "a-tag-no-artifact-has"])
    write_live([["900", "Data Scientist", "Corp", "", "", exotic, "2026-09-01T00:00:00+00:00"]], directory=tmp_path)

    payload = build_market_demand(data_directory=tmp_path)

    assert "fresh_signals" in payload
    assert "skills" in payload
    assert payload["layer_note"]
    # The live tag is published on the fresh record only; it never becomes a
    # prepared skill row.
    prepared = {skill["skill"] for skill in payload["skills"]}
    assert "a-tag-no-artifact-has" in payload["fresh_signals"][0]["skills_list"]
    assert "a-tag-no-artifact-has" not in prepared


def test_sample_derived_metrics_are_declared_unavailable(tmp_path) -> None:
    payload = build_market_demand(data_directory=tmp_path)

    assert payload["not_available"] == list(MARKET_NOT_AVAILABLE)
    for field in MARKET_NOT_AVAILABLE:
        assert field not in payload


# ------------------------------------------------ 10. deterministic output


def test_the_same_file_always_yields_the_same_response(tmp_path) -> None:
    write_live(
        [
            ["2", "ML Engineer", "Corp", "", "", "[]", "2026-09-16T19:00:02+00:00"],
            ["1", "Data Analyst", "Corp", "", "", "[]", "2026-08-04T14:20:29+00:00"],
        ],
        directory=tmp_path,
    )

    first = build_market_demand(data_directory=tmp_path)
    second = build_market_demand(data_directory=tmp_path)

    assert json.dumps(first, sort_keys=True) == json.dumps(second, sort_keys=True)


def test_fresh_signals_are_ordered_newest_first(tmp_path) -> None:
    write_live(
        [
            ["1", "Data Analyst", "Corp", "", "", "[]", "2026-08-04T14:20:29+00:00"],
            ["2", "ML Engineer", "Corp", "", "", "[]", "2026-09-16T19:00:02+00:00"],
        ],
        directory=tmp_path,
    )

    payload = build_market_demand(data_directory=tmp_path)

    dates = [record["posting_date"] for record in payload["fresh_signals"]]
    assert dates == sorted(dates, reverse=True)


# ------------------------------------------------ 11. relevance is the title
#
# The filter was tag-matching until the first captured sample was measured against
# it. These assertions pin the rule that replaced it, so the permissive behaviour
# cannot come back unnoticed.


def _tags_dump() -> list[str]:
    """The near-identical tag dump this source stamps on unrelated listings.

    Shaped from the captured rows: the generic ``virtual assistant`` / ``bus dev``
    listings carry ``data science`` and ``python`` among thirty-odd tags that have
    nothing to do with the role, which is exactly how tag matching let Business
    Development in.
    """
    return ["saas", "customer support", "marketing", "exec", "ops", "sales", "virtual assistant", "data science", "python"]


def test_a_relevant_tag_on_an_unrelated_title_is_not_enough() -> None:
    assert scraper_daily.matches_keywords("Business Development") is False
    assert scraper_daily.matches_keywords("Sr Solutions Architect") is False
    assert scraper_daily.matches_keywords("Java Developer") is False


def test_the_tag_dump_alone_cannot_admit_a_posting() -> None:
    rows, stats = scraper_daily.parse_feed(
        [
            {"legal": "notice"},
            {
                "id": "1136221",
                "position": "Business Development",
                "company": "GROW10X",
                "location": "Islamabad",
                "tags": _tags_dump(),
                "date": "2026-08-04T07:17:17+00:00",
            },
        ]
    )

    assert rows == []
    assert stats == {"postings": 1, "matched": 0, "not_matched": 1, "unusable": 0}


def test_a_relevant_title_is_admitted_and_keeps_its_tags() -> None:
    rows, stats = scraper_daily.parse_feed(
        [
            {
                "id": "1136217",
                "position": "Data Analyst Assistant",
                "company": "Arabian Private Holdings",
                "location": "Islamabad",
                "tags": _tags_dump(),
                "date": "2026-08-04T13:06:29+00:00",
            }
        ]
    )

    assert stats["matched"] == 1
    assert rows[0]["job_title"] == "Data Analyst Assistant"
    # Admitted on the title, but the tags are still stored verbatim.
    assert json.loads(rows[0]["skills_list"]) == _tags_dump()


def test_a_short_keyword_does_not_match_inside_a_longer_word() -> None:
    # `sql` is not inside MySQL/PostgreSQL and `etl` is not inside Retail, Travel
    # or Hotel. Without word boundaries the filter would admit all of these.
    assert scraper_daily.matches_keywords("MySQL Developer") is False
    assert scraper_daily.matches_keywords("PostgreSQL Developer") is False
    assert scraper_daily.matches_keywords("Retail Operations Analyst") is False
    assert scraper_daily.matches_keywords("Hotel Revenue Analyst") is False
    assert scraper_daily.matches_keywords("Corporate Lawyer") is False


def test_title_matching_is_case_folded_and_deterministic() -> None:
    assert scraper_daily.matches_keywords("DATA ANALYST") is True
    assert scraper_daily.matches_keywords("senior ml engineer") is True
    assert scraper_daily.matches_keywords("") is False
    assert [scraper_daily.matches_keywords("Data Analyst") for _ in range(5)] == [True] * 5


def test_a_stored_row_the_rule_no_longer_admits_is_removed(tmp_path, monkeypatch) -> None:
    # The live file is a projection of the rule, so tightening it has to change
    # what is served without waiting for a stale row to age out.
    path = tmp_path / "live_postings.csv"
    path.write_text(
        ",".join(LIVE_COLUMNS)
        + "\n"
        + "1,Data Analyst,Corp,,,[],2026-08-04T00:00:00+00:00\n"
        + "2,Business Development,Corp,,,[],2026-08-04T00:00:00+00:00\n"
        + "3,Java Developer,Corp,,,[],2026-08-04T00:00:00+00:00\n",
        encoding="utf-8",
    )
    # An empty feed, so nothing is re-added: only the rule can change the file.
    monkeypatch.setattr(scraper_daily, "fetch_feed", lambda *a, **k: [{"legal": "notice"}])

    assert scraper_daily.main(["--data-dir", str(tmp_path)]) == 0
    with path.open(encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))
    assert [row["job_id"] for row in rows] == ["1"]


def test_the_real_live_file_holds_only_titles_the_rule_admits() -> None:
    with live_postings_path().open(encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))

    assert rows, "the committed live file is empty"
    for row in rows:
        assert scraper_daily.matches_keywords(row["job_title"]), row["job_title"]


def test_the_live_sample_is_never_aggregated() -> None:
    payload = build_market_demand()

    # Individual records only. Nothing counts, ranks or scores the live rows.
    for record in payload["fresh_signals"]:
        assert set(record) == {
            "job_id",
            "job_title",
            "company",
            "location",
            "experience_required",
            "skills_list",
            "posting_date",
        }
    assert payload["not_available"] == list(MARKET_NOT_AVAILABLE)


# ------------------------------------------------ 12. scraper failure handling


class _Response:
    def __init__(self, status, text="", payload=None):
        self.status_code = status
        self.text = text
        self._payload = payload

    def json(self):
        return self._payload

    def close(self):
        return None


class _Client:
    def __init__(self, response):
        self.response = response
        self.calls = 0

    def get(self, url):
        self.calls += 1
        return self.response


def test_a_refusal_is_not_retried() -> None:
    client_double = _Client(_Response(403))

    with pytest.raises(scraper_daily.AccessRefused):
        scraper_daily.fetch_feed(client=client_double)

    assert client_double.calls == 1


def test_a_rate_limit_is_not_retried() -> None:
    client_double = _Client(_Response(429))

    with pytest.raises(scraper_daily.AccessRefused):
        scraper_daily.fetch_feed(client=client_double)

    assert client_double.calls == 1


def test_a_challenge_body_stops_the_run() -> None:
    client_double = _Client(_Response(200, text="<html>Just a moment...</html>"))

    with pytest.raises(scraper_daily.AccessRefused):
        scraper_daily.fetch_feed(client=client_double)

    assert client_double.calls == 1


def test_a_failed_run_leaves_the_live_file_untouched(tmp_path, monkeypatch) -> None:
    path = tmp_path / "live_postings.csv"
    path.write_text("job_id,job_title,company,location,experience_required,skills_list,posting_date\n1,Data Analyst,C,,,[],2026-08-04T00:00:00+00:00\n", encoding="utf-8")
    before = path.read_text(encoding="utf-8")

    def boom(*args, **kwargs):
        raise scraper_daily.ScrapeError("source unreachable")

    monkeypatch.setattr(scraper_daily, "fetch_feed", boom)

    assert scraper_daily.main(["--data-dir", str(tmp_path)]) == 1
    assert path.read_text(encoding="utf-8") == before


def test_a_dry_run_writes_nothing(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(
        scraper_daily,
        "fetch_feed",
        lambda *a, **k: [{"legal": "notice"}, FEED_POSTING],
    )

    assert scraper_daily.main(["--dry-run", "--data-dir", str(tmp_path)]) == 0
    assert not (tmp_path / "live_postings.csv").exists()


def test_a_successful_run_writes_the_header_and_the_row(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(
        scraper_daily,
        "fetch_feed",
        lambda *a, **k: [{"legal": "notice"}, FEED_POSTING],
    )

    assert scraper_daily.main(["--data-dir", str(tmp_path)]) == 0
    with (tmp_path / "live_postings.csv").open(encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))
    assert rows[0]["job_title"] == "Data Scientist"
    assert json.loads(rows[0]["skills_list"]) == ["python"]


def test_a_second_run_updates_rather_than_duplicates(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(scraper_daily, "fetch_feed", lambda *a, **k: [{"legal": "notice"}, FEED_POSTING])
    assert scraper_daily.main(["--data-dir", str(tmp_path)]) == 0

    moved = dict(FEED_POSTING, date="2026-09-20T00:00:00+00:00")
    monkeypatch.setattr(scraper_daily, "fetch_feed", lambda *a, **k: [{"legal": "notice"}, moved])
    assert scraper_daily.main(["--data-dir", str(tmp_path)]) == 0

    with (tmp_path / "live_postings.csv").open(encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))
    assert len(rows) == 1
    assert rows[0]["posting_date"] == "2026-09-20T00:00:00+00:00"


def test_a_retention_cap_is_explicit_and_reported(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(
        scraper_daily,
        "fetch_feed",
        lambda *a, **k: [
            {"legal": "notice"},
            dict(FEED_POSTING, id=1, date="2026-09-01T00:00:00+00:00"),
            dict(FEED_POSTING, id=2, date="2026-09-02T00:00:00+00:00"),
        ],
    )

    assert scraper_daily.main(["--max-rows", "1", "--data-dir", str(tmp_path)]) == 0
    with (tmp_path / "live_postings.csv").open(encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))
    assert [row["job_id"] for row in rows] == ["2"]


# ----------------------------------------------------- 12. endpoint contract


def test_the_endpoint_publishes_both_layers() -> None:
    response = client.get("/market-demand")

    assert response.status_code == 200
    payload = response.json()
    assert payload["roles"]
    assert payload["skills"]
    assert "fresh_signals" in payload
    assert payload["live"]["source_name"] == "Remote OK"


def test_the_prepared_endpoint_carries_no_live_fields() -> None:
    intelligence = client.get("/curriculum-intelligence/data_science").json()

    assert "fresh_signals" not in intelligence
    assert "live_data_last_updated" not in intelligence


def test_the_artifact_files_are_never_written_to(tmp_path) -> None:
    names = ("cleaned_postings.parquet", "skill_scores.parquet", "velocity_scores.parquet")
    before = {name: loaders.artifact_path(name).read_bytes() for name in names}

    write_live([VALID_ROW], directory=tmp_path)
    build_market_demand(data_directory=tmp_path)

    after = {name: loaders.artifact_path(name).read_bytes() for name in names}
    assert after == before


def test_the_live_file_sits_beside_the_artifacts_not_inside_them(tmp_path) -> None:
    write_live([VALID_ROW], directory=tmp_path)

    assert live_postings_path(tmp_path).parent == tmp_path
    assert not live_postings_path(loaders.artifacts_directory()).is_file()

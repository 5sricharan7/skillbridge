"""Stage 8D semester-aware recommendation engine tests.

These lock the explainability and honesty rules the recommendation layer depends
on:

* Only a real Stage 8C gap is recommended. A covered skill, a skill Stage 7 never
  recorded, and a recorded skill name that does not join the vocabulary are all
  excluded with a stated reason.
* Placement is recorded-prerequisite alignment and nothing else: the named
  semester and course already exist, and the course's own recorded prerequisite is
  a course that teaches the gap's recorded prerequisite.
* A missing, dangling, or cyclic prerequisite blocks or abstains. None is repaired,
  and no prerequisite is invented for a skill that records none.
* An unplaceable gap is still reported, with an explicit placement_status and a
  reason naming the recorded fact that stopped it.
* Recorded hours, credits, nulls, Stage 7 fields, and the demo disclaimer are
  carried through unchanged.
* Nothing is scored, weighted, ranked, prioritised, or expressed as a percentage.
* Output is deterministic, and no earlier endpoint changes behavior.
"""

import json

import pytest
from fastapi.testclient import TestClient

from backend.data.adapters import UnknownTargetRoleError
from backend.data.curriculum_gaps import build_role_curriculum_gaps
from backend.data.curriculum_intelligence import (
    build_role_curriculum_intelligence,
)
from backend.data.curriculum_record import (
    CONTRACT_VERSION,
    build_curriculum_coverage,
    load_curriculum_record,
)
from backend.data.curriculum_recommendations import (
    PLACEMENT_BASIS,
    PLACEMENT_STATUS_BLOCKED_CYCLE,
    PLACEMENT_STATUS_BLOCKED_DANGLING,
    PLACEMENT_STATUS_INSUFFICIENT_DATA,
    PLACEMENT_STATUS_PLACED,
    PREREQUISITE_STATUS_CYCLE,
    PREREQUISITE_STATUS_DANGLING,
    PREREQUISITE_STATUS_EMPTY,
    PREREQUISITE_STATUS_NOT_RECORDED,
    PREREQUISITE_STATUS_RESOLVED,
    PREREQUISITE_STATUS_SKILL_ABSENT,
    RECOMMENDATION_STATUS_PLACED,
    RECOMMENDATION_STATUS_UNPLACED,
    TARGET_SELECTION_BASIS,
    build_role_curriculum_recommendations,
)
from backend.main import app


client = TestClient(app)

ROLES = ("data_science", "backend_ml_engineer", "other")

REQUIRED_FIELDS = (
    "skill",
    "recommendation_status",
    "target_semester",
    "target_course",
    "reason",
    "industry_evidence",
    "prerequisites",
    "prerequisite_status",
    "learning_hours",
    "hours_source",
    "placement_status",
    "evidence_limitations",
)


@pytest.fixture(scope="module")
def data_science():
    return build_role_curriculum_recommendations("data_science")


@pytest.fixture(scope="module")
def backend_ml():
    return build_role_curriculum_recommendations("backend_ml_engineer")


@pytest.fixture(scope="module")
def corpus_only():
    return build_role_curriculum_recommendations("other")


@pytest.fixture(scope="module")
def data_science_text(data_science):
    return json.dumps(data_science, sort_keys=True)


def _by_skill(payload, skill):
    matches = [record for record in payload["recommendations"] if record["skill"] == skill]
    assert len(matches) == 1, f"expected exactly one {skill!r} recommendation"
    return matches[0]


def _limitation_codes(record):
    return [limitation["code"] for limitation in record["evidence_limitations"]]


def _absent(payload, skill):
    """True when no recommendation was made for this skill."""
    return all(record["skill"] != skill for record in payload["recommendations"])


def _placed(payload):
    return [
        record
        for record in payload["recommendations"]
        if record["placement_status"] == PLACEMENT_STATUS_PLACED
    ]


# ------------------------------------------------------ 1. a valid recommendation
def test_every_gap_becomes_exactly_one_recommendation(data_science):
    gaps = build_role_curriculum_gaps("data_science")
    assert [record["skill"] for record in data_science["recommendations"]] == [
        gap["skill"] for gap in gaps["gaps"]
    ]
    assert data_science["summary"]["gap_count"] == gaps["summary"]["gap_count"] == 37


def test_every_recommendation_carries_the_required_fields(data_science):
    for record in data_science["recommendations"]:
        for field in REQUIRED_FIELDS:
            assert field in record, field
        assert record["is_gap"] is True
        assert record["coverage_status"] == "not_covered"
        assert record["reason"].strip()


def test_a_gap_with_a_recorded_chain_is_placed_in_an_existing_course(data_science):
    record = _by_skill(data_science, "pandas")

    assert record["placement_status"] == PLACEMENT_STATUS_PLACED
    assert record["recommendation_status"] == RECOMMENDATION_STATUS_PLACED
    assert record["prerequisite_status"] == PREREQUISITE_STATUS_RESOLVED
    # A course and a semester the record already contains.
    assert record["target_course"]["course_id"] == "DEMO-103"
    assert record["target_semester"]["semester_id"] == "2026-2027-s2"
    assert record["target_semester"]["academic_year_id"] == "2026-2027"


def test_a_placed_recommendation_explains_the_recorded_chain_it_followed(data_science):
    record = _by_skill(data_science, "pandas")

    # Stage 7 records python; DEMO-102 records it as a skill; DEMO-103 records
    # DEMO-102 as its own prerequisite.
    assert record["prerequisites"] == ["python"]
    assert record["reason"] == (
        "Stage 7 records 'python' as prerequisites of this skill. 'python' is "
        "taught by DEMO-102, DEMO-201; DEMO-103 records DEMO-102 as one of its own "
        "prerequisites. No course earlier in the record's own order lists a course "
        "teaching every one of those prerequisites, so DEMO-103 is the earliest "
        "recorded position for this gap. It runs in semester 2026-2027-s2 of "
        "academic year 2026-2027."
    )
    assert record["prerequisite_chain"] == [
        {
            "prerequisite": "python",
            "join_key": "python",
            "recorded_courses": ["DEMO-102", "DEMO-201"],
            "usable_courses": ["DEMO-102", "DEMO-201"],
            "excluded_courses": [],
        }
    ]


def test_a_placed_recommendation_copies_stage_seven_hours_and_their_source(data_science):
    record = _by_skill(data_science, "pandas")
    row = {
        item["skill"]: item
        for item in build_role_curriculum_intelligence("data_science")["skills"]
    }["pandas"]

    assert record["learning_hours"] == row["hours"] == 8
    assert record["hours_source"] == row["hours_source"] == (
        "heuristic; public Python/data curricula"
    )
    # Carried at the top level and inside the verbatim evidence block.
    assert record["learning_hours"] == record["industry_evidence"]["hours"]


def test_a_placed_recommendation_never_claims_the_hours_fit_somewhere(data_science):
    record = _by_skill(data_science, "pandas")
    codes = _limitation_codes(record)

    assert "learning_hours_not_scheduled" in codes
    assert "curriculum_revision_not_proposed" in codes
    # The record has no credits or hours anywhere, and that is stated rather than
    # assumed to be zero.
    assert "course_credits_not_recorded" in codes
    assert "course_hours_not_recorded" in codes
    assert "semester_credits_not_recorded" in codes


def test_stage_seven_fields_are_preserved_verbatim_on_every_recommendation(data_science):
    rows = {
        row["skill"]: row
        for row in build_role_curriculum_intelligence("data_science")["skills"]
    }
    for record in data_science["recommendations"]:
        expected = rows[record["skill"]]
        assert record["industry_evidence"] == json.loads(json.dumps(expected))
        assert record["prerequisites"] == expected["prerequisites"]


def test_unrecorded_hours_stay_null_and_are_never_read_as_zero(data_science):
    record = _by_skill(data_science, "scikit-learn")

    assert record["learning_hours"] is None
    assert record["hours_source"] is None
    assert "learning_hours_not_recorded" in _limitation_codes(record)


# ------------------------------------------------- 2. prerequisite-aware placement
def test_placement_follows_the_recorded_prerequisite_not_the_gap_order(data_science):
    placed = {record["skill"] for record in _placed(data_science)}
    # pandas is the first row Stage 7 publishes, but a skill later in that order is
    # also placed, so a placement is not the first gap or the most frequent skill.
    assert "llm" in placed
    assert data_science["recommendations"][0]["skill"] == "pandas"


def test_prerequisites_move_a_gap_off_the_first_recorded_semester(data_science):
    record = _by_skill(data_science, "pandas")
    first_semester = data_science["curriculum"]["semesters"][0]

    assert first_semester["semester_id"] == "2026-2027-s1"
    # python is taught in the first recorded semester, so the earliest course that
    # sequences after it is in the second one, not the first.
    assert record["target_semester"]["semester_id"] == "2026-2027-s2"
    assert record["target_semester"]["recorded_index"] == 2


def test_the_target_course_records_the_prerequisite_teaching_course(data_science):
    record = _by_skill(data_science, "pandas")
    target = record["target_course"]

    assert target["recorded_prerequisites"] == ["DEMO-102"]
    # DEMO-102 is a recorded course of this curriculum that teaches python, and it
    # is the one the named target course actually requires.
    assert record["prerequisite_chain"][0]["recorded_courses"] == [
        "DEMO-102",
        "DEMO-201",
    ]
    assert "DEMO-102" in target["recorded_prerequisites"]


def test_a_skill_with_no_recorded_prerequisite_is_never_placed(data_science):
    # Stage 7 records statistics with an empty prerequisite list. Nothing in the
    # record then says where it belongs, so it is not put in the first semester.
    empty = _by_skill(data_science, "statistics")
    assert empty["prerequisites"] == []
    assert empty["placement_status"] == PLACEMENT_STATUS_INSUFFICIENT_DATA
    assert empty["target_semester"] is None
    assert empty["target_course"] is None


def test_a_multi_prerequisite_gap_is_placed_after_every_recorded_prerequisite(
    data_science,
):
    record = _by_skill(data_science, "llm")
    assert record["prerequisites"] == ["machine learning", "python"]
    assert record["placement_status"] == PLACEMENT_STATUS_PLACED
    # DEMO-203 records DEMO-201, which teaches both prerequisites, and no earlier
    # course records a course teaching both.
    assert record["target_course"]["recorded_prerequisites"] == ["DEMO-201"]
    assert record["recorded_candidate_courses"] == ["DEMO-202", "DEMO-203"]


def test_the_earliest_recorded_candidate_wins_deterministically(data_science):
    record = _by_skill(data_science, "llm")

    # Both DEMO-202 and DEMO-203 satisfy the chain; the earlier recorded semester
    # wins, which is a structural position and not a comparison between gaps.
    assert record["recorded_candidate_courses"] == ["DEMO-202", "DEMO-203"]
    assert record["target_course"]["semester_id"] == "2027-2028-s1"
    assert data_science["target_selection_basis"] == TARGET_SELECTION_BASIS


# -------------------------------------------------- 3. missing prerequisite data
def test_a_skill_with_no_recorded_prerequisites_is_insufficient_not_invented(
    data_science,
):
    record = _by_skill(data_science, "aws")

    assert record["prerequisites"] is None
    assert record["prerequisite_status"] == PREREQUISITE_STATUS_NOT_RECORDED
    assert record["placement_status"] == PLACEMENT_STATUS_INSUFFICIENT_DATA
    assert record["recommendation_status"] == RECOMMENDATION_STATUS_UNPLACED
    assert record["target_semester"] is None and record["target_course"] is None
    assert "no_recorded_prerequisite_chain" in _limitation_codes(record)


def test_an_unplaced_gap_stays_in_the_output_with_a_reason(data_science):
    record = _by_skill(data_science, "aws")

    assert "no prerequisites" in record["reason"]
    assert "invented" in record["reason"]
    # It is still a gap and still recommended; only the placement is unresolved.
    assert record["is_gap"] is True
    assert record["recommendation_status"] == RECOMMENDATION_STATUS_UNPLACED


def test_no_prerequisite_is_ever_invented_for_any_recommendation(data_science):
    rows = {
        row["skill"]: row["prerequisites"]
        for row in build_role_curriculum_intelligence("data_science")["skills"]
    }
    for record in data_science["recommendations"]:
        assert record["prerequisites"] == rows[record["skill"]]
    # The two recorded shapes are distinguished, not merged.
    assert _by_skill(data_science, "aws")["prerequisite_status"] == (
        PREREQUISITE_STATUS_NOT_RECORDED
    )
    assert _by_skill(data_science, "statistics")["prerequisite_status"] == (
        PREREQUISITE_STATUS_EMPTY
    )


# ----------------------------------------------- 4. a dangling recorded prerequisite
def _fixture_course(course_id, *, skills=(), prerequisites=None):
    return {
        "course_id": course_id,
        "name": course_id,
        "code": None,
        "credits": None,
        "hours": None,
        "description": None,
        "level": None,
        "delivery_format": None,
        "is_elective": None,
        "source": {"kind": "manual_entry"},
        "prerequisites": prerequisites
        if prerequisites is not None
        else {"recorded": False, "course_ids": []},
        "skills": [
            {
                "skill": skill,
                "input_skill": skill,
                "canonical_skill": skill,
                "match_type": "exact",
                "role_categories": ["data_science"],
                "coverage": None,
                "notes": None,
                "source": {"kind": "manual_entry"},
            }
            for skill in skills
        ],
    }


def _fixture_document(semesters, *, record_id="fixture_record"):
    """A minimal but valid record, so the rules run on real input.

    ``semesters`` is a list of ``(semester_id, [course, ...])`` in recorded order.
    """
    return {
        "contract_version": CONTRACT_VERSION,
        "record_id": record_id,
        "record_kind": "demonstration",
        "is_demo": True,
        "is_representative": True,
        "label": "Fixture curriculum",
        "disclaimer": "Test fixture only.",
        "source": {"kind": "demo"},
        "not_recorded": [],
        "programmes": [
            {
                "programme_id": "p",
                "name": "P",
                "institution_name": None,
                "award": None,
                "faculty": None,
                "duration_terms": None,
                "total_credits": None,
                "source": {"kind": "demo"},
                "curricula": [
                    {
                        "version_id": "v",
                        "version_label": None,
                        "effective_from": None,
                        "effective_to": None,
                        "status": None,
                        "total_credits": None,
                        "source": {"kind": "demo"},
                        "academic_years": [
                            {
                                "academic_year_id": "2026-2027",
                                "label": None,
                                "start_year": None,
                                "end_year": None,
                                "is_entry_cohort": None,
                                "source": {"kind": "demo"},
                                "semesters": [
                                    {
                                        "semester_id": semester_id,
                                        "sequence": None,
                                        "term": None,
                                        "label": None,
                                        "start_date": None,
                                        "end_date": None,
                                        "recorded_credits": None,
                                        "source": {"kind": "demo"},
                                        "courses": courses,
                                    }
                                    for semester_id, courses in semesters
                                ],
                            }
                        ],
                    }
                ],
            }
        ],
    }


def _write_fixture(tmp_path, document):
    directory = tmp_path / "curricula"
    directory.mkdir()
    (directory / "demo_curriculum.json").write_text(
        json.dumps(document), encoding="utf-8"
    )
    return directory


def test_a_dangling_prerequisite_blocks_the_placement_and_is_not_repaired(tmp_path):
    directory = _write_fixture(
        tmp_path,
        _fixture_document(
            [
                (
                    "s1",
                    [
                        _fixture_course(
                            "ANCHOR", skills=["python"]
                        )
                    ],
                ),
                (
                    "s2",
                    [
                        _fixture_course(
                            "BROKEN",
                            prerequisites={
                                "recorded": True,
                                "course_ids": ["ANCHOR", "GHOST-1"],
                            },
                        )
                    ],
                ),
            ],
            record_id="dangling_record",
        ),
    )

    payload = build_role_curriculum_recommendations(
        "data_science", curriculum_directory=directory
    )
    record = _by_skill(payload, "pandas")

    assert record["placement_status"] == PLACEMENT_STATUS_BLOCKED_DANGLING
    assert record["prerequisite_status"] == PREREQUISITE_STATUS_DANGLING
    assert record["recommendation_status"] == RECOMMENDATION_STATUS_UNPLACED
    assert record["target_semester"] is None and record["target_course"] is None
    assert "GHOST-1" in record["reason"]
    # The dangling edge is still there, unrepaired, and the cycle-free record is
    # otherwise unchanged.
    assert payload["validation"]["dangling_prerequisites"] == [
        {"course_id": "BROKEN", "prerequisite_course_id": "GHOST-1"}
    ]
    assert payload["validation"] == json.loads(
        json.dumps(
            load_curriculum_record(curriculum_directory=directory)["validation"]
        )
    )


def test_a_blocked_course_does_not_stop_a_valid_candidate_being_used(tmp_path):
    directory = _write_fixture(
        tmp_path,
        _fixture_document(
            [
                ("s1", [_fixture_course("ANCHOR", skills=["python"])]),
                (
                    "s2",
                    [
                        _fixture_course(
                            "GOOD",
                            prerequisites={"recorded": True, "course_ids": ["ANCHOR"]},
                        )
                    ],
                ),
                (
                    "s3",
                    [
                        _fixture_course(
                            "BROKEN",
                            prerequisites={
                                "recorded": True,
                                "course_ids": ["ANCHOR", "GHOST-1"],
                            },
                        )
                    ],
                ),
            ],
            record_id="mixed_record",
        ),
    )

    record = _by_skill(
        build_role_curriculum_recommendations(
            "data_science", curriculum_directory=directory
        ),
        "pandas",
    )

    assert record["placement_status"] == PLACEMENT_STATUS_PLACED
    assert record["target_course"]["course_id"] == "GOOD"
    assert record["recorded_candidate_courses"] == ["BROKEN", "GOOD"]
    codes = _limitation_codes(record)
    assert "candidate_courses_excluded" in codes
    assert "BROKEN" in record["reason"] or any(
        "BROKEN" in limitation["note"]
        for limitation in record["evidence_limitations"]
    )


def test_an_unusable_anchor_course_blocks_the_placement(tmp_path):
    directory = _write_fixture(
        tmp_path,
        _fixture_document(
            [
                (
                    "s1",
                    [
                        _fixture_course(
                            "ANCHOR",
                            skills=["python"],
                            prerequisites={
                                "recorded": True,
                                "course_ids": ["GHOST-2"],
                            },
                        )
                    ],
                ),
                (
                    "s2",
                    [
                        _fixture_course(
                            "AFTER",
                            prerequisites={"recorded": True, "course_ids": ["ANCHOR"]},
                        )
                    ],
                ),
            ],
            record_id="dangling_anchor_record",
        ),
    )

    record = _by_skill(
        build_role_curriculum_recommendations(
            "data_science", curriculum_directory=directory
        ),
        "pandas",
    )

    assert record["placement_status"] == PLACEMENT_STATUS_BLOCKED_DANGLING
    assert record["prerequisite_status"] == PREREQUISITE_STATUS_DANGLING
    assert record["target_semester"] is None and record["target_course"] is None
    assert "ANCHOR" in record["reason"]


def test_a_blocked_teaching_course_does_not_block_a_usable_one_for_the_same_skill(
    tmp_path,
):
    # python is taught by ANCHOR (unusable, dangling) and ANCHOR-2 (usable), so the
    # chain still resolves through ANCHOR-2 and the placement is not blocked.
    directory = _write_fixture(
        tmp_path,
        _fixture_document(
            [
                (
                    "s1",
                    [
                        _fixture_course(
                            "ANCHOR",
                            skills=["python"],
                            prerequisites={
                                "recorded": True,
                                "course_ids": ["GHOST-3"],
                            },
                        ),
                        _fixture_course("ANCHOR-2", skills=["python"]),
                    ],
                ),
                (
                    "s2",
                    [
                        _fixture_course(
                            "AFTER",
                            prerequisites={"recorded": True, "course_ids": ["ANCHOR-2"]},
                        )
                    ],
                ),
            ],
            record_id="partly_usable_anchor_record",
        ),
    )

    record = _by_skill(
        build_role_curriculum_recommendations(
            "data_science", curriculum_directory=directory
        ),
        "pandas",
    )

    assert record["placement_status"] == PLACEMENT_STATUS_PLACED
    assert record["prerequisite_status"] == PREREQUISITE_STATUS_RESOLVED
    assert record["target_course"]["course_id"] == "AFTER"
    chain = {entry["prerequisite"]: entry for entry in record["prerequisite_chain"]}
    assert chain["python"]["recorded_courses"] == ["ANCHOR", "ANCHOR-2"]
    assert chain["python"]["usable_courses"] == ["ANCHOR-2"]
    assert chain["python"]["excluded_courses"] == ["ANCHOR"]


def test_a_dangling_candidate_is_reported_ahead_of_a_cyclic_one(tmp_path):
    # Both recorded candidates are unusable. A dangling reference is the harder
    # recorded fact, so it decides both the placement and the prerequisite status.
    directory = _write_fixture(
        tmp_path,
        _fixture_document(
            [
                (
                    "s1",
                    [
                        _fixture_course("ANCHOR", skills=["python"]),
                        _fixture_course(
                            "CYCLE-A",
                            prerequisites={
                                "recorded": True,
                                "course_ids": ["ANCHOR", "CYCLE-B"],
                            },
                        ),
                        _fixture_course(
                            "CYCLE-B",
                            prerequisites={"recorded": True, "course_ids": ["CYCLE-A"]},
                        ),
                    ],
                ),
                (
                    "s2",
                    [
                        _fixture_course(
                            "DANGLING-TARGET",
                            prerequisites={
                                "recorded": True,
                                "course_ids": ["ANCHOR", "GHOST-4"],
                            },
                        ),
                    ],
                ),
            ],
            record_id="mixed_blocker_record",
        ),
    )

    record = _by_skill(
        build_role_curriculum_recommendations(
            "data_science", curriculum_directory=directory
        ),
        "pandas",
    )

    assert record["placement_status"] == PLACEMENT_STATUS_BLOCKED_DANGLING
    assert record["prerequisite_status"] == PREREQUISITE_STATUS_DANGLING
    assert record["target_semester"] is None and record["target_course"] is None
    # Neither course was repaired, dropped, or singled out as the cause.
    assert record["recorded_candidate_courses"] == [
        "CYCLE-A",
        "DANGLING-TARGET",
    ]
    assert "GHOST-4" in record["reason"]
    assert "CYCLE-A requires another course on the same recorded prerequisite cycle" in record["reason"]


# -------------------------------------------------- 5. a recorded prerequisite cycle
def test_a_prerequisite_cycle_blocks_the_placement_and_is_not_repaired(tmp_path):
    directory = _write_fixture(
        tmp_path,
        _fixture_document(
            [
                (
                    "s1",
                    [
                        _fixture_course(
                            "CYCLE-A",
                            skills=["python"],
                            prerequisites={"recorded": True, "course_ids": ["CYCLE-B"]},
                        ),
                        _fixture_course(
                            "CYCLE-B",
                            prerequisites={"recorded": True, "course_ids": ["CYCLE-A"]},
                        ),
                    ],
                ),
                (
                    "s2",
                    [
                        _fixture_course(
                            "AFTER",
                            prerequisites={"recorded": True, "course_ids": ["CYCLE-A"]},
                        )
                    ],
                ),
            ],
            record_id="cyclic_record",
        ),
    )

    payload = build_role_curriculum_recommendations(
        "data_science", curriculum_directory=directory
    )
    record = _by_skill(payload, "pandas")

    assert record["placement_status"] == PLACEMENT_STATUS_BLOCKED_CYCLE
    assert record["prerequisite_status"] == PREREQUISITE_STATUS_CYCLE
    assert record["recommendation_status"] == RECOMMENDATION_STATUS_UNPLACED
    assert record["target_semester"] is None and record["target_course"] is None
    assert "CYCLE-A" in record["reason"]
    # The cycle is published as recorded and no edge or course was removed.
    assert payload["validation"]["prerequisite_cycles"] == [
        ["CYCLE-A", "CYCLE-B", "CYCLE-A"]
    ]
    assert payload["validation"]["cycle_course_ids"] == ["CYCLE-A", "CYCLE-B"]
    assert {semester["courses"][0] for semester in payload["curriculum"]["semesters"]} == {
        "CYCLE-A",
        "AFTER",
    }


# --------------------------------------------- 6. insufficient placement evidence
def test_a_prerequisite_the_curriculum_does_not_teach_leaves_the_chain_unresolved(
    data_science,
):
    record = _by_skill(data_science, "generative ai")

    assert record["prerequisites"] == ["llm", "python"]
    assert record["prerequisite_status"] == PREREQUISITE_STATUS_SKILL_ABSENT
    assert record["placement_status"] == PLACEMENT_STATUS_INSUFFICIENT_DATA
    assert record["target_semester"] is None and record["target_course"] is None
    assert "prerequisite_skill_absent_from_curriculum" in _limitation_codes(record)
    # python is in the curriculum and llm is not, so only the absent one is named as
    # unresolved even though both are listed as recorded prerequisites.
    notes = [
        limitation["note"]
        for limitation in record["evidence_limitations"]
        if limitation["code"] == "prerequisite_skill_absent_from_curriculum"
    ]
    assert len(notes) == 1
    assert "'llm'" in notes[0]
    assert "'python'" not in notes[0]
    assert "records 'llm', 'python' as prerequisites" in record["reason"]


def test_a_near_miss_prerequisite_name_is_not_joined(backend_ml):
    record = _by_skill(backend_ml, "mongodb")

    # Stage 7 records the prerequisite "databases"; the curriculum teaches
    # "database". The names do not match exactly, so nothing is placed and the
    # reference is not resolved to the similar name.
    assert record["prerequisites"] == ["databases"]
    assert record["prerequisite_status"] == PREREQUISITE_STATUS_SKILL_ABSENT
    assert record["placement_status"] == PLACEMENT_STATUS_INSUFFICIENT_DATA
    assert record["target_course"] is None


def test_a_corpus_only_role_names_no_semester_for_any_gap(corpus_only):
    assert corpus_only["industry"]["plannable"] is False
    assert corpus_only["summary"]["gap_count"] == 9
    assert corpus_only["summary"]["placed_count"] == 0
    assert corpus_only["summary"]["insufficient_data_count"] == 9
    for record in corpus_only["recommendations"]:
        assert record["target_semester"] is None
        assert "corpus_only_role" in _limitation_codes(record)


# --------------------------------------------------- 7. no_industry_record excluded
def test_a_curriculum_skill_stage_seven_never_recorded_is_not_recommended(data_science):
    excluded = data_science["excluded"]["no_industry_record"]

    assert excluded["skills"] == ["git"]
    assert excluded["count"] == 1
    assert "no industry evidence" in excluded["reason"]
    assert _absent(data_science, "git")


def test_a_skill_with_no_industry_evidence_is_never_claimed_as_a_gap(data_science):
    industry_skills = {
        row["skill"]
        for row in build_role_curriculum_intelligence("data_science")["skills"]
    }
    for skill in data_science["excluded"]["no_industry_record"]["skills"]:
        assert skill not in industry_skills


# -------------------------------------------- 8. unmatched curriculum skill excluded
def test_an_unmatched_curriculum_skill_is_not_recommended(data_science):
    excluded = data_science["excluded"]["unmatched_curriculum_skill"]

    assert excluded["skills"] == ["on-device inference"]
    assert "does not join the shared vocabulary" in excluded["reason"]
    assert _absent(data_science, "on-device inference")


def test_an_unmatched_skill_is_not_resolved_to_a_similar_industry_skill(data_science):
    assert _absent(data_science, "on-device inference")
    # It also never becomes a gap of its own.
    assert all(
        record["coverage_status"] != "unmatched_curriculum_skill"
        for record in data_science["recommendations"]
    )


def test_a_covered_skill_is_excluded_because_it_is_not_a_gap(data_science):
    excluded = data_science["excluded"]["covered_skill"]

    assert excluded["count"] == 8
    assert "python" in excluded["skills"] and "deep learning" in excluded["skills"]
    assert "already records this skill" in excluded["reason"]
    for skill in excluded["skills"]:
        assert _absent(data_science, skill)


# ------------------------------------------- 9. existing course/semester structure
def test_every_placement_points_at_an_existing_semester_and_course(data_science):
    semesters = {
        semester["semester_id"]: semester
        for semester in data_science["curriculum"]["semesters"]
    }
    for record in _placed(data_science):
        semester = semesters[record["target_semester"]["semester_id"]]
        course_id = record["target_course"]["course_id"]

        assert record["target_semester"]["academic_year_id"] == (
            semester["academic_year_id"]
        )
        assert course_id in semester["courses"]
        # The named prerequisite is itself a course of the same record.
        for prerequisite in record["target_course"]["recorded_prerequisites"]:
            assert prerequisite in {
                candidate
                for entry in data_science["curriculum"]["semesters"]
                for candidate in entry["courses"]
            }


def test_the_echoed_structure_matches_the_coverage_endpoint(data_science):
    coverage = build_curriculum_coverage("data_science")

    assert [
        (entry["academic_year_id"], entry["semester_id"])
        for entry in data_science["curriculum"]["semesters"]
    ] == [
        (entry["academic_year_id"], entry["semester_id"])
        for entry in coverage["semesters"]
    ]
    assert [
        entry["courses"] for entry in data_science["curriculum"]["semesters"]
    ] == [
        [course["course_id"] for course in entry["courses"]]
        for entry in coverage["semesters"]
    ]


def test_the_recorded_structure_is_unchanged_by_this_stage(data_science):
    record = load_curriculum_record()

    assert data_science["record_id"] == record["record_id"]
    assert data_science["curriculum"]["semester_count"] == record["counts"]["semesters"]
    assert data_science["curriculum"]["course_count"] == record["counts"]["courses"] == 9
    assert [semester["course_count"] for semester in data_science["curriculum"]["semesters"]] == [
        3,
        2,
        2,
        2,
    ]


def test_no_recommendation_invents_a_semester_or_course(data_science):
    semester_ids = {
        semester["semester_id"] for semester in data_science["curriculum"]["semesters"]
    }
    course_ids = {
        course_id
        for semester in data_science["curriculum"]["semesters"]
        for course_id in semester["courses"]
    }
    for record in data_science["recommendations"]:
        if record["placement_status"] != PLACEMENT_STATUS_PLACED:
            assert record["target_semester"] is None
            assert record["target_course"] is None
            continue
        assert record["target_semester"]["semester_id"] in semester_ids
        assert record["target_course"]["course_id"] in course_ids
        for candidate in record["recorded_candidate_courses"]:
            assert candidate in course_ids


def test_credits_and_hours_on_a_placed_course_are_copied_never_invented(data_science):
    record = _by_skill(data_science, "pandas")

    # The demo record records no credits or hours on DEMO-103, and none appear.
    assert record["target_course"]["credits"] is None
    assert record["target_course"]["hours"] is None
    assert record["target_semester"]["sequence"] is None


def test_this_stage_proposes_no_curriculum_revision(data_science):
    assert data_science["stage_boundary"] == {
        "curriculum_revision": "not_proposed",
        "new_course_or_semester": "not_proposed",
        "credit_or_capacity_budget": "not_proposed",
    }
    assert "curriculum_revision_recommendation" in data_science["not_available"]
    assert "new_course" in data_science["not_available"]
    assert "new_semester" in data_science["not_available"]


# -------------------------------------------------------- 10. role switching
def test_switching_roles_changes_the_recommendation_set(data_science, backend_ml):
    assert {record["skill"] for record in data_science["recommendations"]} != {
        record["skill"] for record in backend_ml["recommendations"]
    }
    assert data_science["summary"]["gap_count"] == 37
    assert backend_ml["summary"]["gap_count"] == 24
    assert data_science["role_category"] == "data_science"
    assert backend_ml["role_category"] == "backend_ml_engineer"


def test_role_specific_placement_only_happens_where_the_evidence_supports_it(backend_ml):
    # pandas is a data_science gap and is placed there; for this role it is not even
    # an industry skill, so it cannot be recommended at all.
    assert _absent(backend_ml, "pandas")
    assert backend_ml["summary"]["placed_count"] == 0
    for record in backend_ml["recommendations"]:
        assert record["target_semester"] is None


def test_coverage_is_a_property_of_the_curriculum_not_of_the_role(
    data_science, backend_ml
):
    # python is taught by this curriculum for both roles, but only data_science's
    # industry data records it. Either way it is excluded rather than recommended,
    # because a course already records it.
    assert "python" in data_science["excluded"]["covered_skill"]["skills"]
    assert "python" in backend_ml["excluded"]["covered_skill"]["skills"]
    assert _absent(backend_ml, "python")


@pytest.mark.parametrize("role", ROLES)
def test_every_known_role_builds_without_error(role):
    payload = build_role_curriculum_recommendations(role)

    assert payload["role_category"] == role
    assert payload["placement_basis"] == PLACEMENT_BASIS
    assert payload["summary"]["recommendation_count"] == payload["summary"]["gap_count"]


# ------------------------------------------------------- 11. unknown role
def test_unknown_role_raises_with_the_roles_the_artifacts_record():
    with pytest.raises(UnknownTargetRoleError) as error:
        build_role_curriculum_recommendations("embedded_systems_engineer")
    assert set(error.value.valid_roles) == set(ROLES)


def test_unknown_role_over_http_is_422_listing_valid_roles():
    response = client.get("/curriculum-recommendations/embedded_systems_engineer")

    assert response.status_code == 422
    detail = response.json()["detail"]
    assert set(detail["valid_roles"]) == set(ROLES)
    assert "embedded_systems_engineer" in detail["message"]


def test_unknown_role_is_rejected_exactly_like_the_other_role_routes():
    style = {
        route: client.get(f"{route}/embedded_systems_engineer").json()["detail"]
        for route in ("/curriculum-gaps", "/curriculum-intelligence", "/curriculum-coverage")
    }
    style["/curriculum-recommendations"] = client.get(
        "/curriculum-recommendations/embedded_systems_engineer"
    ).json()["detail"]

    for detail in style.values():
        assert set(detail["valid_roles"]) == set(ROLES)
        assert "embedded_systems_engineer" in detail["message"]


@pytest.mark.parametrize("role", ROLES)
def test_role_endpoint_serves_json(role):
    response = client.get(f"/curriculum-recommendations/{role}")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/json")
    assert response.json()["role_category"] == role


def test_the_endpoint_serves_the_builder_output_exactly():
    direct = build_role_curriculum_recommendations("backend_ml_engineer")
    body = client.get("/curriculum-recommendations/backend_ml_engineer").json()

    assert body == json.loads(json.dumps(direct))


# ------------------------------------------------------ 12. deterministic output
def test_repeated_builds_are_byte_identical():
    first = json.dumps(build_role_curriculum_recommendations("data_science"), sort_keys=True)
    second = json.dumps(build_role_curriculum_recommendations("data_science"), sort_keys=True)

    assert first == second


def test_a_fixture_build_matches_the_module_build(data_science, data_science_text):
    assert data_science_text == json.dumps(
        build_role_curriculum_recommendations("data_science"), sort_keys=True
    )


def test_repeated_requests_are_byte_identical():
    first = client.get("/curriculum-recommendations/data_science").text
    second = client.get("/curriculum-recommendations/data_science").text

    assert first == second


def test_recommendation_order_inherits_stage_seven_order(data_science):
    industry_order = [
        row["skill"]
        for row in build_role_curriculum_intelligence("data_science")["skills"]
    ]
    recommended = [record["skill"] for record in data_science["recommendations"]]

    # Stage 8D adds no ordering of its own: this is Stage 7's sequence filtered to
    # the gaps, and the sequence itself is not treated as a ranking.
    assert recommended == [
        skill for skill in industry_order if skill in set(recommended)
    ]


def test_every_ordering_within_a_recommendation_is_sorted(data_science):
    for record in data_science["recommendations"]:
        candidates = record["recorded_candidate_courses"]
        assert candidates == sorted(candidates)
        for entry in record["prerequisite_chain"]:
            assert entry["recorded_courses"] == sorted(entry["recorded_courses"])
            assert entry["usable_courses"] == sorted(entry["usable_courses"])
            assert entry["excluded_courses"] == sorted(entry["excluded_courses"])


def test_the_excluded_lists_are_alphabetical(data_science):
    for group in data_science["excluded"].values():
        assert group["skills"] == sorted(group["skills"])


def test_the_echoed_structure_is_in_the_records_own_order(data_science):
    assert [
        (semester["semester_id"], tuple(semester["courses"]))
        for semester in data_science["curriculum"]["semesters"]
    ] == [
        ("2026-2027-s1", ("DEMO-101", "DEMO-102", "DEMO-206")),
        ("2026-2027-s2", ("DEMO-103", "DEMO-204")),
        ("2027-2028-s1", ("DEMO-201", "DEMO-203")),
        ("2027-2028-s2", ("DEMO-202", "DEMO-205")),
    ]


# ----------------------------------------------------- 13. demo status preserved
def test_the_demo_disclaimer_and_label_survive(data_science):
    record = load_curriculum_record()

    assert data_science["is_demo"] is True
    assert data_science["disclaimer"] == record["disclaimer"]
    assert data_science["curriculum"]["record_kind"] == "demonstration"
    assert "demonstration" in record["label"].casefold()


def test_every_recommendation_is_flagged_as_demo_derived(data_science):
    for record in data_science["recommendations"]:
        assert "curriculum_record_is_demo" in _limitation_codes(record)


def test_the_industry_caveats_are_carried_through(data_science):
    assert data_science["industry"]["velocity_reproducibility"]["status"] == "pass"
    assert data_science["industry"]["evidence"]
    for proof in data_science["industry"]["evidence"]:
        assert "caveats" in proof
    assert data_science["industry"]["plannable"] is True


def test_the_recorded_defects_are_carried_through_verbatim(data_science):
    record = load_curriculum_record()

    assert data_science["validation"] == json.loads(json.dumps(record["validation"]))
    assert data_science["validation"]["dangling_prerequisites"] == [
        {"course_id": "DEMO-205", "prerequisite_course_id": "DEMO-999"}
    ]
    assert data_science["validation"]["unmatched_skills"] == [
        {"course_id": "DEMO-203", "skill": "on-device inference", "input_skill": "on-device inference"}
    ]


def test_the_recorded_dangling_prerequisite_is_never_used_as_a_placement_target(
    data_science,
):
    used = {
        record["target_course"]["course_id"]
        for record in _placed(data_science)
        if record["target_course"]
    }
    assert "DEMO-205" not in used
    for record in data_science["recommendations"]:
        assert "DEMO-205" not in record["recorded_candidate_courses"]


def test_the_basis_fields_state_what_was_used(data_science):
    assert data_science["coverage_basis"] == "normalized_skill_exact_match"
    assert data_science["placement_basis"] == PLACEMENT_BASIS == (
        "recorded_prerequisite_course_alignment"
    )
    assert data_science["prerequisite_basis"] == "recorded_prerequisite_edges_only"
    assert data_science["prerequisite_join"] == "normalized_skill_exact_match"
    assert data_science["ordering_basis"].startswith("recorded_curriculum_order")
    assert len(data_science["placement_rules"]) == 12


# -------------------------------------------------- no invented analytics
def test_no_score_rank_priority_or_percentage_is_invented(data_science):
    forbidden = {
        "score",
        "gap_score",
        "priority",
        "rank",
        "weight",
        "confidence",
        "coverage_percentage",
        "growth_percentage",
        "gap_percentage",
        "recommendation_score",
        "placement_confidence",
    }

    def walk(node, path="body"):
        # Stage 7's own evidence block is copied verbatim and is checked against
        # Stage 7 directly instead.
        if "industry_evidence" in path:
            return
        if isinstance(node, dict):
            for key, value in node.items():
                assert key.lower() not in forbidden, f"invented field {path}.{key}"
                walk(value, f"{path}.{key}")
        elif isinstance(node, list):
            for index, value in enumerate(node):
                walk(value, f"{path}[{index}]")

    walk(data_science)


def test_the_summary_reports_counts_only(data_science):
    summary = data_science["summary"]

    assert summary["recommendation_count"] == 37
    assert summary["placed_count"] == len(_placed(data_science))
    assert summary["placed_count"] + summary["insufficient_data_count"] + summary[
        "blocked_count"
    ] == summary["recommendation_count"]
    assert sum(summary["by_placement_status"].values()) == summary["recommendation_count"]
    assert sum(summary["by_prerequisite_status"].values()) == summary["recommendation_count"]


def test_not_available_declares_what_this_stage_still_cannot_serve(data_science):
    for field in (
        "gap_score",
        "gap_priority",
        "gap_rank",
        "recommendation_score",
        "recommendation_priority",
        "recommendation_rank",
        "placement_confidence",
        "credit_budget",
        "semester_capacity",
        "learning_hours_scheduled",
        "coverage_percentage",
        "industry_growth_percentage",
    ):
        assert field in data_science["not_available"]
    # What this stage does serve is no longer declared unavailable.
    for field in ("semester_placement", "course_recommendation"):
        assert field not in data_science["not_available"]


def test_the_placement_rules_are_published_and_reference_only_recorded_facts(
    data_science,
):
    rules = " ".join(data_science["placement_rules"])

    assert "is_gap true" in rules
    assert "exact normalized name match" in rules
    assert "never added, removed, or inferred" in rules
    assert "structural position, not a ranking" in rules
    assert "Nothing is scored, weighted, ranked" in rules
    assert "null, and no hours are scheduled" in rules


# ------------------------------------------------- 14. existing endpoint regression
def test_curriculum_gaps_is_unchanged(data_science):
    direct = build_role_curriculum_gaps("data_science")
    body = client.get("/curriculum-gaps/data_science").json()

    assert body == json.loads(json.dumps(direct))
    # Stage 8C still declares placement as this stage's job, not its own.
    assert body["stage_boundary"]["semester_placement"] == "stage_8d"


def test_recommendations_agree_with_gaps_on_which_skills_are_recommended(data_science):
    gaps = build_role_curriculum_gaps("data_science")
    recommended = {record["skill"] for record in data_science["recommendations"]}

    assert recommended == {gap["skill"] for gap in gaps["gaps"]}
    assert recommended.isdisjoint(
        {record["skill"] for record in gaps["covered_skills"]}
    )
    assert recommended.isdisjoint(
        {record["skill"] for record in gaps["no_industry_record"]}
    )
    assert recommended.isdisjoint(
        {record["skill"] for record in gaps["unmatched_curriculum_skills"]}
    )


def test_curriculum_intelligence_is_unchanged():
    direct = build_role_curriculum_intelligence("data_science")
    body = client.get("/curriculum-intelligence/data_science").json()

    assert body == json.loads(json.dumps(direct))


def test_curriculum_coverage_is_unchanged():
    direct = build_curriculum_coverage("data_science")
    body = client.get("/curriculum-coverage/data_science").json()

    assert body == json.loads(json.dumps(direct))


def test_curriculum_record_is_unchanged():
    response = client.get("/curriculum-record")

    assert response.status_code == 200
    assert response.json()["record_id"] == "demo_curriculum_v1"


def test_earlier_endpoints_still_answer():
    assert client.get("/health").json() == {"status": "ok"}
    assert client.get("/velocity/statistical analysis").status_code == 200
    assert client.get("/proofs").status_code == 200
    assert client.get("/vendor-flags").json() == []
"""Read-only access to the finalized Notebook 1-5 artifacts.

This module locates ``backend/data/artifacts`` relative to this file, decodes
each artifact, and returns plain Python dicts and lists. It reconciles nothing
with the engines in ``backend/engines``: skill names, role scoping, learning
hours, prerequisites, velocity scores, and proof shapes are returned exactly as
the artifacts record them.

Nothing here writes to, moves, or rewrites an artifact. Nothing here imports an
engine, and no engine or API module imports this layer.

Decoding is deliberately shallow. Top-level keys of JSON objects and the
container type of every artifact are checked, so truncation or corruption raises
a typed error, but nested record schemas are not frozen here; they belong to the
notebooks that produce them.

Known future adapter requirements, recorded by the artifact audit and
deliberately unresolved in this stage:

* **Vocabulary.** The artifacts carry 64 distinct skills. ``SKILL_CATALOG``
  carries 40 and only 17 names overlap. A future integration needs an explicit
  alias and normalization bridge; no aliasing happens in this module.
* **Role scoping.** ``cleaned_postings``, ``skill_scores``, ``velocity_scores``,
  and ``hours_per_skill`` are keyed by ``role_category`` plus skill, and
  ``dag_structure`` is keyed by role. The engines are role-agnostic and
  skill-keyed, so a role resolution step is required.
* **Learning hours.** ``hours_per_skill`` is role-scoped while ``LEARNING_HOURS``
  is a flat skill-keyed map, and the two disagree for 6 of the 13 shared skill
  names. 6 of the 22 artifact hour values equal ``DEFAULT_LEARNING_HOURS``, so
  those are currently indistinguishable from the fallback.
* **Prerequisites.** ``dag_structure`` is role-scoped and disagrees with
  ``PREREQUISITE_MAP`` for data_science machine learning and deep learning and
  for backend_ml_engineer react. ``backend_ml_engineer`` django requires
  ``python``, which is not a node in that role's graph, so wiring the DAG in
  unchanged would leave django permanently unlearnable under ``_can_learn``.
* **Velocity.** ``velocity_scores`` stores a bounded score in [-1, 1] plus a
  ``"start -> end"`` slice-pair string. ``compute_velocity`` consumes ordered
  ``{period, count}`` observations and returns baseline, latest, absolute,
  percentage, and trend. There is no per-period count data to build a history.
* **Proof serialization.** ``proof_b_results``, ``proof_c_results``, and
  ``proof_e_example`` have three different top-level shapes, while ``/proofs``
  returns ``list[dict]``.
"""

import datetime
import json
from collections.abc import Callable
from pathlib import Path
from typing import Optional, TypedDict

import pyarrow.parquet as parquet


ARTIFACT_DIRECTORY_NAME = "artifacts"

ARTIFACT_NAMES: tuple[str, ...] = (
    "cleaned_postings.parquet",
    "skill_scores.parquet",
    "thresholds.json",
    "velocity_scores.parquet",
    "backtest_chart_data.json",
    "hours_per_skill.json",
    "dag_structure.json",
    "proof_e_example.json",
    "example_curricula.json",
    "proof_b_results.json",
    "proof_c_results.json",
)


class ArtifactError(Exception):
    """Base error for every artifact loading failure."""


class ArtifactNotFoundError(ArtifactError, FileNotFoundError):
    """Raised when an expected artifact file is absent."""


class ArtifactParseError(ArtifactError, ValueError):
    """Raised when an artifact exists but cannot be decoded."""


class ArtifactStructureError(ArtifactError, ValueError):
    """Raised when a decoded artifact lacks its expected top-level shape."""


class Posting(TypedDict):
    job_id: str
    title: str
    company: str
    posted_date: datetime.datetime
    source: str
    skills: list[str]
    role_category: str


class SkillScore(TypedDict):
    role_category: str
    skill: str
    frequency: float
    classification: str


class VelocityScore(TypedDict):
    role_category: str
    skill: str
    velocity_score: float
    time_slices_used: str


class HoursPerSkill(TypedDict):
    role_category: str
    skill: str
    hours: int
    source: str


class SkillVocabulary(TypedDict):
    skills: list[str]
    by_role: dict[str, list[str]]
    by_artifact: dict[str, list[str]]


def artifacts_directory() -> Path:
    """Return the directory holding the finalized artifacts."""
    return Path(__file__).resolve().parent / ARTIFACT_DIRECTORY_NAME


def list_artifact_names(*, directory: Optional[Path] = None) -> list[str]:
    """Return the artifact file names actually present, sorted."""
    base = _base_directory(directory)
    return sorted(path.name for path in base.iterdir() if path.is_file())


def missing_artifact_names(*, directory: Optional[Path] = None) -> list[str]:
    """Return the expected artifact names that are not present, sorted."""
    present = set(list_artifact_names(directory=directory))
    return sorted(name for name in ARTIFACT_NAMES if name not in present)


def unexpected_artifact_names(*, directory: Optional[Path] = None) -> list[str]:
    """Return the present file names that are not expected artifacts, sorted."""
    expected = set(ARTIFACT_NAMES)
    return sorted(
        name for name in list_artifact_names(directory=directory) if name not in expected
    )


def artifact_path(name: str, *, directory: Optional[Path] = None) -> Path:
    """Return the path of an artifact, raising if it is not a readable file."""
    base = _base_directory(directory)
    path = base / name
    if not path.is_file():
        raise ArtifactNotFoundError(
            f"Artifact {name!r} was not found at {path}. "
            f"Expected the finalized Notebook 1-5 artifacts in {base}."
        )
    return path


def load_json_artifact(name: str, *, directory: Optional[Path] = None) -> object:
    """Decode a JSON artifact and return it as plain Python data."""
    path = artifact_path(name, directory=directory)
    try:
        text = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError) as error:
        raise ArtifactParseError(
            f"Artifact {name!r} at {path} could not be read as UTF-8 text: {error}"
        ) from error
    try:
        return json.loads(text)
    except json.JSONDecodeError as error:
        raise ArtifactParseError(
            f"Artifact {name!r} at {path} is not valid JSON: {error}"
        ) from error


def load_parquet_artifact(
    name: str, *, directory: Optional[Path] = None
) -> list[dict[str, object]]:
    """Decode a Parquet artifact into one plain dict per row."""
    path = artifact_path(name, directory=directory)
    try:
        table = parquet.read_table(path)
    except Exception as error:
        raise ArtifactParseError(
            f"Artifact {name!r} at {path} is not readable Parquet: {error}"
        ) from error
    return [_plain_row(row) for row in table.to_pylist()]


def load_cleaned_postings(
    *, directory: Optional[Path] = None
) -> list[Posting]:
    """Return the Notebook 1 cleaned postings, one dict per posting."""
    return load_parquet_artifact("cleaned_postings.parquet", directory=directory)


def load_skill_scores(*, directory: Optional[Path] = None) -> list[SkillScore]:
    """Return the Notebook 2 per-role skill frequencies and classifications."""
    return load_parquet_artifact("skill_scores.parquet", directory=directory)


def load_thresholds(*, directory: Optional[Path] = None) -> dict[str, object]:
    """Return the Notebook 2 frequency and similarity thresholds."""
    return _expect_object(
        load_json_artifact("thresholds.json", directory=directory),
        "thresholds.json",
        ("core_min_frequency", "noise_max_frequency", "similarity_cutoff"),
    )


def load_velocity_scores(
    *, directory: Optional[Path] = None
) -> list[VelocityScore]:
    """Return the Notebook 3 per-role velocity scores and their time slices."""
    return load_parquet_artifact("velocity_scores.parquet", directory=directory)


def load_backtest_chart_data(
    *, directory: Optional[Path] = None
) -> dict[str, object]:
    """Return the Notebook 3 backtest dataset bounds and chart rows."""
    return _expect_object(
        load_json_artifact("backtest_chart_data.json", directory=directory),
        "backtest_chart_data.json",
        ("dataset_rows", "date_min", "date_max", "usable_slices"),
    )


def load_hours_per_skill(
    *, directory: Optional[Path] = None
) -> list[HoursPerSkill]:
    """Return the Notebook 4 role-scoped learning-hour estimates."""
    return _expect_records(
        load_json_artifact("hours_per_skill.json", directory=directory),
        "hours_per_skill.json",
    )


def load_dag_structure(
    *, directory: Optional[Path] = None
) -> dict[str, dict[str, list[str]]]:
    """Return the Notebook 4 role-scoped skill to prerequisite mapping."""
    roles = _expect_object(
        load_json_artifact("dag_structure.json", directory=directory),
        "dag_structure.json",
        (),
    )
    for role, nodes in roles.items():
        if not isinstance(nodes, dict):
            raise ArtifactStructureError(
                f"Artifact 'dag_structure.json' role {role!r} must map skills to "
                f"prerequisite lists, got {type(nodes).__name__}."
            )
        for skill, prerequisites in nodes.items():
            if not isinstance(prerequisites, list) or not all(
                isinstance(item, str) for item in prerequisites
            ):
                raise ArtifactStructureError(
                    f"Artifact 'dag_structure.json' node {role!r}/{skill!r} must be a "
                    "list of prerequisite skill names."
                )
    return roles


def load_proof_e_example(
    *, directory: Optional[Path] = None
) -> dict[str, object]:
    """Return the Notebook 4 budget-sensitivity proof example."""
    return _expect_object(
        load_json_artifact("proof_e_example.json", directory=directory),
        "proof_e_example.json",
        (),
    )


def load_example_curricula(
    *, directory: Optional[Path] = None
) -> list[dict[str, object]]:
    """Return the Notebook 5 example curriculum records."""
    return _expect_records(
        load_json_artifact("example_curricula.json", directory=directory),
        "example_curricula.json",
    )


def load_proof_b_results(*, directory: Optional[Path] = None) -> dict[str, object]:
    """Return the Notebook 5 external-reference overlap results."""
    return _expect_object(
        load_json_artifact("proof_b_results.json", directory=directory),
        "proof_b_results.json",
        ("reference_description", "reference_urls", "results", "summary"),
    )


def load_proof_c_results(*, directory: Optional[Path] = None) -> dict[str, object]:
    """Return the Notebook 5 naive-versus-signal benchmark results."""
    return _expect_object(
        load_json_artifact("proof_c_results.json", directory=directory),
        "proof_c_results.json",
        ("benchmark_type", "warning", "n_cases", "naive", "signal_engine", "cases"),
    )


def load_skill_vocabulary(
    *, directory: Optional[Path] = None
) -> SkillVocabulary:
    """Report which skill names the artifacts use, without aliasing them.

    The result is a union, not an intersection: skills the backend catalog does
    not know are reported rather than dropped or mapped onto a catalog name.
    """
    postings = load_cleaned_postings(directory=directory)
    scores = load_skill_scores(directory=directory)
    velocities = load_velocity_scores(directory=directory)
    hours = load_hours_per_skill(directory=directory)
    dag = load_dag_structure(directory=directory)

    by_artifact: dict[str, list[str]] = {
        "cleaned_postings.parquet": sorted(
            {skill for posting in postings for skill in posting["skills"]}
        ),
        "skill_scores.parquet": sorted({row["skill"] for row in scores}),
        "velocity_scores.parquet": sorted({row["skill"] for row in velocities}),
        "hours_per_skill.json": sorted({row["skill"] for row in hours}),
        "dag_structure.json": sorted(
            {skill for nodes in dag.values() for skill in nodes}
        ),
    }

    by_role: dict[str, set[str]] = {}
    for record in (*scores, *velocities, *hours):
        by_role.setdefault(record["role_category"], set()).add(record["skill"])
    for role, nodes in dag.items():
        by_role.setdefault(role, set()).update(nodes)

    return {
        "skills": sorted({skill for skills in by_artifact.values() for skill in skills}),
        "by_role": {role: sorted(skills) for role, skills in sorted(by_role.items())},
        "by_artifact": dict(sorted(by_artifact.items())),
    }


def load_all_artifacts(*, directory: Optional[Path] = None) -> dict[str, object]:
    """Load every finalized artifact, keyed by file name in pipeline order."""
    return {name: loader(directory=directory) for name, loader in _ARTIFACT_LOADERS.items()}


def _base_directory(directory: Optional[Path]) -> Path:
    base = artifacts_directory() if directory is None else Path(directory)
    if not base.is_dir():
        raise ArtifactNotFoundError(
            f"Artifact directory {base} does not exist or is not a directory."
        )
    return base


def _plain_value(value: object) -> object:
    if isinstance(value, datetime.datetime):
        return datetime.datetime(
            value.year,
            value.month,
            value.day,
            value.hour,
            value.minute,
            value.second,
            value.microsecond,
            value.tzinfo,
        )
    if isinstance(value, list):
        return [_plain_value(item) for item in value]
    return value


def _plain_row(row: dict[str, object]) -> dict[str, object]:
    return {key: _plain_value(value) for key, value in row.items()}


def _expect_object(
    data: object, name: str, required_keys: tuple[str, ...]
) -> dict[str, object]:
    if not isinstance(data, dict):
        raise ArtifactStructureError(
            f"Artifact {name!r} must be a JSON object, got {type(data).__name__}."
        )
    missing = [key for key in required_keys if key not in data]
    if missing:
        raise ArtifactStructureError(
            f"Artifact {name!r} is missing required key(s): {', '.join(missing)}."
        )
    return data


def _expect_records(data: object, name: str) -> list[dict[str, object]]:
    if not isinstance(data, list):
        raise ArtifactStructureError(
            f"Artifact {name!r} must be a JSON array, got {type(data).__name__}."
        )
    for index, row in enumerate(data):
        if not isinstance(row, dict):
            raise ArtifactStructureError(
                f"Artifact {name!r} record {index} must be a JSON object, "
                f"got {type(row).__name__}."
            )
    return data


_ARTIFACT_LOADERS: dict[str, Callable[..., object]] = {
    "cleaned_postings.parquet": load_cleaned_postings,
    "skill_scores.parquet": load_skill_scores,
    "thresholds.json": load_thresholds,
    "velocity_scores.parquet": load_velocity_scores,
    "backtest_chart_data.json": load_backtest_chart_data,
    "hours_per_skill.json": load_hours_per_skill,
    "dag_structure.json": load_dag_structure,
    "proof_e_example.json": load_proof_e_example,
    "example_curricula.json": load_example_curricula,
    "proof_b_results.json": load_proof_b_results,
    "proof_c_results.json": load_proof_c_results,
}

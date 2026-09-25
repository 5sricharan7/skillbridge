"""Deterministic frequency and gap signals for technical job requirements.

A signal score is calculated as ``0.6 * min(jd_frequency / 5, 1) + 0.4``
when the skill is missing from the resume, or the frequency component alone
when it is present. The priority thresholds are critical for scores at least
0.75, important for scores at least 0.40, and supporting below 0.40. This is a
requirement signal based on the supplied resume and job description only.
"""

import re
from typing import TypedDict

from .skill_catalog import SKILL_CATALOG


_TOKEN_PATTERN = re.compile(r"[a-z0-9]+(?:\+\+|#)?")
_FREQUENCY_SATURATION = 5
_FREQUENCY_WEIGHT = 0.6
_GAP_WEIGHT = 0.4
_CRITICAL_THRESHOLD = 0.75
_IMPORTANT_THRESHOLD = 0.4


class SkillSignal(TypedDict):
    skill: str
    jd_frequency: int
    in_resume: bool
    gap: bool
    signal_score: float
    priority: str


def _tokenize(text: str) -> tuple[str, ...]:
    return tuple(_TOKEN_PATTERN.findall(text.casefold()))


def _build_matches() -> tuple[tuple[tuple[str, ...], str], ...]:
    matches: list[tuple[tuple[str, ...], str]] = []
    for skill, aliases in SKILL_CATALOG.items():
        for value in (skill, *aliases):
            tokens = _tokenize(value)
            match = (tokens, skill)
            if tokens and match not in matches:
                matches.append(match)
    return tuple(sorted(matches, key=lambda match: (-len(match[0]), match[1], match[0])))


_SKILL_MATCHES = _build_matches()


def _count_skill_occurrences(tokens: tuple[str, ...]) -> dict[str, int]:
    counts: dict[str, int] = {}
    start = 0
    while start < len(tokens):
        matched = False
        for term, skill in _SKILL_MATCHES:
            end = start + len(term)
            if tokens[start:end] == term:
                counts[skill] = counts.get(skill, 0) + 1
                start = end
                matched = True
                break
        if not matched:
            start += 1
    return counts


def extract_skills(text: str) -> list[str]:
    return sorted(_count_skill_occurrences(_tokenize(text)))


def _priority_label(signal_score: float) -> str:
    if signal_score >= _CRITICAL_THRESHOLD:
        return "critical"
    if signal_score >= _IMPORTANT_THRESHOLD:
        return "important"
    return "supporting"


def compute_skill_signals(
    resume_text: str, jd_text: str
) -> list[SkillSignal]:
    jd_counts = _count_skill_occurrences(_tokenize(jd_text))
    resume_skills = set(extract_skills(resume_text))
    signals: list[SkillSignal] = []

    for skill in sorted(jd_counts):
        jd_frequency = jd_counts[skill]
        in_resume = skill in resume_skills
        gap = not in_resume
        frequency_score = min(jd_frequency / _FREQUENCY_SATURATION, 1.0)
        signal_score = round(
            _FREQUENCY_WEIGHT * frequency_score
            + (_GAP_WEIGHT if gap else 0.0),
            2,
        )
        signals.append(
            {
                "skill": skill,
                "jd_frequency": jd_frequency,
                "in_resume": in_resume,
                "gap": gap,
                "signal_score": signal_score,
                "priority": _priority_label(signal_score),
            }
        )

    return sorted(signals, key=lambda signal: (-signal["signal_score"], signal["skill"]))


def extract_signals(resume_text: str, jd_text: str) -> list[SkillSignal]:
    return compute_skill_signals(resume_text, jd_text)

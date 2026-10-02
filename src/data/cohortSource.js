/**
 * Institution / Cohort Dashboard data boundary.
 *
 * The single seam between the cohort dashboard and its data. The component
 * imports this module and never calls `fetch` itself.
 *
 * There is deliberately **no demo mode here**. The service answers
 * `POST /cohort-analysis`, so Real is the only path: a demonstration dataset
 * would have to be a fabricated service response, and a fabricated cohort
 * compared against real recorded frequencies is exactly the number this product
 * must not show. A failed request stays a failure and is surfaced through
 * `describeCohortError`; it never falls back to anything.
 *
 * The transport wrapper below is intentionally standalone rather than imported
 * from `careerBridgeSource.js` or `curriculumSource.js`. Those modules carry the
 * Career Bridge mock data and the curriculum fixtures respectively, and
 * importing either here would pull that data into this bundle and couple the
 * routes together for no reason.
 *
 * ---------------------------------------------------------------------------
 * Configuration (Vite env, see .env.example)
 * ---------------------------------------------------------------------------
 *
 * VITE_CAREER_BRIDGE_API   backend base URL. Empty means same-origin, which is
 *                          what the dev-server proxy in vite.config.js provides.
 *
 * ---------------------------------------------------------------------------
 * Backend contract this is shaped against (see backend/data/cohort_analysis.py)
 * ---------------------------------------------------------------------------
 *
 * POST /cohort-analysis
 *   request  { cohort: [{ student_id, skills[] }], target_role }
 *   response { cohort_size, students_with_skills, skill_records_submitted,
 *              skill_records_deduplicated, distinct_cohort_skills, target_role,
 *              market_baseline { role, plannable, layer, postings, skill_count,
 *                                 corpus { dataset_rows, date_min, date_max,
 *                                          postings_artifact } },
 *              skills[], skills_not_in_market_baseline[], not_available[],
 *              method_note }
 *
 *   skills[] entries carry only recorded values:
 *   { skill, students_listing, cohort_size, student_proficiency, market_demand,
 *     gap, in_market_baseline, market_classification, students[] }
 *
 *   Two contract rules this layer must not smooth over:
 *
 *   1. `student_proficiency` is the share of submitted records naming the skill.
 *      It is coverage, not an assessed level — the repository holds no
 *      assessment record and none is estimated. It is therefore reported as
 *      "n of m students" plus the raw decimal, never as a percentage, matching
 *      the Curriculum Time Machine's rule that no value on a workspace page is
 *      expressed as a percentage.
 *
 *   2. `market_demand` and `gap` are `null` for a skill the baseline does not
 *      record for the role. There is no market figure to subtract, so `null`
 *      stays `null` here instead of becoming 0 or an em dash presented as a
 *      value. The live sample is never present in this response, so nothing
 *      here reads as fresh.
 *
 *   A role the artifacts do not record, or one with no recorded learning data,
 *   is a 422 carrying `detail.valid_roles` or `detail.plannable_roles`. A cohort
 *   the service refuses to read is a 422 carrying `detail.message`, which names
 *   the offending record so the page can show it verbatim.
 */

const RAW_API_BASE = String(import.meta.env.VITE_CAREER_BRIDGE_API ?? '').trim()

/** Empty means same-origin, which is what the dev-server proxy provides. */
export const API_BASE = RAW_API_BASE.replace(/\/+$/, '')

const COHORT_PATH = '/cohort-analysis'

export const COHORT_SERVICE_UNAVAILABLE_MESSAGE =
  'Cohort analysis service unavailable. Check that the SkillBridge backend is running.'

/* ------------------------------------------------------------------ roles */

/* Only the roles the service can compare a cohort against. `other` is a real
   recorded corpus category but it has no role-scoped planning data, so the
   endpoint refuses it exactly as `POST /roadmap` does. Offering it in a selector
   would only produce a dead control. */
export const COHORT_ROLES = [
  { id: 'data_science', label: 'Data Science' },
  { id: 'backend_ml_engineer', label: 'Backend ML Engineer' },
]

export const COHORT_DEFAULT_ROLE = COHORT_ROLES[0].id

const COHORT_ROLE_IDS = new Set(COHORT_ROLES.map((role) => role.id))

/* Mirrors the acronym set the Curriculum Time Machine labels with, so the same
   role reads identically in both workspaces. */
const ROLE_ACRONYMS = new Set(['ml', 'ai', 'nlp', 'api', 'sql', 'llm', 'ui', 'ux', 'etl', 'aws', 'gcp'])

export function humanizeRole(role) {
  if (typeof role !== 'string' || !role) return ''
  return role
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => {
      const key = word.toLowerCase()
      if (ROLE_ACRONYMS.has(key)) return key.toUpperCase()
      return word.charAt(0).toUpperCase() + word.slice(1)
    })
    .join(' ')
}

export function roleLabel(role) {
  const match = COHORT_ROLES.find((entry) => entry.id === role)
  return match ? match.label : humanizeRole(role)
}

/* ----------------------------------------------------------------- errors */

export class CohortApiError extends Error {
  constructor(message, { status = 0, path = COHORT_PATH, kind = 'unknown' } = {}) {
    super(message)
    this.name = 'CohortApiError'
    this.status = status
    this.path = path
    this.kind = kind
  }
}

export class UnknownRoleError extends CohortApiError {
  constructor(message, { requestedRole, supportedRoles, plannableRoles = null }) {
    super(message, { status: 422, kind: 'unknown-role' })
    this.name = 'UnknownRoleError'
    this.requestedRole = requestedRole
    this.supportedRoles = supportedRoles
    /* The narrower list, when the service refused the role for lack of planning
       data rather than for being unknown. Null means "not a plannability case". */
    this.plannableRoles = plannableRoles
  }
}

/** The service refused the submitted cohort. The message names the record. */
export class CohortRejectedError extends CohortApiError {
  constructor(message) {
    super(message, { status: 422, kind: 'cohort-rejected' })
    this.name = 'CohortRejectedError'
  }
}

export function isAbortError(error) {
  return error?.name === 'AbortError'
}

/** Turn any thrown value into copy that is safe and useful to show a reader. */
export function describeCohortError(error) {
  if (error instanceof UnknownRoleError) {
    /* A plannability refusal and an unknown-role refusal are different problems
       with different fixes, so they get different copy rather than one message
       that covers both. */
    const unplannable = Array.isArray(error.plannableRoles) && error.plannableRoles.length > 0
    return {
      kind: 'unknown-role',
      title: unplannable ? 'This role cannot be compared' : 'This role has no recorded data',
      message: unplannable
        ? `${roleLabel(error.requestedRole)} has no recorded role-scoped planning data, so there is no prepared baseline to compare a cohort against.`
        : `${roleLabel(error.requestedRole)} is not a role category the SkillBridge service has recorded data for, so nothing can be shown for it.`,
      detail: unplannable
        ? `Roles the service can compare against: ${error.plannableRoles.map(roleLabel).join(', ')}.`
        : error.supportedRoles.length
          ? `Roles the service can answer: ${error.supportedRoles.map(roleLabel).join(', ')}.`
          : 'The service reported no known role categories.',
      requestedRole: error.requestedRole,
      supportedRoles: error.supportedRoles,
    }
  }

  if (error instanceof CohortRejectedError) {
    return {
      kind: 'cohort-rejected',
      title: 'The cohort could not be read',
      message: error.message,
      detail: 'Correct the record named above and analyse again.',
      requestedRole: null,
      supportedRoles: [],
    }
  }

  return {
    kind: 'api',
    title: 'Cohort analysis unavailable',
    message:
      typeof error?.message === 'string' && error.message ? error.message : COHORT_SERVICE_UNAVAILABLE_MESSAGE,
    detail: '',
    requestedRole: null,
    supportedRoles: [],
  }
}

/* ----------------------------------------------------------------- client */

function errorForResponse(response, payload, role) {
  const detail = payload && typeof payload === 'object' ? payload.detail : null

  if (response.status === 422 && detail && typeof detail === 'object' && !Array.isArray(detail)) {
    const validRoles = Array.isArray(detail.valid_roles) ? detail.valid_roles.filter((entry) => typeof entry === 'string') : null
    const plannableRoles = Array.isArray(detail.plannable_roles)
      ? detail.plannable_roles.filter((entry) => typeof entry === 'string')
      : null

    /* Two role refusals, distinguished by which list the service sent: an unknown
       role names `valid_roles`, a role with no recorded planning data names
       `plannable_roles`. Both carry a `message`, so checking only for a message
       below would report either of them as an unreadable roster. */
    if (validRoles?.length || plannableRoles?.length) {
      return new UnknownRoleError('The service cannot answer for that role.', {
        requestedRole: typeof role === 'string' && role.trim() ? role.trim() : null,
        supportedRoles: validRoles?.length ? validRoles : plannableRoles,
        plannableRoles,
      })
    }

    /* A 422 with a message and no role lists is the service refusing the roster,
       not the role. The message is passed through verbatim because it names the
       record index that needs fixing. */
    if (typeof detail.message === 'string' && detail.message) {
      return new CohortRejectedError(detail.message)
    }
  }

  if (response.status === 404) {
    return new CohortApiError('The cohort analysis service did not recognise that request.', { status: 404, kind: 'not-found' })
  }

  if (response.status >= 500) {
    return new CohortApiError('The cohort analysis service is temporarily unavailable.', { status: response.status, kind: 'server' })
  }

  return new CohortApiError('The cohort analysis service could not complete that request.', {
    status: response.status,
    kind: 'rejected',
  })
}

async function postCohort(body, { signal, role } = {}) {
  let response
  try {
    response = await fetch(`${API_BASE}${COHORT_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })
  } catch (error) {
    if (isAbortError(error)) throw error
    throw new CohortApiError(COHORT_SERVICE_UNAVAILABLE_MESSAGE, { kind: 'unreachable' })
  }

  let payload = null
  try {
    payload = await response.json()
  } catch {
    if (response.ok) {
      throw new CohortApiError(COHORT_SERVICE_UNAVAILABLE_MESSAGE, { kind: 'malformed' })
    }
    throw errorForResponse(response, null, role)
  }

  if (!response.ok) throw errorForResponse(response, payload, role)
  return payload
}

/* ------------------------------------------------------------- primitives */

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function numberOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function stringOrNull(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function stringList(value) {
  return Array.isArray(value) ? value.filter((entry) => typeof entry === 'string' && entry.trim()) : []
}

/* The three recorded classification words. Anything else is carried through as
   text with no tier, so an unforeseen label is never mapped onto a colour that
   would imply a meaning the service did not state. */
const TIER_BY_CLASSIFICATION = { core: 'core', mid: 'mid', noise: 'noise' }

export const CLASSIFICATION_LABEL = { core: 'Core', mid: 'Mid', noise: 'Noise' }

/* ------------------------------------------------------------- cohort input
 *
 * The roster is parsed here, in the data layer, so the component only ever holds
 * a validated array. The accepted shape is the request contract above, and
 * nothing else is accepted: no CSV, no pasted prose, no guessed columns. A paste
 * the page cannot read exactly is reported as unreadable rather than partially
 * interpreted, because a half-read roster would produce a confident-looking
 * comparison of the wrong students.
 */

export class CohortParseError extends Error {
  constructor(message) {
    super(message)
    this.name = 'CohortParseError'
  }
}

const MAX_PASTED_CHARACTERS = 200000

/**
 * Parse a pasted roster into the request shape. Returns the cohort array, or
 * throws `CohortParseError` with copy that names what to fix.
 */
export function parseCohortInput(text) {
  const raw = typeof text === 'string' ? text.trim() : ''

  if (!raw) {
    throw new CohortParseError('Paste a cohort first. Nothing was submitted, so there is nothing to analyse.')
  }
  if (raw.length > MAX_PASTED_CHARACTERS) {
    throw new CohortParseError(
      `That roster is ${raw.length.toLocaleString('en-GB')} characters. The page reads up to ${MAX_PASTED_CHARACTERS.toLocaleString('en-GB')}; split it into smaller cohorts.`,
    )
  }

  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    throw new CohortParseError(`That is not readable JSON: ${error.message}`)
  }

  /* Both shapes are accepted so a reader can paste the request contract verbatim
     or just the roster array. A wrapper object with a different key is not
     guessed at. */
  const cohort = Array.isArray(parsed) ? parsed : isRecord(parsed) && Array.isArray(parsed.cohort) ? parsed.cohort : null

  if (!cohort) {
    throw new CohortParseError(
      'Expected a JSON array of students, or an object with a "cohort" array of { student_id, skills }.',
    )
  }
  if (!cohort.length) {
    throw new CohortParseError(
      'The roster is empty. With no students there is nothing to compare, and reporting every skill as a gap would state a shortfall that was never measured.',
    )
  }

  return cohort.map((entry, index) => {
    const position = `Student ${index + 1}`
    if (!isRecord(entry)) {
      throw new CohortParseError(`${position} is not an object with student_id and skills.`)
    }

    const studentId = stringOrNull(entry.student_id)
    if (!studentId) {
      throw new CohortParseError(`${position} has no student_id. Every record needs an identifier, and a blank one cannot be told apart from a missing one.`)
    }

    const skills = entry.skills ?? []
    if (typeof skills === 'string' || !Array.isArray(skills)) {
      throw new CohortParseError(`${position} ("${studentId}") has a skills value that is not a list. Write it as ["python", "sql"].`)
    }

    const cleaned = []
    skills.forEach((skill, position2) => {
      if (typeof skill !== 'string') {
        throw new CohortParseError(`${position} ("${studentId}") has a skill that is not text: entry ${position2 + 1}.`)
      }
      const name = skill.trim()
      if (name) cleaned.push(name)
    })

    return { student_id: studentId, skills: cleaned }
  })
}

/**
 * An example roster for the "fill an example" control. It is input help, not
 * data: the figures the service returns for it are computed by the service, and
 * nothing here claims what they are.
 */
export const EXAMPLE_COHORT_INPUT = JSON.stringify(
  [
    { student_id: 'S-001', skills: ['python', 'sql', 'statistics'] },
    { student_id: 'S-002', skills: ['Python', 'pandas', 'sql'] },
    { student_id: 'S-003', skills: ['python', 'excel'] },
    { student_id: 'S-004', skills: ['statistics', 'sql'] },
  ],
  null,
  2,
)

/* ------------------------------------------------------------- normalizers */

function normalizeSkillRow(raw) {
  if (!isRecord(raw)) return null
  const skill = stringOrNull(raw.skill)
  if (!skill) return null
  const classification = stringOrNull(raw.market_classification)

  const studentsListing = numberOrNull(raw.students_listing)
  const proficiency = numberOrNull(raw.student_proficiency)
  const marketDemand = numberOrNull(raw.market_demand)
  const gap = numberOrNull(raw.gap)
  const inBaseline = raw.in_market_baseline === true

  return {
    skill,
    studentsListing,
    cohortSize: numberOrNull(raw.cohort_size),
    proficiency,
    marketDemand,
    gap,
    inBaseline,
    classification,
    tier: TIER_BY_CLASSIFICATION[classification?.toLowerCase()] ?? null,
    students: stringList(raw.students),
    /* The two comparisons the row supports, kept apart so the page never draws a
       market bar for a skill the baseline does not record. */
    hasMarketFigure: inBaseline && marketDemand !== null,
    /* A row whose service-published gap is negative: the cohort records the skill
       more often than the baseline names it. Reported, never clamped to zero. */
    isAhead: gap !== null && gap < 0,
  }
}

function normalizeCorpus(raw) {
  return {
    datasetRows: numberOrNull(raw?.dataset_rows),
    dateMin: stringOrNull(raw?.date_min),
    dateMax: stringOrNull(raw?.date_max),
    postingsArtifact: stringOrNull(raw?.postings_artifact),
  }
}

function normalizePayload(payload, requestedRole) {
  if (!isRecord(payload) || !Array.isArray(payload.skills)) {
    throw new CohortApiError('The service returned an incomplete cohort analysis. Please try again.', { kind: 'malformed' })
  }

  const role = stringOrNull(payload.target_role) ?? requestedRole
  const baseline = isRecord(payload.market_baseline) ? payload.market_baseline : {}
  const skills = payload.skills.map(normalizeSkillRow).filter(Boolean)
  const cohortSize = numberOrNull(payload.cohort_size)

  return {
    role,
    roleLabel: roleLabel(role),
    cohortSize,
    studentsWithSkills: numberOrNull(payload.students_with_skills),
    skillRecordsSubmitted: numberOrNull(payload.skill_records_submitted),
    skillRecordsDeduplicated: numberOrNull(payload.skill_records_deduplicated),
    distinctCohortSkills: numberOrNull(payload.distinct_cohort_skills),
    baseline: {
      role: stringOrNull(baseline.role) ?? role,
      plannable: baseline.plannable === true,
      layer: stringOrNull(baseline.layer),
      postings: numberOrNull(baseline.postings),
      skillCount: numberOrNull(baseline.skill_count),
      corpus: normalizeCorpus(baseline.corpus),
    },
    /* The service's own order: recorded-baseline skills first by widest gap,
       then alphabetical, then skills the baseline does not record. Preserved so
       the page's default view matches the response field by field. */
    skills,
    bySkill: new Map(skills.map((skill) => [skill.skill, skill])),
    skillsNotInBaseline: stringList(payload.skills_not_in_market_baseline),
    notAvailable: stringList(payload.not_available),
    methodNote: stringOrNull(payload.method_note),
    /* Counts derived by counting the service's rows, not by re-deriving them from
       the roster. `gapSkills` excludes rows with no gap because a skill the
       baseline does not record has no gap to count. */
    counts: {
      total: skills.length,
      inBaseline: skills.filter((skill) => skill.inBaseline).length,
      withoutMarketFigure: skills.filter((skill) => !skill.hasMarketFigure).length,
      uncovered: skills.filter((skill) => skill.inBaseline && skill.proficiency === 0).length,
      ahead: skills.filter((skill) => skill.isAhead).length,
      gapSkills: skills.filter((skill) => skill.gap !== null && skill.gap > 0).length,
    },
  }
}

/* ----------------------------------------------------------------- loader */

/**
 * Analyse one cohort against one role's recorded baseline.
 *
 * `cohort` is the array `parseCohortInput` returned. It is sent as given: this
 * layer does not re-normalize, re-sort, or drop entries, because the service is
 * the layer that defines those rules and pre-applying them here would let the
 * page and the response disagree about what was submitted.
 */
export async function analyzeCohort(cohort, role, { signal } = {}) {
  const id = typeof role === 'string' ? role.trim().toLowerCase() : ''

  if (!COHORT_ROLE_IDS.has(id)) {
    throw new UnknownRoleError('Choose one of the roles this page can compare against.', {
      requestedRole: typeof role === 'string' && role.trim() ? role.trim() : null,
      supportedRoles: [...COHORT_ROLE_IDS],
    })
  }
  if (!Array.isArray(cohort) || !cohort.length) {
    throw new CohortParseError('There is no cohort to analyse. Paste a roster first.')
  }

  const payload = await postCohort({ cohort, target_role: id }, { signal, role: id })
  return normalizePayload(payload, id)
}

/* -------------------------------------------------------------- formatters
 *
 * The page reports recorded counts, raw share decimals, and raw gaps. There is
 * deliberately no percent formatter: `student_proficiency` is a share of
 * submitted records rather than a measured rate, and formatting it as a
 * percentage would present a coverage ratio in the visual language of a measured
 * outcome. It is shown as "n of m students" alongside the decimal instead.
 */

export const EMPTY_VALUE = '—'

export function formatCount(value) {
  return value === null || value === undefined ? EMPTY_VALUE : String(value)
}

export function formatShare(value) {
  return value === null || value === undefined ? EMPTY_VALUE : value.toFixed(3)
}

export function formatGap(value) {
  if (value === null || value === undefined) return EMPTY_VALUE
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(3)}`
}

/** '3 of 4 students' — the raw observation, so a decimal is never a mystery. */
export function formatCoverage(row) {
  if (row.studentsListing === null) return EMPTY_VALUE
  if (row.cohortSize === null) return `${row.studentsListing} students`
  return `${row.studentsListing} of ${row.cohortSize} students`
}

export function formatDate(value) {
  const text = stringOrNull(value)
  if (!text) return EMPTY_VALUE
  const date = new Date(`${text}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return text
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

export function classificationLabel(value) {
  if (!value) return EMPTY_VALUE
  return CLASSIFICATION_LABEL[value.toLowerCase()] ?? value
}
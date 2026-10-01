/**
 * Curriculum Time Machine data boundary.
 *
 * The single seam between the Curriculum Time Machine UI and its data. The
 * component imports this module and never calls `fetch` itself.
 *
 * This module has no mock source and no demo dataset on purpose. Stage 7A
 * established that this repository holds no university, programme, year, credit,
 * course, or curriculum-revision record, so there is no local data set that could
 * honestly stand in for the service. The checked-in `ctmData.js` is illustrative
 * curriculum copy and is deliberately not imported here. A failed request stays a
 * failure and is surfaced through `describeCurriculumError`; it never falls back.
 *
 * The transport wrapper below is intentionally standalone rather than imported
 * from `careerBridgeSource.js`: that module carries the Career Bridge mock data
 * and evidence fixtures, and importing it here would pull that demo data into
 * the Curriculum Time Machine bundle and couple the two routes to each other.
 *
 * ---------------------------------------------------------------------------
 * Configuration (Vite env, see .env.example)
 * ---------------------------------------------------------------------------
 *
 * VITE_CAREER_BRIDGE_API   backend base URL. Empty means same-origin, which is
 *                          what the dev-server proxy in vite.config.js provides.
 *                          The Curriculum Time Machine always reads from the API
 *                          and has no `VITE_CAREER_BRIDGE_MODE` equivalent,
 *                          because it has no offline data set to fall back to.
 *
 * ---------------------------------------------------------------------------
 * Backend contract this is shaped against (see backend/data/curriculum_intelligence.py)
 * ---------------------------------------------------------------------------
 *
 * GET /curriculum-intelligence/{role_category}
 *   -> { role_category, plannable, known_roles[], plannable_roles[],
 *        corpus { artifact, postings_artifact, dataset_rows, date_min, date_max,
 *                 usable_slices[], role_postings },
 *        thresholds { artifact, core_min_frequency, noise_max_frequency,
 *                     similarity_cutoff, embedding_backend_used_when_tuned },
 *        velocity_slices[], velocity_reproducibility { status, checked_scores,
 *        matched_scores, tolerance }, dangling_prerequisites[], skills[],
 *        evidence[], artifacts[], not_available[] }
 *
 *   A role the artifacts do not know returns 422 with `detail.valid_roles`. The
 *   service also knows the corpus-only category `other`, which is answered with
 *   `plannable: false` and null learning fields. `other` is not offered in the
 *   role selector, because the page presents learning paths and `other` has
 *   neither hours nor a prerequisite graph.
 *
 *   skills[] entries carry only recorded values. `slices` holds exactly the two
 *   observations named in `time_slices_used` (`2025-H1 -> 2026-H2`), not the four
 *   slice inventory in `corpus.usable_slices`. `prerequisites: null` means the
 *   graph records nothing for that skill; `[]` means the graph records the node
 *   with no prerequisites. `hours_source` is reproduced verbatim.
 *
 * Nothing here interpolates, averages, extrapolates, or reduces a measurement to
 * a verdict. `percentage_change` is carried through for completeness but is not
 * displayed: the page reports recorded counts and recorded frequency decimals
 * instead, so it never makes a percentage or growth claim.
 *
 * GET /curriculum-record
 *   -> { contract_version, record_id, record_kind, is_demo, is_representative,
 *        label, disclaimer, source, not_recorded[], programmes[], validation{},
 *        counts{}, vocabulary{} }
 *
 *   The curriculum contract from `backend/data/curriculum_record.py`: programme,
 *   curriculum version, academic year, semester, course, and the skills each
 *   course explicitly records. The only record this repository holds is the
 *   demonstration one, so it arrives labelled. `validation` carries what is
 *   incomplete rather than hiding or repairing it, including prerequisite cycles
 *   as cycle paths.
 *
 * GET /curriculum-coverage/{role_category}
 *   -> { role_category, record_id, is_demo, disclaimer, industry{},
 *        covered_skills[], not_covered_skills[],
 *        curriculum_skills_without_industry_record[], semesters[], validation{},
 *        not_available[] }
 *
 *   A course skill is matched to an industry skill only on an exact normalized
 *   name. A skill outside the recorded vocabulary has no canonical skill and covers
 *   nothing; it is reported, never fuzzy-matched. An unknown role is a 422 with
 *   `detail.valid_roles`, the same shape the intelligence request returns.
 */

const RAW_API_BASE = String(import.meta.env.VITE_CAREER_BRIDGE_API ?? '').trim()

/** Empty means same-origin, which is what the dev-server proxy provides. */
export const API_BASE = RAW_API_BASE.replace(/\/+$/, '')

export const CTM_SERVICE_UNAVAILABLE_MESSAGE =
  'Curriculum intelligence service unavailable. Check that the SkillBridge backend is running.'

/* ------------------------------------------------------------------ roles */

/* The three role categories the artifacts record. `other` is a real recorded
   category rather than an error: it has no recorded prerequisite graph and no
   recorded learning hours, so every placement it produces resolves to
   `insufficient_data`. The page offers it because that recorded state is part of
   what the institutional workflow has to show honestly, not a failure to hide. */
export const CTM_ROLES = [
  { id: 'data_science', label: 'Data Science' },
  { id: 'backend_ml_engineer', label: 'Backend ML Engineer' },
  { id: 'other', label: 'Other roles' },
]

export const CTM_DEFAULT_ROLE = CTM_ROLES[0].id

const CTM_ROLE_IDS = new Set(CTM_ROLES.map((role) => role.id))

/* Mirrors the acronym set used by the Career Bridge labels, so the same role
   reads identically in both workspaces. */
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
  const match = CTM_ROLES.find((entry) => entry.id === role)
  return match ? match.label : humanizeRole(role)
}

/* ----------------------------------------------------------------- errors */

export class CurriculumApiError extends Error {
  constructor(message, { status = 0, path = '', kind = 'unknown' } = {}) {
    super(message)
    this.name = 'CurriculumApiError'
    this.status = status
    this.path = path
    this.kind = kind
  }
}

export class UnknownRoleError extends CurriculumApiError {
  constructor(message, { requestedRole, supportedRoles }) {
    super(message, { status: 422, path: '/curriculum-intelligence', kind: 'unknown-role' })
    this.name = 'UnknownRoleError'
    this.requestedRole = requestedRole
    this.supportedRoles = supportedRoles
  }
}

export function isAbortError(error) {
  return error?.name === 'AbortError'
}

/** Turn any thrown value into copy that is safe and useful to show a reader. */
export function describeCurriculumError(error) {
  if (error instanceof UnknownRoleError) {
    return {
      kind: 'unknown-role',
      title: 'This role has no recorded curriculum intelligence',
      message: `${roleLabel(error.requestedRole)} is not a role category the SkillBridge service has recorded data for, so nothing can be shown for it.`,
      detail: error.supportedRoles.length
        ? `Roles the service can answer: ${error.supportedRoles.map(roleLabel).join(', ')}.`
        : 'The service reported no known role categories.',
      requestedRole: error.requestedRole,
      supportedRoles: error.supportedRoles,
    }
  }

  return {
    kind: 'api',
    title: 'Curriculum intelligence unavailable',
    message:
      typeof error?.message === 'string' && error.message ? error.message : CTM_SERVICE_UNAVAILABLE_MESSAGE,
    detail: '',
    requestedRole: null,
    supportedRoles: [],
  }
}

/* ----------------------------------------------------------------- client */

function errorForResponse(response, payload, path, role) {
  const detail = payload && typeof payload === 'object' ? payload.detail : null
  const validRoles =
    response.status === 422 && detail && typeof detail === 'object' && Array.isArray(detail.valid_roles)
      ? detail.valid_roles
      : null

  if (validRoles) {
    return new UnknownRoleError('The service does not have recorded data for that role.', {
      /* The role the caller asked for, so the message names it instead of saying
         that nothing was requested. */
      requestedRole: stringOrNull(role),
      supportedRoles: validRoles.filter((role) => typeof role === 'string'),
    })
  }

  if (response.status === 404) {
    return new CurriculumApiError('The curriculum intelligence service did not recognise that request.', {
      status: 404,
      path,
      kind: 'not-found',
    })
  }

  if (response.status >= 500) {
    return new CurriculumApiError('The curriculum intelligence service is temporarily unavailable.', {
      status: response.status,
      path,
      kind: 'server',
    })
  }

  return new CurriculumApiError('The curriculum intelligence service could not complete that request.', {
    status: response.status,
    path,
    kind: 'rejected',
  })
}

async function request(path, { signal, role } = {}) {
  let response
  try {
    response = await fetch(`${API_BASE}${path}`, { method: 'GET', signal })
  } catch (error) {
    if (isAbortError(error)) throw error
    throw new CurriculumApiError(CTM_SERVICE_UNAVAILABLE_MESSAGE, { path, kind: 'unreachable' })
  }

  if (response.status === 204) return null

  let payload = null
  try {
    payload = await response.json()
  } catch {
    if (response.ok) {
      throw new CurriculumApiError(CTM_SERVICE_UNAVAILABLE_MESSAGE, { path, kind: 'malformed' })
    }
    throw errorForResponse(response, null, path, role)
  }

  if (!response.ok) throw errorForResponse(response, payload, path, role)
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

/* '2025-H1 -> 2026-H2' -> ['2025-H1', '2026-H2'] */
function parseSlicePair(value) {
  const text = stringOrNull(value)
  if (!text) return []
  const [from, to] = text.split('->').map((part) => part.trim())
  return [from, to].filter(Boolean)
}

/* ---------------------------------------------------------------- slices */

function normalizeSlice(entry) {
  if (!isRecord(entry)) return null
  const timeSlice = stringOrNull(entry.time_slice)
  if (!timeSlice) return null
  return {
    timeSlice,
    mentions: numberOrNull(entry.mentions),
    totalPostings: numberOrNull(entry.total_postings),
    frequency: numberOrNull(entry.frequency),
  }
}

/* ---------------------------------------------------------------- skills */

/* The three recorded classification words. Anything else is carried through as
   text with no tier, so an unforeseen label is never mapped onto a colour that
   would imply a meaning the service did not state. */
const TIER_BY_CLASSIFICATION = {
  core: 'core',
  mid: 'mid',
  noise: 'noise',
}

export const CLASSIFICATION_LABEL = {
  core: 'Core',
  mid: 'Mid',
  noise: 'Noise',
}

function normalizeSkill(raw) {
  const name = stringOrNull(raw?.skill)
  if (!name) return null

  const sliceIds = parseSlicePair(raw.time_slices_used)
  const slices = Array.isArray(raw.slices) ? raw.slices.map(normalizeSlice).filter(Boolean) : []
  const sliceById = new Map(slices.map((slice) => [slice.timeSlice, slice]))
  const classification = stringOrNull(raw.classification)
  const prerequisitesRecorded = Array.isArray(raw.prerequisites)

  return {
    id: name,
    name,
    frequency: numberOrNull(raw.frequency),
    classification,
    tier: TIER_BY_CLASSIFICATION[classification?.toLowerCase()] ?? null,
    velocityScore: numberOrNull(raw.velocity_score),
    timeSlicesUsed: stringOrNull(raw.time_slices_used),
    sliceIds,
    slices,
    /* The two observations the stored score was computed from, matched by id
       rather than by position, so a reordering of the array cannot swap them. */
    baseline: sliceIds[0] ? sliceById.get(sliceIds[0]) ?? null : null,
    latest: sliceIds[1] ? sliceById.get(sliceIds[1]) ?? null : null,
    absoluteChange: numberOrNull(raw.absolute_change),
    /* Carried for completeness, never rendered: the page reports recorded counts
       and frequency decimals rather than percentage claims. */
    percentageChange: numberOrNull(raw.percentage_change),
    hours: numberOrNull(raw.hours),
    hoursSource: stringOrNull(raw.hours_source),
    prerequisites: prerequisitesRecorded
      ? raw.prerequisites.filter((entry) => typeof entry === 'string' && entry.trim()).map((entry) => entry.trim())
      : null,
    prerequisitesRecorded,
  }
}

/* -------------------------------------------------------------- evidence */

const EVIDENCE_LABEL = {
  external_reference_overlap: 'External reference overlap',
  naive_vs_signal_synthetic_benchmark: 'Naive vs signal benchmark',
  budget_sensitivity_example: 'Budget sensitivity example',
}

function evidenceSummary(record) {
  const type = record.type
  const metrics = record.metrics ?? {}

  if (type === 'external_reference_overlap') {
    const matched = numberOrNull(metrics.matched)
    const top10 = numberOrNull(metrics.top10_count)
    if (matched === null || top10 === null) return 'External reference set comparison for this role.'
    return `${matched} of ${top10} top skills were present in the reference set.`
  }

  if (type === 'naive_vs_signal_synthetic_benchmark') {
    const n = record.sampleSize
    return n === null
      ? 'Naive keyword baseline against the signal engine.'
      : `Naive keyword baseline against the signal engine across ${n} controlled cases.`
  }

  if (type === 'budget_sensitivity_example') {
    return metrics.plans_identical === true
      ? 'The recorded 20h and 100h plans were identical, so this example does not demonstrate budget sensitivity.'
      : 'The recorded 20h and 100h plans differ, so this example does demonstrate budget sensitivity.'
  }

  return 'Evaluation record from the SkillBridge service.'
}

function normalizeEvidence(records) {
  return records
    .filter(isRecord)
    .map((record, index) => {
      const type = stringOrNull(record.proof_type) ?? 'unknown'
      const normalized = {
        id: stringOrNull(record.proof_id) ?? `evidence-${index}`,
        type,
        label: EVIDENCE_LABEL[type] ?? 'Evaluation record',
        role: stringOrNull(record.role_category),
        source: stringOrNull(record.source),
        sourceUrls: stringList(record.source_urls),
        caveats: stringList(record.caveats),
        isSynthetic: record.is_synthetic === true,
        sampleSize: numberOrNull(record.sample_size),
        artifactSource: stringOrNull(record.artifact_source),
        metrics: isRecord(record.metrics) ? record.metrics : {},
      }
      normalized.summary = evidenceSummary(normalized)
      return normalized
    })
}

/* ---------------------------------------------------------- slice inventory
 *
 * The recorded slices, summarised across the role's skills. A slice's posting total
 * is stated only when every skill that observed the slice agrees on the denominator,
 * so one disagreeing skill reports `null` rather than a total that is half true.
 *
 * There is deliberately no ordering of skills here. The service publishes a
 * velocity order and the page reports each skill's own recorded movement, but
 * ordering skills by that movement would be a claim this layer cannot support.
 */

function buildSliceInventory(skills) {
  const bySlice = new Map()

  for (const skill of skills) {
    for (const slice of skill.slices) {
      if (!bySlice.has(slice.timeSlice)) bySlice.set(slice.timeSlice, { timeSlice: slice.timeSlice, observed: 0, totals: new Set() })
      const entry = bySlice.get(slice.timeSlice)
      entry.observed += 1
      if (slice.totalPostings !== null) entry.totals.add(slice.totalPostings)
    }
  }

  const slices = [...bySlice.values()]
    .sort((a, b) => a.timeSlice.localeCompare(b.timeSlice))
    .map((entry) => ({
      timeSlice: entry.timeSlice,
      observedSkills: entry.observed,
      totalPostings: entry.totals.size === 1 ? [...entry.totals][0] : null,
    }))

  /* Skills missing one of their two slices cannot be compared, so they are counted
     here instead of being dropped from the comparison without explanation. */
  const compared = skills.filter(
    (skill) => skill.baseline && skill.latest && skill.absoluteChange !== null,
  ).length

  return {
    slices,
    compared,
    unmeasured: skills.filter((skill) => !skill.baseline || !skill.latest).length,
  }
}

/* ------------------------------------------------------------ normalizers */

function humanizeField(value) {
  const text = value.replace(/_/g, ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function normalizeReproducibility(raw) {
  return {
    status: stringOrNull(raw?.status),
    checkedScores: numberOrNull(raw?.checked_scores),
    matchedScores: numberOrNull(raw?.matched_scores),
    tolerance: numberOrNull(raw?.tolerance),
  }
}

function normalizeCorpus(raw) {
  return {
    artifact: stringOrNull(raw?.artifact),
    postingsArtifact: stringOrNull(raw?.postings_artifact),
    datasetRows: numberOrNull(raw?.dataset_rows),
    dateMin: stringOrNull(raw?.date_min),
    dateMax: stringOrNull(raw?.date_max),
    usableSlices: stringList(raw?.usable_slices),
    rolePostings: numberOrNull(raw?.role_postings),
  }
}

function normalizePayload(payload, requestedRole) {
  if (!isRecord(payload) || !Array.isArray(payload.skills)) {
    throw new CurriculumApiError('The service returned an incomplete record. Please try again.', {
      path: '/curriculum-intelligence',
      kind: 'malformed',
    })
  }

  const role = stringOrNull(payload.role_category) ?? requestedRole
  const skills = payload.skills.map(normalizeSkill).filter(Boolean)
  /* The position the service published the skill in. It is the order the reader
     sees, and it is not a score: nothing here computes it. */
  skills.forEach((skill, index) => {
    skill.order = index + 1
  })

  const thresholds = isRecord(payload.thresholds) ? payload.thresholds : {}

  return {
    role,
    roleLabel: roleLabel(role),
    plannable: payload.plannable === true,
    knownRoles: stringList(payload.known_roles),
    plannableRoles: stringList(payload.plannable_roles),
    corpus: normalizeCorpus(payload.corpus),
    thresholds: {
      artifact: stringOrNull(thresholds.artifact),
      coreMinFrequency: numberOrNull(thresholds.core_min_frequency),
      noiseMaxFrequency: numberOrNull(thresholds.noise_max_frequency),
      similarityCutoff: numberOrNull(thresholds.similarity_cutoff),
      embeddingBackend: stringOrNull(thresholds.embedding_backend_used_when_tuned),
    },
    velocitySlices: stringList(payload.velocity_slices),
    reproducibility: normalizeReproducibility(payload.velocity_reproducibility),
    skills,
    byName: new Map(skills.map((skill) => [skill.id, skill])),
    /* Recorded movement between the slices the service paired, summarised per slice
       rather than per skill, so the comparison is stated at the level the artifacts
       actually support. */
    slices: buildSliceInventory(skills),
    /* Prerequisite edges whose prerequisite is not a node in this role's graph. Kept
       as the service's own list rather than recomputed, so the page can report the
       same edges the payload reports. */
    danglingPrerequisites: (Array.isArray(payload.dangling_prerequisites) ? payload.dangling_prerequisites : [])
      .filter(isRecord)
      .map(normalizeDanglingPrerequisite)
      .filter(Boolean),
    evidence: normalizeEvidence(Array.isArray(payload.evidence) ? payload.evidence : []),
    artifacts: stringList(payload.artifacts),
    notAvailable: stringList(payload.not_available),
  }
}

/* A recorded prerequisite edge that points at a skill this role's graph does not
 * carry. Reported because it is a limit on what the graph can place, not noise. */
function normalizeDanglingPrerequisite(raw) {
  if (!isRecord(raw)) return null
  const skill = stringOrNull(raw.skill)
  if (!skill) return null
  return {
    skill,
    prerequisite: stringOrNull(raw.prerequisite),
    skillRecorded: raw.skill_recorded === true,
    prerequisiteRecorded: raw.prerequisite_recorded === true,
    reason: stringOrNull(raw.reason),
  }
}

/* ----------------------------------------------------------------- loader */

export async function loadCurriculumIntelligence(role, { signal } = {}) {
  const id = typeof role === 'string' ? role.trim().toLowerCase() : ''
  const path = '/curriculum-intelligence'

  if (!CTM_ROLE_IDS.has(id)) {
    throw new CurriculumApiError('Choose one of the roles this page can show.', { path, kind: 'invalid-input' })
  }

  const payload = await request(`${path}/${encodeURIComponent(id)}`, { signal, role: id })
  return normalizePayload(payload, id)
}

/* -------------------------------------------------------------- formatters
 *
 * The page reports recorded counts and recorded frequency decimals. There is
 * deliberately no percent formatter here: no value on this page is expressed as
 * a percentage, so a growth or coverage claim cannot be introduced by formatting.
 */

export const EMPTY_VALUE = '—'

export function formatFrequency(value) {
  return value === null ? EMPTY_VALUE : value.toFixed(3)
}

export function formatDelta(value) {
  if (value === null) return EMPTY_VALUE
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(3)}`
}

export function formatVelocity(value) {
  if (value === null) return EMPTY_VALUE
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(2)}`
}

export function formatHours(value) {
  if (value === null) return EMPTY_VALUE
  return `${value} h`
}

export function formatCount(value) {
  return value === null ? EMPTY_VALUE : String(value)
}

/** '28 May 2022' from an artifact ISO date, read as UTC so it never shifts. */
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

/** '11 of 20 postings' — the raw observation, so a decimal is never a mystery. */
export function formatObservation(slice) {
  if (!slice) return EMPTY_VALUE
  return `${formatCount(slice.mentions)} of ${formatCount(slice.totalPostings)} postings`
}

export function classificationLabel(value) {
  if (!value) return EMPTY_VALUE
  return CLASSIFICATION_LABEL[value.toLowerCase()] ?? value
}

/* ------------------------------------------------- curriculum record (8B)
 *
 * The Curriculum Time Machine has no curriculum data of its own. These loaders
 * read the one curriculum the service holds and join it to the role intelligence
 * the page already shows, and they normalize the response into the same
 * camelCase, Map-indexed shape the rest of this module uses.
 *
 * Three rules carry over from the service and are preserved here rather than
 * smoothed over:
 *
 *   1. `null` is not `[]`. A field nobody recorded is `null`; an empty list means
 *      the record states there are none. `prerequisitesRecorded: false` and
 *      `prerequisites: []` are different facts and stay different.
 *   2. `matchType: 'unmatched'` means the skill is outside the recorded
 *      vocabulary. It has no `canonicalSkill`, is not counted as coverage of any
 *      industry skill, and is never fuzzy-matched to the nearest name.
 *   3. Prerequisite cycles are data, not an error. `cycleCourseIds` and
 *      `prerequisiteCycles` come from the service as recorded; this layer does not
 *      reorder, drop, or repair them.
 *
 * Nothing here scores or ranks. The service states which courses record a skill
 * and which industry skills no course records; a coverage percentage is never
 * computed, because the denominator for one is not a recorded fact.
 */

function normalizeProvenance(raw) {
  if (!isRecord(raw)) return null
  return {
    kind: stringOrNull(raw.kind),
    reference: stringOrNull(raw.reference),
    recordedAt: stringOrNull(raw.recorded_at),
    verified: typeof raw.verified === 'boolean' ? raw.verified : null,
    note: stringOrNull(raw.note),
  }
}

/* `recorded: false` with ids present would be a service bug, so ids are only read
   when the record claims to have them. The list stays `[]` in that case rather
   than becoming null, because the distinction the contract cares about is
   recorded-but-empty against not-recorded-at-all, and `recorded` carries that. */
function normalizePrerequisites(raw) {
  const recorded = isRecord(raw) && raw.recorded === true
  const ids = recorded ? stringList(raw.course_ids) : []
  return { recorded, courseIds: ids }
}

function normalizeCourseSkill(raw) {
  if (!isRecord(raw)) return null
  const skill = stringOrNull(raw.skill)
  if (!skill) return null
  const matchType = stringOrNull(raw.match_type)
  return {
    skill,
    inputSkill: stringOrNull(raw.input_skill),
    /* An unmatched name has no canonical skill. The field stays null rather than
       echoing the input, so a reader cannot mistake it for a vocabulary match. */
    canonicalSkill: matchType === 'unmatched' ? null : stringOrNull(raw.canonical_skill),
    matchType,
    isExact: matchType === 'exact',
    roleCategories: stringList(raw.role_categories),
    coverage: stringOrNull(raw.coverage),
    notes: stringOrNull(raw.notes),
    source: normalizeProvenance(raw.source),
  }
}

function normalizeCourse(raw) {
  if (!isRecord(raw)) return null
  const courseId = stringOrNull(raw.course_id)
  if (!courseId) return null
  const skills = (Array.isArray(raw.skills) ? raw.skills : []).map(normalizeCourseSkill).filter(Boolean)
  return {
    courseId,
    name: stringOrNull(raw.name),
    code: stringOrNull(raw.code),
    credits: numberOrNull(raw.credits),
    hours: numberOrNull(raw.hours),
    description: stringOrNull(raw.description),
    level: stringOrNull(raw.level),
    deliveryFormat: stringOrNull(raw.delivery_format),
    isElective: typeof raw.is_elective === 'boolean' ? raw.is_elective : null,
    prerequisites: normalizePrerequisites(raw.prerequisites),
    prerequisitesRecorded: isRecord(raw.prerequisites) && raw.prerequisites.recorded === true,
    skills,
    bySkill: new Map(skills.map((skill) => [skill.skill, skill])),
    source: normalizeProvenance(raw.source),
  }
}

function normalizeSemester(raw) {
  if (!isRecord(raw)) return null
  const semesterId = stringOrNull(raw.semester_id)
  if (!semesterId) return null
  const courses = (Array.isArray(raw.courses) ? raw.courses : []).map(normalizeCourse).filter(Boolean)
  return {
    semesterId,
    sequence: numberOrNull(raw.sequence),
    term: stringOrNull(raw.term),
    label: stringOrNull(raw.label),
    startDate: stringOrNull(raw.start_date),
    endDate: stringOrNull(raw.end_date),
    recordedCredits: numberOrNull(raw.recorded_credits),
    courses,
    byCourseId: new Map(courses.map((course) => [course.courseId, course])),
    source: normalizeProvenance(raw.source),
  }
}

function normalizeAcademicYear(raw) {
  if (!isRecord(raw)) return null
  const academicYearId = stringOrNull(raw.academic_year_id)
  if (!academicYearId) return null
  const semesters = (Array.isArray(raw.semesters) ? raw.semesters : []).map(normalizeSemester).filter(Boolean)
  return {
    academicYearId,
    label: stringOrNull(raw.label),
    startYear: numberOrNull(raw.start_year),
    endYear: numberOrNull(raw.end_year),
    isEntryCohort: typeof raw.is_entry_cohort === 'boolean' ? raw.is_entry_cohort : null,
    semesters,
    source: normalizeProvenance(raw.source),
  }
}

function normalizeVersion(raw) {
  if (!isRecord(raw)) return null
  const versionId = stringOrNull(raw.version_id)
  if (!versionId) return null
  const academicYears = (Array.isArray(raw.academic_years) ? raw.academic_years : []).map(normalizeAcademicYear).filter(Boolean)
  return {
    versionId,
    versionLabel: stringOrNull(raw.version_label),
    effectiveFrom: stringOrNull(raw.effective_from),
    effectiveTo: stringOrNull(raw.effective_to),
    status: stringOrNull(raw.status),
    totalCredits: numberOrNull(raw.total_credits),
    academicYears,
    source: normalizeProvenance(raw.source),
  }
}

function normalizeProgramme(raw) {
  if (!isRecord(raw)) return null
  const programmeId = stringOrNull(raw.programme_id)
  if (!programmeId) return null
  const curricula = (Array.isArray(raw.curricula) ? raw.curricula : []).map(normalizeVersion).filter(Boolean)
  return {
    programmeId,
    name: stringOrNull(raw.name),
    institutionName: stringOrNull(raw.institution_name),
    award: stringOrNull(raw.award),
    faculty: stringOrNull(raw.faculty),
    durationTerms: numberOrNull(raw.duration_terms),
    totalCredits: numberOrNull(raw.total_credits),
    curricula,
    source: normalizeProvenance(raw.source),
  }
}

function normalizeValidation(raw) {
  const report = isRecord(raw) ? raw : {}
  return {
    danglingPrerequisites: (Array.isArray(report.dangling_prerequisites) ? report.dangling_prerequisites : [])
      .filter(isRecord)
      .map((edge) => ({
        courseId: stringOrNull(edge.course_id),
        prerequisiteCourseId: stringOrNull(edge.prerequisite_course_id),
      })),
    unmatchedSkills: (Array.isArray(report.unmatched_skills) ? report.unmatched_skills : [])
      .filter(isRecord)
      .map((entry) => ({
        courseId: stringOrNull(entry.course_id),
        skill: stringOrNull(entry.skill),
        inputSkill: stringOrNull(entry.input_skill),
      })),
    coursesWithoutRecordedSkills: stringList(report.courses_without_recorded_skills),
    /* Cycle paths exactly as the service detected them. `cycleCourseIds` is what
       a later placement rule needs to exclude a course without re-walking the
       graph; nothing here resolves or removes a cycle. */
    prerequisiteCycles: (Array.isArray(report.prerequisite_cycles) ? report.prerequisite_cycles : []).map((cycle) =>
      stringList(cycle),
    ),
    cycleCourseIds: stringList(report.cycle_course_ids),
    orderingObservations: (Array.isArray(report.ordering_observations) ? report.ordering_observations : [])
      .filter(isRecord)
      .map((entry) => ({
        courseId: stringOrNull(entry.course_id),
        prerequisiteCourseId: stringOrNull(entry.prerequisite_course_id),
        courseSemesterId: stringOrNull(entry.course_semester_id),
        prerequisiteSemesterId: stringOrNull(entry.prerequisite_semester_id),
        observation: stringOrNull(entry.observation),
      })),
    tokenSignatureCollisions: (Array.isArray(report.token_signature_collisions) ? report.token_signature_collisions : [])
      .filter(isRecord)
      .map((entry) => ({
        tokenSignature: stringList(entry.token_signature),
        skills: stringList(entry.skills),
        assertionOnly: entry.assertion_only === true,
      })),
  }
}

/* Flatten to one entry per course so a caller can ask "where is this skill
   taught?" without walking four nested levels, keeping the placement path on each
   entry rather than throwing it away. */
function flattenCourses(programmes) {
  const placements = []
  for (const programme of programmes) {
    for (const version of programme.curricula) {
      for (const year of version.academicYears) {
        for (const semester of year.semesters) {
          for (const course of semester.courses) {
            placements.push({ programme, version, year, semester, course })
          }
        }
      }
    }
  }
  return placements
}

export function normalizeCurriculumRecord(payload) {
  if (!isRecord(payload) || !Array.isArray(payload.programmes)) {
    throw new CurriculumApiError('The service returned an incomplete curriculum record. Please try again.', {
      path: '/curriculum-record',
      kind: 'malformed',
    })
  }

  const programmes = payload.programmes.map(normalizeProgramme).filter(Boolean)
  const placements = flattenCourses(programmes)
  const byCourseId = new Map(placements.map((entry) => [entry.course.courseId, entry]))

  /* Index by recorded skill name, not by canonical name. Two courses recording
     the same name is the normal case, and an unmatched name is a legitimate key
     here even though it has no canonical skill and covers nothing. */
  const bySkill = new Map()
  for (const { course } of placements) {
    for (const skill of course.skills) {
      if (!bySkill.has(skill.skill)) bySkill.set(skill.skill, [])
      bySkill.get(skill.skill).push(course.courseId)
    }
  }

  const counts = isRecord(payload.counts) ? payload.counts : {}
  const vocabulary = isRecord(payload.vocabulary) ? payload.vocabulary : {}

  return {
    contractVersion: stringOrNull(payload.contract_version),
    recordId: stringOrNull(payload.record_id),
    recordKind: stringOrNull(payload.record_kind),
    isDemo: payload.is_demo === true,
    isRepresentative: payload.is_representative === true,
    label: stringOrNull(payload.label),
    disclaimer: stringOrNull(payload.disclaimer),
    source: normalizeProvenance(payload.source),
    notRecorded: stringList(payload.not_recorded),
    programmes,
    courses: placements,
    byCourseId,
    bySkill,
    counts: {
      programmes: numberOrNull(counts.programmes),
      curriculumVersions: numberOrNull(counts.curriculum_versions),
      academicYears: numberOrNull(counts.academic_years),
      semesters: numberOrNull(counts.semesters),
      courses: numberOrNull(counts.courses),
      courseSkillMappings: numberOrNull(counts.course_skill_mappings),
    },
    vocabulary: {
      source: stringOrNull(vocabulary.source),
      size: numberOrNull(vocabulary.size),
      artifactOnlySkills: stringList(vocabulary.artifact_only_skills),
    },
    validation: normalizeValidation(payload.validation),
  }
}

function normalizeCoverageCourse(raw) {
  if (!isRecord(raw)) return null
  return {
    courseId: stringOrNull(raw.course_id),
    name: stringOrNull(raw.name),
    code: stringOrNull(raw.code),
    credits: numberOrNull(raw.credits),
    academicYearId: stringOrNull(raw.academic_year_id),
    semesterId: stringOrNull(raw.semester_id),
    recordedSkill: stringOrNull(raw.recorded_skill),
    inputSkill: stringOrNull(raw.input_skill),
    matchType: stringOrNull(raw.match_type),
    coverage: stringOrNull(raw.coverage),
    source: normalizeProvenance(raw.source),
  }
}

/* The industry row is carried through as the service published it, so the coverage
   view cannot drift from `/curriculum-intelligence` by restating a field. */
function normalizeCoverageSkill(raw) {
  if (!isRecord(raw)) return null
  const skill = stringOrNull(raw.skill)
  if (!skill) return null
  const courses = (Array.isArray(raw.curriculum_courses) ? raw.curriculum_courses : [])
    .map(normalizeCoverageCourse)
    .filter(Boolean)
  return {
    skill,
    frequency: numberOrNull(raw.frequency),
    classification: stringOrNull(raw.classification),
    tier: TIER_BY_CLASSIFICATION[stringOrNull(raw.classification)?.toLowerCase()] ?? null,
    velocityScore: numberOrNull(raw.velocity_score),
    hours: numberOrNull(raw.hours),
    hoursSource: stringOrNull(raw.hours_source),
    prerequisites: Array.isArray(raw.prerequisites) ? stringList(raw.prerequisites) : null,
    isCovered: raw.is_covered === true,
    courses,
    courseIds: courses.map((course) => course.courseId).filter(Boolean),
  }
}

function normalizeCoverageSemester(raw) {
  if (!isRecord(raw)) return null
  const semesterId = stringOrNull(raw.semester_id)
  if (!semesterId) return null
  const courses = (Array.isArray(raw.courses) ? raw.courses : []).filter(isRecord).map((course) => ({
    courseId: stringOrNull(course.course_id),
    name: stringOrNull(course.name),
    code: stringOrNull(course.code),
    credits: numberOrNull(course.credits),
    skillCount: numberOrNull(course.skill_count),
    skills: stringList(course.skills),
    matchedIndustrySkills: stringList(course.matched_industry_skills),
  }))
  return {
    programmeId: stringOrNull(raw.programme_id),
    versionId: stringOrNull(raw.version_id),
    academicYearId: stringOrNull(raw.academic_year_id),
    semesterId,
    sequence: numberOrNull(raw.sequence),
    term: stringOrNull(raw.term),
    courseCount: numberOrNull(raw.course_count),
    coursesWithRecordedSkills: numberOrNull(raw.courses_with_recorded_skills),
    coursesWithoutRecordedSkills: numberOrNull(raw.courses_without_recorded_skills),
    coursesWithRecordedCredits: numberOrNull(raw.courses_with_recorded_credits),
    /* Null when any course in the semester left credits unrecorded. A partial sum
       would read as a semester total the curriculum does not state. */
    recordedCreditSum: numberOrNull(raw.recorded_credit_sum),
    courses,
  }
}

export function normalizeCurriculumCoverage(payload, requestedRole) {
  if (!isRecord(payload) || !Array.isArray(payload.covered_skills)) {
    throw new CurriculumApiError('The service returned an incomplete coverage record. Please try again.', {
      path: '/curriculum-coverage',
      kind: 'malformed',
    })
  }

  const role = stringOrNull(payload.role_category) ?? requestedRole
  const coveredSkills = payload.covered_skills.map(normalizeCoverageSkill).filter(Boolean)
  const notCoveredSkills = (Array.isArray(payload.not_covered_skills) ? payload.not_covered_skills : [])
    .map(normalizeCoverageSkill)
    .filter(Boolean)
  const industry = isRecord(payload.industry) ? payload.industry : {}
  const corpus = isRecord(industry.corpus) ? industry.corpus : {}

  return {
    role,
    roleLabel: roleLabel(role),
    recordId: stringOrNull(payload.record_id),
    isDemo: payload.is_demo === true,
    disclaimer: stringOrNull(payload.disclaimer),
    industry: {
      plannable: industry.plannable === true,
      skillCount: numberOrNull(industry.skill_count),
      velocitySlices: stringList(industry.velocity_slices),
      corpus: normalizeCorpus(corpus),
    },
    coveredSkills,
    notCoveredSkills,
    bySkill: new Map(
      [...coveredSkills, ...notCoveredSkills].map((skill) => [skill.skill, skill]),
    ),
    /* Curriculum skills the role's artifacts say nothing about. Reported apart from
       `notCoveredSkills`, which counts the other direction: an industry skill no
       course records. */
    curriculumSkillsWithoutIndustryRecord: (
      Array.isArray(payload.curriculum_skills_without_industry_record)
        ? payload.curriculum_skills_without_industry_record
        : []
    )
      .filter(isRecord)
      .map((entry) => ({ skill: stringOrNull(entry.skill), courseIds: stringList(entry.course_ids) })),
    semesters: (Array.isArray(payload.semesters) ? payload.semesters : []).map(normalizeCoverageSemester).filter(Boolean),
    validation: normalizeValidation(payload.validation),
    notAvailable: stringList(payload.not_available),
  }
}

/* ----------------------------------------------------------------- loaders */

export async function loadCurriculumRecord({ signal } = {}) {
  return normalizeCurriculumRecord(await request('/curriculum-record', { signal }))
}
/* Stage 8B's coverage comparison, kept for the record-level view it describes.
   `/curriculum-gaps` supersedes it for the gap workflow below. */
export async function loadCurriculumCoverage(role, { signal } = {}) {
  const id = typeof role === 'string' ? role.trim().toLowerCase() : ''
  if (!id) {
    throw new CurriculumApiError('Choose a role to compare the curriculum against.', {
      path: '/curriculum-coverage',
      kind: 'invalid-input',
    })
  }

  const payload = await request(`/curriculum-coverage/${encodeURIComponent(id)}`, { signal, role: id })
  return normalizeCurriculumCoverage(payload, id)
}

/* ------------------------------------------------------- slice pair helper
 *
 * The two observations a stored velocity score was computed from, matched by the
 * ids the service named rather than by array position, so a reordering cannot swap
 * them. Shared by the industry-evidence block of every Stage 7-derived response,
 * because a gap row and a recommendation carry the identical evidence object.
 */
function slicePair(slices, timeSlicesUsed) {
  const sliceIds = parseSlicePair(timeSlicesUsed)
  const byId = new Map(slices.map((slice) => [slice.timeSlice, slice]))
  return {
    sliceIds,
    baseline: sliceIds[0] ? byId.get(sliceIds[0]) ?? null : null,
    latest: sliceIds[1] ? byId.get(sliceIds[1]) ?? null : null,
  }
}

/* The Stage 7 evidence block as `/curriculum-intelligence` publishes it, read once
 * and shared. `percentage_change` is carried but never rendered: the page reports
 * recorded counts and recorded frequency decimals, so no growth claim can be made
 * by formatting. */
function normalizeEvidenceBlock(raw) {
  if (!isRecord(raw)) return null
  const slices = (Array.isArray(raw.slices) ? raw.slices : []).map(normalizeSlice).filter(Boolean)
  const classification = stringOrNull(raw.classification)
  const pair = slicePair(slices, stringOrNull(raw.time_slices_used))
  return {
    skill: stringOrNull(raw.skill),
    frequency: numberOrNull(raw.frequency),
    classification,
    tier: TIER_BY_CLASSIFICATION[classification?.toLowerCase()] ?? null,
    velocityScore: numberOrNull(raw.velocity_score),
    timeSlicesUsed: stringOrNull(raw.time_slices_used),
    sliceIds: pair.sliceIds,
    slices,
    baseline: pair.baseline,
    latest: pair.latest,
    absoluteChange: numberOrNull(raw.absolute_change),
    percentageChange: numberOrNull(raw.percentage_change),
    hours: numberOrNull(raw.hours),
    hoursSource: stringOrNull(raw.hours_source),
    /* null means the graph records nothing for this skill; [] means it records the
       node with no prerequisites. The two are different facts and stay different. */
    prerequisites: Array.isArray(raw.prerequisites) ? stringList(raw.prerequisites) : null,
  }
}

function normalizeLimitation(raw) {
  if (!isRecord(raw)) return null
  const code = stringOrNull(raw.code)
  if (!code) return null
  return { code, note: stringOrNull(raw.note) }
}

function normalizeLimitations(value) {
  return (Array.isArray(value) ? value : []).map(normalizeLimitation).filter(Boolean)
}

function normalizeGapCourse(raw) {
  if (!isRecord(raw)) return null
  const courseId = stringOrNull(raw.course_id)
  if (!courseId) return null
  return {
    courseId,
    name: stringOrNull(raw.name),
    code: stringOrNull(raw.code),
    credits: numberOrNull(raw.credits),
    academicYearId: stringOrNull(raw.academic_year_id),
    semesterId: stringOrNull(raw.semester_id),
    recordedSkill: stringOrNull(raw.recorded_skill),
    inputSkill: stringOrNull(raw.input_skill),
    matchType: stringOrNull(raw.match_type),
    coverage: stringOrNull(raw.coverage),
    source: normalizeProvenance(raw.source),
  }
}

/* One row of the gap analysis. Every group the service publishes normalizes
 * through this, so a covered skill, a gap, a skill with no industry record and an
 * unmatched curriculum skill are the same shape with different fields empty. */
function normalizeGapRow(raw, fallbackStatus) {
  if (!isRecord(raw)) return null
  const skill = stringOrNull(raw.skill)
  if (!skill) return null
  const learning = isRecord(raw.learning) ? raw.learning : {}
  const courses = (Array.isArray(raw.curriculum_courses) ? raw.curriculum_courses : [])
    .map(normalizeGapCourse)
    .filter(Boolean)
  return {
    skill,
    inputSkill: stringOrNull(raw.input_skill),
    coverageStatus: stringOrNull(raw.coverage_status) ?? fallbackStatus,
    isGap: raw.is_gap === true,
    classification: stringOrNull(raw.classification),
    tier: TIER_BY_CLASSIFICATION[stringOrNull(raw.classification)?.toLowerCase()] ?? null,
    evidence: normalizeEvidenceBlock(raw.industry_evidence),
    courses,
    courseCount: numberOrNull(raw.course_count),
    learning: {
      hours: numberOrNull(learning.hours),
      hoursSource: stringOrNull(learning.hours_source),
      recorded: learning.recorded === true,
    },
    prerequisites: Array.isArray(raw.prerequisites) ? stringList(raw.prerequisites) : null,
    limitations: normalizeLimitations(raw.evidence_limitations),
  }
}

/* ------------------------------------------------------- gap analysis (8C) */

export function normalizeGapAnalysis(payload, requestedRole) {
  if (!isRecord(payload) || !Array.isArray(payload.gaps)) {
    throw new CurriculumApiError('The service returned an incomplete gap analysis. Please try again.', {
      path: '/curriculum-gaps',
      kind: 'malformed',
    })
  }

  const role = stringOrNull(payload.role_category) ?? requestedRole
  const rows = (value, status) =>
    (Array.isArray(value) ? value : []).map((entry) => normalizeGapRow(entry, status)).filter(Boolean)

  const industry = isRecord(payload.industry) ? payload.industry : {}
  const counts = isRecord(payload.summary) ? payload.summary : {}
  const boundary = isRecord(payload.stage_boundary) ? payload.stage_boundary : {}

  return {
    role,
    roleLabel: roleLabel(role),
    recordId: stringOrNull(payload.record_id),
    isDemo: payload.is_demo === true,
    disclaimer: stringOrNull(payload.disclaimer),
    coverageBasis: stringOrNull(payload.coverage_basis),
    industry: {
      plannable: industry.plannable === true,
      skillCount: numberOrNull(industry.skill_count),
      velocitySlices: stringList(industry.velocity_slices),
      reproducibility: normalizeReproducibility(industry.velocity_reproducibility),
      corpus: normalizeCorpus(industry.corpus),
      evidence: normalizeEvidence(Array.isArray(industry.evidence) ? industry.evidence : []),
    },
    /* The four groups the service publishes, in the order it publishes them. The
       page never merges them: a covered skill and a gap are different facts about
       different directions of the comparison. */
    groups: {
      gaps: rows(payload.gaps, 'not_covered'),
      covered: rows(payload.covered_skills, 'covered'),
      noIndustryRecord: rows(payload.no_industry_record, 'no_industry_record'),
      unmatched: rows(payload.unmatched_curriculum_skills, 'unmatched_curriculum_skill'),
    },
    counts: {
      industrySkillCount: numberOrNull(counts.industry_skill_count),
      coveredCount: numberOrNull(counts.covered_count),
      gapCount: numberOrNull(counts.gap_count),
      noIndustryRecordCount: numberOrNull(counts.no_industry_record_count),
      unmatchedCount: numberOrNull(counts.unmatched_curriculum_skill_count),
    },
    validation: normalizeValidation(payload.validation),
    notAvailable: stringList(payload.not_available),
    stageBoundary: Object.fromEntries(
      Object.entries(boundary).map(([key, entry]) => [key, stringOrNull(entry)]),
    ),
  }
}

export async function loadCurriculumGaps(role, { signal } = {}) {
  const id = typeof role === 'string' ? role.trim().toLowerCase() : ''
  if (!CTM_ROLE_IDS.has(id)) {
    throw new CurriculumApiError('Choose one of the roles this page can show.', {
      path: '/curriculum-gaps',
      kind: 'invalid-input',
    })
  }

  const payload = await request(`/curriculum-gaps/${encodeURIComponent(id)}`, { signal, role: id })
  return normalizeGapAnalysis(payload, id)
}

/* ------------------------------------------------- proposed updates (8D)
 *
 * Placement is the service's decision and this layer only reads it. A semester and
 * a course are echoed when the service named them and are `null` when it refused,
 * and the two are never reconciled here: an unplaced recommendation is reported
 * with the reason the service published, never repaired into a plausible one.
 */
function normalizeTargetSemester(raw) {
  if (!isRecord(raw)) return null
  const semesterId = stringOrNull(raw.semester_id)
  if (!semesterId) return null
  return {
    programmeId: stringOrNull(raw.programme_id),
    versionId: stringOrNull(raw.version_id),
    academicYearId: stringOrNull(raw.academic_year_id),
    semesterId,
    sequence: numberOrNull(raw.sequence),
    term: stringOrNull(raw.term),
    recordedIndex: numberOrNull(raw.recorded_index),
  }
}

function normalizeTargetCourse(raw) {
  if (!isRecord(raw)) return null
  const courseId = stringOrNull(raw.course_id)
  if (!courseId) return null
  return {
    courseId,
    name: stringOrNull(raw.name),
    code: stringOrNull(raw.code),
    credits: numberOrNull(raw.credits),
    hours: numberOrNull(raw.hours),
    isElective: typeof raw.is_elective === 'boolean' ? raw.is_elective : null,
    recordedPrerequisites: stringList(raw.recorded_prerequisites),
    semesterId: stringOrNull(raw.semester_id),
    academicYearId: stringOrNull(raw.academic_year_id),
    recordedIndex: numberOrNull(raw.recorded_index),
  }
}

function normalizeChain(raw) {
  return (Array.isArray(raw) ? raw : [])
    .filter(isRecord)
    .map((entry) => ({
      prerequisite: stringOrNull(entry.prerequisite),
      joinKey: stringOrNull(entry.join_key),
      recordedCourses: stringList(entry.recorded_courses),
      usableCourses: stringList(entry.usable_courses),
      excludedCourses: stringList(entry.excluded_courses),
    }))
}

function normalizeRecommendation(raw) {
  if (!isRecord(raw)) return null
  const skill = stringOrNull(raw.skill)
  if (!skill) return null
  return {
    skill,
    isGap: raw.is_gap === true,
    coverageStatus: stringOrNull(raw.coverage_status),
    recommendationStatus: stringOrNull(raw.recommendation_status),
    placementStatus: stringOrNull(raw.placement_status),
    targetSemester: normalizeTargetSemester(raw.target_semester),
    targetCourse: normalizeTargetCourse(raw.target_course),
    reason: stringOrNull(raw.reason),
    evidence: normalizeEvidenceBlock(raw.industry_evidence),
    prerequisites: Array.isArray(raw.prerequisites) ? stringList(raw.prerequisites) : null,
    prerequisiteStatus: stringOrNull(raw.prerequisite_status),
    chain: normalizeChain(raw.prerequisite_chain),
    learningHours: numberOrNull(raw.learning_hours),
    hoursSource: stringOrNull(raw.hours_source),
    candidateCourses: stringList(raw.recorded_candidate_courses),
    limitations: normalizeLimitations(raw.evidence_limitations),
  }
}

function normalizeExcluded(raw) {
  const report = isRecord(raw) ? raw : {}
  const skills = (Array.isArray(report.skills) ? report.skills : [])
    .map((entry) => (isRecord(entry) ? stringOrNull(entry.skill) : typeof entry === 'string' ? entry : null))
    .filter(Boolean)
  return {
    count: numberOrNull(report.count),
    skills,
    reason: stringOrNull(report.reason),
  }
}

function normalizeRecSemester(raw) {
  if (!isRecord(raw)) return null
  const semesterId = stringOrNull(raw.semester_id)
  if (!semesterId) return null
  return {
    programmeId: stringOrNull(raw.programme_id),
    versionId: stringOrNull(raw.version_id),
    academicYearId: stringOrNull(raw.academic_year_id),
    semesterId,
    sequence: numberOrNull(raw.sequence),
    term: stringOrNull(raw.term),
    label: stringOrNull(raw.label),
    recordedCredits: numberOrNull(raw.recorded_credits),
    recordedIndex: numberOrNull(raw.recorded_index),
    courseCount: numberOrNull(raw.course_count),
    courseIds: stringList(raw.courses),
  }
}

function normalizeCountMap(raw) {
  if (!isRecord(raw)) return {}
  const counts = {}
  for (const [key, value] of Object.entries(raw)) {
    const count = numberOrNull(value)
    if (count !== null) counts[key] = count
  }
  return counts
}

export function normalizeRecommendationSet(payload, requestedRole) {
  if (!isRecord(payload) || !Array.isArray(payload.recommendations)) {
    throw new CurriculumApiError('The service returned an incomplete proposal set. Please try again.', {
      path: '/curriculum-recommendations',
      kind: 'malformed',
    })
  }

  const role = stringOrNull(payload.role_category) ?? requestedRole
  const industry = isRecord(payload.industry) ? payload.industry : {}
  const curriculum = isRecord(payload.curriculum) ? payload.curriculum : {}
  const summary = isRecord(payload.summary) ? payload.summary : {}
  const boundary = isRecord(payload.stage_boundary) ? payload.stage_boundary : {}
  const excluded = isRecord(payload.excluded) ? payload.excluded : {}
  const recommendations = payload.recommendations.map(normalizeRecommendation).filter(Boolean)

  return {
    role,
    roleLabel: roleLabel(role),
    recordId: stringOrNull(payload.record_id),
    isDemo: payload.is_demo === true,
    disclaimer: stringOrNull(payload.disclaimer),
    coverageBasis: stringOrNull(payload.coverage_basis),
    placementBasis: stringOrNull(payload.placement_basis),
    placementRules: stringList(payload.placement_rules),
    prerequisiteBasis: stringOrNull(payload.prerequisite_basis),
    prerequisiteJoin: stringOrNull(payload.prerequisite_join),
    orderingBasis: stringOrNull(payload.ordering_basis),
    targetSelectionBasis: stringOrNull(payload.target_selection_basis),
    industry: {
      plannable: industry.plannable === true,
      skillCount: numberOrNull(industry.skill_count),
      velocitySlices: stringList(industry.velocity_slices),
      reproducibility: normalizeReproducibility(industry.velocity_reproducibility),
      corpus: normalizeCorpus(industry.corpus),
      evidence: normalizeEvidence(Array.isArray(industry.evidence) ? industry.evidence : []),
    },
    curriculum: {
      recordId: stringOrNull(curriculum.record_id),
      recordKind: stringOrNull(curriculum.record_kind),
      semesterCount: numberOrNull(curriculum.semester_count),
      courseCount: numberOrNull(curriculum.course_count),
      semesters: (Array.isArray(curriculum.semesters) ? curriculum.semesters : [])
        .map(normalizeRecSemester)
        .filter(Boolean),
    },
    recommendations,
    bySkill: new Map(recommendations.map((entry) => [entry.skill, entry])),
    excluded: {
      coveredSkill: normalizeExcluded(excluded.covered_skill),
      noIndustryRecord: normalizeExcluded(excluded.no_industry_record),
      unmatchedCurriculumSkill: normalizeExcluded(excluded.unmatched_curriculum_skill),
    },
    summary: {
      gapCount: numberOrNull(summary.gap_count),
      recommendationCount: numberOrNull(summary.recommendation_count),
      placedCount: numberOrNull(summary.placed_count),
      blockedCount: numberOrNull(summary.blocked_count),
      insufficientDataCount: numberOrNull(summary.insufficient_data_count),
      byPlacementStatus: normalizeCountMap(summary.by_placement_status),
      byPrerequisiteStatus: normalizeCountMap(summary.by_prerequisite_status),
    },
    validation: normalizeValidation(payload.validation),
    notAvailable: stringList(payload.not_available),
    stageBoundary: Object.fromEntries(
      Object.entries(boundary).map(([key, entry]) => [key, stringOrNull(entry)]),
    ),
  }
}

export async function loadCurriculumRecommendations(role, { signal } = {}) {
  const id = typeof role === 'string' ? role.trim().toLowerCase() : ''
  if (!CTM_ROLE_IDS.has(id)) {
    throw new CurriculumApiError('Choose one of the roles this page can show.', {
      path: '/curriculum-recommendations',
      kind: 'invalid-input',
    })
  }

  const payload = await request(`/curriculum-recommendations/${encodeURIComponent(id)}`, { signal, role: id })
  return normalizeRecommendationSet(payload, id)
}

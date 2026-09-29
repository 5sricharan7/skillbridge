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
 */

const RAW_API_BASE = String(import.meta.env.VITE_CAREER_BRIDGE_API ?? '').trim()

/** Empty means same-origin, which is what the dev-server proxy provides. */
export const API_BASE = RAW_API_BASE.replace(/\/+$/, '')

export const CTM_SERVICE_UNAVAILABLE_MESSAGE =
  'Curriculum intelligence service unavailable. Check that the SkillBridge backend is running.'

/* ------------------------------------------------------------------ roles */

/* The two roles the page offers. `other` is a real recorded category but has no
   recorded hours and no recorded prerequisite graph, so offering it would show a
   page whose learning-path sections are empty by construction. */
export const CTM_ROLES = [
  { id: 'data_science', label: 'Data Science' },
  { id: 'backend_ml_engineer', label: 'Backend ML Engineer' },
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

function errorForResponse(response, payload, path) {
  const detail = payload && typeof payload === 'object' ? payload.detail : null
  const validRoles =
    response.status === 422 && detail && typeof detail === 'object' && Array.isArray(detail.valid_roles)
      ? detail.valid_roles
      : null

  if (validRoles) {
    return new UnknownRoleError('The service does not have recorded data for that role.', {
      requestedRole: null,
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

async function request(path, { signal } = {}) {
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
    throw errorForResponse(response, null, path)
  }

  if (!response.ok) throw errorForResponse(response, payload, path)
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

/* ------------------------------------------------------- learning path
 *
 * A stage number is the longest recorded prerequisite chain that ends at a skill.
 * Only skills the graph actually records are placed: a node with no recorded
 * prerequisites is a first-stage node, and a skill with no recorded prerequisites
 * field at all is not placed and is reported separately. Edges whose prerequisite
 * is not a node in this role's graph contribute no depth, which is also what the
 * service's `dangling_prerequisites` reports.
 */

function buildPath(skills, dangling) {
  const nodes = new Map()
  for (const skill of skills) {
    if (skill.prerequisitesRecorded) nodes.set(skill.id, skill)
  }

  const depthById = new Map()
  const resolving = new Set()

  function depthOf(id) {
    if (depthById.has(id)) return depthById.get(id)
    /* A recorded cycle would otherwise recurse forever. The service's own
       adapter rejects those upstream; this guard keeps the page rendering a
       finite, first-stage placement rather than a claim about ordering. */
    if (resolving.has(id)) return 0

    resolving.add(id)
    let depth = 0
    for (const prerequisite of nodes.get(id)?.prerequisites ?? []) {
      if (nodes.has(prerequisite)) depth = Math.max(depth, depthOf(prerequisite) + 1)
    }
    resolving.delete(id)
    depthById.set(id, depth)
    return depth
  }

  const stages = []
  for (const skill of skills) {
    if (!nodes.has(skill.id)) continue
    const level = depthOf(skill.id)
    if (!stages[level]) stages[level] = { level, skills: [] }
    stages[level].skills.push(skill)
  }

  const placed = stages.flatMap((stage) => stage.skills)
  const withHours = skills.filter((skill) => skill.hours !== null)
  const hoursRecorded = placed.reduce((total, skill) => total + (skill.hours ?? 0), 0)
  const hoursRecordedCount = placed.filter((skill) => skill.hours !== null).length

  /* Stage depth per graph node, so the recommendation layer can order by
     prerequisite depth without re-deriving the graph a second time. */
  const stageById = new Map()
  for (const stage of stages) {
    for (const skill of stage.skills) stageById.set(skill.id, stage.level)
  }

  return {
    stages,
    stageById,
    dangling,
    /* Hours recorded across the whole role, which is what the summary reports. */
    hoursTotal: withHours.reduce((total, skill) => total + skill.hours, 0),
    hoursTotalCount: withHours.length,
    /* Hours on the placed nodes only, which is what the path panel reports. */
    hoursRecorded,
    hoursRecordedCount,
    unplaced: skills.filter((skill) => !skill.prerequisitesRecorded),
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

/* ------------------------------------------------------------- changelog
 *
 * The page reports only what the two recorded slices hold. A slice is summarised
 * across the role's skills, so a total is stated only when every skill that
 * observed the slice agrees on the denominator.
 */

function buildChange(skills) {
  const bySlice = new Map()

  for (const skill of skills) {
    for (const slice of skill.slices) {
      if (!bySlice.has(slice.timeSlice)) bySlice.set(slice.timeSlice, { timeSlice: slice.timeSlice, observed: 0, totals: new Set() })
      const entry = bySlice.get(slice.timeSlice)
      entry.observed += 1
      if (slice.totalPostings !== null) entry.totals.add(slice.totalPostings)
    }
  }

  const slices = [...bySlice.values()].map((entry) => ({
    timeSlice: entry.timeSlice,
    observedSkills: entry.observed,
    totalPostings: entry.totals.size === 1 ? [...entry.totals][0] : null,
  }))

  /* Ranked by the size of the recorded frequency movement, largest first, using
     the service's own `absolute_change`. Only skills that recorded both slices
     can be compared at all. */
  const compared = skills
    .filter((skill) => skill.baseline && skill.latest && skill.absoluteChange !== null)
    .sort((a, b) => Math.abs(b.absoluteChange) - Math.abs(a.absoluteChange))

  return {
    slices,
    compared: compared.length,
    movers: compared.slice(0, 3),
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
  skills.forEach((skill, index) => {
    skill.rank = index + 1
  })

  const thresholds = isRecord(payload.thresholds) ? payload.thresholds : {}
  const path = buildPath(skills, Array.isArray(payload.dangling_prerequisites) ? payload.dangling_prerequisites.filter(isRecord) : [])

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
    path,
    change: buildChange(skills),
    /* Built from `path` so the prerequisite graph is walked exactly once. */
    recommendations: buildRecommendations(skills, path),
    evidence: normalizeEvidence(Array.isArray(payload.evidence) ? payload.evidence : []),
    artifacts: stringList(payload.artifacts),
    notAvailable: stringList(payload.not_available),
  }
}

/* -------------------------------------------------------- recommendations
 *
 * A deterministic ordering of the role's skills, built only from fields the
 * service returned. There is no composite score, no weight, no normalisation, and
 * no threshold of our own: a weighted blend of frequency and velocity would be a
 * number the artifacts never recorded, and presenting one as a priority would be a
 * claim the service did not make. Instead each entry carries the recorded fields
 * that put it where it is, so a reader can audit the ordering against the payload.
 *
 * Order, applied in sequence, all of it total and none of it random:
 *   1. prerequisite stage ascending   - a skill whose prerequisites are recorded
 *                                       and placed comes before one the graph
 *                                       does not place. Unplaced sorts last.
 *   2. classification rank ascending - core, then mid, then noise. Unclassified
 *                                       sorts after all three.
 *   3. frequency descending          - the recorded share of the role's postings.
 *   4. absolute change descending    - the recorded frequency movement.
 *   5. name ascending                - a total tiebreak, so the same payload
 *                                       always produces the same list.
 *
 * Two slices are required to place a skill at all, because the layer is reporting
 * movement between them. A skill the service did not observe in both slices is
 * reported as "Insufficient data" with the reason recorded, never as a low
 * priority: absence of a comparison is not a measurement of a small one.
 */

const CLASSIFICATION_RANK = { core: 0, mid: 1, noise: 2 }
const UNCLASSIFIED_RANK = CLASSIFICATION_RANK.noise + 1

function classificationRank(skill) {
  const rank = CLASSIFICATION_RANK[skill.classification?.toLowerCase()]
  return rank === undefined ? UNCLASSIFIED_RANK : rank
}

/** Raw text for why two slices cannot be compared, taken from the payload. */
function insufficientReason(skill) {
  const observed = skill.slices.map((slice) => slice.timeSlice)
  if (observed.length === 0) return 'No time slice was recorded for this skill.'
  if (observed.length === 1) return `Only ${observed[0]} was recorded; the pair of slices could not be compared.`
  return 'The recorded slices could not be matched to the pair the velocity score was computed from.'
}

function compareByName(a, b) {
  return a.name < b.name ? -1 : a.name > b.name ? 1 : 0
}

function directionOf(skill) {
  if (skill.absoluteChange === null) return 'unmeasured'
  if (skill.absoluteChange > 0) return 'higher'
  if (skill.absoluteChange < 0) return 'lower'
  return 'unchanged'
}

export function buildRecommendations(skills, path) {
  const stageById = path.stageById

  const placeable = []
  const insufficient = []

  for (const skill of skills) {
    if (skill.baseline && skill.latest) placeable.push(skill)
    else insufficient.push({ id: skill.id, name: skill.name, reason: insufficientReason(skill) })
  }

  const placed = placeable.slice().sort((a, b) => {
    const stageA = stageById.has(a.id) ? stageById.get(a.id) : Number.MAX_SAFE_INTEGER
    const stageB = stageById.has(b.id) ? stageById.get(b.id) : Number.MAX_SAFE_INTEGER
    if (stageA !== stageB) return stageA - stageB

    const classA = classificationRank(a)
    const classB = classificationRank(b)
    if (classA !== classB) return classA - classB

    const freqA = a.frequency ?? -1
    const freqB = b.frequency ?? -1
    if (freqA !== freqB) return freqB - freqA

    const changeA = a.absoluteChange ?? -Infinity
    const changeB = b.absoluteChange ?? -Infinity
    if (changeA !== changeB) return changeB - changeA

    return compareByName(a, b)
  })

  const recommendations = placed.map((skill, index) => {
    const stage = stageById.get(skill.id)
    const recorded = skill.prerequisitesRecorded

    return {
      order: index + 1,
      id: skill.id,
      name: skill.name,
      classification: skill.classification,
      classificationRank: classificationRank(skill),
      tier: skill.tier,
      frequency: skill.frequency,
      velocityScore: skill.velocityScore,
      absoluteChange: skill.absoluteChange,
      direction: directionOf(skill),
      baseline: skill.baseline,
      latest: skill.latest,
      hours: skill.hours,
      hoursSource: skill.hoursSource,
      stage: stage === undefined ? null : stage,
      /* null means the graph records nothing for this skill; [] means the graph
         records the node with no prerequisites. The two are not the same fact. */
      prerequisites: skill.prerequisites,
      prerequisitesRecorded: recorded,
      danglingPrerequisites: recorded
        ? skill.prerequisites.filter((name) => !stageById.has(name) && !skills.some((other) => other.id === name))
        : [],
    }
  })

  insufficient.sort(compareByName)

  return {
    recommendations,
    insufficient,
    placed: recommendations.length,
    total: skills.length,
    stageById,
  }
}

/* ------------------------------------------------------------------ report
 *
 * There is no report endpoint in this service, so nothing here calls the API and
 * nothing here is generated by a model. The report is a plain-text rendering of
 * the record this page is already showing, assembled from the fields the service
 * returned. Every line traces to `role_category`, `corpus`, `velocity_slices`,
 * `velocity_reproducibility`, `skills[]`, `evidence[]`, or `not_available`.
 *
 * Two rules make the report honest rather than merely plausible:
 *
 *   1. A field the artifacts do not record is written as "not recorded", never
 *      omitted and never filled in. An absent value in a report is invisible; a
 *      written "not recorded" is auditable.
 *   2. `percentage_change` is not written. A report is the artefact most likely to
 *      be quoted out of context, so it carries counts, frequency decimals, and
 *      recorded hours only, and it states the standing limitation that this
 *      repository holds no university, programme, year, credit, course, or
 *      curriculum-revision record.
 *
 * The function is pure and deterministic: same payload in, same text out.
 */

const REPORT_STANDING_NOTE =
  'This record contains no university, programme, year, credit, course, or curriculum-revision data. ' +
  'Nothing in it describes an existing curriculum, and no growth, coverage, or revision is claimed.'

function reportLine(label, value) {
  return `  ${label.padEnd(20)} ${value}`
}

function reportHours(skill) {
  if (skill.hours === null) return 'not recorded'
  return skill.hoursSource ? `${formatHours(skill.hours)} (${skill.hoursSource})` : formatHours(skill.hours)
}

export function reportReadiness(data) {
  const blockers = []
  const warnings = []

  if (!data || data.skills.length === 0) {
    blockers.push('The service returned no skills for this role, so there is nothing to review.')
  } else if (data.recommendations.placed === 0) {
    blockers.push(
      'No skill was observed in both recorded slices, so the record carries no movement to review. ' +
        'This is a gap in the corpus, not a finding about the role.',
    )
  }

  const status = data?.reproducibility?.status ?? null
  if (status && !/match|pass|reproduc/i.test(status)) {
    warnings.push(
      `The service recorded velocity reproducibility as "${status}". The velocity scores in this record are not ` +
        'confirmed reproducible and should be read as provisional.',
    )
  }

  if (data && data.recommendations.insufficient.length > 0) {
    warnings.push(
      `${data.recommendations.insufficient.length} of ${data.skills.length} skills were not observed in both slices ` +
        'and are listed as insufficient data rather than ranked.',
    )
  }

  return { ready: blockers.length === 0, blockers, warnings }
}

export function buildReport(data) {
  const { corpus, velocitySlices, reproducibility, recommendations, evidence, notAvailable, skills } = data
  const rule = '='.repeat(72)
  const out = []

  out.push(rule)
  out.push('CURRICULUM TIME MACHINE - ROLE REVIEW RECORD')
  out.push(rule)
  out.push('')
  out.push(reportLine('role', data.roleLabel))
  out.push(reportLine('role_category', data.role))
  out.push(reportLine('corpus rows', formatCount(corpus.datasetRows)))
  out.push(reportLine('corpus range', `${formatDate(corpus.dateMin)} to ${formatDate(corpus.dateMax)}`))
  out.push(reportLine('role postings', formatCount(corpus.rolePostings)))
  out.push(reportLine('velocity slices', velocitySlices.length ? velocitySlices.join(' | ') : 'not recorded'))
  out.push(
    reportLine(
      'reproducibility',
      `${reproducibility.status ?? 'not recorded'} (${formatCount(reproducibility.matchedScores)} of ` +
        `${formatCount(reproducibility.checkedScores)} scores matched, tolerance ${formatCount(reproducibility.tolerance)})`,
    ),
  )
  out.push('')

  out.push('RANKED SKILLS (deterministic order: stage, classification, frequency,')
  out.push('absolute change, name)')
  out.push('-'.repeat(72))
  if (recommendations.recommendations.length === 0) {
    out.push('  none - no skill was observed in both recorded slices')
  }
  for (const entry of recommendations.recommendations) {
    out.push('')
    out.push(`  ${String(entry.order).padStart(2, ' ')}. ${entry.name}`)
    out.push(reportLine('classification', entry.classification ?? 'not recorded'))
    out.push(reportLine('frequency', formatFrequency(entry.frequency)))
    out.push(
      reportLine(
        'slices',
        `${entry.baseline.timeSlice} ${formatObservation(entry.baseline)} -> ${entry.latest.timeSlice} ` +
          `${formatObservation(entry.latest)}`,
      ),
    )
    out.push(reportLine('velocity_score', formatVelocity(entry.velocityScore)))
    out.push(reportLine('absolute_change', formatDelta(entry.absoluteChange)))
    out.push(reportLine('hours', reportHours(entry)))
    out.push(reportLine('stage', entry.stage === null ? 'not placed' : String(entry.stage + 1)))
    out.push(
      reportLine(
        'prerequisites',
        !entry.prerequisitesRecorded
          ? 'not recorded'
          : entry.prerequisites.length === 0
            ? 'recorded, none'
            : entry.prerequisites.join(', '),
      ),
    )
    if (entry.danglingPrerequisites.length > 0) {
      out.push(reportLine('unresolved prereqs', entry.danglingPrerequisites.join(', ')))
    }
  }
  out.push('')

  out.push('INSUFFICIENT DATA')
  out.push('-'.repeat(72))
  if (recommendations.insufficient.length === 0) {
    out.push('  none - every tracked skill was observed in both recorded slices')
  }
  for (const entry of recommendations.insufficient) {
    out.push(`  ${entry.name}: ${entry.reason}`)
  }
  out.push('')

  out.push(`EVALUATION RECORDS AND CAVEATS (${evidence.length})`)
  out.push('-'.repeat(72))
  if (evidence.length === 0) {
    out.push('  none recorded')
  }
  for (const record of evidence) {
    out.push('')
    out.push(`  ${record.label} [${record.isSynthetic ? 'synthetic' : 'recorded'}]`)
    out.push(reportLine('summary', record.summary))
    if (record.role) out.push(reportLine('scoped to', record.role))
    if (record.source) out.push(reportLine('source', record.source))
    for (const caveat of record.caveats) out.push(reportLine('caveat', caveat))
  }
  out.push('')

  out.push(`NOT RECORDED IN THE ARTIFACTS (${notAvailable.length})`)
  out.push('-'.repeat(72))
  if (notAvailable.length === 0) {
    out.push('  none')
  }
  for (const field of notAvailable) out.push(`  - ${field.replace(/_/g, ' ')}`)
  out.push('')

  out.push('LIMITATION')
  out.push('-'.repeat(72))
  out.push(`  ${REPORT_STANDING_NOTE}`)
  out.push('')
  out.push(`  Tracked skills: ${skills.length}. Ranked: ${recommendations.placed}. ` +
    `Insufficient data: ${recommendations.insufficient.length}.`)
  out.push('')

  return out.join('\n')
}

export const REPORT_STANDING_LIMITATION = REPORT_STANDING_NOTE

/* ----------------------------------------------------------------- loader */

export async function loadCurriculumIntelligence(role, { signal } = {}) {
  const id = typeof role === 'string' ? role.trim().toLowerCase() : ''
  const path = '/curriculum-intelligence'

  if (!CTM_ROLE_IDS.has(id)) {
    throw new CurriculumApiError('Choose one of the roles this page can show.', { path, kind: 'invalid-input' })
  }

  const payload = await request(`${path}/${encodeURIComponent(id)}`, { signal })
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

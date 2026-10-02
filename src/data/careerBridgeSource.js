/**
 * Career Bridge data boundary.
 *
 * Single seam between the Career Bridge UI and its data. Components never import
 * `careerBridgeMock.js` or `evidenceData.js` directly — they import this module —
 * so the data source is a configuration choice rather than a code change. The
 * Career Bridge also exposes explicit local demo loaders for its in-product
 * DEMO mode, which must remain independent of API availability.
 *
 * Every exported loader is asynchronous in both modes, so the UI has exactly one
 * consumption path. Mock mode resolves locally and issues no requests.
 *
 * ---------------------------------------------------------------------------
 * Configuration (Vite env, see .env.example)
 * ---------------------------------------------------------------------------
 *
 * VITE_CAREER_BRIDGE_MODE  'api' (default) | 'mock'
 * VITE_CAREER_BRIDGE_API   backend base URL. Empty means same-origin, which is
 *                          what the dev-server proxy in vite.config.js provides.
 * VITE_CAREER_BRIDGE_TARGET_ROLE
 *                          optional artifact role category sent only when it is
 *                          one of the backend's current plannable roles. Omitted
 *                          by default.
 *
 * API mode never falls back to mock data. A failed request stays a failure and is
 * surfaced to the user through `describeApiError`.
 *
 * ---------------------------------------------------------------------------
 * Backend contracts this is shaped against (see backend/main.py, backend/schemas.py)
 * ---------------------------------------------------------------------------
 *
 * POST /roadmap            request  { resume_text: string, jd_text: string,
 *                                    budget_hours: number,
 *   target_role?: string }
 *                          response { budget_hours: number,
 *                                    roadmap: Array<{ skill: string, hours: number,
 *                                                   priority: string, reason: string,
 *                                                   vendor_flag: boolean }> }
 *   Note: items are keyed by `skill` (a normalized string), there is no `id`,
 *   no `name`, and no `trend`. `reason` carries the justification, `priority` is
 *   one of critical / important / supporting, and the response carries no
 *   presentation metadata. Velocity is a separate endpoint, so trend and demand
 *   arrive with `loadVelocity` and are merged into the item.
 *
 *   An unknown or unplannable `target_role` returns 422 with
 *   `detail.valid_roles` or `detail.plannable_roles`; that is surfaced as
 *   `UnsupportedTargetRoleError` rather than being retried or hidden.
 *
 * GET  /velocity/{skill}   -> { skill: string,
 *                               trend: 'rising'|'declining'|'stable'|'insufficient_data',
 *                               percentage_change: number|null,
 *                               absolute_change: number|null,
 *                               history: Array<{ period: string, count: number }> }
 *   Note: `trend` is LOWERCASE on the wire. The UI presents 'Rising' / 'Stable' /
 *   'Declining', so trend casing is normalized here and nowhere else. An unknown
 *   skill is a 200 with 'insufficient_data' and null measures, not an error.
 *
 * GET  /vendor-flags       -> Array<object>   (currently [] server-side)
 * GET  /proofs             -> Array<object>   Proof B (one record per role), Proof C,
 *                                           and Proof E. Proof A is not served and
 *                                           is never synthesised here.
 *
 * Real mode sends locally extracted resume text, the user-entered job
 * description, the selected target role and the available hours through
 * submitRoadmap, then enriches the returned route with the per-skill velocity
 * the service actually holds. Demo mode uses the explicit local loaders and
 * never issues a request.
 *
 * ---------------------------------------------------------------------------
 * What Real mode can source, and what it cannot (audited, not assumed)
 * ---------------------------------------------------------------------------
 *
 * Real API data       name, hours, priority, reason (POST /roadmap); the service's
 *                     echoed budget_hours; trend and percentage change
 *                     (GET /velocity/{skill}); proof records (GET /proofs);
 *                     per-role recorded posting counts, per-role skill frequency
 *                     and artifact classification, the recorded velocity score,
 *                     and the dataset bounds and artifact names
 *                     (GET /curriculum-intelligence/{role})
 * Not recorded        job-description share, salary, prerequisites, topics,
 *                     resources, per-skill resume analysis, and any measure of how
 *                     well this learner fits a role. None of these is invented:
 *                     the UI states that a field is not available.
 *
 * Role comparison, audited at Stage 11. The only route that accepts a resume and
 * a job description is POST /roadmap, and it takes the target role from the
 * caller and returns a plan for it: it never compares roles. Every curriculum
 * route takes a role alone, so none of them can score this learner against a
 * role. Closest-fit is therefore unsourced, is stated as unsourced in the UI, and
 * no role is ever presented as a fit for the learner.
 */

import {
  CAREER_BRIDGE_BANDS,
  CAREER_BRIDGE_DEFAULT_BUDGET,
  CAREER_BRIDGE_MAX_BUDGET,
  CAREER_BRIDGE_MIN_BUDGET,
  CAREER_BRIDGE_PROFILE,
  getBudgetBand,
  getMockRoadmap,
  getRoadmapHours,
} from './careerBridgeMock'
import { PROOF_A_DATA, PROOF_B_DATA, PROOF_C_DATA, PROOF_E_DATA } from './evidenceData'

export { CAREER_BRIDGE_BANDS, CAREER_BRIDGE_DEFAULT_BUDGET, CAREER_BRIDGE_MAX_BUDGET, CAREER_BRIDGE_MIN_BUDGET }

export const ROADMAP_BUDGET_RANGE = {
  min: CAREER_BRIDGE_MIN_BUDGET,
  max: CAREER_BRIDGE_MAX_BUDGET,
  step: 10,
}

/* ------------------------------------------------------------------ mode */

const RAW_MODE = String(import.meta.env.VITE_CAREER_BRIDGE_MODE ?? '').trim().toLowerCase()

/** 'api' unless the environment explicitly asks for 'mock'. */
export const CAREER_BRIDGE_MODE = RAW_MODE === 'mock' ? 'mock' : 'api'
export const IS_API_MODE = CAREER_BRIDGE_MODE === 'api'

const RAW_API_BASE = String(import.meta.env.VITE_CAREER_BRIDGE_API ?? '').trim()
export const API_BASE = RAW_API_BASE.replace(/\/+$/, '')

/* ----------------------------------------------------------------- roles

   The service can only plan a role that appears in BOTH hours_per_skill.json
   and dag_structure.json (see plannable_roles in backend/data/adapters.py).
   Read from the running service, that set is exactly the two identifiers below;
   POST /roadmap rejects anything else with 422 and names the roles it does hold
   in `detail.valid_roles` / `detail.plannable_roles`, which is the correction
   path when this list ever drifts.

   `label` is presentation only. The identifier is what goes on the wire, and it
   is never rewritten into a display form before being sent. There is deliberately
   no entry for the product's own 'Embedded Systems Engineer' role: the service
   holds no role-scoped hours or DAG for it, so the UI offers it nowhere. */
export const CAREER_BRIDGE_TARGET_ROLES = [
  { id: 'backend_ml_engineer', label: 'Backend ML Engineer' },
  { id: 'data_science', label: 'Data Science' },
]

const PLANNABLE_TARGET_ROLES = new Set(CAREER_BRIDGE_TARGET_ROLES.map((role) => role.id))

/** The empty selection: plan from the resume and job description alone. */
export const NO_TARGET_ROLE = ''

export function isSupportedTargetRole(role) {
  return typeof role === 'string' && PLANNABLE_TARGET_ROLES.has(role)
}

/** Display label for a backend role identifier, or '' for no role selected. */
export function targetRoleLabel(role) {
  if (!isSupportedTargetRole(role)) return ''
  return CAREER_BRIDGE_TARGET_ROLES.find((entry) => entry.id === role)?.label ?? ''
}

const CONFIGURED_TARGET_ROLE = String(import.meta.env.VITE_CAREER_BRIDGE_TARGET_ROLE ?? '').trim()
export const API_TARGET_ROLE = isSupportedTargetRole(CONFIGURED_TARGET_ROLE.toLowerCase())
  ? CONFIGURED_TARGET_ROLE.toLowerCase()
  : null
export const API_TARGET_ROLE_WARNING =
  CONFIGURED_TARGET_ROLE && !API_TARGET_ROLE ? CONFIGURED_TARGET_ROLE : null

export const CAREER_BRIDGE_SOURCE_LABEL = IS_API_MODE
  ? 'Live SkillBridge service'
  : 'Mock analysis · local roadmap data'

/* ----------------------------------------------------------------- errors */

/** Deliberately free of URLs, stack traces and backend exception text. */
export const SERVICE_UNAVAILABLE_MESSAGE =
  'Career intelligence service unavailable. Check that the SkillBridge backend is running.'

export class CareerBridgeApiError extends Error {
  constructor(message, { status = 0, path = '', kind = 'unknown' } = {}) {
    super(message)
    this.name = 'CareerBridgeApiError'
    this.status = status
    this.path = path
    this.kind = kind
  }
}

export class UnsupportedTargetRoleError extends CareerBridgeApiError {
  constructor(message, { requestedRole, supportedRoles }) {
    super(message, { status: 422, path: '/roadmap', kind: 'unsupported-role' })
    this.name = 'UnsupportedTargetRoleError'
    this.requestedRole = requestedRole
    this.supportedRoles = supportedRoles
  }
}

export function isAbortError(error) {
  return error?.name === 'AbortError'
}

/** Turn any thrown value into copy that is safe and useful to show a user. */
export function describeApiError(error) {
  if (error instanceof UnsupportedTargetRoleError) {
    return {
      kind: 'unsupported-role',
      title: 'Live roadmap unavailable for this role',
      message: `${error.requestedRole} is not a target role the SkillBridge service can plan yet, so no live roadmap is available for it.`,
      detail: error.supportedRoles.length
        ? `Roles the service can plan today: ${error.supportedRoles.join(', ')}.`
        : 'The service reported no plannable target roles.',
      requestedRole: error.requestedRole,
      supportedRoles: error.supportedRoles,
    }
  }

  return {
    kind: 'api',
    title: 'Career intelligence service unavailable',
    message: typeof error?.message === 'string' && error.message ? error.message : SERVICE_UNAVAILABLE_MESSAGE,
    detail: '',
    requestedRole: null,
    supportedRoles: [],
  }
}

/* ----------------------------------------------------------------- client */

function errorForResponse(response, payload, path, { requestedRole = '' } = {}) {
  const detail = payload && typeof payload === 'object' ? payload.detail : null
  const supportedRoles =
    response.status === 422 && detail && typeof detail === 'object'
      ? Array.isArray(detail.valid_roles)
        ? detail.valid_roles
        : Array.isArray(detail.plannable_roles)
          ? detail.plannable_roles
          : null
      : null

  if (supportedRoles) {
    return new UnsupportedTargetRoleError('The service cannot plan this target role yet.', {
      requestedRole: requestedRole || API_TARGET_ROLE || '',
      supportedRoles: supportedRoles.filter((role) => typeof role === 'string'),
    })
  }

  if (response.status === 404) {
    return new CareerBridgeApiError('The career intelligence service did not recognise that request.', {
      status: 404,
      path,
      kind: 'not-found',
    })
  }

  if (response.status >= 500) {
    return new CareerBridgeApiError('The career intelligence service is temporarily unavailable.', {
      status: response.status,
      path,
      kind: 'server',
    })
  }

  return new CareerBridgeApiError('The career intelligence service could not complete that request.', {
    status: response.status,
    path,
    kind: 'rejected',
  })
}

async function request(path, { method = 'GET', body, signal, requestedRole = '' } = {}) {
  let response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      signal,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (error) {
    /* An abort is the caller's own cancellation, not a service failure. */
    if (isAbortError(error)) throw error
    throw new CareerBridgeApiError(SERVICE_UNAVAILABLE_MESSAGE, { path, kind: 'unreachable' })
  }

  if (response.status === 204) return null

  let payload = null
  try {
    payload = await response.json()
  } catch {
    if (response.ok) {
      throw new CareerBridgeApiError(SERVICE_UNAVAILABLE_MESSAGE, { path, kind: 'malformed' })
    }
    throw errorForResponse(response, null, path, { requestedRole })
  }

  if (!response.ok) throw errorForResponse(response, payload, path, { requestedRole })
  return payload
}

/* ----------------------------------------------------------------- types
 * RoadmapItem   { id, name, hours, priority, type, trend, demand, position,
 *                 description, why, prerequisites[], topics[], resources[],
 *                 velocity }
 * Velocity      { skill, trend, percentage_change, absolute_change,
 *                 baseline_count, latest_count, history[] }
 * Proof         { id, kind, title, summary, detail, flag?, facts[] }
 * VendorFlag    { vendor, skill, note }
 * Roadmap       { items[], budgetHours, availableHours, committedHours, band,
 *                 source, targetRole }
 */

/* ------------------------------------------------------------ normalizers */

const TREND_FROM_WIRE = { rising: 'Rising', declining: 'Declining', stable: 'Stable' }
const TREND_TO_WIRE = { Rising: 'rising', declining: 'declining', Stable: 'stable' }

export const TREND_INSUFFICIENT = 'Insufficient data'

/* The API speaks in optimizer priority; the workspace presents three tiers. */
const PRIORITY_FROM_WIRE = { critical: 'High', important: 'Medium', supporting: 'Low' }
const PRIORITY_PRESENTED = new Set(['High', 'Medium', 'Low'])

/** Wire trend ('rising' | 'insufficient_data') -> display trend. */
export function normalizeTrend(value) {
  const key = typeof value === 'string' ? value.trim().toLowerCase() : ''; return TREND_FROM_WIRE[key] ?? TREND_INSUFFICIENT
}

/** Display trend -> wire trend. */
export function denormalizeTrend(value) {
  return TREND_TO_WIRE[value] ?? 'stable'
}

/** Optimizer priority ('critical') or presented priority ('High') -> presented. */
export function normalizePriority(value, fallback = 'Medium') {
  if (typeof value !== 'string') return fallback
  const key = value.trim()
  if (PRIORITY_PRESENTED.has(key)) return key
  return PRIORITY_FROM_WIRE[key.toLowerCase()] ?? fallback
}

/** "+38%" -> 38. Returns null when the field is absent or unparseable. */
export function parseDemandPercent(value) {
  if (typeof value === 'number') return value
  const parsed = Number.parseFloat(String(value ?? '').replace('%', ''))
  return Number.isFinite(parsed) ? parsed : null
}

export function formatPercent(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
  return `${value > 0 ? '+' : ''}${Math.round(value)}%`
}

/**
 * Build the UI-facing Velocity object from a GET /velocity response.
 * `history` is passed through untouched so a real backtest series renders as-is.
 */
export function normalizeVelocity(payload, fallbackSkill = '') {
  const skill = payload?.skill ?? fallbackSkill
  const history = Array.isArray(payload?.history) ? payload.history : []
  const percentage = typeof payload?.percentage_change === 'number' ? payload.percentage_change : null
  const absolute = typeof payload?.absolute_change === 'number' ? payload.absolute_change : null

  return {
    skill,
    trend: normalizeTrend(payload?.trend ?? 'insufficient_data'),
    percentage_change: percentage,
    absolute_change: absolute,
    baseline_count: history.length ? history[0].count : null,
    latest_count: history.length ? history[history.length - 1].count : null,
    history,
  }
}

/**
 * Derive a Velocity object from a roadmap item, for sources that return demand
 * as a percentage but no separate velocity series.
 *
 * The mock exposes only `demand` ('+38%'). This expresses that same number in the
 * velocity contract's terms as a two-point baseline -> latest comparison, which is
 * the same claim in the same units. It does not introduce a new metric: a real
 * /velocity response should be preferred whenever one is available.
 */
function velocityFromDemand(skill) {
  const percentage = parseDemandPercent(skill.demand)
  if (percentage === null) return normalizeVelocity({ skill: skill.name, trend: skill.trend }, skill.name)

  const baselineCount = 100
  return normalizeVelocity(
    {
      skill: String(skill.name).toLowerCase(),
      trend: denormalizeTrend(skill.trend),
      percentage_change: percentage,
      absolute_change: percentage,
      history: [
        { period: 'baseline', count: baselineCount },
        { period: 'latest', count: baselineCount + percentage },
      ],
    },
    skill.name,
  )
}

/**
 * Attach a real GET /velocity response to an already-normalized item.
 *
 * Trend and demand then come from the service's own recorded series. A skill the
 * service holds no series for keeps `null` measures, which the UI reports as not
 * recorded; nothing is inferred to fill the gap.
 */
export function withVelocity(item, velocity) {
  if (!item || !velocity) return item

  return {
    ...item,
    trend: velocity.trend,
    demand: velocity.percentage_change === null ? null : formatPercent(velocity.percentage_change),
    velocity,
  }
}

/**
 * Map one roadmap item into the UI-facing RoadmapItem.
 *
 * `reason` from the API becomes `why`; `skill` becomes both `id` and `name`. A
 * `velocity` argument wins when the caller already has a real /velocity response,
 * so an item can be normalized first and enriched afterwards.
 *
 * Presentation-only fields (type, description, topics, resources) have no server
 * equivalent and are read defensively rather than assumed, so an API item simply
 * carries none of them instead of a fabricated value.
 */
export function normalizeRoadmapItem(item, index, velocity) {
  const name = item.name ?? item.skill ?? 'Unknown skill'
  const resolved = velocity ?? (item.velocity ? normalizeVelocity(item.velocity, name) : velocityFromDemand(item))

  return {
    id: item.id ?? item.skill ?? name,
    name,
    hours: Number.isFinite(item.hours) ? item.hours : 0,
    priority: normalizePriority(item.priority),
    type: item.type ?? 'Core Skill',
    trend: resolved.trend,
    demand: item.demand ?? (resolved.percentage_change === null ? null : formatPercent(resolved.percentage_change)),
    position: Number.isFinite(item.position) ? item.position : index + 1,
    rank: Number.isFinite(item.rank) ? item.rank : index + 1,
    description: item.description ?? item.reason ?? '',
    why: item.why ?? item.reason ?? 'Selected from your resume and target role analysis.',
    prerequisites: Array.isArray(item.prerequisites) ? item.prerequisites : [],
    topics: Array.isArray(item.topics) ? item.topics : [],
    resources: Array.isArray(item.resources) ? item.resources : [],
    vendor_flag: item.vendor_flag === true,
    velocity: resolved,
  }
}

/**
 * One roadmap item as returned by POST /roadmap.
 *
 * The live service returns only skill, hours, priority, reason and vendor_flag —
 * no id, no name, no trend and no presentation metadata. This validates the shape
 * before normalizing and drops the fields the service does not supply rather than
 * fabricating them, so an API item carries none of type, description, topics or
 * resources. `velocities` is the map of real /velocity records for this route.
 */
export function normalizeApiRoadmapItem(item, index, velocities) {
  const isRecord = item !== null && typeof item === 'object' && !Array.isArray(item)
  const priority = isRecord ? normalizePriority(item.priority, null) : null

  if (
    !isRecord ||
    typeof item.skill !== 'string' ||
    !item.skill.trim() ||
    !Number.isFinite(item.hours) ||
    item.hours < 0 ||
    !priority ||
    typeof item.reason !== 'string' ||
    !item.reason.trim() ||
    typeof item.vendor_flag !== 'boolean'
  ) {
    throw new CareerBridgeApiError('The service returned an incomplete roadmap. Please try again.', {
      path: '/roadmap',
      kind: 'malformed',
    })
  }

  const normalized = normalizeRoadmapItem({ ...item, priority }, index)
  return withVelocity(
    {
      ...normalized,
      type: undefined,
      description: item.reason,
      why: item.reason,
      prerequisites: [],
      topics: [],
      resources: [],
    },
    velocities?.get(normalized.id) ?? null,
  )
}

/* ---------------------------------------------------------------- profile */

/**
 * The checked-in profile, with the target role aligned to the configured
 * `target_role` when one is set, so the role on screen is always the role that
 * was requested rather than a stale label.
 */
function resolveProfile() {
  if (!IS_API_MODE || !API_TARGET_ROLE) return CAREER_BRIDGE_PROFILE
  return {
    ...CAREER_BRIDGE_PROFILE,
    targetRole: API_TARGET_ROLE,
    jobDescription: { ...CAREER_BRIDGE_PROFILE.jobDescription, file: API_TARGET_ROLE },
  }
}

/* ------------------------------------------------------------ mock source */

const MOCK_PROOFS = [
  {
    id: 'velocity',
    kind: 'velocity',
    title: 'Skill velocity & backtest',
    summary: 'How fast each stop becomes usable, and whether the route holds up as your available time changes.',
    detail:
      'Each stop is scored against observed posting history rather than a static list. Velocity is the percentage change from the baseline observation to the most recent one, and the route is re-scored every time your time budget moves between bands.',
  },
  {
    id: 'external',
    kind: 'external',
    title: 'External comparison',
    summary: 'The recommended path set against wider market demand signals for the same role.',
    detail:
      'External signals are used to confirm that the route is not an artefact of one job description. When no external signal is available for a stop, the roadmap falls back to local analysis and the stop is flagged.',
  },
  {
    id: 'baseline',
    kind: 'baseline',
    title: 'Naive baseline comparison',
    summary: 'The gap between this prioritized route and an equal-hours, unprioritized baseline.',
    detail:
      'A baseline spends the same number of hours without ranking skills by gap or prerequisite order. The difference in outcome is the argument for prioritization: same time, different destination.',
  },
]

const mockSource = {
  loadProfile() {
    return resolveProfile()
  },

  async loadRoadmap({ budgetHours }) {
    const items = getMockRoadmap(budgetHours).map((item, index) => normalizeRoadmapItem(item, index))
    return {
      budgetHours,
      availableHours: budgetHours,
      band: getBudgetBand(budgetHours),
      items,
      committedHours: getRoadmapHours(items),
      source: 'demo',
      targetRole: null,
    }
  },

  async loadVelocity(skillName) {
    const match = getMockRoadmap(CAREER_BRIDGE_DEFAULT_BUDGET).find(
      (skill) => skill.name === skillName || skill.id === skillName,
    )
    return match ? velocityFromDemand(match) : null
  },

  async loadProofs() {
    return MOCK_PROOFS
  },

  async loadVendorFlags() {
    return []
  },
}

/* Explicit demo loaders bypass the environment-selected API source so the
   presentation demo remains deterministic and works without a backend. */
export function loadDemoProfile() {
  return CAREER_BRIDGE_PROFILE
}

export function loadDemoRoadmap(options) {
  return mockSource.loadRoadmap(options)
}

export function loadDemoProofs() {
  return mockSource.loadProofs()
}

export function loadDemoVendorFlags() {
  return mockSource.loadVendorFlags()
}

/* ------------------------------------------------------------- api source
 * The only place in the application that performs network access. Components
 * must not call fetch; they use the loaders below.
 */

const ROLE_ACRONYMS = new Set(['ml', 'ai', 'nlp', 'api', 'sql', 'llm', 'ui', 'ux', 'etl', 'aws', 'gcp'])

export function humanizeRole(role) {
  if (typeof role !== 'string' || !role) return ''
  return role
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => {
      const key = word.toLowerCase()
      /* 'backend_ml_engineer' is not 'Backend Ml Engineer'. */
      if (ROLE_ACRONYMS.has(key)) return key.toUpperCase()
      return word.charAt(0).toUpperCase() + word.slice(1)
    })
    .join(' ')
}

const apiSource = {
  loadProfile() {
    return resolveProfile()
  },

  /**
   * Every distinct skill in a route, looked up in the service's velocity history.
   *
   * A skill the service holds no series for is still returned, as a normalized
   * record with null measures, because "the service holds no series" is itself a
   * real answer. A failed lookup is the one thing that is dropped: it contributes
   * no record, so the route is unaffected by a velocity outage.
   */
  async loadVelocities(skills, { signal } = {}) {
    const names = [...new Set(skills.filter((skill) => typeof skill === 'string' && skill.trim()))]
    const settled = await Promise.allSettled(
      names.map((name) => request(`/velocity/${encodeURIComponent(name)}`, { signal })),
    )

    const records = new Map()
    settled.forEach((outcome, index) => {
      if (outcome.status === 'fulfilled') records.set(names[index], normalizeVelocity(outcome.value, names[index]))
    })
    return records
  },

  async loadRoadmap({ budgetHours, resumeText, jdText, targetRole, signal }) {
    if (typeof resumeText !== 'string' || !resumeText.trim()) {
      throw new CareerBridgeApiError('Extract a resume before generating a roadmap.', {
        path: '/roadmap',
        kind: 'invalid-input',
      })
    }
    if (typeof jdText !== 'string' || !jdText.trim()) {
      throw new CareerBridgeApiError('Add a job description before generating a roadmap.', {
        path: '/roadmap',
        kind: 'invalid-input',
      })
    }

    /* Only a role the service can actually plan is sent, and an unsupported one is
       omitted rather than sent to produce a 422 the user cannot act on. */
    const role = isSupportedTargetRole(targetRole) ? targetRole : null

    const body = {
      resume_text: resumeText,
      jd_text: jdText,
      budget_hours: budgetHours,
    }
    if (role) body.target_role = role

    const payload = await request('/roadmap', {
      method: 'POST',
      signal,
      body,
      requestedRole: role ?? '',
    })

    if (
      !payload ||
      typeof payload !== 'object' ||
      !Number.isFinite(payload.budget_hours) ||
      !Array.isArray(payload.roadmap)
    ) {
      throw new CareerBridgeApiError('The service returned an incomplete roadmap. Please try again.', {
        path: '/roadmap',
        kind: 'malformed',
      })
    }

    /* Trend and demand are not part of the roadmap response. They come from the
       service's own per-skill velocity history, and a failure there leaves the
       route intact with unrecorded demand rather than failing the request. */
    const velocities = await apiSource.loadVelocities(
      payload.roadmap.map((item) => item?.skill),
      { signal },
    )

    /* map() passes the array as a third argument, so the index is passed
       explicitly to keep it out of normalizeRoadmapItem's velocity slot. */
    const items = payload.roadmap.map((item, index) => normalizeApiRoadmapItem(item, index, velocities))

    return {
      budgetHours: payload.budget_hours,
      availableHours: payload.budget_hours,
      band: getBudgetBand(budgetHours),
      items,
      committedHours: items.reduce((total, item) => total + (Number(item.hours) || 0), 0),
      source: 'api',
      targetRole: role,
    }
  },

  async loadVelocity(skillName, { signal } = {}) {
    const payload = await request(`/velocity/${encodeURIComponent(skillName)}`, { signal })
    return normalizeVelocity(payload, skillName)
  },

  async loadVendorFlags({ signal } = {}) {
    const flags = await request('/vendor-flags', { signal })
    return Array.isArray(flags) ? flags : []
  },
}

/* ------------------------------------------------------------------ facade */

const active = IS_API_MODE ? apiSource : mockSource

export function loadProfile() {
  return active.loadProfile()
}

export function loadRoadmap(options) {
  return active.loadRoadmap(options)
}

/** Real mode always submits to the API; it never follows the configured mock source. */
export function submitRoadmap(options) {
  return apiSource.loadRoadmap(options)
}

export function loadVelocity(skillName, options) {
  return active.loadVelocity(skillName, options)
}

export function loadVendorFlags(options) {
  return active.loadVendorFlags(options)
}

/* --------------------------------------------------- real proof adapter

   The Career Bridge "Evidence & insights" panel reads the same GET /proofs
   response the Evidence workspace does, reshaped into the panel rows it already
   renders. Real mode never reuses MOCK_PROOFS: a proof the service does not
   return is absent, and a proof the service marks synthetic keeps that label and
   its caveats on the surface that shows it.

   Every figure below is copied from a served record. Nothing is pooled across
   roles, nothing is ranked, and no missing measurement is filled in. */

const RECORDED_FLAG = 'Recorded'
const SYNTHETIC_FLAG = 'Synthetic · illustrative'

function proofCaveats(record) {
  return asStringList(record?.caveats)
}

function roundPercent(value) {
  if (!Number.isFinite(value)) return null
  return Math.round(value * 10) / 10
}

function measuredChange(value, baseline) {
  if (!Number.isFinite(value) || !Number.isFinite(baseline) || baseline === 0) return null
  return roundPercent(((value - baseline) / baseline) * 100)
}

/** Proof B — recorded external-reference overlap for one role category. */
function realProofB(record) {
  const metrics = record.metrics ?? {}
  const overlap = roundPercent(metrics.overlap_pct)
  const matched = Number.isFinite(metrics.matched) ? metrics.matched : null
  const reference = Number.isFinite(metrics.top10_count) ? metrics.top10_count : null
  const role = String(record.role_category ?? '')
  const label = humanizeRole(role)
  const matchedSkills = (Array.isArray(metrics.skill_results) ? metrics.skill_results : []).filter(
    (result) => result?.external_match === true,
  )
  const checked = Array.isArray(metrics.skill_results) ? metrics.skill_results.length : 0

  const facts = [
    overlap === null
      ? 'No overlap figure is recorded for this role.'
      : `Overlap ${overlap}% · ${matched ?? '—'} of the ${reference ?? '—'} skills in the reference top-10 set also appear in this role's SkillBridge route.`,
    checked
      ? `${checked} recorded skill${checked === 1 ? '' : 's'} checked against the reference set; ${matchedSkills.length} matched.`
      : 'The service records no per-skill comparison for this role.',
    `Source: ${String(record.source ?? 'not recorded')}.`,
    ...proofCaveats(record),
  ]

  return {
    id: record.proof_id,
    kind: 'external',
    title: `External reference overlap · ${label || role}`,
    summary:
      overlap === null
        ? 'The service records this role but no overlap figure for it.'
        : `${overlap}% of a recorded reference set overlaps this role's route.`,
    detail: 'Measured against one externally maintained reference set, role by role. Nothing is pooled between roles.',
    flag: record.is_synthetic === true ? SYNTHETIC_FLAG : RECORDED_FLAG,
    facts,
  }
}

/** Proof C — the recorded naive-versus-signal benchmark, synthetic by definition. */
function realProofC(record) {
  const naive = record.metrics?.naive ?? {}
  const signal = record.metrics?.signal_engine ?? {}
  const n = Number.isFinite(record.sample_size) ? record.sample_size : null
  const precision = measuredChange(signal.precision, naive.precision)

  const facts = [
    `Precision ${roundPercent(signal.precision) ?? '—'} against ${roundPercent(naive.precision) ?? '—'} for the naive keyword baseline${
      precision === null ? '' : ` (${precision > 0 ? '+' : ''}${precision}%)`
    }.`,
    `Structural hits ${signal.structural_hits ?? '—'} against ${naive.structural_hits ?? '—'}.`,
    `Flagged gaps ${signal.flagged_gaps ?? '—'} against ${naive.flagged_gaps ?? '—'}.`,
    n === null ? '' : `Controlled cases: n=${n}.`,
    `Source: ${String(record.source ?? 'not recorded')}.`,
    ...proofCaveats(record),
  ].filter(Boolean)

  return {
    id: record.proof_id,
    kind: 'baseline',
    title: 'Naive baseline comparison',
    summary: 'The recorded gap between the signal engine and an unprioritized keyword baseline.',
    detail:
      'Both methods score the same controlled cases. The comparison is the recorded one, including where the baseline matches.',
    flag: SYNTHETIC_FLAG,
    facts,
  }
}

/** Proof E — the recorded budget-sensitivity example for one role. */
function realProofE(record) {
  const metrics = record.metrics ?? {}
  const role = String(record.role_category ?? '')
  const label = humanizeRole(role)
  const plan20 = asStringList(metrics.plan_20_hours)
  const plan100 = asStringList(metrics.plan_100_hours)
  const identical = metrics.plans_identical === true

  const facts = [
    `Recorded 20-hour plan: ${plan20.length ? plan20.join(', ') : 'no skills recorded'}.`,
    `Recorded 100-hour plan: ${plan100.length ? plan100.join(', ') : 'no skills recorded'}.`,
    identical
      ? 'The two recorded plans are identical, so this example does not show budget sensitivity.'
      : 'The two recorded plans differ, so this example shows budget sensitivity.',
    `Source: ${String(record.source ?? 'not recorded')}.`,
    ...proofCaveats(record),
  ]

  return {
    id: record.proof_id,
    kind: 'budget',
    title: `Budget sensitivity example · ${label || role}`,
    summary: identical
      ? 'The recorded example produced the same plan at 20h and 100h.'
      : 'The recorded example reprioritized the plan between 20h and 100h.',
    detail: 'A recorded illustration of how one profile was planned at two budgets. It is not this route.',
    flag: SYNTHETIC_FLAG,
    facts,
  }
}

/**
 * Proof rows for the Career Bridge evidence panel, from GET /proofs.
 *
 * Proof B and Proof E are role-scoped records, so only the role being planned is
 * shown: the selected target role when it has a record, otherwise the first
 * *plannable* role the service records. A role it cannot plan — "other" — is never
 * offered as a substitute, because its record describes a bucket rather than a
 * role a user could have selected. Proof C is not role-scoped and is shown once,
 * labelled synthetic, because that is what it is.
 *
 * The demo constants are never returned here.
 */
export async function loadRealProofs({ targetRole = null, signal } = {}) {
  const records = await request('/proofs', { signal })
  const list = Array.isArray(records) ? records : []

  const chosen = isSupportedTargetRole(targetRole) ? targetRole : ''
  const pickForRole = (proofType) => {
    const scoped = list.filter((record) => record?.proof_type === proofType)
    return (
      scoped.find((record) => String(record?.role_category ?? '') === chosen) ??
      scoped.find((record) => isSupportedTargetRole(record?.role_category)) ??
      scoped[0] ??
      null
    )
  }

  const rows = []
  const overlap = pickForRole('external_reference_overlap')
  if (overlap) rows.push(realProofB(overlap))

  const benchmark = list.find((record) => record?.proof_type === 'naive_vs_signal_synthetic_benchmark')
  if (benchmark) rows.push(realProofC(benchmark))

  const budget = pickForRole('budget_sensitivity_example')
  if (budget) rows.push(realProofE(budget))

  return rows
}

/* ---------------------------------------------------------- market demand
 * Path B, market demand. GET /market-demand serves both layers side by side and
 * keeps them apart, which is the whole point of the response:
 *  - `corpus`, `roles` and `skills` are the prepared static baseline over
 *    backend/data. Every figure is a value a finalized artifact recorded. Nothing
 *    here pools, weights or turns one into a score, and a field the artifacts did
 *    not record stays null.
 *  - `fresh_signals` are individual recent live postings read from
 *    backend/data/live_postings.csv. They are published one record at a time and
 *    are never merged into the prepared rows, because a small sample cannot move
 *    a ranking.
 *
 * Order is presentational and the UI names it: roles are listed by the posting
 * count they recorded, which is the only cross-role number the artifacts hold.
 * That is not a fit score and it is not a demand score.
 *
 * `live_data_last_updated` is the newest posting date the live file records. It is
 * an observed date, never a claim about when a scrape ran, and it is null when no
 * live data exists yet.
 */

const MARKET_DEMAND_PATH = '/market-demand'

function marketRoleLabel(id) {
  return CAREER_BRIDGE_TARGET_ROLES.find((entry) => entry.id === id)?.label ?? humanizeRole(id)
}

function marketSkillRow(row) {
  return {
    name: String(row?.skill ?? ''),
    /* The recorded share of this role's postings that mention the skill. */
    frequency: Number.isFinite(row?.frequency) ? row.frequency : null,
    classification: typeof row?.classification === 'string' ? row.classification : '',
    velocityScore: Number.isFinite(row?.velocity_score) ? row.velocity_score : null,
  }
}

/** One fresh live posting, exactly as the source recorded it.
 *
 *  Every value here is the source's own. `experienceRequired` is null whenever the
 *  source did not report it — the current feed never does — and is never inferred
 *  from the title or the tags. */
function marketFreshSignal(record) {
  const skills = (Array.isArray(record?.skills_list) ? record.skills_list : [])
    .map((tag) => String(tag).trim())
    .filter(Boolean)
  const text = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null)

  return {
    jobId: String(record?.job_id ?? ''),
    title: text(record?.job_title),
    company: text(record?.company),
    location: text(record?.location),
    experienceRequired: text(record?.experience_required),
    skills,
    /* The source's own date string, never reformatted into a fresher-looking one. */
    postedAt: text(record?.posting_date),
  }
}

/** The corpus bounds and artifact names the response records. */
function marketCorpus(payload) {
  const corpus = payload?.corpus ?? {}
  const strings = (value) => (Array.isArray(value) ? value.filter((entry) => typeof entry === 'string') : [])

  return {
    datasetRows: Number.isFinite(corpus.dataset_rows) ? corpus.dataset_rows : null,
    postingsArtifact: typeof corpus.postings_artifact === 'string' ? corpus.postings_artifact : '',
    dateMin: typeof corpus.date_min === 'string' ? corpus.date_min : '',
    dateMax: typeof corpus.date_max === 'string' ? corpus.date_max : '',
    usableSlices: strings(corpus.usable_slices),
    artifacts: strings(payload?.artifacts),
  }
}

/**
 * Recorded demand for every role the service reports, plus the live freshness layer.
 *
 * One request serves both. The two are kept in separate fields and never combined:
 * `skills` is the prepared baseline, `freshSignals` is the live sample.
 */
export async function loadRealMarketDemand({ signal } = {}) {
  const payload = await request(MARKET_DEMAND_PATH, { signal })

  const skillsByRole = new Map()
  for (const row of Array.isArray(payload?.skills) ? payload.skills : []) {
    const id = String(row?.role ?? '')
    const skill = marketSkillRow(row)
    if (!id || !skill.name) continue
    if (!skillsByRole.has(id)) skillsByRole.set(id, [])
    skillsByRole.get(id).push(skill)
  }

  const roles = (Array.isArray(payload?.roles) ? payload.roles : [])
    .map((row) => {
      const id = String(row?.id ?? '')
      if (!id) return null
      const skills = skillsByRole.get(id) ?? []
      return {
        id,
        label: typeof row?.label === 'string' && row.label ? row.label : marketRoleLabel(id),
        plannable: row?.plannable === true,
        postings: Number.isFinite(row?.postings) ? row.postings : null,
        skills,
        unrecordedVelocity: skills.filter((skill) => skill.velocityScore === null).length,
        unavailable: false,
      }
    })
    .filter(Boolean)

  if (!roles.length) {
    throw new CareerBridgeApiError('The service returned no recorded market data for any role.', {
      path: MARKET_DEMAND_PATH,
      kind: 'empty',
    })
  }

  const freshSignals = (Array.isArray(payload?.fresh_signals) ? payload.fresh_signals : [])
    .map(marketFreshSignal)
    .filter((record) => record.jobId && record.title)

  /* Listed by recorded posting count; the identifier breaks ties so the order
     cannot flicker between two roles that recorded the same count. The service
     already sorts, and this keeps the guarantee local to the view. */
  const ordered = [...roles].sort((a, b) => (b.postings ?? -1) - (a.postings ?? -1) || a.id.localeCompare(b.id))

  const live = payload?.live ?? {}
  const liveStatus = typeof live.status === 'string' ? live.status : 'absent'

  return {
    corpus: marketCorpus(payload),
    roles: ordered,
    unavailableRoles: [],
    freshSignals,
    /* The newest posting date the live file records, or null when there is none. */
    liveDataLastUpdated: typeof payload?.live_data_last_updated === 'string' ? payload.live_data_last_updated : null,
    live: {
      sourceName: typeof live.source_name === 'string' ? live.source_name : '',
      sourceHomepage: typeof live.source_homepage === 'string' ? live.source_homepage : '',
      status: liveStatus,
      /* The service states what it will not compute from a sample this size. */
      notAvailable: (Array.isArray(payload?.not_available) ? payload.not_available : []).filter(
        (field) => typeof field === 'string',
      ),
    },
  }
}

/* ------------------------------------------------------- evidence adapter
 * The Evidence workspace reads the same /proofs response and reshapes it into the
 * panel shapes it already renders. Page copy (titles, taglines, methodology) stays
 * in evidenceData.js; only measured values, sources and caveats come from here.
 *
 * Proof A is intentionally absent from the response and is never synthesised, so
 * it keeps its existing illustrative presentation.
 */

function roundTo(value, places) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}

function percentDelta(value, baseline) {
  if (!Number.isFinite(value) || !Number.isFinite(baseline) || baseline === 0) return '—'
  return `${value > baseline ? '+' : ''}${Math.round(((value - baseline) / baseline) * 1000) / 10}%`
}

/**
 * Change in a count where a lower result is the better one, e.g. gaps flagged.
 * Reporting the raw delta as an 'improvement' would show a good outcome as a
 * negative number, so the direction is named instead.
 */
function percentReduction(value, baseline) {
  if (!Number.isFinite(value) || !Number.isFinite(baseline) || baseline === 0) return '-'
  const delta = ((value - baseline) / baseline) * 100
  return `${Math.abs(Math.round(delta * 10) / 10)}% ${delta <= 0 ? 'fewer' : 'more'}`
}

function asStringList(value) {
  return Array.isArray(value) ? value.filter((entry) => typeof entry === 'string') : []
}

function evidenceProofB(records) {
  const roleRecords = records.filter((record) => record?.proof_type === 'external_reference_overlap')
  if (!roleRecords.length) return null

  /* One number per role, never pooled: Proof B is role-scoped server-side. The
     reference set records presence only, so each skill carries the real posting
     frequency plus the recorded match flag — never an invented external value. */
  const mapSkillResults = (record) =>
    (Array.isArray(record?.metrics?.skill_results) ? record.metrics.skill_results : []).map((result) => ({
      name: String(result.skill ?? ''),
      skillbridgeScore: Math.round((Number(result.frequency) || 0) * 100),
      externalMatch: result.external_match === true,
      note: String(result.note ?? ''),
    }))

  const roles = roleRecords.map((record) => ({
    role: String(record.role_category ?? ''),
    label: humanizeRole(record.role_category),
    overlap: Number.isFinite(record.metrics?.overlap_pct) ? record.metrics.overlap_pct : null,
    top10: Number.isFinite(record.metrics?.top10_count) ? record.metrics.top10_count : null,
    matched: Number.isFinite(record.metrics?.matched) ? record.metrics.matched : null,
    source: String(record.source ?? ''),
    sourceUrls: asStringList(record.source_urls),
    skills: mapSkillResults(record),
  }))

  /* Prefer the configured target role, then any role with a recorded overlap, so
     the panel does not open on a 0% record when a non-zero role exists. Nothing
     is pooled and nothing is synthesised. */
  const configured = API_TARGET_ROLE ? roles.find((role) => role.role === API_TARGET_ROLE) : null
  const nonZero = roles.find((role) => Number.isFinite(role.overlap) && role.overlap > 0)
  const primary = configured ?? nonZero ?? roles[0]
  const primaryRecord = roleRecords.find((record) => String(record.role_category ?? '') === primary.role)
  const caveats = asStringList(primaryRecord?.caveats)

  return {
    ...PROOF_B_DATA,
    source: primary.source,
    sourceUrls: primary.sourceUrls,
    role: primary.role,
    roleLabel: primary.label,
    overallAgreement: Number.isFinite(primary.overlap) ? Math.round(primary.overlap) : 0,
    matched: primary.matched,
    referenceSize: primary.top10,
    roles: roles.map(({ role, label, overlap, top10, matched, skills }) => ({
      role,
      label,
      overlap,
      top10,
      matched,
      skills,
    })),
    skills: mapSkillResults(primaryRecord),
    takeaways: [
      ...roles.map(
        (role) =>
          `${role.label}: ${Number.isFinite(role.overlap) ? Math.round(role.overlap) : '—'}% overlap, ${role.matched ?? '—'} of ${role.top10 ?? '—'} top skills present in the reference set.`,
      ),
      ...caveats,
    ],
  }
}

function evidenceProofC(records) {
  const record = records.find((entry) => entry?.proof_type === 'naive_vs_signal_synthetic_benchmark')
  if (!record) return null

  const naive = record.metrics?.naive ?? {}
  const signal = record.metrics?.signal_engine ?? {}
  const warning = asStringList(record.caveats)[0] ?? ''
  const n = Number.isFinite(record.sample_size) ? record.sample_size : null

  return {
    ...PROOF_C_DATA,
    dataset: n === null ? PROOF_C_DATA.dataset : `Synthetic controlled cases (n=${n})`,
    sampleSize: n,
    warning,
    metrics: [
      {
        label: 'Precision',
        skillbridge: roundTo(signal.precision, 3),
        baseline: roundTo(naive.precision, 3),
        improvement: percentDelta(signal.precision, naive.precision),
      },
      {
        label: 'Structural hits',
        skillbridge: Number.isFinite(signal.structural_hits) ? signal.structural_hits : null,
        baseline: Number.isFinite(naive.structural_hits) ? naive.structural_hits : null,
        improvement: percentDelta(signal.structural_hits, naive.structural_hits),
      },
      {
        label: 'Flagged gaps',
        skillbridge: Number.isFinite(signal.flagged_gaps) ? signal.flagged_gaps : null,
        baseline: Number.isFinite(naive.flagged_gaps) ? naive.flagged_gaps : null,
        improvement: percentReduction(signal.flagged_gaps, naive.flagged_gaps),
      },
    ],
    takeaways: [
      warning,
      `Both methods flag the same ${signal.structural_hits ?? '—'} structural hits across ${n ?? '—'} cases.`,
      `The signal engine flags ${signal.flagged_gaps ?? '—'} gaps against ${naive.flagged_gaps ?? '—'} for the naive keyword baseline.`,
    ].filter(Boolean),
  }
}

function evidenceProofE(records) {
  const record = records.find((entry) => entry?.proof_type === 'budget_sensitivity_example')
  if (!record) return null

  const metrics = record.metrics ?? {}
  const identical = metrics.plans_identical === true
  const plan20 = asStringList(metrics.plan_20_hours)
  const plan100 = asStringList(metrics.plan_100_hours)
  const caveats = asStringList(record.caveats)

  const column = (hours, plan, otherHours) => ({
    hours,
    tier: `Recorded ${hours}h plan`,
    focus: identical
      ? `Identical to the recorded ${otherHours}h plan`
      : `Differs from the recorded ${otherHours}h plan`,
    skills: plan.length ? plan : ['No skills recorded in this plan.'],
    strategy:
      caveats[0] ?? 'Illustrative example output, not a production outcome.',
  })

  return {
    ...PROOF_E_DATA,
    profile: { targetRole: humanizeRole(record.role_category) },
    role: String(record.role_category ?? ''),
    plansIdentical: identical,
    demonstratesBudgetSensitivity: metrics.demonstrates_budget_sensitivity === true,
    differentPlan: metrics.different_plan === true,
    reprioritized: metrics.reprioritized === true,
    budgets: [column(20, plan20, 100), column(100, plan100, 20)],
    takeaways: [
      ...caveats,
      `Recorded plans are ${identical ? 'identical' : 'different'} across the 20h and 100h budgets.`,
    ],
  }
}

/**
 * Proof B / C / E for the Evidence workspace, shaped exactly like the constants in
 * evidenceData.js so the existing panels render unchanged. Returns null for a
 * proof the service did not return, which the panels treat as unavailable.
 */
export async function loadEvidenceProofs({ signal } = {}) {
  if (!IS_API_MODE) {
    return { proofA: PROOF_A_DATA, proofB: PROOF_B_DATA, proofC: PROOF_C_DATA, proofE: PROOF_E_DATA }
  }

  const records = await request('/proofs', { signal })
  const list = Array.isArray(records) ? records : []

  return {
    proofA: PROOF_A_DATA,
    proofB: evidenceProofB(list),
    proofC: evidenceProofC(list),
    proofE: evidenceProofE(list),
  }
}

/**
 * The recalibration marks drawn under the time slider. These are the budget
 * values at which the engine re-weights hours and re-ranks skills, so they are
 * part of the interaction rather than decoration.
 */
export function getRecalibrationMarks() {
  const span = CAREER_BRIDGE_MAX_BUDGET - CAREER_BRIDGE_MIN_BUDGET
  return CAREER_BRIDGE_BANDS.map((hours) => ({
    hours,
    percent: ((hours - CAREER_BRIDGE_MIN_BUDGET) / span) * 100,
  }))
}

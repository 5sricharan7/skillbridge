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
 * Real mode sends locally extracted resume text and the user-entered job
 * description through submitRoadmap. Demo mode uses the explicit local loaders.
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

const CONFIGURED_TARGET_ROLE = String(import.meta.env.VITE_CAREER_BRIDGE_TARGET_ROLE ?? '').trim()
const PLANNABLE_TARGET_ROLES = new Set(['backend_ml_engineer', 'data_science'])
export const API_TARGET_ROLE = PLANNABLE_TARGET_ROLES.has(CONFIGURED_TARGET_ROLE.toLowerCase())
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

function errorForResponse(response, payload, path) {
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
      requestedRole: API_TARGET_ROLE,
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

async function request(path, { method = 'GET', body, signal } = {}) {
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
    throw errorForResponse(response, null, path)
  }

  if (!response.ok) throw errorForResponse(response, payload, path)
  return payload
}

/* ----------------------------------------------------------------- types
 * RoadmapItem   { id, name, hours, priority, type, trend, demand, position,
 *                 description, why, prerequisites[], topics[], resources[],
 *                 velocity }
 * Velocity      { skill, trend, percentage_change, absolute_change,
 *                 baseline_count, latest_count, history[] }
 * Proof         { id, kind, title, summary, detail }
 * VendorFlag    { vendor, skill, note }
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
    demand: item.demand ?? (resolved.percentage_change === null ? '—' : formatPercent(resolved.percentage_change)),
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
 * resources.
 */
export function normalizeApiRoadmapItem(item, index) {
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
  return {
    ...normalized,
    type: undefined,
    demand: '—',
    description: item.reason,
    why: item.reason,
    prerequisites: [],
    topics: [],
    resources: [],
  }
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
      band: getBudgetBand(budgetHours),
      items,
      committedHours: getRoadmapHours(items),
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

const PROOF_KIND_BY_TYPE = {
  external_reference_overlap: 'external',
  naive_vs_signal_synthetic_benchmark: 'baseline',
  budget_sensitivity_example: 'budget',
}

const PROOF_TITLE_BY_TYPE = {
  external_reference_overlap: 'External cross-check',
  naive_vs_signal_synthetic_benchmark: 'Naive baseline comparison',
  budget_sensitivity_example: 'Time-budget sensitivity',
}

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

/** Proof B / C / E records -> the compact rows the workspace evidence panel reads. */
export function normalizeBridgeProofs(records) {
  if (!Array.isArray(records)) return []

  return records.map((record, index) => {
    const type = String(record?.proof_type ?? '')
    const metrics = record?.metrics ?? {}
    const role = record?.role_category ? ` for ${humanizeRole(record.role_category)}` : ''
    const caveats = Array.isArray(record?.caveats) ? record.caveats.filter((c) => typeof c === 'string') : []

    let summary = 'Evaluation record from the SkillBridge service.'
    if (type === 'external_reference_overlap') {
      const overlap = Number.isFinite(metrics.overlap_pct) ? `${Math.round(metrics.overlap_pct)}%` : '—'
      const top = Number.isFinite(metrics.top10_count) ? metrics.top10_count : '—'
      const matched = Number.isFinite(metrics.matched) ? metrics.matched : '—'
      summary = `Top-skill overlap with the external reference set: ${overlap} (${matched} of ${top} skills matched).`
    } else if (type === 'naive_vs_signal_synthetic_benchmark') {
      const n = Number.isFinite(record?.sample_size) ? record.sample_size : '—'
      summary = `Naive keyword baseline against the signal engine across ${n} controlled cases.`
    } else if (type === 'budget_sensitivity_example') {
      summary = metrics.plans_identical
        ? 'The recorded 20h and 100h plans were identical, so this example does not demonstrate budget sensitivity.'
        : 'The recorded 20h and 100h plans differ, so this example does demonstrate budget sensitivity.'
    }

    return {
      id: String(record?.proof_id ?? `proof-${index}`),
      kind: PROOF_KIND_BY_TYPE[type] ?? 'external',
      title: `${PROOF_TITLE_BY_TYPE[type] ?? 'Evaluation proof'}${role}`,
      summary,
      detail: caveats.join(' '),
    }
  })
}

const apiSource = {
  loadProfile() {
    return resolveProfile()
  },

  async loadRoadmap({ budgetHours, resumeText, jdText, signal }) {
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

    const body = {
      resume_text: resumeText,
      jd_text: jdText,
      budget_hours: budgetHours,
    }
    if (API_TARGET_ROLE) body.target_role = API_TARGET_ROLE

    const payload = await request('/roadmap', {
      method: 'POST',
      signal,
      body,
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

    /* map() passes the array as a third argument, so the index is passed
       explicitly to keep it out of normalizeRoadmapItem's velocity slot. */
    const items = payload.roadmap.map(normalizeApiRoadmapItem)

    return {
      budgetHours: payload.budget_hours,
      band: getBudgetBand(budgetHours),
      items,
      committedHours: items.reduce((total, item) => total + (Number(item.hours) || 0), 0),
    }
  },

  async loadVelocity(skillName, { signal } = {}) {
    const payload = await request(`/velocity/${encodeURIComponent(skillName)}`, { signal })
    return normalizeVelocity(payload, skillName)
  },

  async loadProofs({ signal } = {}) {
    return normalizeBridgeProofs(await request('/proofs', { signal }))
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

export function loadProofs(options) {
  return active.loadProofs(options)
}

export function loadVendorFlags(options) {
  return active.loadVendorFlags(options)
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

  /* One number per role, never pooled: Proof B is role-scoped server-side. */
  const roles = roleRecords.map((record) => ({
    role: String(record.role_category ?? ''),
    label: humanizeRole(record.role_category),
    overlap: Number.isFinite(record.metrics?.overlap_pct) ? record.metrics.overlap_pct : null,
    top10: Number.isFinite(record.metrics?.top10_count) ? record.metrics.top10_count : null,
    matched: Number.isFinite(record.metrics?.matched) ? record.metrics.matched : null,
    source: String(record.source ?? ''),
    sourceUrls: asStringList(record.source_urls),
  }))

  const primary = roles.find((role) => role.role === API_TARGET_ROLE) ?? roles[0]
  const primaryRecord = roleRecords.find((record) => String(record.role_category ?? '') === primary.role)
  const caveats = asStringList(primaryRecord?.caveats)

  return {
    ...PROOF_B_DATA,
    source: primary.source,
    sourceUrls: primary.sourceUrls,
    role: primary.role,
    roleLabel: primary.label,
    overallAgreement: Number.isFinite(primary.overlap) ? Math.round(primary.overlap) : 0,
    roles: roles.map(({ role, label, overlap, top10, matched }) => ({ role, label, overlap, top10, matched })),
    skills: (Array.isArray(primaryRecord?.metrics?.skill_results) ? primaryRecord.metrics.skill_results : []).length
      ? (primaryRecord.metrics.skill_results ?? []).map((result) => ({
          name: String(result.skill ?? ''),
          /* The SkillBridge bar is the real relative frequency in the role's
             postings. The external bar encodes the recorded match flag: full when
             the reference set contained the skill, zero when it did not. */
          skillbridgeScore: Math.round((Number(result.frequency) || 0) * 100),
          externalScore: result.external_match === true ? Math.round((Number(result.frequency) || 0) * 100) : 0,
          externalMatch: result.external_match === true,
          note: String(result.note ?? ''),
        }))
      : [],
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

  const column = (hours, plan) => ({
    hours,
    tier: `Recorded ${hours}h plan`,
    focus: identical
      ? 'Identical to the recorded 100h plan'
      : 'Differs from the recorded 100h plan',
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
    budgets: [column(20, plan20), column(100, plan100)],
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

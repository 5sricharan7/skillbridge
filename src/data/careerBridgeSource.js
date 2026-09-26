/**
 * Career Bridge data boundary.
 *
 * Single seam between the Career Bridge UI and its data. The UI never imports
 * `careerBridgeMock.js` directly — it imports this module — so swapping the mock
 * for the real API is a change to this file only.
 *
 * ---------------------------------------------------------------------------
 * Backend contracts this is shaped against (see backend/main.py, backend/schemas.py)
 * ---------------------------------------------------------------------------
 *
 * POST /roadmap            -> { budget_hours: number,
 *                               roadmap: Array<{ skill: string, hours: number,
 *                                              priority: string, reason: string,
 *                                              vendor_flag: boolean }> }
 *   Note: items are keyed by `skill` (a normalized string), there is no `id`,
 *   no `name`, and no `trend`. `reason` carries the justification.
 *
 * GET  /velocity/{skill}   -> { skill: string,
 *                               trend: 'rising'|'declining'|'stable'|'insufficient_data',
 *                               percentage_change: number|null,
 *                               absolute_change: number|null,
 *                               history: Array<{ period: string, count: number }> }
 *   Note: `trend` is LOWERCASE on the wire. The UI presents 'Rising' / 'Stable' /
 *   'Declining', so trend casing is normalized here and nowhere else.
 *
 * GET  /vendor-flags       -> Array<object>   (currently [] server-side)
 * GET  /proofs             -> Array<object>   (currently [] server-side)
 *
 * There is no server endpoint for the analysis inputs (resume / job description /
 * target role). `loadProfile` therefore stays on the checked-in profile in both
 * sources until one exists; do not invent a request for it.
 *
 * ---------------------------------------------------------------------------
 * How to switch to the real API
 * ---------------------------------------------------------------------------
 *
 * Set DATA_SOURCE to 'api' and implement the four functions in the
 * `apiSource` object below. Each one is a thin request plus a call to the
 * matching normalizer that already exists in this file, so the UI-facing shape
 * is guaranteed to stay identical. Do not change the exported shapes — the
 * components depend on them.
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

/** 'mock' reads from careerBridgeMock.js. 'api' reads from the FastAPI service. */
export const DATA_SOURCE = 'mock'

export { CAREER_BRIDGE_BANDS, CAREER_BRIDGE_DEFAULT_BUDGET, CAREER_BRIDGE_MAX_BUDGET, CAREER_BRIDGE_MIN_BUDGET }

export const ROADMAP_BUDGET_RANGE = {
  min: CAREER_BRIDGE_MIN_BUDGET,
  max: CAREER_BRIDGE_MAX_BUDGET,
  step: 10,
}

/* ------------------------------------------------------------------ types
 * RoadmapItem   { id, name, hours, priority, type, trend, demand, position,
 *                 description, why, prerequisites[], topics[], resources[],
 *                 velocity }
 * Velocity      { skill, trend, percentage_change, absolute_change,
 *                 baseline_count, latest_count, history[] }
 * Proof         { id, title, summary, detail, kind }
 * VendorFlag    { vendor, skill, note }
 */

/* ------------------------------------------------------------ normalizers */

const TREND_FROM_WIRE = { rising: 'Rising', declining: 'Declining', stable: 'Stable' }
const TREND_TO_WIRE = { Rising: 'rising', Declining: 'declining', Stable: 'stable' }

/** Wire trend ('rising' | 'insufficient_data') -> display trend. */
export function normalizeTrend(value) {
  return TREND_FROM_WIRE[value] ?? TREND_FROM_WIRE[String(value).toLowerCase()] ?? 'Stable'
}

/** Display trend -> wire trend. */
export function denormalizeTrend(value) {
  return TREND_TO_WIRE[value] ?? 'stable'
}

/** "+38%" -> 38. Returns null when the field is absent or unparseable. */
export function parseDemandPercent(value) {
  if (typeof value === 'number') return value
  const parsed = Number.parseFloat(String(value ?? '').replace('%', ''))
  return Number.isFinite(parsed) ? parsed : null
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
 * Map one POST /roadmap item plus its velocity into the UI-facing RoadmapItem.
 *
 * `reason` from the API becomes `why`; `skill` becomes both `id` and `name`.
 * Presentation-only fields (type, description, topics, resources) have no server
 * equivalent yet and are filled from the item when the server starts sending
 * them — they are read defensively rather than assumed.
 */
export function normalizeRoadmapItem(item, index) {
  const name = item.name ?? item.skill ?? 'Unknown skill'
  const velocity = item.velocity ? normalizeVelocity(item.velocity, name) : velocityFromDemand(item)

  return {
    id: item.id ?? item.skill ?? name,
    name,
    hours: Number.isFinite(item.hours) ? item.hours : 0,
    priority: item.priority ?? 'Medium',
    type: item.type ?? 'Core Skill',
    trend: velocity.trend,
    demand: item.demand ?? (velocity.percentage_change === null ? '—' : formatPercent(velocity.percentage_change)),
    position: Number.isFinite(item.position) ? item.position : index + 1,
    rank: Number.isFinite(item.rank) ? item.rank : index + 1,
    description: item.description ?? item.reason ?? '',
    why: item.why ?? item.reason ?? 'Selected from your resume and target role analysis.',
    prerequisites: Array.isArray(item.prerequisites) ? item.prerequisites : [],
    topics: Array.isArray(item.topics) ? item.topics : [],
    resources: Array.isArray(item.resources) ? item.resources : [],
    vendor_flag: item.vendor_flag === true,
    velocity,
  }
}

export function formatPercent(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
  return `${value > 0 ? '+' : ''}${Math.round(value)}%`
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
    return CAREER_BRIDGE_PROFILE
  },

  loadRoadmap({ budgetHours }) {
    const items = getMockRoadmap(budgetHours).map(normalizeRoadmapItem)
    return {
      budgetHours,
      band: getBudgetBand(budgetHours),
      items,
      committedHours: getRoadmapHours(items),
    }
  },

  loadVelocity(skillName) {
    const match = getMockRoadmap(CAREER_BRIDGE_DEFAULT_BUDGET).find(
      (skill) => skill.name === skillName || skill.id === skillName,
    )
    return match ? velocityFromDemand(match) : null
  },

  loadProofs() {
    return MOCK_PROOFS
  },

  loadVendorFlags() {
    return []
  },
}

/* ------------------------------------------------------------- api source
 * Not wired. Kept as the documented shape of the swap so the normalizers above
 * are exercised and the mapping stays honest. Do not add a fetch call to a
 * component — API access belongs here.
 */

const API_BASE = import.meta.env.VITE_CAREER_BRIDGE_API ?? ''

async function request(path, init) {
  const response = await fetch(`${API_BASE}${path}`, init)
  if (!response.ok) throw new Error(`Career Bridge API ${path} failed: ${response.status}`)
  return response.json()
}

const apiSource = {
  loadProfile: mockSource.loadProfile,

  async loadRoadmap({ budgetHours }) {
    const payload = await request('/roadmap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resume_text: '', jd_text: '', budget_hours: budgetHours }),
    })
    const roadmap = Array.isArray(payload?.roadmap) ? payload.roadmap : []
    return {
      budgetHours: payload?.budget_hours ?? budgetHours,
      band: getBudgetBand(budgetHours),
      items: roadmap.map(normalizeRoadmapItem),
      committedHours: roadmap.reduce((total, item) => total + (Number(item.hours) || 0), 0),
    }
  },

  loadVelocity: (skillName) => request(`/velocity/${encodeURIComponent(skillName)}`),

  loadProofs: () => request('/proofs'),

  loadVendorFlags: () => request('/vendor-flags'),
}

/* ------------------------------------------------------------------ facade */

const active = DATA_SOURCE === 'api' ? apiSource : mockSource

export function loadProfile() {
  return active.loadProfile()
}

export function loadRoadmap({ budgetHours }) {
  return active.loadRoadmap({ budgetHours })
}

export function loadVelocity(skillName) {
  return active.loadVelocity(skillName)
}

export function loadProofs() {
  return active.loadProofs()
}

export function loadVendorFlags() {
  return active.loadVendorFlags()
}

/**
 * The recalibration marks drawn under the time slider. These are the budget
 * values at which the mock re-weights hours and re-ranks skills, so they are
 * part of the interaction rather than decoration.
 */
export function getRecalibrationMarks() {
  const span = CAREER_BRIDGE_MAX_BUDGET - CAREER_BRIDGE_MIN_BUDGET
  return CAREER_BRIDGE_BANDS.map((hours) => ({
    hours,
    percent: ((hours - CAREER_BRIDGE_MIN_BUDGET) / span) * 100,
  }))
}

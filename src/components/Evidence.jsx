import { useEffect, useState } from 'react'
import { RailContext, WorkspaceRail, WorkspaceShell } from './workspaceShell'
import './evidence.css'
import {
  EVIDENCE_META,
  EVIDENCE_HIGHLIGHTS,
  PROOF_A_DATA,
  METHODOLOGY_DATA,
} from '../data/evidenceData'
import {
  CAREER_BRIDGE_SOURCE_LABEL,
  describeApiError,
  isAbortError,
  loadEvidenceProofs,
} from '../data/careerBridgeSource'

/* ------------------------------------------------------------------ */
/* Hand-authored 24x24 SVG Icons                                      */
/* ------------------------------------------------------------------ */

function IconOverview() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  )
}

function IconTrend() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  )
}

function IconCrossCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  )
}

function IconLayers() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  )
}

function IconClock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function IconSliders() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="4" y1="21" x2="4" y2="14" />
      <line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" />
      <line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="17" y1="16" x2="23" y2="16" />
    </svg>
  )
}

function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function IconInfo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  )
}

function IconArrowRight() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  )
}

function IconCircle() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8.4" />
    </svg>
  )
}

function IconDocuments() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="7" y="3" width="11" height="15" rx="2" />
      <path d="M10 7h5M10 10.5h5M10 14h3" />
      <path d="M4 6.5v11.5a3 3 0 0 0 3 3h9" opacity="0.55" />
    </svg>
  )
}

function IconNodes() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8.5 7h7M6 9.4v5.2M18 9.4v5.2M8.5 17h7" opacity="0.6" />
      <circle cx="6" cy="7" r="2.4" />
      <circle cx="18" cy="7" r="2.4" />
      <circle cx="6" cy="17" r="2.4" />
      <circle cx="18" cy="17" r="2.4" />
    </svg>
  )
}

function IconThreshold() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="4" y1="8" x2="20" y2="8" />
      <circle cx="9" cy="8" r="2.2" />
      <line x1="4" y1="16" x2="20" y2="16" />
      <circle cx="15" cy="16" r="2.2" />
    </svg>
  )
}

function IconLimit() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3.6 20.8 19.4H3.2z" />
      <line x1="12" y1="10" x2="12" y2="14" />
      <line x1="12" y1="16.6" x2="12.01" y2="16.6" />
    </svg>
  )
}

/* Small hand-authored pictographs. Geometry only — currentColor, no emoji, no
   icon library, no new palette. They restate the recorded parameter they sit
   next to; they do not encode any number that is not already in the card. */
function ParamGlyph({ viz }) {
  const common = {
    viewBox: '0 0 32 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  }
  switch (viz) {
    case 'frequency':
      return (
        <svg {...common}>
          <line x1="4" y1="19" x2="28" y2="19" opacity="0.45" />
          <line x1="8" y1="19" x2="8" y2="14" />
          <line x1="13" y1="19" x2="13" y2="11" />
          <line x1="18" y1="19" x2="18" y2="8" />
          <line x1="23" y1="19" x2="23" y2="5" />
        </svg>
      )
    case 'noise':
      return (
        <svg {...common}>
          <line x1="4" y1="19" x2="28" y2="19" opacity="0.45" />
          <line x1="10" y1="19" x2="10" y2="17.4" opacity="0.6" />
          <line x1="20" y1="19" x2="20" y2="17.4" opacity="0.6" />
          <circle cx="6" cy="8" r="1.3" opacity="0.5" />
          <circle cx="13" cy="15" r="1.3" opacity="0.5" />
          <circle cx="22" cy="6" r="1.3" opacity="0.5" />
          <circle cx="27" cy="15" r="1.3" opacity="0.5" />
        </svg>
      )
    case 'similarity':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="7" />
          <circle cx="20" cy="12" r="7" />
        </svg>
      )
    case 'tokens':
      return (
        <svg {...common}>
          <rect x="3" y="8" width="10" height="8" rx="4" />
          <rect x="16" y="4" width="12" height="8" rx="4" />
          <rect x="16" y="15" width="12" height="6" rx="3" />
        </svg>
      )
    case 'network':
      return (
        <svg {...common}>
          <line x1="16" y1="4" x2="7" y2="12" opacity="0.55" />
          <line x1="16" y1="4" x2="25" y2="12" opacity="0.55" />
          <line x1="7" y1="12" x2="16" y2="20" opacity="0.55" />
          <line x1="25" y1="12" x2="16" y2="20" opacity="0.55" />
          <circle cx="16" cy="4" r="2.4" />
          <circle cx="7" cy="12" r="2.4" />
          <circle cx="25" cy="12" r="2.4" />
          <circle cx="16" cy="20" r="2.4" />
        </svg>
      )
    case 'hours':
      return (
        <svg {...common}>
          <circle cx="16" cy="12" r="8" />
          <path d="M16 7v5l3.2 2" />
        </svg>
      )
    case 'solver':
      return (
        <svg {...common}>
          <rect x="5" y="4" width="22" height="6" rx="1.5" />
          <rect x="5" y="11" width="15" height="4" rx="1.2" opacity="0.75" />
          <rect x="5" y="16" width="9" height="4" rx="1.2" opacity="0.55" />
        </svg>
      )
    default:
      return null
  }
}

function HighlightViz({ viz }) {
  switch (viz) {
    case 'documents':
      return <IconDocuments />
    case 'nodes':
      return <IconNodes />
    case 'thresholds':
      return <IconThreshold />
    case 'limits':
      return <IconLimit />
    default:
      return <IconCircle />
  }
}

/* Tiny in-card visuals for the overview. Each mirrors the panel it links to. */
function MiniViz({ kind, data }) {
  if (kind === 'trend') {
    return (
      <svg className="ev-mini-viz" viewBox="0 0 120 28" aria-hidden="true">
        <line x1="4" y1="23" x2="116" y2="23" className="ev-mini-axis" strokeWidth="1" opacity="0.5" />
        <path
          d="M6 20 L30 18 L54 15 L78 10 L102 5"
          fill="none"
          strokeDasharray="3 3"
          strokeWidth="2.4"
          strokeLinecap="round"
          className="ev-mini-rising"
        />
        <circle cx="6" cy="20" r="2.4" className="ev-mini-dot-on" />
        <circle cx="102" cy="5" r="2.4" className="ev-mini-dot-on" />
      </svg>
    )
  }

  if (kind === 'dots') {
    const total = Number(data?.total)
    if (!Number.isFinite(total) || total <= 0) return null
    const on = Number.isFinite(data?.matched) ? data.matched : 0
    const step = total > 1 ? 100 / (total - 1) : 0
    return (
      <svg className="ev-mini-viz" viewBox="0 0 120 28" aria-hidden="true">
        {Array.from({ length: total }).map((_, i) => (
          <circle
            key={i}
            cx={total > 1 ? 10 + i * step : 60}
            cy="14"
            r="4"
            className={i < on ? 'ev-mini-dot-on' : 'ev-mini-dot-off'}
          />
        ))}
      </svg>
    )
  }

  if (kind === 'bars') {
    const max = Math.max(Number(data?.signal) || 0, Number(data?.baseline) || 0) || 1
    const width = (value) => Math.max(4, ((Number(value) || 0) / max) * 100)
    return (
      <svg className="ev-mini-viz" viewBox="0 0 120 28" aria-hidden="true">
        <rect x="8" y="3" width={width(data?.signal)} height="9" rx="3" className="ev-mini-bar-sb" />
        <rect x="8" y="16" width={width(data?.baseline)} height="9" rx="3" className="ev-mini-bar-base" />
      </svg>
    )
  }

  if (kind === 'plan') {
    const identical = data?.identical === true
    return (
      <svg className="ev-mini-viz" viewBox="0 0 120 28" aria-hidden="true">
        <line x1="6" y1="7" x2="62" y2="7" strokeWidth="2.4" strokeLinecap="round" className="ev-mini-rail" />
        <line x1="6" y1="21" x2="62" y2="21" strokeWidth="2.4" strokeLinecap="round" className="ev-mini-rail" />
        <path
          d={identical ? 'M62 7 C82 7 80 14 100 14' : 'M62 7 C82 7 82 7 100 7'}
          fill="none"
          strokeWidth="2.4"
          strokeLinecap="round"
          className="ev-mini-merge"
        />
        <path
          d={identical ? 'M62 21 C82 21 80 14 100 14' : 'M62 21 C82 21 82 21 100 21'}
          fill="none"
          strokeWidth="2.4"
          strokeLinecap="round"
          className="ev-mini-merge"
        />
        <circle cx="100" cy="14" r="2.6" className="ev-mini-dot-on" opacity={identical ? 1 : 0} />
        <circle cx="100" cy="7" r="2.6" className="ev-mini-dot-off" opacity={identical ? 0 : 1} />
        <circle cx="100" cy="21" r="2.6" className="ev-mini-dot-off" opacity={identical ? 0 : 1} />
      </svg>
    )
  }

  return null
}

/* ------------------------------------------------------------------ */
/* Sidebar Navigation Config                                           */
/* ------------------------------------------------------------------ */
const EVIDENCE_NAV = [
  { id: 'overview', label: 'Overview', note: 'What the evidence covers', Icon: IconOverview },
  { id: 'proof-a', label: 'Proof A', note: 'Velocity concept, illustrative', Icon: IconTrend },
  { id: 'proof-b', label: 'Proof B', note: 'External cross-check', Icon: IconCrossCheck },
  { id: 'proof-c', label: 'Proof C', note: 'Naive baseline', Icon: IconLayers },
  { id: 'proof-e', label: 'Proof E', note: 'Time-budget sensitivity', Icon: IconClock },
  { id: 'methodology', label: 'Methodology', note: 'Thresholds and limits', Icon: IconSliders },
]

/* The six proof destinations, mapped onto the shared shell's item contract.
   Methodology is separated from the proofs, so a reader can tell at a glance
   which five are results and which one is the account of how they were made. */
const EVIDENCE_RAIL_GROUPS = [
  {
    label: 'Proofs',
    items: EVIDENCE_NAV.filter((entry) => entry.id !== 'methodology').map((entry) => ({
      id: entry.id,
      label: entry.label,
      note: entry.note,
      icon: <entry.Icon />,
    })),
  },
  {
    items: EVIDENCE_NAV.filter((entry) => entry.id === 'methodology').map((entry) => ({
      id: entry.id,
      label: entry.label,
      note: entry.note,
      icon: <entry.Icon />,
    })),
  },
]

/* ------------------------------------------------------------------ */
/* Sub-components & Views                                              */
/* ------------------------------------------------------------------ */

/* Proof A is illustrative page content: the service serves Proof B, C and E only,
   and no Proof A is synthesised to fill the gap. Its card therefore keeps its
   existing copy unchanged. */
const PROOF_A_CARD = {
  id: 'proof-a',
  num: '1',
  title: 'Proof A — Velocity Concept (illustrative)',
  badge: 'Illustrative · not served',
  summary: 'A conceptual sketch of trend detection. It is not returned by /proofs and is not a historical validation.',
  metricLabel: 'Status',
  metricVal: 'Not served',
  btnText: 'View illustrative concept',
}

const NOT_SERVED = 'This record was not returned by the SkillBridge service.'

function proofCards(proofs) {
  const b = proofs?.proofB
  const c = proofs?.proofC
  const e = proofs?.proofE

  /* Budget labels come from the record itself, so mock (60/120/150h) and live
     (20h/100h) both read correctly instead of hardcoding 20h / 100h. */
  const budgetHours = (e?.budgets ?? []).map((budget) => budget.hours).filter((hours) => Number.isFinite(hours))
  const budgetLabel = budgetHours.length ? budgetHours.map((hours) => `${hours}h`).join(' / ') : '—'
  const budgetPair =
    budgetHours.length >= 2
      ? `${budgetHours[0]}h and ${budgetHours[budgetHours.length - 1]}h`
      : 'recorded'

  return [
    { ...PROOF_A_CARD, viz: <MiniViz kind="trend" /> },
    b && {
      id: 'proof-b',
      num: '2',
      title: 'Proof B — External Cross-Check',
      badge: `${b.overallAgreement}% Overlap Agreement`,
      summary: `Role-scoped overlap against ${b.source || 'the external reference set'} (${b.roleLabel}).`,
      metricLabel: 'Independent Match',
      metricVal: `${b.overallAgreement}%`,
      btnText: 'View Cross-Check',
      viz: <MiniViz kind="dots" data={{ matched: b.matched, total: b.referenceSize }} />,
    },
    c && {
      id: 'proof-c',
      num: '3',
      title: 'Proof C — Naive Baseline Comparison',
      badge: `${c.metrics[0].improvement} Precision`,
      summary: `Signal engine against keyword matching on ${c.sampleSize ?? '—'} controlled cases.`,
      metricLabel: 'Precision Gain',
      metricVal: c.metrics[0].improvement,
      btnText: 'View Baseline Tests',
      viz: <MiniViz kind="bars" data={{ signal: c.metrics[0].skillbridge, baseline: c.metrics[0].baseline }} />,
    },
    e && {
      id: 'proof-e',
      num: '4',
      title: 'Proof E — Time-Budget Sensitivity (example)',
      badge: e.plansIdentical ? 'Identical recorded plans' : 'Recorded plans differ',
      summary: e.plansIdentical
        ? `The recorded ${budgetPair} plans were identical, so this example does not demonstrate budget sensitivity.`
        : `The recorded ${budgetPair} plans differ. This is an illustrative example, not a production outcome.`,
      metricLabel: 'Recorded budgets',
      metricVal: budgetLabel,
      btnText: 'View Budget Models',
      viz: <MiniViz kind="plan" data={{ identical: e.plansIdentical }} />,
    },
  ]
    /* A proof the service did not return simply has no card, rather than one
       filled with an invented figure. */
    .filter(Boolean)
}

function CompactOverview({ onSelectView, proofs }) {
  const cards = proofCards(proofs)

  return (
    <div className="ev-overview-compact">
      <div className="ev-section-head">
        <div>
          <h2>Evaluation Proofs & Empirical Validation</h2>
          <p>Select any proof below or use the sidebar to inspect full methodology, charts, and datasets.</p>
        </div>
      </div>

      <div className="ev-overview-grid">
        {cards.map((card) => (
          <article key={card.id} className="ev-overview-card">
            <div className="ev-ov-card-top">
              <span className="ev-proof-badge-num">{card.num}</span>
              <span className="ev-ov-badge">{card.badge}</span>
            </div>
            <h3 className="ev-ov-card-title">{card.title}</h3>
            <p className="ev-ov-card-summary">{card.summary}</p>
            <div className="ev-ov-metric-row">
              <span className="ev-ov-metric-lbl">{card.metricLabel}</span>
              <strong className="ev-ov-metric-val">{card.metricVal}</strong>
            </div>
            {card.viz && <div className="ev-ov-viz" aria-hidden="true">{card.viz}</div>}
            <button
              type="button"
              className="ev-ov-btn"
              onClick={() => onSelectView(card.id)}
            >
              <span>{card.btnText}</span>
              <IconArrowRight />
            </button>
          </article>
        ))}
      </div>

      {/* Methodology Teaser Banner */}
      <div className="ev-methodology-teaser">
        <div>
          <span className="ev-meta-kicker">Transparent Methods</span>
          <h3>Methodology, Thresholds & Pipeline Architecture</h3>
          <p>Review deterministic parameter ranges, embedding similarity bounds, and the 4-stage processing pipeline.</p>
        </div>
        <button
          type="button"
          className="btn btn-dark"
          onClick={() => onSelectView('methodology')}
        >
          View Methodology
          <IconArrowRight />
        </button>
      </div>
    </div>
  )
}

function ProofAPanel() {
  const d = PROOF_A_DATA
  return (
    <div className="ev-panel">
      <div className="ev-proof-header">
        <div>
          <h2 className="ev-proof-title">
            <span className="ev-proof-badge-num">1</span>
            {d.title}
          </h2>
          <p className="ev-proof-tagline">{d.tagline}</p>
        </div>
        <span className="ev-meta-note">
          <IconInfo />
          {d.method}
        </span>
      </div>

      <div className="ev-caveat">
        <span className="ev-caveat-label">
          <IconInfo />
          Illustrative
        </span>
        These figures are a concept sketch and are not evaluated by the service.
      </div>

      <div className="ev-chart-split">
        <div className="ev-chart-container">
          <span className="ev-watermark" aria-hidden="true">Illustrative</span>
          <div className="ev-chart-legend">
            <span className="ev-legend-item">
              <span className="ev-legend-dot is-rising" />
              {d.risingSkill.name}
            </span>
            <span className="ev-legend-item">
              <span className="ev-legend-dot is-declining" />
              {d.decliningSkill.name}
            </span>
            <span className="ev-chart-flag">Illustrative</span>
          </div>

          <svg className="ev-chart-svg" viewBox="0 0 420 180" role="img" aria-label="Illustrative line chart comparing rising vs declining skill demand from 2021 to 2026">
            <line x1="30" y1="20" x2="410" y2="20" className="ev-grid-line" strokeWidth="1" strokeDasharray="3 3" />
            <text x="5" y="24" className="ev-axis-label" fontSize="10" fontFamily="Space Grotesk">100</text>

            <line x1="30" y1="60" x2="410" y2="60" className="ev-grid-line" strokeWidth="1" strokeDasharray="3 3" />
            <text x="10" y="64" className="ev-axis-label" fontSize="10" fontFamily="Space Grotesk">75</text>

            <line x1="30" y1="100" x2="410" y2="100" className="ev-grid-line" strokeWidth="1" strokeDasharray="3 3" />
            <text x="10" y="104" className="ev-axis-label" fontSize="10" fontFamily="Space Grotesk">50</text>

            <line x1="30" y1="140" x2="410" y2="140" className="ev-grid-line" strokeWidth="1" strokeDasharray="3 3" />
            <text x="10" y="144" className="ev-axis-label" fontSize="10" fontFamily="Space Grotesk">25</text>

            <line x1="30" y1="150" x2="410" y2="150" className="ev-axis-line" strokeWidth="1.5" />
            {d.years.map((yr, idx) => (
              <text key={yr} x={45 + idx * 70} y="168" className="ev-axis-year" fontSize="11" fontFamily="Space Grotesk" fontWeight="600" textAnchor="middle">
                {yr}
              </text>
            ))}

            <path
              d="M 45 92 Q 115 88 185 78 T 325 36 T 395 18"
              fill="none"
              className="ev-line-rising"
              strokeWidth="3"
              strokeLinecap="round"
            />
            {d.risingSkill.points.map((pt, idx) => (
              <circle
                key={idx}
                cx={45 + idx * 70}
                cy={150 - (pt * 1.3)}
                r="4.5"
                className="ev-dot-rising"
                strokeWidth="2.5"
              >
                <title>{`${d.years[idx]}: rising trend, illustrative value ${pt}`}</title>
              </circle>
            ))}

            <path
              d="M 45 48 Q 115 58 185 74 T 325 108 T 395 124"
              fill="none"
              className="ev-line-declining"
              strokeWidth="3"
              strokeLinecap="round"
            />
            {d.decliningSkill.points.map((pt, idx) => (
              <circle
                key={idx}
                cx={45 + idx * 70}
                cy={150 - (pt * 1.3)}
                r="4.5"
                className="ev-dot-declining"
                strokeWidth="2.5"
              >
                <title>{`${d.years[idx]}: declining trend, illustrative value ${pt}`}</title>
              </circle>
            ))}
          </svg>
          <div className="ev-chart-source">Source: {d.source}</div>
        </div>

        <div className="ev-takeaways">
          <div className="ev-takeaways-title">Key Validation Insights</div>
          {d.takeaways.map((t, idx) => (
            <div key={idx} className="ev-takeaway-item">
              <span className="ev-takeaway-ic"><IconCheck /></span>
              <span>{t}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* Proof B is role-scoped server-side, so the gauge and the chips below it always
   describe one role and name it. Roles with their own record appear as tabs
   rather than being pooled into a single number, and a selected skill reveals the
   recorded note and posting frequency instead of a bare bar. */
function ProofBPanel({ d }) {
  const [activeRole, setActiveRole] = useState(d.role)
  const [selectedSkill, setSelectedSkill] = useState(null)

  const current = d.roles.find((role) => role.role === activeRole) ?? d
  const roleLabel = current.label ?? d.roleLabel
  const agreement = Number.isFinite(current.overlap) ? Math.round(current.overlap) : d.overallAgreement
  const matched = Number.isFinite(current.matched) ? current.matched : d.matched
  const total = Number.isFinite(current.top10) ? current.top10 : d.referenceSize
  const skills = current.skills?.length ? current.skills : d.skills
  const matchedSkills = skills.filter((s) => s.externalMatch)
  const unmatchedSkills = skills.filter((s) => !s.externalMatch)
  const selected = skills.find((s) => s.name === selectedSkill) ?? null

  const r = 36
  const circ = 2 * Math.PI * r
  const strokeOffset = circ * (1 - agreement / 100)

  const chooseRole = (role) => {
    setActiveRole(role)
    setSelectedSkill(null)
  }

  return (
    <div className="ev-panel">
      <div className="ev-proof-header">
        <div>
          <h2 className="ev-proof-title">
            <span className="ev-proof-badge-num">2</span>
            {d.title}
          </h2>
          <p className="ev-proof-tagline">{d.tagline}</p>
        </div>
        <span className="ev-meta-note">
          <IconInfo />
          {d.source}
        </span>
      </div>

      {d.roles.length > 1 && (
        <div className="ev-role-tabs" role="group" aria-label="Proof B role scope">
          {d.roles.map((role) => {
            const value = Number.isFinite(role.overlap) ? `${Math.round(role.overlap)}%` : '—'
            const isActive = role.role === activeRole
            return (
              <button
                key={role.role}
                type="button"
                aria-pressed={isActive}
                className={`ev-role-tab${isActive ? ' is-active' : ''}`}
                onClick={() => chooseRole(role.role)}
              >
                <span className="ev-role-tab-name">{role.label}</span>
                <span className="ev-role-tab-val">{value}</span>
              </button>
            )
          })}
        </div>
      )}

      <div className="ev-role-scope">
        Role scope: <strong>{roleLabel}</strong>
      </div>
      {total != null && (
        <p className="ev-scope-note">
          {total} role top skills checked against the reference set. Presence only — chips show match / no match, not an external frequency.
        </p>
      )}

      <div className="ev-proof-b-grid">
        <div className="ev-bar-group">
          <div
            className="ev-flow"
            role="img"
            aria-label={`${skills.length || '—'} role skills listed; ${total ?? '—'} top skills checked against the reference set; ${matched ?? '—'} matched`}
          >
            <div className="ev-flow-node">
              <span className="ev-flow-num">{skills.length || '—'}</span>
              <span className="ev-flow-cap">Role skills</span>
            </div>
            <span className="ev-flow-arrow" aria-hidden="true"><IconArrowRight /></span>
            <div className="ev-flow-node">
              <span className="ev-flow-num">{total ?? '—'}</span>
              <span className="ev-flow-cap">Top skills checked</span>
            </div>
            <span className="ev-flow-arrow" aria-hidden="true"><IconArrowRight /></span>
            <div className="ev-flow-node is-accent">
              <span className="ev-flow-num">{matched ?? '—'}</span>
              <span className="ev-flow-cap">Matched</span>
            </div>
          </div>

          {total != null && total > 0 && (
            <div className="ev-dot-meter" role="img" aria-label={`${matched ?? 0} of ${total} matched for ${roleLabel}`}>
              <span className="ev-dot-meter-dots" aria-hidden="true">
                {Array.from({ length: total }).map((_, i) => (
                  <span key={i} className={`ev-meter-dot${i < (matched ?? 0) ? ' is-on' : ''}`} />
                ))}
              </span>
              <span className="ev-dot-meter-label">
                {matched ?? 0} of {total} matched
              </span>
            </div>
          )}

          {skills.length ? (
            <div className="ev-skill-chips">
              <div className="ev-chip-group">
                <span className="ev-chip-group-label">Present in reference set</span>
                <div className="ev-chip-row">
                  {matchedSkills.map((s) => (
                    <button
                      key={s.name}
                      type="button"
                      className={`ev-skill-chip is-in${selectedSkill === s.name ? ' is-selected' : ''}`}
                      aria-pressed={selectedSkill === s.name}
                      onClick={() => setSelectedSkill(selectedSkill === s.name ? null : s.name)}
                    >
                      <IconCheck />
                      <span className="ev-chip-name">{s.name}</span>
                      <span className="ev-chip-freq">{s.skillbridgeScore}%</span>
                    </button>
                  ))}
                  {!matchedSkills.length && <span className="ev-chip-empty">None recorded</span>}
                </div>
              </div>
              <div className="ev-chip-group">
                <span className="ev-chip-group-label">Not in the selected reference set</span>
                <div className="ev-chip-row">
                  {unmatchedSkills.map((s) => (
                    <button
                      key={s.name}
                      type="button"
                      className={`ev-skill-chip is-out${selectedSkill === s.name ? ' is-selected' : ''}`}
                      aria-pressed={selectedSkill === s.name}
                      onClick={() => setSelectedSkill(selectedSkill === s.name ? null : s.name)}
                    >
                      <IconCircle />
                      <span className="ev-chip-name">{s.name}</span>
                      <span className="ev-chip-freq">{s.skillbridgeScore}%</span>
                    </button>
                  ))}
                  {!unmatchedSkills.length && <span className="ev-chip-empty">None recorded</span>}
                </div>
              </div>
            </div>
          ) : (
            <p className="ev-not-provided">{NOT_SERVED}</p>
          )}

          {selected && (
            <div className="ev-chip-evidence" role="status">
              <div className="ev-chip-evidence-head">
                <strong>{selected.name}</strong>
                <span className={`ev-ref-chip ${selected.externalMatch ? 'is-in' : 'is-out'}`}>
                  {selected.externalMatch ? 'present' : 'not present'}
                </span>
              </div>
              <p className="ev-chip-evidence-note">{selected.note || 'No note recorded for this skill.'}</p>
              <p className="ev-chip-evidence-freq">
                Posting frequency in {roleLabel}: <strong>{selected.skillbridgeScore}%</strong>
              </p>
            </div>
          )}

          {d.sourceUrls.length > 0 && (
            <ul className="ev-source-urls">
              {d.sourceUrls.map((url) => (
                <li key={url}>
                  <a href={url} target="_blank" rel="noreferrer noopener">
                    {url}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="ev-gauge-box">
          <div className="ev-gauge-circle">
            <svg viewBox="0 0 90 90" aria-hidden="true">
              <circle cx="45" cy="45" r={r} fill="none" stroke="var(--ev-line-soft)" strokeWidth="8" />
              <circle
                cx="45"
                cy="45"
                r={r}
                fill="none"
                stroke="var(--ev-violet)"
                strokeWidth="8"
                strokeDasharray={circ}
                strokeDashoffset={strokeOffset}
                strokeLinecap="round"
              />
            </svg>
            <div className="ev-gauge-center">{agreement}%</div>
          </div>
          <div className="ev-gauge-label">Overall Agreement</div>
          <div className="ev-gauge-sub">
            {matched != null && total != null
              ? `${matched} of ${total} matched for ${roleLabel}`
              : `Top skill overlap for ${roleLabel}`}
          </div>
        </div>
      </div>

      <div className="ev-takeaways" style={{ marginTop: 18, borderTop: '1px solid var(--ev-line-soft)', paddingTop: 14 }}>
        <div className="ev-takeaways-title">Key Cross-Check Takeaways</div>
        {d.takeaways.map((t, idx) => (
          <div key={idx} className="ev-takeaway-item">
            <span className="ev-takeaway-ic"><IconCheck /></span>
            <span>{t}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* Proof C is a synthetic controlled comparison. Its warning and sample size come
   from the service and stay on screen, so the numbers are never read as audited
   real-world results. */
function ProofCPanel({ d }) {
  return (
    <div className="ev-panel">
      <div className="ev-proof-header">
        <div>
          <h2 className="ev-proof-title">
            <span className="ev-proof-badge-num">3</span>
            {d.title}
          </h2>
          <p className="ev-proof-tagline">{d.tagline}</p>
        </div>
        <span className="ev-meta-note">
          <IconInfo />
          {d.dataset}
        </span>
      </div>

      {d.warning && (
        <div className="ev-caveat">
          <span className="ev-caveat-label">
            <IconInfo />
            Synthetic
          </span>
          {d.warning}
        </div>
      )}

      <div className="ev-metric-legend">
        <span className="ev-legend-item">
          <span className="ev-legend-swatch is-sb" />
          Signal engine
        </span>
        <span className="ev-legend-item">
          <span className="ev-legend-swatch is-base" />
          Naive baseline
        </span>
        <span className="ev-synthetic-tag">Synthetic cases</span>
      </div>

      <div className="ev-metrics-grid">
        {d.metrics.map((m) => {
          const max =
            Math.max(Number(m.skillbridge) || 0, Number(m.baseline) || 0) || 1
          const pct = (value) => `${Math.max(0, Math.min(100, ((Number(value) || 0) / max) * 100))}%`
          return (
            <div key={m.label} className="ev-metric-card">
              <div className="ev-metric-head">
                <span className="ev-metric-name">{m.label}</span>
                <span className="ev-metric-badge">{m.improvement}</span>
              </div>
              <div className="ev-metric-bars" aria-hidden="true">
                <span className="ev-metric-bar-track">
                  <span className="ev-metric-bar-fill is-sb" style={{ width: pct(m.skillbridge) }} />
                </span>
                <span className="ev-metric-bar-track">
                  <span className="ev-metric-bar-fill is-base" style={{ width: pct(m.baseline) }} />
                </span>
              </div>
              <div className="ev-metric-values">
                <div>
                  <span className="ev-val-sb">{m.skillbridge}</span>
                  <span style={{ fontSize: 11, color: 'var(--ev-violet)', display: 'block', fontWeight: 600 }}>Signal engine</span>
                </div>
                <div>
                  <span className="ev-val-base">{m.baseline}</span>
                  <span style={{ fontSize: 11, color: 'var(--ev-ink-2)', display: 'block' }}>Naive baseline</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="ev-takeaways">
        <div className="ev-takeaways-title">Baseline Comparison Takeaways</div>
        {d.takeaways.map((t, idx) => (
          <div key={idx} className="ev-takeaway-item">
            <span className="ev-takeaway-ic"><IconCheck /></span>
            <span>{t}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* Proof E records one role's 20h and 100h plans. When those plans are identical
   the panel says so instead of implying sensitivity that was not observed. */
function ProofEPanel({ d }) {
  return (
    <div className="ev-panel">
      <div className="ev-proof-header">
        <div>
          <h2 className="ev-proof-title">
            <span className="ev-proof-badge-num">4</span>
            {d.title}
          </h2>
          <p className="ev-proof-tagline">{d.tagline}</p>
        </div>
        <span className="ev-meta-note">
          <IconClock />
          {d.plansIdentical ? 'Recorded plans are identical' : 'Recorded plans differ'}
        </span>
      </div>

      {d.plansIdentical && (
        <div className="ev-caveat">
          <span className="ev-caveat-label">
            <IconInfo />
            Limitation
          </span>
          The artifact records identical plans for these budgets, so this example does not demonstrate budget sensitivity.
        </div>
      )}

      <div style={{ fontSize: 12, color: 'var(--ev-ink-2)', marginBottom: 14, background: 'var(--ev-violet-pale)', border: '1px solid var(--ev-violet-soft)', borderRadius: 10, padding: '8px 12px' }}>
        <strong>Target Benchmark:</strong> {d.profile.targetRole}
      </div>

      {d.budgets.length >= 2 && (
        <div className="ev-plan-merge">
          <svg viewBox="0 0 320 64" className="ev-plan-merge-svg" role="img" aria-label={d.plansIdentical ? 'The recorded short and long budget plans resolve to the same plan' : 'The recorded short and long budget plans resolve to different plans'}>
            <line x1="12" y1="16" x2="150" y2="16" className="ev-plan-rail" />
            <line x1="12" y1="48" x2="150" y2="48" className="ev-plan-rail" />
            <text x="12" y="10" className="ev-plan-rail-label">{d.budgets[0].hours}h</text>
            <text x="12" y="62" className="ev-plan-rail-label">{d.budgets[d.budgets.length - 1].hours}h</text>
            <path
              d={d.plansIdentical ? 'M150 16 C 200 16 200 32 246 32' : 'M150 16 C 200 16 200 16 246 16'}
              fill="none"
              className="ev-plan-merge-line"
            />
            <path
              d={d.plansIdentical ? 'M150 48 C 200 48 200 32 246 32' : 'M150 48 C 200 48 200 48 246 48'}
              fill="none"
              className="ev-plan-merge-line"
            />
            <circle cx="250" cy="32" r="5" className="ev-plan-merge-node" opacity={d.plansIdentical ? 1 : 0} />
            <circle cx="250" cy="16" r="5" className="ev-plan-merge-node" opacity={d.plansIdentical ? 0 : 1} />
            <circle cx="250" cy="48" r="5" className="ev-plan-merge-node" opacity={d.plansIdentical ? 0 : 1} />
            <text x="264" y="36" className="ev-plan-rail-label">{d.plansIdentical ? 'Same plan' : 'Adjusted'}</text>
          </svg>
          <p className="ev-plan-merge-caption">
            {d.plansIdentical
              ? 'The recorded budgets resolve to the same plan, so this example does not show budget sensitivity.'
              : 'The recorded budgets resolve to different plans.'}
          </p>
        </div>
      )}

      <div className="ev-budgets-grid">
        {d.budgets.map((b) => (
          <div key={b.hours} className="ev-budget-col">
            <div className="ev-budget-header">
              <span className="ev-budget-pill">{b.hours} Hours</span>
              {d.plansIdentical && <span className="ev-same-tag">Same plan</span>}
            </div>
            <div className="ev-budget-tier">{b.tier}</div>
            <div className="ev-budget-focus">{b.focus}</div>
            <ul className="ev-budget-list">
              {b.skills.map((s, idx) => (
                <li key={idx} className="ev-budget-skill">{s}</li>
              ))}
            </ul>
            <div className="ev-budget-strategy">{b.strategy}</div>
          </div>
        ))}
      </div>

      <div className="ev-takeaways" style={{ marginTop: 18, borderTop: '1px solid var(--ev-line-soft)', paddingTop: 14 }}>
        <div className="ev-takeaways-title">Sensitivity & Sizing Takeaways</div>
        {d.takeaways.map((t, idx) => (
          <div key={idx} className="ev-takeaway-item">
            <span className="ev-takeaway-ic"><IconCheck /></span>
            <span>{t}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* A proof the service did not return says so in place of the panel, so the
   navigation never leads to a blank or invented result. */
function ProofUnavailable() {
  return (
    <div className="ev-panel">
      <div className="ev-status is-error" role="status">
        <span className="ev-status-title">Proof record unavailable</span>
        <p className="ev-status-body">{NOT_SERVED}</p>
      </div>
    </div>
  )
}

function MethodologyPanel() {
  const d = METHODOLOGY_DATA
  return (
    <div className="ev-panel">
      <div className="ev-proof-header">
        <div>
          <h2 className="ev-proof-title">
            <span className="ev-proof-badge-num">5</span>
            {d.title}
          </h2>
          <p className="ev-proof-tagline">{d.tagline}</p>
        </div>
        <span className="ev-meta-note">
          <IconSliders />
          Recorded parameters & pipeline
        </span>
      </div>

      <div className="ev-params-grid">
        {d.parameters.map((p) => (
          <div key={p.name} className="ev-param-card">
            <span className="ev-param-type">{p.type}</span>
            <div className="ev-param-name">{p.name}</div>
            <div className="ev-param-glyph">
              <span className="ev-param-glyph-ic" aria-hidden="true"><ParamGlyph viz={p.viz} /></span>
              <span className="ev-param-glyph-val">{p.glyph}</span>
              {p.glyphUnit && <span className="ev-param-glyph-unit">{p.glyphUnit}</span>}
            </div>
            <div className="ev-param-value">{p.value}</div>
            <div className="ev-param-desc">{p.desc}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 20, borderTop: '1px solid var(--ev-line-soft)', paddingTop: 16 }}>
        <div className="ev-takeaways-title" style={{ marginBottom: 12 }}>Four-Stage Pipeline Architecture</div>
        <div className="ev-pipeline-grid">
          {d.pipelineSteps.map((s) => (
            <div key={s.step} className="ev-pipe-step">
              <span className="ev-pipe-node" aria-hidden="true" />
              <div className="ev-pipe-num">Stage {s.step}</div>
              <div className="ev-pipe-title">{s.title}</div>
              <div className="ev-pipe-desc">{s.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ================================================================== */
/* Main Evidence Component                                            */
/* ================================================================== */

export default function Evidence() {
  const [activeView, setActiveView] = useState('overview')
  const [proofs, setProofs] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const controller = new AbortController()

    loadEvidenceProofs({ signal: controller.signal })
      .then((loaded) => {
        setProofs(loaded)
        setError(null)
      })
      .catch((caught) => {
        if (isAbortError(caught)) return
        setError(describeApiError(caught))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [])

  return (
    <div className="ev-page">
      {/* One application shell, shared with Career Bridge, Cohort and CTM. */}
      <WorkspaceShell
        rail={
          <WorkspaceRail
            label="Evidence & Proofs"
            navLabel="Evidence sections"
            groups={EVIDENCE_RAIL_GROUPS}
            activeId={activeView}
            onSelect={setActiveView}
            context={<RailContext label="Evidence" meta="Recorded results. Stated limits." />}
          />
        }
      >
        {/* Main Content Area */}
        <div className="ev-main" aria-live="polite">
          {/* Hero Banner with evidencebanner.png — shallow hero */}
          <div className="ev-hero">
            <figure className="ev-hero-figure">
              <img
                className="ev-hero-img"
                src="/references/evidencebanner.png"
                alt="Illustrated analytics dashboard with magnifying glass, charts, and clean horizon"
              />
              <div className="ev-hero-copy">
                <span className="ev-hero-kicker">Evidence & Limits</span>
                <h1 className="ev-hero-headline">
                  What the evidence supports.<br />
                  <em>Including what it does not.</em>
                </h1>
                <p className="ev-hero-lead">
                  {EVIDENCE_META.lead}
                </p>
              </div>
            </figure>
          </div>

          <div className="ev-content">
            <p className="ev-disclaimer" role="note">{EVIDENCE_META.disclaimer}</p>

            {/* Top 4 Highlights Bar */}
            <div className="ev-highlights" role="list" aria-label="Evidence highlights">
              {EVIDENCE_HIGHLIGHTS.map((h) => (
                <div key={h.id} className="ev-highlight-card" role="listitem">
                  <div className="ev-highlight-ic" aria-hidden="true">
                    <HighlightViz viz={h.viz} />
                  </div>
                  <div>
                    <div className="ev-highlight-num">{h.num}</div>
                    <div className="ev-highlight-desc">{h.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            {error ? (
              <div className="ev-status is-error" role="alert">
                <span className="ev-status-title">{error.title}</span>
                <p className="ev-status-body">{error.message}</p>
                <p className="ev-status-note">
                  Proof A, the page copy and the methodology reference below are static content and remain readable.
                </p>
              </div>
            ) : loading ? (
              <p className="ev-status is-loading" aria-live="polite">
                Loading proof records from the SkillBridge service…
              </p>
            ) : (
              <p className="ev-source-line">Proof records · {CAREER_BRIDGE_SOURCE_LABEL}</p>
            )}

            {/* Proof A is illustrative page content and is never replaced by a
                service record, so it stays readable even when /proofs fails. */}
            {activeView === 'proof-a' && <ProofAPanel />}

            {activeView === 'proof-b' && (proofs?.proofB ? <ProofBPanel d={proofs.proofB} /> : <ProofUnavailable />)}

            {activeView === 'proof-c' && (proofs?.proofC ? <ProofCPanel d={proofs.proofC} /> : <ProofUnavailable />)}

            {activeView === 'proof-e' && (proofs?.proofE ? <ProofEPanel d={proofs.proofE} /> : <ProofUnavailable />)}

            {activeView === 'methodology' && <MethodologyPanel />}

            {!error && !loading && activeView === 'overview' && (
              <CompactOverview onSelectView={(viewId) => setActiveView(viewId)} proofs={proofs} />
            )}
          </div>
        </div>
      </WorkspaceShell>
    </div>
  )
}
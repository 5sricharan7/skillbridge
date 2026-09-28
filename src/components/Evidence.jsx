import { useEffect, useState } from 'react'
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

function IconSparkle() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v18M3 12h18M6.3 6.3l11.4 11.4M6.3 17.7L17.7 6.3" />
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

/* ------------------------------------------------------------------ */
/* Sidebar Navigation Config                                           */
/* ------------------------------------------------------------------ */
const EVIDENCE_NAV = [
  { id: 'overview', label: 'Overview', Icon: IconOverview },
  { id: 'proof-a', label: 'Proof A — Velocity Backtest', Icon: IconTrend },
  { id: 'proof-b', label: 'Proof B — External Cross-Check', Icon: IconCrossCheck },
  { id: 'proof-c', label: 'Proof C — Naive Baseline', Icon: IconLayers },
  { id: 'proof-e', label: 'Proof E — Time-Budget Sensitivity', Icon: IconClock },
  { id: 'methodology', label: 'Methodology & Thresholds', Icon: IconSliders },
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
  title: 'Proof A — Velocity Backtest',
  badge: '+98% Rising / -72% Declining',
  summary: 'Historical validation showing early detection of emerging technologies 6–12 months ahead of traditional curricula.',
  metricLabel: 'Trend Accuracy',
  metricVal: 'High Signal',
  btnText: 'View Velocity Backtest',
}

const NOT_SERVED = 'This record was not returned by the SkillBridge service.'

function proofCards(proofs) {
  const b = proofs?.proofB
  const c = proofs?.proofC
  const e = proofs?.proofE

  return [
    PROOF_A_CARD,
    b && {
      id: 'proof-b',
      num: '2',
      title: 'Proof B — External Cross-Check',
      badge: `${b.overallAgreement}% Overlap Agreement`,
      summary: `Role-scoped overlap against ${b.source || 'the external reference set'} (${b.roleLabel}).`,
      metricLabel: 'Independent Match',
      metricVal: `${b.overallAgreement}%`,
      btnText: 'View Cross-Check',
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
    },
    e && {
      id: 'proof-e',
      num: '4',
      title: 'Proof E — Time-Budget Sensitivity',
      badge: e.plansIdentical ? 'Identical 20h / 100h plans' : 'Dynamic Reprioritization',
      summary: e.plansIdentical
        ? 'The recorded 20h and 100h plans were identical, so this example does not demonstrate budget sensitivity.'
        : 'The recorded 20h and 100h plans differ, demonstrating budget sensitivity.',
      metricLabel: 'Recorded budgets',
      metricVal: '20h / 100h',
      btnText: 'View Budget Models',
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

      <div className="ev-chart-split">
        <div className="ev-chart-container">
          <div className="ev-chart-legend">
            <span className="ev-legend-item">
              <span className="ev-legend-dot is-rising" />
              {d.risingSkill.name}
            </span>
            <span className="ev-legend-item">
              <span className="ev-legend-dot is-declining" />
              {d.decliningSkill.name}
            </span>
          </div>

          <svg className="ev-chart-svg" viewBox="0 0 420 180" aria-label="Line chart comparing rising vs declining skill demand from 2021 to 2026">
            <line x1="30" y1="20" x2="410" y2="20" stroke="#ece9e6" strokeWidth="1" strokeDasharray="3 3" />
            <text x="5" y="24" fill="#8d8794" fontSize="10" fontFamily="Space Grotesk">100</text>

            <line x1="30" y1="60" x2="410" y2="60" stroke="#ece9e6" strokeWidth="1" strokeDasharray="3 3" />
            <text x="10" y="64" fill="#8d8794" fontSize="10" fontFamily="Space Grotesk">75</text>

            <line x1="30" y1="100" x2="410" y2="100" stroke="#ece9e6" strokeWidth="1" strokeDasharray="3 3" />
            <text x="10" y="104" fill="#8d8794" fontSize="10" fontFamily="Space Grotesk">50</text>

            <line x1="30" y1="140" x2="410" y2="140" stroke="#ece9e6" strokeWidth="1" strokeDasharray="3 3" />
            <text x="10" y="144" fill="#8d8794" fontSize="10" fontFamily="Space Grotesk">25</text>

            <line x1="30" y1="150" x2="410" y2="150" stroke="#e5e2e4" strokeWidth="1.5" />
            {d.years.map((yr, idx) => (
              <text key={yr} x={45 + idx * 70} y="168" fill="#4c4859" fontSize="11" fontFamily="Space Grotesk" fontWeight="600" textAnchor="middle">
                {yr}
              </text>
            ))}

            <path
              d="M 45 92 Q 115 88 185 78 T 325 36 T 395 18"
              fill="none"
              stroke="#5b46d8"
              strokeWidth="3"
              strokeLinecap="round"
            />
            {d.risingSkill.points.map((pt, idx) => (
              <circle
                key={idx}
                cx={45 + idx * 70}
                cy={150 - (pt * 1.3)}
                r="4.5"
                fill="#ffffff"
                stroke="#5b46d8"
                strokeWidth="2.5"
              />
            ))}

            <path
              d="M 45 48 Q 115 58 185 74 T 325 108 T 395 124"
              fill="none"
              stroke="#c2503b"
              strokeWidth="3"
              strokeLinecap="round"
            />
            {d.decliningSkill.points.map((pt, idx) => (
              <circle
                key={idx}
                cx={45 + idx * 70}
                cy={150 - (pt * 1.3)}
                r="4.5"
                fill="#ffffff"
                stroke="#c2503b"
                strokeWidth="2.5"
              />
            ))}
          </svg>
          <div style={{ fontSize: 10.5, color: '#8d8794', marginTop: 8 }}>
            Source: {d.source}
          </div>
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

/* Proof B is role-scoped server-side, so the gauge and the bars below it always
   describe one role and name it, and the remaining roles are listed with their own
   overlap figures rather than pooled into a single number. */
function ProofBPanel({ d }) {
  const r = 36
  const circ = 2 * Math.PI * r
  const strokeOffset = circ * (1 - d.overallAgreement / 100)

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

      <div className="ev-role-scope">
        Role scope: <strong>{d.roleLabel}</strong>
        {d.roles.length > 1 && (
          <span className="ev-role-scope-rest">
            {d.roles
              .filter((role) => role.role !== d.role)
              .map((role) => ` ${role.label}: ${Number.isFinite(role.overlap) ? Math.round(role.overlap) : '—'}%`)
              .join(' ·')}
          </span>
        )}
      </div>

      <div className="ev-proof-b-grid">
        <div className="ev-bar-group">
          <div style={{ display: 'flex', gap: 14, fontSize: 11, color: 'var(--ev-muted)', marginBottom: 4 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--ev-violet)' }} />
              Posting frequency
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--ev-lilac)' }} />
              In reference set
            </span>
          </div>
          {d.skills.length ? (
            d.skills.map((s) => (
              <div key={s.name} className="ev-bar-row">
                <div className="ev-bar-row-label">
                  <span>{s.name}</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ev-muted)', fontSize: 11 }}>
                    Freq: {s.skillbridgeScore}% | Ref: {s.externalMatch ? 'yes' : 'no'}
                  </span>
                </div>
                <div className="ev-bar-pair">
                  <div className="ev-dual-bar">
                    <div className="ev-dual-fill-sb" style={{ width: `${s.skillbridgeScore}%` }} />
                  </div>
                  <div className="ev-dual-bar">
                    <div className="ev-dual-fill-ext" style={{ width: `${s.externalScore}%` }} />
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="ev-not-provided">{NOT_SERVED}</p>
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
              <circle cx="45" cy="45" r={r} fill="none" stroke="#ece9e6" strokeWidth="8" />
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
            <div className="ev-gauge-center">{d.overallAgreement}%</div>
          </div>
          <div className="ev-gauge-label">Overall Agreement</div>
          <div className="ev-gauge-sub">Top skill overlap for {d.roleLabel}</div>
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

      <div className="ev-metrics-grid">
        {d.metrics.map((m) => (
          <div key={m.label} className="ev-metric-card">
            <div className="ev-metric-head">
              <span className="ev-metric-name">{m.label}</span>
              <span className="ev-metric-badge">{m.improvement}</span>
            </div>
            <div className="ev-metric-values">
              <div>
                <span className="ev-val-sb">{m.skillbridge}</span>
                <span style={{ fontSize: 11, color: 'var(--ev-violet)', display: 'block', fontWeight: 600 }}>Signal engine</span>
              </div>
              <div>
                <span className="ev-val-base">{m.baseline}</span>
                <span style={{ fontSize: 11, color: 'var(--ev-muted)', display: 'block' }}>Naive baseline</span>
              </div>
            </div>
          </div>
        ))}
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

      <div style={{ fontSize: 12, color: 'var(--ev-ink-2)', marginBottom: 14, background: 'var(--ev-violet-pale)', border: '1px solid var(--ev-violet-soft)', borderRadius: 10, padding: '8px 12px' }}>
        <strong>Target Benchmark:</strong> {d.profile.targetRole}
      </div>

      <div className="ev-budgets-grid">
        {d.budgets.map((b) => (
          <div key={b.hours} className="ev-budget-col">
            <div className="ev-budget-header">
              <span className="ev-budget-pill">{b.hours} Hours</span>
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
          Deterministic constraints & open parameters
        </span>
      </div>

      <div className="ev-params-grid">
        {d.parameters.map((p) => (
          <div key={p.name} className="ev-param-card">
            <span className="ev-param-type">{p.type}</span>
            <div className="ev-param-name">{p.name}</div>
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
      <div className="ev-shell">
        {/* Left Functional Sidebar */}
        <aside className="ev-sidebar" aria-label="Evidence workspace navigation">
          <div className="ev-sidebar-label" aria-hidden="true">Evidence & Proofs</div>
          <nav className="ev-sidebar-nav" aria-label="Evidence sections">
            {EVIDENCE_NAV.map(({ id, label, Icon }, idx) => {
              const isSep = idx === EVIDENCE_NAV.length - 1
              return (
                <button
                  key={id}
                  className={`ev-sidebar-btn${activeView === id ? ' is-active' : ''}`}
                  onClick={() => setActiveView(id)}
                  aria-current={activeView === id ? 'page' : undefined}
                  style={isSep ? { marginTop: 8 } : undefined}
                >
                  <span className="ev-sidebar-ic" aria-hidden="true"><Icon /></span>
                  <span>{label}</span>
                </button>
              )
            })}
          </nav>

          <div className="ev-sidebar-badge" aria-hidden="true">
            <div className="ev-sidebar-badge-ic"><IconSparkle /></div>
            <div className="ev-sidebar-badge-text">
              <span className="ev-sidebar-badge-sm">Transparent methods.</span>
              <span className="ev-sidebar-badge-lg">Real data.</span>
            </div>
          </div>
        </aside>
        {/* Main Content Area */}
        <main className="ev-main" aria-live="polite">
          {/* Hero Banner with evidencebanner.png — shallow hero */}
          <div className="ev-hero">
            <figure className="ev-hero-figure">
              <img
                className="ev-hero-img"
                src="/references/evidencebanner.png"
                alt="Illustrated analytics dashboard with magnifying glass, charts, and clean horizon"
              />
              <div className="ev-hero-copy">
                <span className="ev-hero-kicker">Evidence & Validation</span>
                <h1 className="ev-hero-headline">
                  Why SkillBridge Works.<br />
                  <em>Real data. Transparent methods.</em>
                </h1>
                <p className="ev-hero-lead">
                  {EVIDENCE_META.lead}
                </p>
              </div>
            </figure>
          </div>

          <div className="ev-content">
            {/* Top 4 Highlights Bar */}
            <div className="ev-highlights" role="list" aria-label="Evidence highlights">
              {EVIDENCE_HIGHLIGHTS.map((h) => (
                <div key={h.id} className="ev-highlight-card" role="listitem">
                  <div className="ev-highlight-ic" aria-hidden="true">
                    {h.icon === 'sources' && <IconOverview />}
                    {h.icon === 'proofs' && <IconTrend />}
                    {h.icon === 'methods' && <IconSliders />}
                    {h.icon === 'results' && <IconSparkle />}
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
        </main>
      </div>
    </div>
  )
}
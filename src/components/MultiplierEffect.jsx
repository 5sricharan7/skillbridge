import { useState } from 'react'
import './multiplierEffect.css'
import {
  MULTIPLIER_SECTIONS,
  OVERVIEW_DATA,
  NETWORK_FLOW_STEPS,
  BUSINESS_MODEL_STREAMS,
  MARKET_SCALABILITY_DATA,
  STAKEHOLDER_CARDS,
  COMPARISON_TABLE,
  ROADMAP_PHASES,
} from '../data/multiplierData'

/* ------------------------------------------------------------------ */
/* Hand-crafted 24x24 SVG Icons for Multiplier Effect                 */
/* ------------------------------------------------------------------ */

function IconSignal() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 20h.01M7 20v-4M12 20v-8M17 20V4M22 20v-6" />
    </svg>
  )
}

function IconClock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 14" />
    </svg>
  )
}

function IconCampus() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 21V10m8 11V10m8 11V6M4 10l8-6 8 6" />
    </svg>
  )
}

function IconShield() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  )
}

function IconNetwork() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="5" r="3" />
      <circle cx="5" cy="19" r="3" />
      <circle cx="19" cy="19" r="3" />
      <line x1="12" y1="8" x2="5" y2="16" />
      <line x1="12" y1="8" x2="19" y2="16" />
    </svg>
  )
}

function IconGrowth() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  )
}

function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export default function MultiplierEffect() {
  const [activeId, setActiveId] = useState('overview')
  const [activeStepId, setActiveStepId] = useState('skillbridge')

  const current = MULTIPLIER_SECTIONS.find((s) => s.id === activeId) || MULTIPLIER_SECTIONS[0]
  const currentStep = NETWORK_FLOW_STEPS.find((s) => s.id === activeStepId) || NETWORK_FLOW_STEPS[1]

  return (
    <div className="multiplier-page">
      {/* ── Integrated Hero Banner ─────────────────────────────────── */}
      <header className="me-hero-banner">
        <div className="me-hero-backdrop" aria-hidden="true">
          <img
            src="/references/multiplierbg.png"
            alt=""
            className="me-hero-art-img"
          />
          <div className="me-hero-art-mask" />
        </div>
        <div className="me-hero-content">
          <div className="me-kicker">Multiplier Effect</div>
          <h1 className="me-hero-headline">
            A Sustainable Model for <em>Bharat&rsquo;s Next Generation.</em>
          </h1>
          <p className="me-hero-sub">
            How aligning higher education with real labor market signals creates an expanding,
            closed-loop ecosystem for learners, colleges, and industry.
          </p>
        </div>
      </header>

      {/* ── Main Workspace: Compact Sidebar + Content Panel ────────── */}
      <div className="me-workspace">
        {/* Left Sidebar */}
        <aside className="me-sidebar" aria-label="Multiplier Effect Views">
          <div className="me-sidebar-header">System Views</div>
          <ul className="me-nav-list" role="tablist">
            {MULTIPLIER_SECTIONS.map((section) => {
              const active = section.id === activeId
              return (
                <li key={section.id} role="presentation">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className={`me-nav-btn${active ? ' is-active' : ''}`}
                    onClick={() => setActiveId(section.id)}
                  >
                    <span className="me-nav-btn-label">{section.label}</span>
                    <span className="me-nav-btn-badge">{section.badge}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </aside>

        {/* Content Workspace Panel */}
        <main className="me-panel" role="tabpanel" aria-label={current.label}>
          <div className="me-panel-intro">
            <span className="me-panel-kicker">{current.kicker}</span>
            <h2 className="me-panel-title">{current.title}</h2>
            <p className="me-panel-lead">{current.lead}</p>
          </div>

          {/* ── VIEW 1: OVERVIEW / THESIS ─────────────────────────── */}
          {activeId === 'overview' && (
            <div className="me-view-overview">
              <div className="me-thesis-grid">
                <div className="me-card me-thesis-card">
                  <div className="me-card-head-row">
                    <span className="me-card-tag">01. Latency Trap</span>
                    <span className="me-card-icon" aria-hidden="true"><IconClock /></span>
                  </div>
                  <h3 className="me-card-title">Curriculum Lag</h3>
                  <p className="me-card-desc">{OVERVIEW_DATA.thesis.problem}</p>
                </div>
                <div className="me-card me-thesis-card">
                  <div className="me-card-head-row">
                    <span className="me-card-tag">02. The Solution</span>
                    <span className="me-card-icon" aria-hidden="true"><IconSignal /></span>
                  </div>
                  <h3 className="me-card-title">Time-Budgeted Routing</h3>
                  <p className="me-card-desc">{OVERVIEW_DATA.thesis.solution}</p>
                </div>
                <div className="me-card me-thesis-card is-multiplier">
                  <div className="me-card-head-row">
                    <span className="me-card-tag is-indigo">03. The Multiplier</span>
                    <span className="me-card-icon is-indigo" aria-hidden="true"><IconGrowth /></span>
                  </div>
                  <h3 className="me-card-title">Compound Value Chain</h3>
                  <p className="me-card-desc">{OVERVIEW_DATA.thesis.multiplier}</p>
                </div>
              </div>

              <h3 className="me-block-title">Core System Pillars</h3>
              <div className="me-grid-2x2">
                {OVERVIEW_DATA.pillars.map((pillar, idx) => (
                  <div key={pillar.title} className="me-card">
                    <div className="me-card-head-row">
                      <span className="me-card-tag is-soft">{pillar.tag}</span>
                      <span className="me-card-icon" aria-hidden="true">
                        {idx === 0 && <IconClock />}
                        {idx === 1 && <IconSignal />}
                        {idx === 2 && <IconCampus />}
                        {idx === 3 && <IconShield />}
                      </span>
                    </div>
                    <h4 className="me-card-title">{pillar.title}</h4>
                    <p className="me-card-desc">{pillar.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── VIEW 2: BUSINESS MODEL (VISUAL CENTERPIECE) ───────── */}
          {activeId === 'business-model' && (
            <div className="me-view-business">
              <div className="me-centerpiece-card">
                <div className="me-centerpiece-head">
                  <div className="me-card-head-row">
                    <span className="me-card-tag is-indigo">Interactive Ecosystem Engine</span>
                    <span className="me-card-icon is-indigo" aria-hidden="true"><IconNetwork /></span>
                  </div>
                  <h3 className="me-card-title" style={{ fontSize: '17px' }}>
                    Multi-Sided Value Exchange Network
                  </h3>
                  <p className="me-card-desc">
                    Click any participant below to trace input parameters, data flows, and compounding outcomes.
                  </p>
                </div>

                {/* Interactive Network Strip */}
                <div className="me-network-strip" role="tablist" aria-label="Ecosystem participants">
                  {NETWORK_FLOW_STEPS.map((step, idx) => {
                    const isSelected = step.id === activeStepId
                    return (
                      <div key={step.id} className="me-network-node-wrap">
                        <button
                          type="button"
                          className={`me-network-node${isSelected ? ' is-selected' : ''}`}
                          onClick={() => setActiveStepId(step.id)}
                        >
                          <span className="me-node-num">{idx + 1}</span>
                          <span className="me-node-title">{step.title}</span>
                          <span className="me-node-sub">{step.sub}</span>
                        </button>
                        {idx < NETWORK_FLOW_STEPS.length - 1 && (
                          <div className="me-network-arrow" aria-hidden="true">
                            <span className="me-arrow-line" />
                            <span className="me-arrow-head">→</span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Selected Participant Details Callout */}
                <div className="me-node-inspector">
                  <div className="me-inspector-left">
                    <span className="me-inspector-tag">Active Node Focus</span>
                    <h4 className="me-inspector-title">{currentStep.title}</h4>
                    <p className="me-inspector-role">{currentStep.role}</p>
                  </div>
                  <div className="me-inspector-right">
                    <span className="me-inspector-tag">Primary Deliverables & Value</span>
                    <ul className="me-inspector-outputs">
                      {currentStep.outputs.map((out) => (
                        <li key={out}>
                          <span className="me-check-ic" aria-hidden="true"><IconCheck /></span>
                          <span>{out}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              <h3 className="me-block-title">Commercial Revenue Streams</h3>
              <div className="me-grid-2x2">
                {BUSINESS_MODEL_STREAMS.map((s) => (
                  <div key={s.segment} className="me-card">
                    <div className="me-stream-top">
                      <span className="me-stream-title">{s.segment}</span>
                      <span className="me-stream-pricing">{s.pricing}</span>
                    </div>
                    <ul className="me-stream-list">
                      {s.features.map((feat) => (
                        <li key={feat}>{feat}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── VIEW 3: MARKET OPPORTUNITY & SCALABILITY ──────────── */}
          {activeId === 'market-opportunity' && (
            <div className="me-view-market">
              <h3 className="me-block-title" style={{ marginTop: 0 }}>Market Signals & Macro Latency</h3>
              <div className="me-grid-4up">
                {MARKET_SCALABILITY_DATA.marketContext.map((c) => (
                  <div key={c.label} className="me-card me-metric-card">
                    <div className="me-metric-big">{c.val}</div>
                    <div className="me-metric-label">{c.label}</div>
                    <div className="me-metric-note">{c.note}</div>
                    <span className="me-metric-source">{c.source}</span>
                  </div>
                ))}
              </div>

              {/* Compact Visual Relationship Cascade Flow */}
              <div className="me-cascade-card">
                <span className="me-card-tag is-indigo">System Scale Mechanism</span>
                <h4 className="me-card-title" style={{ fontSize: '15.5px', marginBottom: '14px' }}>
                  Market → Scale → Distribution → Impact Flywheel
                </h4>
                <div className="me-cascade-flow" role="list">
                  {MARKET_SCALABILITY_DATA.cascadeFlow.map((step, idx) => (
                    <div key={step.num} className="me-cascade-step" role="listitem">
                      <div className="me-cascade-step-top">
                        <span className="me-cascade-num">{step.num}</span>
                        <strong className="me-cascade-phase">{step.phase}</strong>
                      </div>
                      <p className="me-cascade-desc">{step.desc}</p>
                      {idx < MARKET_SCALABILITY_DATA.cascadeFlow.length - 1 && (
                        <div className="me-cascade-arrow" aria-hidden="true">→</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <h3 className="me-block-title">Why the Model Scales with Minimal Marginal Cost</h3>
              <div className="me-grid-3up">
                {MARKET_SCALABILITY_DATA.scalabilityFactors.map((f, idx) => (
                  <div key={f.title} className="me-card me-scale-card">
                    <div className="me-card-head-row">
                      <span className="me-card-tag is-soft">Architecture</span>
                      <span className="me-card-icon" aria-hidden="true">
                        {idx === 0 && <IconClock />}
                        {idx === 1 && <IconSignal />}
                        {idx === 2 && <IconCampus />}
                      </span>
                    </div>
                    <h4 className="me-card-title">{f.title}</h4>
                    <p className="me-scale-insight">{f.insight}</p>
                    <p className="me-card-desc">{f.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── VIEW 4: STAKEHOLDER IMPACT ────────────────────────── */}
          {activeId === 'stakeholders' && (
            <div className="me-view-stakeholders">
              <div className="me-grid-2x2">
                {STAKEHOLDER_CARDS.map((card, idx) => (
                  <div key={card.title} className="me-card me-stakeholder-box">
                    <div className="me-card-head-row">
                      <h3 className="me-stakeholder-title">{card.title}</h3>
                      <span className="me-card-icon is-indigo" aria-hidden="true">
                        {idx === 0 && <IconShield />}
                        {idx === 1 && <IconCampus />}
                        {idx === 2 && <IconGrowth />}
                        {idx === 3 && <IconNetwork />}
                      </span>
                    </div>
                    <div className="me-stakeholder-role">{card.role}</div>
                    <ul className="me-stakeholder-list">
                      {card.gains.map((gain) => (
                        <li key={gain}>{gain}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── VIEW 5: HOW SKILLBRIDGE DIFFERS (COMPARISON) ──────── */}
          {activeId === 'comparison' && (
            <div className="me-view-comparison">
              <div className="me-table-card">
                <div className="me-table-wrap">
                  <table className="me-comp-table">
                    <thead>
                      <tr>
                        <th>Capability Dimension</th>
                        <th className="th-highlight">SkillBridge</th>
                        <th>Generic Job Portals</th>
                        <th>Traditional Course Platforms</th>
                        <th>Generic AI Career Tools</th>
                      </tr>
                    </thead>
                    <tbody>
                      {COMPARISON_TABLE.map((row) => (
                        <tr key={row.dimension}>
                          <td className="td-dimension">{row.dimension}</td>
                          <td className="td-highlight">{row.skillbridge}</td>
                          <td>{row.jobPortals}</td>
                          <td>{row.coursePlatforms}</td>
                          <td>{row.aiTools}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── VIEW 6: GROWTH ROADMAP ────────────────────────────── */}
          {activeId === 'roadmap' && (
            <div className="me-view-roadmap">
              <div className="me-roadmap-flow">
                {ROADMAP_PHASES.map((phase, idx) => {
                  const isActive = idx === 0
                  return (
                    <div key={phase.phase} className={`me-roadmap-phase${isActive ? ' is-current' : ''}`}>
                      <div className="me-phase-header">
                        <div>
                          <span className="me-phase-badge">{phase.status}</span>
                          <h4 className="me-phase-title">{phase.phase}</h4>
                          <span className="me-phase-focus">Scope: {phase.focus}</span>
                        </div>
                      </div>
                      <ul className="me-phase-items">
                        {phase.deliverables.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

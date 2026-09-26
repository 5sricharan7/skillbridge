import { useState, useMemo } from 'react'
import './ctm.css'
import {
  CTM_META,
  INDUSTRY_SIGNALS,
  GAP_ITEMS,
  MODULES,
  RESOURCES,
  CALENDAR_SLOTS,
} from '../data/ctmData'

/* ------------------------------------------------------------------ */
/* Inline SVG icons — 24×24 viewBox, stroke currentColor, no library  */
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

function IconSignals() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  )
}

function IconGap() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function IconModules() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  )
}

function IconPlan() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
    </svg>
  )
}

function IconResources() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
    </svg>
  )
}

function IconArrow() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
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

function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function IconPlus() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function IconX() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
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

function IconBook() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
    </svg>
  )
}

function IconTag() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  )
}

function IconTrending() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
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

function IconExternal() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  )
}

function IconCurriculum() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" />
      <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
    </svg>
  )
}

function IconIndustry() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  )
}

function IconLightbulb() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="9" y1="21" x2="15" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
      <path d="M12 2a7 7 0 017 7c0 2.38-1.19 4.47-3 5.74V17H8v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 017-7z" />
    </svg>
  )
}

function IconTrash() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2" />
    </svg>
  )
}

function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/* Sparkline paths (hand-authored, decorative)                         */
/* ------------------------------------------------------------------ */
const SPARKLINES = [
  'M2,20 C6,18 10,10 14,8 S20,6 30,4',
  'M2,22 C7,19 11,14 16,10 S24,6 30,4',
  'M2,20 C8,17 12,13 17,10 S26,7 30,5',
  'M2,21 C6,19 10,12 15,9 S22,6 30,4',
  'M2,22 C7,18 11,13 16,9 S24,5 30,4',
]

/* ------------------------------------------------------------------ */
/* Module chip color helper                                             */
/* ------------------------------------------------------------------ */
function typeChipClass(typeClass) {
  if (typeClass === 'module') return 'ctm-chip ctm-chip-module'
  if (typeClass === 'workshop') return 'ctm-chip ctm-chip-workshop'
  if (typeClass === 'elective') return 'ctm-chip ctm-chip-elective'
  return 'ctm-chip ctm-chip-impact'
}

function gapChipClass(gapClass) {
  if (gapClass === 'high') return 'ctm-chip ctm-chip-high'
  if (gapClass === 'moderate') return 'ctm-chip ctm-chip-moderate'
  return 'ctm-chip ctm-chip-low-coverage'
}

/* ------------------------------------------------------------------ */
/* Sidebar navigation config                                           */
/* ------------------------------------------------------------------ */
const SIDEBAR_VIEWS = [
  { id: 'overview', label: 'Overview', Icon: IconOverview },
  { id: 'signals', label: 'Industry Signals', Icon: IconSignals },
  { id: 'gap', label: 'Gap Analysis', Icon: IconGap },
  { id: 'modules', label: 'Recommended Modules', Icon: IconModules },
  { id: 'plan', label: 'Implementation Plan', Icon: IconPlan },
  { id: 'resources', label: 'Resources', Icon: IconResources },
]

/* ================================================================== */
/* Sub-views                                                           */
/* ================================================================== */

/* ---- Overview ---------------------------------------------------- */
function ViewOverview({ plan, onAddModule, onGoView }) {
  return (
    <>
      {/* Flow strip */}
      <div className="ctm-flow" aria-label="How the Curriculum Time Machine works">
        <div className="ctm-flow-step">
          <div className="ctm-flow-num" aria-hidden="true">1</div>
          <div className="ctm-flow-ic" aria-hidden="true"><IconCurriculum /></div>
          <div className="ctm-flow-text">
            <h3>Your Curriculum</h3>
            <p>Your existing syllabus stays the same.</p>
          </div>
        </div>
        <div className="ctm-flow-arrow" aria-hidden="true"><IconArrow /></div>
        <div className="ctm-flow-step">
          <div className="ctm-flow-num" aria-hidden="true">2</div>
          <div className="ctm-flow-ic" aria-hidden="true"><IconIndustry /></div>
          <div className="ctm-flow-text">
            <h3>Industry Signals</h3>
            <p>We analyse which skills are growing in the industry.</p>
          </div>
        </div>
        <div className="ctm-flow-arrow" aria-hidden="true"><IconArrow /></div>
        <div className="ctm-flow-step">
          <div className="ctm-flow-num" aria-hidden="true">3</div>
          <div className="ctm-flow-ic" aria-hidden="true"><IconLightbulb /></div>
          <div className="ctm-flow-text">
            <h3>Recommended Additions</h3>
            <p>Short, time-bound modules that complement your current curriculum.</p>
          </div>
        </div>
      </div>

      {/* Key Industry Trends */}
      <div className="ctm-section-head">
        <div className="ctm-section-meta">
          <h2>Key Industry Trends</h2>
          <p>Top skill areas seeing increased demand across industries</p>
        </div>
        <button className="ctm-view-all" onClick={() => onGoView('signals')}>
          View all trends
          <IconArrowRight />
        </button>
      </div>
      <div className="ctm-trends" role="list">
        {INDUSTRY_SIGNALS.map((sig, i) => (
          <div key={sig.id} className="ctm-trend-card" role="listitem">
            <div className="ctm-trend-ic" aria-hidden="true"><IconTrending /></div>
            <div className="ctm-trend-name">{sig.area}</div>
            <div className="ctm-trend-growth">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                <polyline points="17 6 23 6 23 12" />
              </svg>
              {sig.growth}%
            </div>
            <svg className="ctm-sparkline" viewBox="0 0 30 24" preserveAspectRatio="none" aria-hidden="true">
              <path d={SPARKLINES[i % SPARKLINES.length]} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
        ))}
      </div>

      {/* Overview split — Gap + Modules */}
      <div className="ctm-overview-split">
        {/* Gap analysis preview */}
        <div className="ctm-panel">
          <div className="ctm-section-head">
            <div className="ctm-section-meta">
              <h2>Gap Analysis</h2>
              <p>Topics with high industry demand but limited coverage</p>
            </div>
            <button className="ctm-view-all" onClick={() => onGoView('gap')}>
              View details
              <IconArrowRight />
            </button>
          </div>
          <ul className="ctm-gap-list" aria-label="Curriculum gaps">
            {GAP_ITEMS.map((g) => (
              <li key={g.id} className="ctm-gap-item">
                <span className="ctm-gap-name">{g.skill}</span>
                <div className="ctm-gap-bar-wrap">
                  <div className="ctm-gap-bar-track">
                    <div
                      className="ctm-gap-bar-fill"
                      style={{ width: `${g.coveragePercent}%` }}
                      role="progressbar"
                      aria-valuenow={g.coveragePercent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${g.skill} coverage: ${g.coveragePercent}%`}
                    />
                  </div>
                  <span className="ctm-gap-bar-label">{g.coveragePercent}%</span>
                </div>
                <span className={gapChipClass(g.gapClass)}>{g.gapLevel}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Recommended modules preview */}
        <div className="ctm-panel">
          <div className="ctm-section-head">
            <div className="ctm-section-meta">
              <h2>Recommended Additions</h2>
              <p>Short, practical modules that complement your existing curriculum</p>
            </div>
            <button className="ctm-view-all" onClick={() => onGoView('modules')}>
              See all
              <IconArrowRight />
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {MODULES.slice(0, 3).map((mod) => {
              const added = plan.some((p) => p.id === mod.id)
              return (
                <div
                  key={mod.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    padding: '10px 12px',
                    background: added ? 'var(--ctm-violet-pale)' : 'transparent',
                    border: `1px solid ${added ? 'var(--ctm-violet-soft)' : 'var(--ctm-line-soft)'}`,
                    borderRadius: 10,
                    transition: 'background 0.2s ease, border-color 0.2s ease',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 4 }}>
                      <span className={typeChipClass(mod.typeClass)}>{mod.type}</span>
                      <span className="ctm-chip ctm-chip-impact">{mod.impact}</span>
                    </div>
                    <div style={{
                      fontFamily: 'var(--ctm-font-display)',
                      fontSize: 13,
                      fontWeight: 700,
                      letterSpacing: '-0.01em',
                      color: added ? 'var(--ctm-violet)' : 'var(--ctm-ink)',
                      marginBottom: 2,
                    }}>
                      {mod.title}
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <span className="ctm-meta-item">
                        <IconClock /> {mod.duration}
                      </span>
                      <span className="ctm-meta-item">
                        <IconBook /> {mod.sessions}
                      </span>
                    </div>
                  </div>
                  <button
                    className={`ctm-add-btn${added ? ' is-added' : ''}`}
                    style={{ width: 'auto', padding: '5px 12px', fontSize: 11.5 }}
                    onClick={() => onAddModule(mod)}
                    aria-pressed={added}
                    aria-label={added ? `Remove ${mod.title} from plan` : `Add ${mod.title} to plan`}
                  >
                    {added ? <IconCheck /> : <IconPlus />}
                    {added ? 'Added' : 'Add to Plan'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}

/* ---- Industry Signals -------------------------------------------- */
function ViewSignals() {
  return (
    <>
      <div className="ctm-view-heading">
        <h1>Industry Signals</h1>
        <p>Skill areas and technology domains seeing sustained growth in engineering job postings.</p>
        <span className="ctm-data-note">
          <IconInfo />
          Sample data — illustrative only, not from a live feed
        </span>
      </div>
      <div className="ctm-content">
        <div className="ctm-signals-grid" role="list">
          {INDUSTRY_SIGNALS.map((sig) => (
            <div key={sig.id} className="ctm-signal-row" role="listitem">
              <div>
                <div className="ctm-signal-name">{sig.area}</div>
                <div className="ctm-signal-desc">{sig.description}</div>
                <div className="ctm-signal-roles" aria-label="Example roles">
                  {sig.topRoles.map((r) => (
                    <span key={r} className="ctm-signal-role">{r}</span>
                  ))}
                </div>
              </div>
              <div className="ctm-signal-stat" aria-label={`${sig.growth}% growth in demand`}>
                <div className="ctm-signal-pct">+{sig.growth}%</div>
                <div className="ctm-signal-pct-label">demand growth</div>
                <div className="ctm-signal-postings">{sig.jobPostingsGrowth}</div>
              </div>
              <div>
                <span className={`ctm-trend-badge ${sig.trend === 'rising' ? 'ctm-trend-rising' : 'ctm-trend-stable'}`}>
                  <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                    {sig.trend === 'rising'
                      ? <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></>
                      : <line x1="5" y1="12" x2="19" y2="12" />
                    }
                  </svg>
                  {sig.trend === 'rising' ? 'Rising' : 'Stable'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

/* ---- Gap Analysis ------------------------------------------------ */
function ViewGap() {
  return (
    <>
      <div className="ctm-view-heading">
        <h1>Gap Analysis</h1>
        <p>Topics with high industry demand but limited or no coverage in the current curriculum.</p>
        <span className="ctm-data-note">
          <IconInfo />
          Coverage percentages are illustrative demo data
        </span>
      </div>
      <div className="ctm-content">
        <div className="ctm-gap-full-list" role="list">
          {GAP_ITEMS.map((g) => (
            <div key={g.id} className="ctm-gap-row" role="listitem">
              <div>
                <div className="ctm-gap-row-name">{g.skill}</div>
                <div className="ctm-gap-row-desc">{g.description}</div>
              </div>
              <div className="ctm-gap-coverage">
                <div className="ctm-gap-coverage-label">Current coverage</div>
                <div className="ctm-gap-bar-wrap">
                  <div className="ctm-gap-bar-track" style={{ width: 120 }}>
                    <div
                      className="ctm-gap-bar-fill"
                      style={{ width: `${g.coveragePercent}%` }}
                      role="progressbar"
                      aria-valuenow={g.coveragePercent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${g.coveragePercent}% coverage`}
                    />
                  </div>
                  <span className="ctm-gap-bar-label">{g.coveragePercent}%</span>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--ctm-ink-2)', marginTop: 2 }}>{g.currentCoverage}</div>
              </div>
              <div className="ctm-gap-meta">
                <div className="ctm-gap-meta-label">Industry relevance</div>
                <div className="ctm-gap-relevance">{g.industryRelevance}</div>
              </div>
              <span className={gapChipClass(g.gapClass)}>{g.gapLevel}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

/* ---- Recommended Modules ----------------------------------------- */
function ViewModules({ plan, onAddModule }) {
  return (
    <>
      <div className="ctm-view-heading">
        <h1>Recommended Modules</h1>
        <p>Short additions — 1–2 week modules, workshops, labs, and mini-electives — designed to complement your existing curriculum without replacing it.</p>
        <span className="ctm-data-note">
          <IconInfo />
          Modules are illustrative; adapt duration and format to your programme
        </span>
      </div>
      <div className="ctm-content">
        <div className="ctm-module-grid" role="list">
          {MODULES.map((mod) => {
            const added = plan.some((p) => p.id === mod.id)
            return (
              <article key={mod.id} className={`ctm-module-card${added ? ' is-selected' : ''}`} role="listitem">
                <div className="ctm-module-top">
                  <div className="ctm-module-chips">
                    <span className={typeChipClass(mod.typeClass)}>{mod.type}</span>
                    <span className="ctm-chip ctm-chip-impact">{mod.impact}</span>
                  </div>
                </div>
                <h3 className="ctm-module-title">{mod.title}</h3>
                <p className="ctm-module-desc">{mod.description}</p>
                <div className="ctm-module-meta">
                  <span className="ctm-meta-item"><IconClock />{mod.duration}</span>
                  <span className="ctm-meta-item"><IconBook />{mod.sessions}</span>
                  <span className="ctm-meta-item"><IconTag />{mod.level}</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
                  {mod.topics.map((t) => (
                    <span key={t} style={{
                      fontSize: 10.5,
                      color: 'var(--ctm-violet)',
                      background: 'var(--ctm-violet-pale)',
                      border: '1px solid var(--ctm-violet-soft)',
                      borderRadius: 999,
                      padding: '2px 7px',
                      fontWeight: 500,
                    }}>{t}</span>
                  ))}
                </div>
                <button
                  className={`ctm-add-btn${added ? ' is-added' : ''}`}
                  onClick={() => onAddModule(mod)}
                  aria-pressed={added}
                  aria-label={added ? `Remove ${mod.title} from plan` : `Add ${mod.title} to plan`}
                >
                  {added ? <IconCheck /> : <IconPlus />}
                  {added ? 'Added to plan' : 'Add to Plan'}
                </button>
              </article>
            )
          })}
        </div>
      </div>
    </>
  )
}

/* ---- Implementation Plan ----------------------------------------- */
function ViewPlan({ plan, onRemoveModule, onClearPlan }) {
  const totalWeeks = useMemo(() => {
    return plan.reduce((sum, m) => {
      const n = parseInt(m.duration, 10)
      return sum + (isNaN(n) ? 1 : n)
    }, 0)
  }, [plan])

  const formats = useMemo(() => {
    const set = new Set(plan.map((m) => m.type))
    return [...set].join(', ')
  }, [plan])

  if (plan.length === 0) {
    return (
      <>
        <div className="ctm-view-heading">
          <h1>Implementation Plan</h1>
          <p>Modules you add to your plan will appear here with a simple academic-calendar placement.</p>
        </div>
        <div className="ctm-content">
          <div className="ctm-panel">
            <div className="ctm-plan-empty" aria-live="polite">
              <div className="ctm-plan-empty-ic" aria-hidden="true"><IconPlan /></div>
              <strong>No modules selected yet</strong>
              Go to Recommended Modules and add modules to see your plan here.
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="ctm-view-heading">
        <h1>Implementation Plan</h1>
        <p>Your selected additions. Remove individual modules or clear the plan to start over.</p>
      </div>
      <div className="ctm-content">
        {/* Summary stats */}
        <div className="ctm-plan-summary" aria-label="Plan summary">
          <div className="ctm-plan-stat">
            <div className="ctm-plan-stat-label">Total additions</div>
            <div className="ctm-plan-stat-value" aria-live="polite">{plan.length}</div>
            <div className="ctm-plan-stat-sub">selected modules</div>
          </div>
          <div className="ctm-plan-stat">
            <div className="ctm-plan-stat-label">Total duration</div>
            <div className="ctm-plan-stat-value" aria-live="polite">{totalWeeks}</div>
            <div className="ctm-plan-stat-sub">weeks estimated</div>
          </div>
          <div className="ctm-plan-stat">
            <div className="ctm-plan-stat-label">Delivery formats</div>
            <div style={{
              fontFamily: 'var(--ctm-font-display)',
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '-0.01em',
              color: 'var(--ctm-violet)',
              marginTop: 2,
              lineHeight: 1.25,
            }} aria-live="polite">{formats || '—'}</div>
          </div>
        </div>

        {/* Module list */}
        <div className="ctm-plan-list" aria-live="polite" aria-label="Selected modules">
          {plan.map((mod) => (
            <div key={mod.id} className="ctm-plan-item">
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: 'var(--ctm-violet-pale)',
                  border: '1px solid var(--ctm-violet-soft)',
                  color: 'var(--ctm-violet)',
                  flex: 'none',
                }}
                aria-hidden="true"
              >
                <IconModules />
              </div>
              <div className="ctm-plan-item-body">
                <div className="ctm-plan-item-name">{mod.title}</div>
                <div className="ctm-plan-item-meta">
                  <span className={typeChipClass(mod.typeClass)}>{mod.type}</span>
                  <span className="ctm-plan-item-dur">{mod.duration} · {mod.sessions}</span>
                </div>
              </div>
              <button
                className="ctm-plan-remove"
                onClick={() => onRemoveModule(mod.id)}
                aria-label={`Remove ${mod.title} from plan`}
              >
                <IconX />
              </button>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="ctm-plan-actions">
          <button className="ctm-plan-clear" onClick={onClearPlan}>
            <IconTrash />
            Clear plan
          </button>
        </div>

        {/* Calendar placement */}
        <div className="ctm-calendar">
          <div className="ctm-calendar-head">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 20, height: 20, borderRadius: 5,
                background: 'var(--ctm-violet-pale)',
                border: '1px solid var(--ctm-violet-soft)',
                color: 'var(--ctm-violet)',
              }} aria-hidden="true">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </span>
              Academic calendar placement
            </span>
          </div>
          <div className="ctm-calendar-slots" role="list">
            {CALENDAR_SLOTS.map((slot) => (
              <div
                key={slot.label}
                className={`ctm-cal-slot${slot.available ? ' is-available' : ''}`}
                role="listitem"
              >
                <div>
                  <div className="ctm-cal-slot-label">{slot.label}</div>
                  <div className="ctm-cal-slot-weeks">{slot.weeks} weeks available</div>
                </div>
                <span
                  className="ctm-cal-dot"
                  role="img"
                  aria-label={slot.available ? 'Available' : 'Not available'}
                />
              </div>
            ))}
          </div>
          <p style={{ fontSize: 11, color: 'var(--ctm-muted)', marginTop: 10 }}>
            Calendar slots are illustrative. Coordinate with your academic office for actual scheduling.
          </p>
        </div>
      </div>
    </>
  )
}

/* ---- Resources --------------------------------------------------- */
function ViewResources() {
  return (
    <>
      <div className="ctm-view-heading">
        <h1>Resources</h1>
        <p>Curated references — courses, guides, and reports — to support curriculum planning and module design.</p>
        <span className="ctm-data-note">
          <IconInfo />
          Sample resource list — verify availability before use
        </span>
      </div>
      <div className="ctm-content">
        <div className="ctm-resources-grid" role="list">
          {RESOURCES.map((r) => (
            <a
              key={r.id}
              href={r.url}
              className="ctm-resource-card"
              role="listitem"
              aria-label={`${r.title} — ${r.source} (${r.type})`}
              onClick={(e) => e.preventDefault()}
            >
              <div className="ctm-resource-ic" aria-hidden="true"><IconBook /></div>
              <div className="ctm-resource-body">
                <div className="ctm-resource-title">{r.title}</div>
                <div className="ctm-resource-source">{r.source}</div>
              </div>
              <span className="ctm-resource-type">{r.type}</span>
              <span className="ctm-resource-ext" aria-hidden="true"><IconExternal /></span>
            </a>
          ))}
        </div>
      </div>
    </>
  )
}

/* ================================================================== */
/* Root component                                                      */
/* ================================================================== */

export default function CurriculumTimeMachine() {
  const [activeView, setActiveView] = useState('overview')
  const [plan, setPlan] = useState([])

  function handleAddModule(mod) {
    setPlan((prev) => {
      if (prev.some((p) => p.id === mod.id)) {
        return prev.filter((p) => p.id !== mod.id)
      }
      return [...prev, mod]
    })
  }

  function handleRemoveModule(id) {
    setPlan((prev) => prev.filter((p) => p.id !== id))
  }

  function handleClearPlan() {
    setPlan([])
  }

  function handleGoView(view) {
    setActiveView(view)
  }

  const planCount = plan.length

  return (
    <div className="ctm">
      <div className="ctm-shell">
        {/* ---- Sidebar ---- */}
        <aside className="ctm-sidebar" aria-label="Curriculum Time Machine navigation">
          <div className="ctm-sidebar-label" aria-hidden="true">Curriculum Time Machine</div>
          <nav className="ctm-sidebar-nav" aria-label="CTM sections">
            {SIDEBAR_VIEWS.map(({ id, label, Icon }, idx) => {
              const isSep = idx === SIDEBAR_VIEWS.length - 1
              return (
                <button
                  key={id}
                  className={`ctm-sidebar-btn${activeView === id ? ' is-active' : ''}`}
                  onClick={() => setActiveView(id)}
                  aria-current={activeView === id ? 'page' : undefined}
                  style={isSep ? { marginTop: 8 } : undefined}
                >
                  <span className="ctm-sidebar-ic" aria-hidden="true"><Icon /></span>
                  {label}
                  {id === 'plan' && planCount > 0 && (
                    <span
                      style={{
                        marginLeft: 'auto',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 18,
                        height: 18,
                        borderRadius: 999,
                        background: 'var(--ctm-violet)',
                        color: '#fff',
                        fontSize: 10,
                        fontWeight: 700,
                        fontVariantNumeric: 'tabular-nums',
                        flexShrink: 0,
                      }}
                      aria-label={`${planCount} module${planCount !== 1 ? 's' : ''} in plan`}
                    >
                      {planCount}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>

          {/* Sidebar promo card */}
          <div className="ctm-plan-badge" aria-hidden="true">
            <div className="ctm-plan-badge-ic"><IconLightbulb /></div>
            <div className="ctm-plan-badge-text">
              <span className="ctm-plan-badge-sm">Small additions.</span>
              <span className="ctm-plan-badge-lg">Big futures.</span>
            </div>
          </div>
        </aside>

        {/* ---- Main column ---- */}
        <main className="ctm-main" aria-live="polite" aria-atomic="false">
          {/* Hero — shown only in Overview */}
          {activeView === 'overview' && (
            <div className="ctm-hero">
              <figure className="ctm-hero-figure">
                <img
                  className="ctm-hero-img"
                  src="/assets/curriculum-campus-banner.png"
                  alt="Illustrated college campus with violet banners"
                />
                <div className="ctm-hero-copy">
                  <span className="ctm-hero-kicker">Curriculum Time Machine</span>
                  <h1 className="ctm-hero-headline">
                    Same foundation.<br />
                    <em>Brighter futures.</em>
                  </h1>
                  <p className="ctm-hero-lead">
                    Turn industry changes into focused, time-bound additions that strengthen your existing curriculum.
                  </p>
                </div>
              </figure>
              {/* SR duplicate of headline for document outline */}
              <span className="ctm-hero-sr">
                Curriculum Time Machine — Same foundation. Brighter futures.
              </span>
            </div>
          )}

          {/* View heading for non-overview views — hero takes its place */}
          <div className="ctm-content">
            {activeView === 'overview' && (
              <ViewOverview
                plan={plan}
                onAddModule={handleAddModule}
                onGoView={handleGoView}
              />
            )}
          </div>

          {activeView === 'signals' && <ViewSignals />}
          {activeView === 'gap' && <ViewGap />}
          {activeView === 'modules' && (
            <ViewModules plan={plan} onAddModule={handleAddModule} />
          )}
          {activeView === 'plan' && (
            <ViewPlan
              plan={plan}
              onRemoveModule={handleRemoveModule}
              onClearPlan={handleClearPlan}
            />
          )}
          {activeView === 'resources' && <ViewResources />}
        </main>
      </div>
    </div>
  )
}
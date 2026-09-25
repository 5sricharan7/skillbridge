import { useEffect, useMemo, useRef, useState } from 'react'
import './careerBridge.css'
import {
  CAREER_BRIDGE_DEFAULT_BUDGET,
  CAREER_BRIDGE_MAX_BUDGET,
  CAREER_BRIDGE_MIN_BUDGET,
  CAREER_BRIDGE_PROFILE,
  getBudgetBand,
  getMockRoadmap,
  getRoadmapHours,
} from '../data/careerBridgeMock'

/* ---------------------------------------------------------------- icons */

const ICON_ATTRS = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': 'true',
}

const FileIcon = () => (
  <svg {...ICON_ATTRS}>
    <path d="M7 3.5h7l4 4V20H7z" />
    <path d="M14 3.5v4h4" />
    <path d="M9.5 15h6M9.5 18h3.5" strokeWidth="1.4" />
  </svg>
)

const TargetIcon = () => (
  <svg {...ICON_ATTRS}>
    <circle cx="12" cy="12" r="8.4" />
    <circle cx="12" cy="12" r="4.2" />
    <path d="M12 3.2V6M12 18v2.8M3.2 12H6M18 12h2.8" strokeWidth="1.3" />
  </svg>
)

const ClockIcon = () => (
  <svg {...ICON_ATTRS}>
    <circle cx="12" cy="12" r="8.4" />
    <path d="M12 7.5V12l3 2.1" />
  </svg>
)

const RouteIcon = () => (
  <svg {...ICON_ATTRS} strokeWidth="1.6">
    <path d="M4 5h7.5a4 4 0 0 1 0 8H7a4 4 0 0 0 0 8h9" />
    <path d="M17 3.5l2.5 2.5L17 8.5" />
    <path d="M19.5 6H17" />
  </svg>
)

const BulbIcon = () => (
  <svg {...ICON_ATTRS}>
    <path d="M9.2 18.2h5.6M10 21h4" strokeWidth="1.4" />
    <path d="M12 2.8a6.4 6.4 0 0 1 3.8 11.4c-.8.6-1.2 1.5-1.3 2.5h-5c-.1-1-.5-1.9-1.3-2.5A6.4 6.4 0 0 1 12 2.8z" />
  </svg>
)

const ExternalIcon = () => (
  <svg {...ICON_ATTRS} strokeWidth="1.6">
    <path d="M13.5 5.5H18.5v5" />
    <path d="M18.5 5.5L10 14" />
    <path d="M19.5 13.5v5a1.5 1.5 0 0 1-1.5 1.5H6a1.5 1.5 0 0 1-1.5-1.5V6A1.5 1.5 0 0 1 6 4.5h5" />
  </svg>
)

const AskIcon = () => (
  <svg {...ICON_ATTRS} strokeWidth="1.6">
    <circle cx="12" cy="12" r="8.4" />
    <path d="M9.5 9.5a2.5 2.5 0 1 1 3.4 2.3c-.8.4-.9 1-.9 1.4" strokeWidth="1.4" />
    <path d="M12 16.6h.01" strokeWidth="1.8" />
  </svg>
)

const TrendGlyphUp = () => (
  <svg {...ICON_ATTRS} strokeWidth="1.8" viewBox="0 0 24 24">
    <path d="M5 15l4.5-4.5L13 14l6-6" />
    <path d="M19 8h-4.4M19 8v4.4" strokeWidth="1.6" />
  </svg>
)

const TrendGlyphFlat = () => (
  <svg {...ICON_ATTRS} strokeWidth="1.8">
    <path d="M4 16.5h7M13 16.5h7" />
    <path d="M17 13.5l3 3-3 3" strokeWidth="1.6" />
  </svg>
)

const TrendGlyphDown = () => (
  <svg {...ICON_ATTRS} strokeWidth="1.8" viewBox="0 0 24 24">
    <path d="M5 9l4.5 4.5L13 10l6 6" />
    <path d="M19 16h-4.4M19 16v-4.4" strokeWidth="1.6" />
  </svg>
)

const RankIcon = () => (
  <svg {...ICON_ATTRS} strokeWidth="1.6">
    <path d="M12 3.5l7 3.5-7 3.5-7-3.5z" />
    <path d="M5 11.5l7 3.5 7-3.5" strokeWidth="1.3" />
    <path d="M5 15.5l7 3.5 7-3.5" strokeWidth="1.3" />
  </svg>
)

const CheckIcon = () => (
  <svg {...ICON_ATTRS} strokeWidth="1.6">
    <path d="M5 12.5l4.5 4.5L19 7" />
  </svg>
)

const GaugeIcon = () => (
  <svg {...ICON_ATTRS}>
    <path d="M12 20a8 8 0 1 1 8-8" />
    <path d="M12 12l4-3" />
    <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
  </svg>
)

const GlobeIcon = () => (
  <svg {...ICON_ATTRS}>
    <circle cx="12" cy="12" r="8.4" />
    <path d="M3.6 12h16.8" />
    <path d="M12 3.6c2.4 2.3 3.6 5.1 3.6 8.4s-1.2 6.1-3.6 8.4c-2.4-2.3-3.6-5.1-3.6-8.4s1.2-6.1 3.6-8.4z" strokeWidth="1.4" />
  </svg>
)

const ScaleIcon = () => (
  <svg {...ICON_ATTRS}>
    <path d="M12 3.5v17M4 8h16M7.5 4.5l-3 10h7.5l-3-10zM13 14.5l3 6 3-6z" strokeWidth="1.5" />
  </svg>
)

const ChevronIcon = () => (
  <svg {...ICON_ATTRS} strokeWidth="2">
    <path d="M5 9l7 7 7-7" />
  </svg>
)

/* tinier glyphs for the floating hero cards */

const GLYPHS = {
  python: (
    <path d="M8.3 2.2c-1.3 0-2.2 1-2.2 2.2v2.6c0 1.2.9 2.2 2.2 2.2h3.4c1.3 0 2.2.9 2.2 2.1v2.5c0 1.3-.9 2.2-2.2 2.2H8.3c-1.3 0-2.2-1-2.2-2.2H4.6c0-1.3.9-2.2 2.2-2.2h3.4c.6 0 1.1-.5 1.1-1.1V8.2H9.5c-1.3 0-2.2-.9-2.2-2.1V3.4c0-1.3.9-2.2 2.2-2.2zM9 2.6c.3 0 .5.2.5.5s-.2.5-.5.5-.5-.2-.5-.5.2-.5.5-.5zM13.7 5.2c-1.3 0-2.2 1-2.2 2.2v2.6c0 1.2.9 2.1 2.2 2.1h3.4c1.3 0 2.2 1 2.2 2.2v2.5c0 1.3-.9 2.2-2.2 2.2h-5.6v-2.6h3.4c.6 0 1.1-.5 1.1-1.1v-1H15.5c-1.3 0-2.2-.9-2.2-2.2V2.2h5.1v3z" stroke="none" fill="currentColor" />
  ),
  ml: (
    <path d="M4 5a1.6 1.6 0 1 0 0-4.2 1.6 1.6 0 0 0 0 4.2zM12 7.2a1.6 1.6 0 1 0 0-4.2 1.6 1.6 0 0 0 0 4.2zM18 16.5a1.6 1.6 0 1 0 0-4.2 1.6 1.6 0 0 0 0 4.2zM8 14.5a1.6 1.6 0 1 0 0-4.2 1.6 1.6 0 0 0 0 4.2zM16 6a1.6 1.6 0 1 0 0-4.2 1.6 1.6 0 0 0 0 4.2zM5.5 4.2l5 2.2M14 5.5l3 8M8.5 12.6H14M17.5 14.2l-7-3" strokeWidth="1.1" />
  ),
  java: (
    <path d="M15 3.5c.4.7.6 1.6.5 2.5-.6.2-1.2.7-1.6 1.3-.5.8-.9 1.7-.9 2.7 0 1 .4 2 1.1 2.7l.5.4-1.2 1.1c-.2-.3-.4-.6-.5-.9-.3-.8-.2-1.7.2-2.5.2-.4.5-.8.5-1.2 0-.4-.2-.8-.4-1.1-.5-.7-1.4-1.2-2.1-1.9.3-.2.5-.5.7-.8.5-.6.6-1.4.3-2.1zm0 0c-.9-.2-1.9 0-2.6.6-.7.6-1.1 1.4-1.1 2.3.4.5.6 1 .6 1.6 0 .7-.3 1.4-.8 1.8l-.5.4 1.2 1.1c.4-.2.8-.5 1-.9.3-.5.3-1.1.1-1.6-.3-.8-.1-1.8.5-2.5.3-.3.6-.6.9-.8h.7z" stroke="none" fill="currentColor" />
  ),
  cloud: (
    <path d="M7 16a3.4 3.4 0 0 1-.4-6.8 4.6 4.6 0 0 1 9-1.1 3.7 3.7 0 0 1 .6 7.4z" strokeWidth="1.2" />
  ),
  chip: (
    <>
      <path d="M6 6h8v8H6z" strokeWidth="1.1" />
      <path d="M6 8H4.3M6 12H4.3M14 8h1.7M14 12h1.7M6 3.3v1.6M10 3.3v1.6M14 3.3v1.6M6 14v1.7M10 14v1.7M14 14v1.7M4.4 6H2.6M4.4 9.8H2.6M17.4 6h-1.8M17.4 9.8h-1.8" strokeWidth="1" />
    </>
  ),
  sql: (
    <path d="M4 5.5c0-1.4 3.6-2.5 8-2.5s8 1.1 8 2.5-3.6 2.5-8 2.5-8-1.1-8-2.5zM4 12c0-1.4 3.6-2.5 8-2.5s8 1.1 8 2.5-3.6 2.5-8 2.5-8-1.1-8-2.5zM4 5.5v13c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5v-13M20 12v6.5" strokeWidth="1.1" />
  ),
  vlsi: (
    <path d="M9.5 4.5h5M9.5 13.5h5M5 6.5h4.5v7H5zM14.5 6.5H19v7h-4.5M8.5 8.5h1.5v3H8.5zM14 8.5h1.5v3H14z" strokeWidth="1.1" />
  ),
  web: (
    <>
      <path d="M3 6.5h18M8 3.8c1.5 2 1.5 14.4 0 16.4M16 3.8c-1.5 2-1.5 14.4 0 16.4M3.2 12h17.6" strokeWidth="1.1" />
      <circle cx="12" cy="12" r="8.8" strokeWidth="1.1" />
    </>
  ),
}

/* sparkline paths for decorative cards (miniature trend graphs) */
const SPARK = {
  up: 'M2 15.5 L8 11.5 L14 13 L20 7.5 L26 9 L32 4',
  flat: 'M2 10 L9 9.5 L15 10.5 L21 8.5 L27 9.5 L32 9',
  down: 'M2 5 L8 8.5 L14 6.5 L20 12 L26 10 L32 15',
}

/* ------------------------------------------------------- hero field data */

const HERO_CARDS = [
  { id: 'python', name: 'Python', trend: 'up', stat: '+38%', tone: 'core', x: 56, y: 43 },
  { id: 'ml', name: 'Machine Learning', trend: 'up', stat: 'core', tone: 'dim', x: 80, y: 15 },
  { id: 'java', name: 'Java', trend: 'flat', stat: 'steady', tone: 'dim', x: 70, y: 63 },
  { id: 'cloud', name: 'Cloud Computing', trend: 'up', stat: '+24%', tone: 'dim', x: 92, y: 40 },
  { id: 'embed', name: 'Embedded Systems', trend: 'flat', stat: 'core', tone: 'front', x: 87, y: 77 },
  { id: 'sql', name: 'SQL', trend: 'up', stat: 'baseline', tone: 'dim', x: 42, y: 72 },
  { id: 'vlsi', name: 'VLSI', trend: 'flat', stat: 'deep', tone: 'dim', x: 56, y: 61 },
  { id: 'web', name: 'Web Development', trend: 'up', stat: '+18%', tone: 'dim', x: 39, y: 24 },
]

const HERO_NOTES = [
  { id: 'n1', lines: ['so many skills...', 'where do I start?'], x: 74, y: 3, target: 'ml', cls: 'cb-note-top' },
  { id: 'n2', lines: ['Skills today.', 'Better opportunities.', 'tomorrow.'], x: 63, y: 26, target: 'python', cls: 'cb-note-right' },
  { id: 'n3', lines: ['Your time.', 'Your roadmap.'], x: 47, y: 87, target: 'sql', cls: 'cb-note-bottom' },
  { id: 'n4', lines: ['not all skills', 'are equal.'], x: 16, y: 86, target: 'vlsi', cls: 'cb-note-left' },
]

/* arrow geometry helpers — arrows always point at their target card */

const noteAnchor = (note, cardCenter) => {
  const cx = note.x + note.w / 2
  const cy = note.y + note.h / 2
  const dx = cardCenter.x - cx
  const dy = cardCenter.y - cy
  if (Math.abs(dx) > Math.abs(dy)) return { x: dx > 0 ? note.x + note.w : note.x, y: cy }
  return { x: cx, y: dy > 0 ? note.y + note.h : note.y }
}

const cardAnchor = (card, noteCenter) => {
  const cx = card.x + card.w / 2
  const cy = card.y + card.h / 2
  const dx = noteCenter.x - cx
  const dy = noteCenter.y - cy
  if (Math.abs(dx) > Math.abs(dy)) return { x: dx > 0 ? card.x : card.x + card.w, y: cy }
  return { x: cx, y: dy > 0 ? card.y : card.y + card.h }
}

const handCurve = (ax, ay, bx, by) => {
  const dx = bx - ax
  const dy = by - ay
  const len = Math.hypot(dx, dy) || 1
  const bend = Math.min(24, len * 0.12)
  const px = -dy / len
  const py = dx / len
  return `M ${ax.toFixed(1)} ${ay.toFixed(1)} C ${(ax + dx * 0.22 + px * bend * 0.5).toFixed(1)} ${(ay + dy * 0.22 + py * bend * 0.5).toFixed(1)}, ${(ax + dx * 0.45 + px * bend).toFixed(1)} ${(ay + dy * 0.45 + py * bend).toFixed(1)}, ${bx.toFixed(1)} ${by.toFixed(1)}`
}

/* ------------------------------------------------------------ hero field */

function HeroField({ fieldRef }) {
  const [geo, setGeo] = useState(null)

  useEffect(() => {
    const field = fieldRef.current
    if (!field) return
    let ro
    const upd = () => {
      const f = field.getBoundingClientRect()
      if (f.width < 20 || f.height < 20) return
      const rectOf = (el) => {
        if (!el) return null
        const r = el.getBoundingClientRect()
        return { x: Math.round(r.x - f.x), y: Math.round(r.y - f.y), w: Math.round(r.width), h: Math.round(r.height) }
      }
      const arrows = HERO_NOTES.map((n) => {
        const note = rectOf(field.querySelector(`[data-note="${n.id}"]`))
        const card = rectOf(field.querySelector(`[data-card="${n.target}"]`))
        if (!note || !card) return null
        return { id: n.id, note, card }
      }).filter(Boolean)
      const key = JSON.stringify(arrows)
      setGeo((prev) => (prev && prev.key === key ? prev : { key, w: f.width, h: f.height, arrows }))
    }
    upd()
    if (document.fonts?.ready) document.fonts.ready.then(upd).catch(() => {})
    ro = new ResizeObserver(upd)
    ro.observe(field)
    window.addEventListener('resize', upd)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', upd)
    }
  }, [fieldRef])

  return (
    <div className="cb-hero-field" ref={fieldRef} aria-hidden="true">
      <span className="cb-wash cb-wash-a" />
      <span className="cb-wash cb-wash-b" />
      <span className="cb-blob cb-blob-a" />
      <span className="cb-blob cb-blob-b" />

      <svg
        className="cb-arrows-svg"
        width={geo ? geo.w : 0}
        height={geo ? geo.h : 0}
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <marker id="cb-hand-head" viewBox="0 0 8 8" refX="6.5" refY="4" markerWidth="5.5" markerHeight="5.5" orient="auto-start-reverse">
            <path d="M0 0 L8 4 L0 8 Z" />
          </marker>
        </defs>
        {geo &&
          geo.arrows.map((a) => {
            const ncx = a.note.x + a.note.w / 2
            const ncy = a.note.y + a.note.h / 2
            const ccx = a.card.x + a.card.w / 2
            const ccy = a.card.y + a.card.h / 2
            const A = noteAnchor(a.note, { x: ccx, y: ccy })
            const B = cardAnchor(a.card, { x: ncx, y: ncy })
            return <path key={a.id} className="cb-handline" d={handCurve(A.x, A.y, B.x, B.y)} markerEnd="url(#cb-hand-head)" />
          })}
      </svg>

      {HERO_CARDS.map((card) => (
        <div
          key={card.id}
          className={`cb-card cb-card-${card.tone}`}
          data-card={card.id}
          style={{ left: `${card.x}%`, top: `${card.y}%` }}
        >
          <span className="cb-card-top">
            <span className="cb-card-ic">{GLYPHS[card.id]}</span>
            <span className="cb-card-name">{card.name}</span>
          </span>
          <span className="cb-card-bottom">
            <svg className="cb-card-spark" viewBox="0 0 34 20" aria-hidden="true">
              <path d={SPARK[card.trend]} />
            </svg>
            <span className="cb-card-stat">{card.stat}</span>
          </span>
        </div>
      ))}

      {HERO_NOTES.map((note) => (
        <span key={note.id} className={`cb-note ${note.cls}`} data-note={note.id} style={{ left: `${note.x}%`, top: `${note.y}%` }}>
          {note.lines.join('\n')}
        </span>
      ))}
    </div>
  )
}

/* -------------------------------------------------------- shared pieces */

function TrendMark({ trend }) {
  const glyph = trend === 'Rising' ? <TrendGlyphUp /> : trend === 'Declining' ? <TrendGlyphDown /> : <TrendGlyphFlat />
  return (
    <span className={`cb-trendmark cb-trend-${trend.toLowerCase()}`}>
      <span className="cb-trend-arrow" aria-hidden="true">
        {glyph}
      </span>
      {trend}
    </span>
  )
}

function SummaryCard({ icon, label, title, status, detail }) {
  return (
    <div className="cb-summary-card">
      <button type="button" className="cb-reupload">
        Re-upload
      </button>
      <div className="cb-summary-top">
        <span className="cb-summary-icon">{icon}</span>
        <span className="cb-summary-label">{label}</span>
      </div>
      <strong className="cb-summary-title">{title}</strong>
      <div className="cb-summary-foot">
        <span className="cb-summary-status">{status}</span>
        <span className="cb-summary-detail">{detail}</span>
      </div>
    </div>
  )
}

function TimeCard({ budget, onChange, usedHours, band }) {
  const ratio = ((budget - CAREER_BRIDGE_MIN_BUDGET) / (CAREER_BRIDGE_MAX_BUDGET - CAREER_BRIDGE_MIN_BUDGET)) * 100
  const track = `linear-gradient(90deg, var(--cb-violet) 0%, var(--cb-violet) ${ratio}%, var(--cb-violet-soft) ${ratio}%, var(--cb-violet-soft) 100%)`
  return (
    <div className="cb-summary-card cb-time-card">
      <div className="cb-summary-top">
        <span className="cb-summary-icon">
          <ClockIcon />
        </span>
        <span className="cb-summary-label">Available learning time</span>
      </div>
      <div className="cb-time-value">
        <strong>{budget}</strong>
        <span>hours</span>
      </div>
      <input
        className="cb-slider"
        type="range"
        min={CAREER_BRIDGE_MIN_BUDGET}
        max={CAREER_BRIDGE_MAX_BUDGET}
        step="10"
        value={budget}
        onChange={onChange}
        style={{ background: track }}
        aria-label="Available learning hours"
        aria-valuetext={`${budget} hours`}
      />
      <div className="cb-slider-scale" aria-hidden="true">
        <span>10</span>
        <span>60</span>
        <span>120</span>
        <span>200</span>
      </div>
      <div className="cb-summary-foot">
        <span className="cb-summary-status">{usedHours} hours committed</span>
        <span className="cb-summary-detail">recalibrates at the {band}-hour mark</span>
      </div>
    </div>
  )
}

const FACT_ICONS = {
  why: <AskIcon />,
  demand: <TrendGlyphUp />,
  position: <RankIcon />,
  prerequisites: <CheckIcon />,
}

function DetailPanel({ skill, total }) {
  if (!skill) {
    return (
      <aside className="cb-panel cb-detail" aria-live="polite">
        <span className="cb-label">Skill detail</span>
        <p className="cb-detail-empty">Select a stop on the route to see the reasoning behind it.</p>
      </aside>
    )
  }

  const facts = [
    { key: 'why', label: 'Why this skill?', value: skill.why },
    { key: 'demand', label: 'Demand trend', value: `${skill.trend} · ${skill.demand}` },
    { key: 'position', label: 'Position', value: `${skill.position} / ${total}` },
    { key: 'prerequisites', label: 'Prerequisites', value: skill.prerequisites.join(' · ') },
  ]

  return (
    <aside className="cb-panel cb-detail" aria-live="polite" key={skill.id}>
      <header className="cb-detail-head">
        <div>
          <div className="cb-detail-kicker">
            <span>Skill detail</span>
            <span className="cb-detail-code">|</span>
            <span>
              {skill.position} / {total}
            </span>
          </div>
          <h3>{skill.name}</h3>
        </div>
        <TrendMark trend={skill.trend} />
      </header>

      <div className="cb-detail-meta">
        <span className="cb-chip cb-chip-type">{skill.type}</span>
        <span className={`cb-chip cb-chip-prio cb-prio-${skill.priority.toLowerCase()}`}>{skill.priority}</span>
        <span className="cb-chip cb-chip-hours">{skill.hours} hours</span>
      </div>

      <p className="cb-detail-desc">{skill.description}</p>

      <div className="cb-detail-facts">
        {facts.map((fact) => (
          <div key={fact.key}>
            <span className="cb-fact-label">
              <span className="cb-fact-ic" aria-hidden="true">
                {FACT_ICONS[fact.key]}
              </span>
              {fact.label}
            </span>
            <p>{fact.value}</p>
          </div>
        ))}
      </div>

      <div className="cb-detail-topics">
        <span className="cb-label">Key topics</span>
        <div className="cb-topics">
          {skill.topics.map((topic) => (
            <span className="cb-topic" key={topic}>
              {topic}
            </span>
          ))}
        </div>
      </div>

      <div className="cb-detail-resources">
        <span className="cb-label">Recommended resources</span>
        <ul className="cb-resources">
          {skill.resources.map((resource) => (
            <li className="cb-resource" key={resource}>
              <span>{resource}</span>
              <ExternalIcon />
            </li>
          ))}
        </ul>
      </div>
    </aside>
  )
}

const PROOFS = [
  { title: 'Skill Velocity & Backtest', icon: <GaugeIcon />, text: 'Measures how quickly each stop becomes usable and how a route holds up as time changes.' },
  { title: 'External Comparison', icon: <GlobeIcon />, text: 'Places the recommended path against wider market demand signals for the same role.' },
  { title: 'Naive Baseline Comparison', icon: <ScaleIcon />, text: 'Shows the gap between this prioritized route and an equal-hours, unprioritized baseline.' },
]

function ProofCard({ proof }) {
  return (
    <article className="cb-proof">
      <span className="cb-proof-ico" aria-hidden="true">
        {proof.icon}
      </span>
      <h3>{proof.title}</h3>
      <p>{proof.text}</p>
      <button type="button" className="cb-proof-link">
        View Analysis
        <ExternalIcon />
      </button>
    </article>
  )
}

/* ----------------------------------------------------------------- page */

export default function CareerBridge() {
  const [budget, setBudget] = useState(CAREER_BRIDGE_DEFAULT_BUDGET)
  const [selectedId, setSelectedId] = useState('python')
  const [evidenceOpen, setEvidenceOpen] = useState(false)
  const fieldRef = useRef(null)

  const roadmap = useMemo(() => getMockRoadmap(budget), [budget])
  const usedHours = useMemo(() => getRoadmapHours(roadmap), [roadmap])
  const band = useMemo(() => getBudgetBand(budget), [budget])
  const selected = roadmap.find((skill) => skill.id === selectedId) ?? roadmap[0]

  useEffect(() => {
    setSelectedId((current) => (roadmap.some((skill) => skill.id === current) ? current : roadmap[0].id))
  }, [roadmap])

  const handleBudgetChange = (event) => setBudget(Number(event.target.value))
  const handleSelect = (id) => setSelectedId(id)

  return (
    <section className="career-bridge" id="career-bridge">
      <div className="cb-inner">
        <header className="cb-intro">
          <HeroField fieldRef={fieldRef} />
          <div className="cb-hero-copy" data-copy="1">
            <div className="cb-eyebrow">
              <span className="cb-eyebrow-mark" aria-hidden="true" />
              <span>Career Bridge</span>
            </div>
            <h1 className="cb-title">
              <span>YOUR SKILLS TODAY.</span>
              <em>A CLEARER TOMORROW.</em>
            </h1>
            <p className="cb-lead">
              Turn your resume and target role into a personalized, time-aware learning roadmap built for real
              opportunities.
            </p>
          </div>
          <div className="cb-hero-character" data-student="1" aria-hidden="true">
            <img className="cb-student" src="assets/student-front.png" alt="" />
          </div>
        </header>

        <section className="cb-summary" aria-label="Analysis inputs" data-summary="1">
          <SummaryCard
            icon={<FileIcon />}
            label={CAREER_BRIDGE_PROFILE.resume.label}
            title={CAREER_BRIDGE_PROFILE.resume.file}
            status={CAREER_BRIDGE_PROFILE.resume.status}
            detail={CAREER_BRIDGE_PROFILE.resume.detail}
          />
          <SummaryCard
            icon={<TargetIcon />}
            label={CAREER_BRIDGE_PROFILE.jobDescription.label}
            title={CAREER_BRIDGE_PROFILE.jobDescription.file}
            status={CAREER_BRIDGE_PROFILE.jobDescription.status}
            detail={CAREER_BRIDGE_PROFILE.jobDescription.detail}
          />
          <TimeCard budget={budget} onChange={handleBudgetChange} usedHours={usedHours} band={band} />
        </section>

        <div className="cb-main">
          <section className="cb-panel cb-route-panel" aria-labelledby="cb-route-title">
            <header className="cb-panel-head">
              <div>
                <span className="cb-label cb-label-route">
                  <span className="cb-label-ic" aria-hidden="true">
                    <RouteIcon />
                  </span>
                  Recommended roadmap
                </span>
                <h2 id="cb-route-title">Your next stops.</h2>
              </div>
              <span className="cb-count">{roadmap.length} skills</span>
            </header>
            <ol className="cb-routes" key={band}>
              {roadmap.map((skill, index) => {
                const isActive = selected?.id === skill.id
                return (
                  <li key={skill.id}>
                    <button
                      type="button"
                      className={`cb-route${isActive ? ' is-active' : ''}`}
                      onClick={() => handleSelect(skill.id)}
                      aria-pressed={isActive}
                    >
                      <span className="cb-route-rank">{String(index + 1).padStart(2, '0')}</span>
                      <span className="cb-route-name">{skill.name}</span>
                      <span className="cb-route-hours">{skill.hours}h</span>
                      <span className={`cb-chip cb-chip-tag cb-prio-${skill.priority.toLowerCase()}`}>
                        {skill.priority}
                      </span>
                      <TrendMark trend={skill.trend} />
                    </button>
                  </li>
                )
              })}
            </ol>
          </section>

          <DetailPanel skill={selected} total={roadmap.length} />
        </div>

        <section className="cb-evidence" aria-labelledby="cb-evidence-title">
          <button
            type="button"
            className={`cb-evidence-toggle${evidenceOpen ? ' is-open' : ''}`}
            onClick={() => setEvidenceOpen((open) => !open)}
            aria-expanded={evidenceOpen}
            aria-controls="cb-evidence-panel"
          >
            <span className="cb-evidence-label">
              <span className="cb-evidence-ic" aria-hidden="true">
                <BulbIcon />
              </span>
              Evidence &amp; insights
            </span>
            <span className="cb-evidence-arrow" aria-hidden="true">
              <ChevronIcon />
            </span>
          </button>
          {evidenceOpen && (
            <div className="cb-evidence-panel cb-evidence-in" id="cb-evidence-panel">
              <div className="cb-proofs">
                {PROOFS.map((proof) => (
                  <ProofCard proof={proof} key={proof.title} />
                ))}
              </div>
            </div>
          )}
        </section>

        <footer className="cb-footer">
          <span>Mock analysis · local roadmap data</span>
          <span>Move the time dial. The route responds.</span>
        </footer>
      </div>
    </section>
  )
}
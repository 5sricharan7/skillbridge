import { useEffect, useId, useMemo, useRef, useState } from 'react'
import './careerBridge.css'
import {
  CAREER_BRIDGE_DEFAULT_BUDGET,
  TREND_INSUFFICIENT,
  describeApiError,
  getRecalibrationMarks,
  formatPercent,
  isAbortError,
  API_TARGET_ROLE_WARNING,
  ROADMAP_BUDGET_RANGE,
  loadDemoProfile,
  loadDemoRoadmap,
  loadDemoProofs,
  loadDemoVendorFlags,
  submitRoadmap,
} from '../data/careerBridgeSource'
import { extractResumeText, validateResumeFile } from '../data/resumeExtraction'

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

const CloseIcon = () => (
  <svg {...ICON_ATTRS} strokeWidth="1.9">
    <path d="M7 7l10 10M17 7L7 17" />
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

const ArrowUpRightIcon = () => (
  <svg {...ICON_ATTRS} strokeWidth="1.6">
    <path d="M8 16L16 8" />
    <path d="M9.5 8H16v6.5" />
  </svg>
)

/* ------------------------------------------------- sidebar nav icons */

const CommunityIcon = () => (
  <svg {...ICON_ATTRS}>
    <circle cx="9.5" cy="8.4" r="3" />
    <path d="M3.8 19.2c0-3 2.5-5.2 5.7-5.2s5.7 2.2 5.7 5.2" />
    <path d="M16.4 6.4a2.8 2.8 0 0 1 0 5.2M17.7 14.6c1.5.8 2.5 2.4 2.5 4.6" strokeWidth="1.4" />
  </svg>
)

const SettingsIcon = () => (
  <svg {...ICON_ATTRS}>
    <path d="M4 7.5h8.5M16.5 7.5H20M4 16.5h3.5M11.5 16.5H20" />
    <circle cx="14.5" cy="7.5" r="2.1" />
    <circle cx="9.5" cy="16.5" r="2.1" />
  </svg>
)

/* Application-level navigation only. The global routes stay in the top navbar
   and are deliberately not repeated here. Group boundaries are drawn as
   separators, matching the reference's rhythm. Each destination switches the
   workspace view inside /career-bridge — there is no per-destination route. */
const CAREER_BRIDGE_VIEWS = {
  overview: 'overview',
  resume: 'resume',
  role: 'role',
  gap: 'gap',
  planner: 'planner',
  market: 'market',
  resources: 'resources',
  community: 'community',
  settings: 'settings',
}

const SIDEBAR_GROUPS = [
  {
    label: 'Career Bridge',
    items: [
      { label: 'Overview', icon: <GaugeIcon />, view: CAREER_BRIDGE_VIEWS.overview },
      { label: 'Resume Analyzer', icon: <FileIcon />, view: CAREER_BRIDGE_VIEWS.resume },
      { label: 'Role Explorer', icon: <TargetIcon />, view: CAREER_BRIDGE_VIEWS.role },
      { label: 'Skill Gap', icon: <RankIcon />, view: CAREER_BRIDGE_VIEWS.gap },
      { label: 'Learning Planner', icon: <ClockIcon />, view: CAREER_BRIDGE_VIEWS.planner },
    ],
  },
  {
    items: [
      { label: 'Market Insights', icon: <GlobeIcon />, view: CAREER_BRIDGE_VIEWS.market },
      { label: 'Resources', icon: <BulbIcon />, view: CAREER_BRIDGE_VIEWS.resources },
    ],
  },
  {
    items: [
      { label: 'Community', icon: <CommunityIcon />, view: CAREER_BRIDGE_VIEWS.community },
      { label: 'Settings', icon: <SettingsIcon />, view: CAREER_BRIDGE_VIEWS.settings },
    ],
  },
]

function CareerBridgeSidebar({ view, mode, onChange }) {
  return (
    <aside className="cb-sidebar">
      <nav className="cb-sidebar-nav" aria-label="Career Bridge application">
        {SIDEBAR_GROUPS.map((group, groupIndex) => (
          <div className={`cb-sidebar-group${groupIndex > 0 ? ' is-separated' : ''}`} key={group.label ?? groupIndex}>
            {group.label && <span className="cb-sidebar-label">{group.label}</span>}
            {group.items.map((item) => {
              const isActive = item.view === view
              const unavailableInRealMode =
                mode === 'real' &&
                ![
                  CAREER_BRIDGE_VIEWS.overview,
                  CAREER_BRIDGE_VIEWS.resume,
                  CAREER_BRIDGE_VIEWS.role,
                ].includes(item.view)
              return (
                <button
                  key={item.label}
                  type="button"
                  className={`cb-sidebar-link${isActive ? ' is-active' : ''}`}
                  disabled={unavailableInRealMode}
                  title={unavailableInRealMode ? 'Analysis views are available in Demo mode' : undefined}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => onChange(item.view)}
                >
                  <span className="cb-sidebar-ic" aria-hidden="true">
                    {item.icon}
                  </span>
                  {item.label}
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Presentational only — no destination, so it is not a link or a button. */}
      <div className="cb-promo">
        <span className="cb-promo-ic" aria-hidden="true">
          <TrendGlyphUp />
        </span>
        <span className="cb-promo-text">
          <span className="cb-promo-sm">Small skills.</span>
          <span className="cb-promo-lg">big futures.</span>
        </span>
        <span className="cb-promo-arrow" aria-hidden="true">
          <ArrowUpRightIcon />
        </span>
      </div>
    </aside>
  )
}

/* ------------------------------------------------------- hero artwork */

/* The hero is a supplied static image (see CB_HERO_ART below). It is placed as-is
   at its native 1580x260 ratio and is never approximated with CSS, SVG or canvas. */
const CB_HERO_ART = {
  src: 'references/skillbridge-career-bridge-hero-static.png',
  width: 1580,
  height: 260,
}

/* -------------------------------------------------------- shared pieces */

/* A multi-word trend cannot be slugged straight into the class name, so the
   modifier comes from a fixed map and an unmeasured skill gets its own muted
   treatment rather than borrowing the flat 'stable' arrow. */
const TREND_CLASS = {
  Rising: 'rising',
  Declining: 'declining',
  Stable: 'stable',
  [TREND_INSUFFICIENT]: 'insufficient',
}

function TrendMark({ trend }) {
  const modifier = TREND_CLASS[trend] ?? 'insufficient'
  const glyph =
    trend === 'Rising' ? <TrendGlyphUp /> : trend === 'Declining' ? <TrendGlyphDown /> : <TrendGlyphFlat />
  return (
    <span className={`cb-trendmark cb-trend-${modifier}`}>
      <span className="cb-trend-arrow" aria-hidden="true">
        {glyph}
      </span>
      {trend}
    </span>
  )
}

/* ---------------------------------------------------------------- inputs */

/* Real mode extracts resume text locally before the user submits it for a route. */
const RESUME_ACCEPT = '.pdf,.docx,.txt'

function resumeExtensionOf(file) {
  const name = typeof file?.name === 'string' ? file.name : ''
  const dot = name.lastIndexOf('.')
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase()
}

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return 'Unknown size'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/* Human label for the file's format, preferring the extension the user actually
   selected over the browser's MIME string, which is empty for some local files. */
function resumeTypeLabel(file) {
  const extension = resumeExtensionOf(file)
  if (extension) return extension.toUpperCase()
  const type = typeof file?.type === 'string' ? file.type : ''
  return type || 'unknown'
}

function CareerBridgeModeSwitch({ mode, onChange }) {
  return (
    <div className="cb-mode-row">
      <div>
        <p className="cb-mode-title">Choose your experience</p>
        <p className="cb-mode-description">
          Demo uses a curated sample. Real builds a roadmap from your resume, job description and available hours.
        </p>
      </div>
      <div className="cb-mode-switch" role="group" aria-label="Career Bridge experience mode">
        <button
          type="button"
          className={`cb-mode-option${mode === 'demo' ? ' is-active' : ''}`}
          aria-pressed={mode === 'demo'}
          onClick={() => onChange('demo')}
        >
          Demo
        </button>
        <button
          type="button"
          className={`cb-mode-option${mode === 'real' ? ' is-active' : ''}`}
          aria-pressed={mode === 'real'}
          onClick={() => onChange('real')}
        >
          Real
        </button>
      </div>
    </div>
  )
}

function DemoInputCard({ icon, label, title, detail }) {
  return (
    <div className="cb-summary-card cb-input-card cb-demo-input-card">
      <div className="cb-summary-top">
        <span className="cb-summary-icon">{icon}</span>
        <span className="cb-summary-label">{label}</span>
        <span className="cb-demo-tag">Demo data</span>
      </div>
      <strong className="cb-summary-title">{title}</strong>
      <div className="cb-summary-foot">
        <span className="cb-file-state">{detail}</span>
      </div>
    </div>
  )
}

/* The real file input is visually hidden but stays focusable, so the pill is
   reachable by keyboard and its focus ring can be shown on the label. */
function ResumeInputCard({ file, status, text, error, onSelect, onClear }) {
  const inputId = useId()
  const hasFile = Boolean(file)
  const statusMessage = {
    idle: 'Selected, not extracted',
    extracting: 'Extracting text on this device…',
    ready: 'Text extracted locally — ready for analysis',
    error: 'Extraction failed',
  }[status]

  return (
    <div className="cb-summary-card cb-input-card">
      <div className="cb-summary-top">
        <span className="cb-summary-icon">
          <FileIcon />
        </span>
        <label className="cb-summary-label" htmlFor={inputId}>
          Resume
        </label>
        <input
          id={inputId}
          className="cb-fileinput"
          type="file"
          accept={RESUME_ACCEPT}
          onChange={(event) => {
            onSelect(event.target.files?.[0] ?? null, event.target)
          }}
        />
        {hasFile && (
          <button type="button" className="cb-icon-btn" onClick={onClear} aria-label="Remove selected resume">
            <CloseIcon />
          </button>
        )}
        <label className="cb-reupload" htmlFor={inputId}>
          {hasFile ? 'Replace' : 'Choose file'}
        </label>
      </div>

      {hasFile ? (
        <>
          <strong className="cb-summary-title" title={file.name}>
            {file.name}
          </strong>
          <div className="cb-summary-foot">
            <span className="cb-file-facts">
              {resumeTypeLabel(file)} · {formatFileSize(file.size)}
            </span>
            <span className={`cb-file-state is-${status}`} aria-live="polite">
              {statusMessage}
            </span>
          </div>
          {status === 'ready' && (
            <p className="cb-input-hint" aria-live="polite">
              {text.length.toLocaleString()} characters extracted. The text stays on this device and is not uploaded.
            </p>
          )}
          {status === 'extracting' && (
            <p className="cb-input-hint" role="status">
              Reading the selected file locally…
            </p>
          )}
        </>
      ) : (
        <>
          <strong className="cb-summary-title cb-input-placeholder">No resume selected</strong>
          <div className="cb-summary-foot">
            <span className="cb-file-facts">PDF, DOCX or TXT</span>
          </div>
          <p className="cb-input-hint">Choose a local file. It is not uploaded or read in this step.</p>
        </>
      )}

      {error && (
        <p className="cb-input-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

function JobDescriptionInputCard({ value, onChange, size = 'compact' }) {
  const inputId = useId()
  const length = value.length
  const hasText = length > 0

  return (
    <div className="cb-summary-card cb-input-card">
      <div className="cb-summary-top">
        <span className="cb-summary-icon">
          <TargetIcon />
        </span>
        <label className="cb-summary-label" htmlFor={inputId}>
          Job description
        </label>
        {hasText && (
          <button type="button" className="cb-icon-btn" onClick={() => onChange('')} aria-label="Clear job description">
            <CloseIcon />
          </button>
        )}
      </div>

      <textarea
        id={inputId}
        className="cb-jd-textarea"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Paste the full job posting, including responsibilities, requirements and skills."
        rows={size === 'tall' ? 10 : 4}
        aria-describedby={`${inputId}-hint ${inputId}-count`}
      />
      <p className="cb-input-hint" id={`${inputId}-hint`}>
        Kept in page state while you type. When you generate a roadmap, it is sent to the SkillBridge service as plain text.
      </p>

      <div className="cb-summary-foot">
        <span className="cb-file-facts" id={`${inputId}-count`} aria-live="polite">
          {hasText ? `${length.toLocaleString()} characters` : 'Empty'}
        </span>
        <span className="cb-file-state">
          {hasText ? 'Captured, not yet submitted' : 'Paste a job description to begin'}
        </span>
      </div>
    </div>
  )
}

const { min: MIN_HOURS, max: MAX_HOURS } = ROADMAP_BUDGET_RANGE

/* The tick marks under the rail are the budget values at which the engine
   re-weights hours and re-ranks skills, so they are the interaction made
   visible rather than decoration. They are centred on the thumb by insetting
   by half the thumb width, so a tick at 90h sits under a slider set to 90h. */
function TimeCard({ budget, onChange, committedHours, band, marks, skillCount, mode = 'demo' }) {
  const remaining = Math.max(0, budget - committedHours)
  const ratio = ((budget - MIN_HOURS) / (MAX_HOURS - MIN_HOURS)) * 100
  const track = `linear-gradient(90deg, var(--cb-violet) 0%, var(--cb-violet) ${ratio}%, var(--cb-violet-soft) ${ratio}%, var(--cb-violet-soft) 100%)`
  const committedRatio = budget > 0 ? Math.min(100, (committedHours / budget) * 100) : 0

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
        min={MIN_HOURS}
        max={MAX_HOURS}
        step={ROADMAP_BUDGET_RANGE.step}
        value={budget}
        onChange={onChange}
        style={{ background: track }}
        aria-label="Available learning hours"
        aria-valuetext={
          mode === 'demo'
            ? `${budget} hours. ${committedHours} hours committed, ${remaining} hours remaining.`
              : `${budget} hours available for your roadmap.`
        }
      />

      <div className="cb-marks" aria-hidden="true">
        {marks.map((mark) => (
          <span
            key={mark.hours}
            className={`cb-mark${mark.hours === band ? ' is-active' : ''}`}
            style={{ '--pct': mark.percent / 100 }}
          />
        ))}
        <span className="cb-mark-edge cb-mark-min">{MIN_HOURS}h</span>
        <span className="cb-mark-edge cb-mark-max">{MAX_HOURS}h</span>
      </div>

      {mode === 'demo' ? (
        <>
          <div className="cb-budget">
            <span className="cb-budget-track">
              <span className="cb-budget-used" style={{ width: `${committedRatio}%` }} />
            </span>
            <span className="cb-budget-readout">
              <span>
                <b>{committedHours}h</b> committed
              </span>
              <span>
                <b>{remaining}h</b> remaining
              </span>
            </span>
          </div>

          <div className="cb-summary-foot">
            <span className="cb-summary-status">Reprioritized at {band} hours</span>
            <span className="cb-summary-detail">All {skillCount} stops re-ranked, none dropped</span>
          </div>
        </>
      ) : (
        <div className="cb-summary-foot">
          <span className="cb-file-state">{budget} hours available for your roadmap</span>
        </div>
      )}
    </div>
  )
}

const FACT_ICONS = {
  why: <AskIcon />,
  demand: <TrendGlyphUp />,
  position: <RankIcon />,
  prerequisites: <CheckIcon />,
  topics: <BulbIcon />,
  resources: <ExternalIcon />,
}

/* Progressive disclosure. Secondary detail (topics, resources) is one click away
   so the panel leads with the reasoning instead of a wall of chips. */
function Disclosure({ label, iconKey, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  const panelId = useId()

  return (
    <div className="cb-disclosure">
      <button
        type="button"
        className="cb-disclosure-btn"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls={panelId}
      >
        <span className="cb-fact-ic" aria-hidden="true">
          {FACT_ICONS[iconKey]}
        </span>
        {label}
        <span className="cb-disclosure-chev" aria-hidden="true">
          <ChevronIcon />
        </span>
      </button>
      {open && (
        <div className="cb-disclosure-body" id={panelId}>
          {children}
        </div>
      )}
    </div>
  )
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

  const velocity = skill.velocity
  const facts = [
    { key: 'demand', label: 'Demand trend', value: `${skill.trend} · ${skill.demand}` },
    { key: 'position', label: 'Position', value: `${skill.position} of ${total}` },
    {
      key: 'prerequisites',
      label: 'Prerequisites',
      value: skill.prerequisites.length ? skill.prerequisites.join(' · ') : NOT_PROVIDED,
    },
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
        {skill.type && <span className="cb-chip cb-chip-type">{skill.type}</span>}
        <span className={`cb-chip cb-chip-prio cb-prio-${skill.priority.toLowerCase()}`}>{skill.priority}</span>
        <span className="cb-chip cb-chip-hours">{skill.hours} hours</span>
      </div>

      {/* The explanation is the reason this panel exists, so it leads. */}
      <div className="cb-detail-why">
        <span className="cb-fact-label">
          <span className="cb-fact-ic" aria-hidden="true">
            {FACT_ICONS.why}
          </span>
          Why this skill
        </span>
        <p>{skill.why}</p>
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

        {velocity.baseline_count !== null && (
          <div className="cb-fact-wide">
            <span className="cb-fact-label">
              <span className="cb-fact-ic" aria-hidden="true">
                <GaugeIcon />
              </span>
              Velocity
            </span>
            <p>
              {formatPercent(velocity.percentage_change)} · baseline {velocity.baseline_count} to latest{' '}
              {velocity.latest_count}
            </p>
          </div>
        )}
      </div>

      <div className="cb-detail-more">
        <Disclosure label="Key topics" iconKey="topics">
          <div className="cb-topics">
            {skill.topics.length ? (
              skill.topics.map((topic) => (
                <span className="cb-topic" key={topic}>
                  {topic}
                </span>
              ))
            ) : (
              <span className="cb-not-provided">{NOT_PROVIDED}</span>
            )}
          </div>
        </Disclosure>

        <Disclosure label="Recommended resources" iconKey="resources">
          {skill.resources.length ? (
            <ul className="cb-resources">
              {skill.resources.map((resource) => (
                <li className="cb-resource" key={resource}>
                  <span>{resource}</span>
                  <ExternalIcon />
                </li>
              ))}
            </ul>
          ) : (
            <p className="cb-not-provided">{NOT_PROVIDED}</p>
          )}
        </Disclosure>
      </div>
    </aside>
  )
}

const PROOF_ICONS = {
  velocity: <GaugeIcon />,
  external: <GlobeIcon />,
  baseline: <ScaleIcon />,
  budget: <ClockIcon />,
}

/* A live roadmap item carries only what the service returns — skill, hours,
   priority, reason — so the descriptive panels state plainly that a field is
   unavailable rather than rendering an empty chip row. */
const NOT_PROVIDED = 'Not provided by the service'

/* Each row is its own disclosure, so a reader opens only the method they care
   about. The heading wraps the button rather than sitting inside it — <h3> does
   not accept a <button>, the button does not accept an <h3>. */
function ProofRow({ proof, skill, flagCount }) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const velocity = skill?.velocity

  return (
    <article className={`cb-proof${open ? ' is-open' : ''}`}>
      <h3 className="cb-proof-heading">
        <button
          type="button"
          className="cb-proof-toggle"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          aria-controls={panelId}
        >
          <span className="cb-proof-ico" aria-hidden="true">
            {PROOF_ICONS[proof.kind]}
          </span>
          <span className="cb-proof-titles">
            <span className="cb-proof-title">{proof.title}</span>
            <span className="cb-proof-summary">{proof.summary}</span>
          </span>
          <span className="cb-proof-state" aria-hidden="true">
            <ChevronIcon />
          </span>
        </button>
      </h3>

      {open && (
        <div className="cb-proof-body" id={panelId}>
          <p>{proof.detail}</p>

          {proof.kind === 'velocity' && velocity && (
            <p className="cb-proof-figure">
              <b>{skill.name}</b> moved {formatPercent(velocity.percentage_change)} from a baseline of{' '}
              {velocity.baseline_count} to {velocity.latest_count} — classified {velocity.trend.toLowerCase()}.
            </p>
          )}

          {proof.kind === 'external' && (
            <p className="cb-proof-figure">
              {flagCount > 0
                ? `${flagCount} external vendor signal${flagCount === 1 ? '' : 's'} checked against this route.`
                : 'No external vendor signals available for this role yet, so the route rests on local analysis alone.'}
            </p>
          )}
        </div>
      )}
    </article>
  )
}

/* ------------------------------------------------------------- workspace views
   Every destination renders from data the Overview already loads — the profile,
   the roadmap and the budget — so no view introduces a second source of truth. */

function ViewShell({ label, title, icon, meta, children }) {
  return (
    <section className="cb-panel cb-view">
      <header className="cb-panel-head">
        <div>
          <span className="cb-label cb-label-route">
            <span className="cb-label-ic" aria-hidden="true">
              {icon}
            </span>
            {label}
          </span>
          <h2>{title}</h2>
        </div>
        {meta && <span className="cb-count">{meta}</span>}
      </header>
      {children}
    </section>
  )
}

function ViewNote({ label, icon, children }) {
  return (
    <div className="cb-view-note">
      <span className="cb-fact-label">
        <span className="cb-fact-ic" aria-hidden="true">
          {icon}
        </span>
        {label}
      </span>
      {children}
    </div>
  )
}

function ResumeAnalyzerView({ mode, profile, resume, onSelect, onClear, roadmap }) {
  return (
    <ViewShell
      label="Resume Analyzer"
      title="Resume"
      icon={<FileIcon />}
      meta={
        mode === 'demo'
          ? 'Demo profile'
          : resume.file
            ? resume.status === 'ready'
              ? `${resume.text.length.toLocaleString()} characters extracted`
              : resume.status === 'extracting'
                ? 'Extracting text'
                : resume.status === 'error'
                  ? 'Extraction error'
                  : 'Selected'
            : 'No file selected'
      }
    >
      <div className="cb-view-split is-stacked">
        {mode === 'demo' ? (
          <DemoInputCard
            icon={<FileIcon />}
            label="Resume profile"
            title="Curated sample learner"
            detail={`${profile.resume.detail} in demo data`}
          />
        ) : (
          <ResumeInputCard
            file={resume.file}
            status={resume.status}
            text={resume.text}
            error={resume.error}
            onSelect={onSelect}
            onClear={onClear}
          />
        )}
        <ViewNote label={mode === 'demo' ? 'Demo data' : 'What happens next'} icon={FACT_ICONS.why}>
          {mode === 'demo' ? (
            <p>This sample profile and its roadmap are curated demo content, not a real learner's resume.</p>
          ) : (
            <>
              <p>
                The file is read locally. When you generate a roadmap, its extracted text is sent as plain text to the
                SkillBridge service; the file itself is never uploaded.
              </p>
            </>
          )}
        </ViewNote>
      </div>
    </ViewShell>
  )
}

function RoleExplorerView({ mode, profile, roadmap, jobDescription, onChangeJobDescription }) {
  return (
    <ViewShell
      label="Role Explorer"
      title={mode === 'demo' ? profile.targetRole : 'Job description'}
      icon={<TargetIcon />}
      meta={mode === 'demo' ? 'Demo role' : `${jobDescription.length.toLocaleString()} characters`}
    >
      <div className="cb-view-split is-stacked">
        {mode === 'demo' ? (
          <DemoInputCard
            icon={<TargetIcon />}
            label="Target role"
            title={profile.jobDescription.file}
            detail={`${profile.jobDescription.detail} in demo data`}
          />
        ) : (
          <JobDescriptionInputCard value={jobDescription} onChange={onChangeJobDescription} size="tall" />
        )}
        <ViewNote label={mode === 'demo' ? 'Demo data' : 'What happens next'} icon={FACT_ICONS.position}>
          {mode === 'demo' ? (
            <p>This role profile and its roadmap are curated demo content, not an analysis of a real job description.</p>
          ) : (
            <p>Generate a roadmap from the Overview to submit this job description with your extracted resume text.</p>
          )}
        </ViewNote>
      </div>

      {mode === 'demo' && (
        <ul className="cb-view-list">
          {roadmap.map((skill) => (
            <li key={skill.id}>
              <span className="cb-view-rank">{String(skill.position).padStart(2, '0')}</span>
              <span className="cb-view-name">{skill.name}</span>
              <span className={`cb-chip cb-chip-tag cb-prio-${skill.priority.toLowerCase()}`}>{skill.priority}</span>
              <TrendMark trend={skill.trend} />
            </li>
          ))}
        </ul>
      )}
    </ViewShell>
  )
}

function SkillGapView({ roadmap, onSelect }) {
  return (
    <ViewShell label="Skill Gap" title="Priority skills" icon={<RankIcon />} meta={`${roadmap.length} skills`}>
      <ul className="cb-view-list cb-view-list-wide">
        {roadmap.map((skill) => (
          <li key={skill.id}>
            <button type="button" className="cb-view-pick" onClick={() => onSelect(skill.id)}>
              <span className="cb-view-rank">{String(skill.position).padStart(2, '0')}</span>
              <span className="cb-view-body">
                <span className="cb-view-name">{skill.name}</span>
                <span className="cb-view-why">{skill.why}</span>
              </span>
              <span className="cb-view-meta">
                <span className="cb-chip cb-chip-hours">{skill.hours}h</span>
                <span className={`cb-chip cb-chip-tag cb-prio-${skill.priority.toLowerCase()}`}>{skill.priority}</span>
                <TrendMark trend={skill.trend} />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </ViewShell>
  )
}

/* The planner reuses the Overview slider and its budget state directly, so the
   two views can never disagree about the current time allocation. */
function LearningPlannerView({ budget, onBudgetChange, committedHours, band, marks, roadmap, skillCount }) {
  return (
    <ViewShell label="Learning Planner" title="Time budget" icon={<ClockIcon />} meta={`${skillCount} skills`}>
      <div className="cb-view-split">
        <TimeCard
          budget={budget}
          onChange={onBudgetChange}
          committedHours={committedHours}
          band={band}
          marks={marks}
          skillCount={skillCount}
        />
        <ViewNote label="Effect on the route" icon={FACT_ICONS.position}>
          <p>
            At {budget} hours the engine re-weights every stop. {committedHours} hours are committed and{' '}
            {Math.max(0, budget - committedHours)} hours remain.
          </p>
        </ViewNote>
      </div>

      <ul className="cb-view-list">
        {roadmap.map((skill) => (
          <li key={skill.id}>
            <span className="cb-view-rank">{String(skill.position).padStart(2, '0')}</span>
            <span className="cb-view-name">{skill.name}</span>
            <span className="cb-view-hours">{skill.hours}h</span>
            <TrendMark trend={skill.trend} />
          </li>
        ))}
      </ul>
    </ViewShell>
  )
}

function MarketInsightsView({ roadmap }) {
  return (
    <ViewShell label="Market Insights" title="Demand signals" icon={<GlobeIcon />} meta={`${roadmap.length} skills`}>
      <ul className="cb-view-list cb-view-list-wide">
        {roadmap.map((skill) => (
          <li key={skill.id}>
            <span className="cb-view-rank">{String(skill.position).padStart(2, '0')}</span>
            <span className="cb-view-name">{skill.name}</span>
            <span className="cb-view-demand">{skill.demand}</span>
            <span className="cb-view-body">
              <span className="cb-view-why">
                {formatPercent(skill.velocity.percentage_change)} · baseline {skill.velocity.baseline_count} to latest{' '}
                {skill.velocity.latest_count}
              </span>
            </span>
            <TrendMark trend={skill.trend} />
          </li>
        ))}
      </ul>
    </ViewShell>
  )
}

function ResourcesView({ roadmap }) {
  return (
    <ViewShell label="Resources" title="Recommended resources" icon={<BulbIcon />} meta={`${roadmap.length} skills`}>
      <div className="cb-view-resources">
        {roadmap.map((skill) => (
          <div key={skill.id}>
            <span className="cb-fact-label">
              <span className="cb-fact-ic" aria-hidden="true">
                {FACT_ICONS.topics}
              </span>
              {skill.name}
            </span>
            {skill.resources.length ? (
              <ul className="cb-resources">
                {skill.resources.map((resource) => (
                  <li className="cb-resource" key={resource}>
                    <span>{resource}</span>
                    <ExternalIcon />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="cb-not-provided">{NOT_PROVIDED}</p>
            )}
          </div>
        ))}
      </div>
    </ViewShell>
  )
}

/* Community and Settings have no backing feature in this application, so they say
   so rather than presenting an empty or invented workspace. */
function ComingSoonView({ label, title, icon, message }) {
  return (
    <ViewShell label={label} title={title} icon={icon}>
      <div className="cb-view-empty">
        <span className="cb-view-empty-ic" aria-hidden="true">
          {icon}
        </span>
        <p>{message}</p>
      </div>
    </ViewShell>
  )
}

/* Overview summary tiles ----------------------------------------------------
   Compact restatements of data the Overview already loads. The project holds a
   single target role and no salary, region, employer or posting-count figures, so
   none of those appear here — every number below is a value already in the
   roadmap or the profile. */

function SummaryTile({ title, icon, actionLabel, actionName, onAction, children }) {
  return (
    <section className="cb-tile">
      <header className="cb-tile-head">
        <span className="cb-tile-label">
          <span className="cb-tile-ic" aria-hidden="true">
            {icon}
          </span>
          {title}
        </span>
        {actionLabel && (
          /* All three tiles read "View all", so each needs a distinct accessible
             name. The aria-label keeps the visible text as its prefix, so the
             control still matches speech input. */
          <button type="button" className="cb-tile-action" onClick={onAction} aria-label={actionName}>
            {actionLabel}
            <ArrowUpRightIcon />
          </button>
        )}
      </header>
      {children}
    </section>
  )
}

/* The profile carries one target role, so this lists that role rather than a
   ranked set. Its indicators are the key-skill count the analysis already
   reports and the length of the roadmap already loaded beside it. */
function TopMatchingRolesCard({ profile, roadmapLength, onOpen }) {
  return (
    <SummaryTile
      title="Top matching roles"
      icon={<TargetIcon />}
      actionLabel="View all"
      actionName="View all matching roles"
      onAction={onOpen}
    >
      <p className="cb-tile-lead">{profile.targetRole}</p>
      <p className="cb-tile-sub">{profile.jobDescription.detail}</p>
      <p className="cb-tile-sub">{roadmapLength} priority skills mapped</p>
    </SummaryTile>
  )
}

function JobMarketInsightsCard({ roadmap, onOpen }) {
  if (!roadmap.length) {
    return (
      <SummaryTile title="Job market insights" icon={<GlobeIcon />}>
        <p className="cb-detail-empty">No demand signals yet. Generate a roadmap to see them here.</p>
      </SummaryTile>
    )
  }

  const ranked = [...roadmap].sort((a, b) => b.velocity.percentage_change - a.velocity.percentage_change)
  const peak = Math.max(1, ...ranked.map((skill) => skill.velocity.percentage_change))
  const rising = roadmap.filter((skill) => skill.trend === 'Rising').length
  const leader = ranked[0]

  return (
    <SummaryTile
      title="Job market insights"
      icon={<GlobeIcon />}
      actionLabel="View all"
      actionName="View all job market insights"
      onAction={onOpen}
    >
      <p className="cb-tile-lead">
        {rising} of {roadmap.length} stops rising
      </p>
      <p className="cb-tile-sub">
        Strongest signal {leader.name} {formatPercent(leader.velocity.percentage_change)}
      </p>

      <ul className="cb-tile-bars">
        {ranked.slice(0, 3).map((skill) => {
          const change = skill.velocity.percentage_change
          const isFall = change < 0
          return (
            <li key={skill.id}>
              <span className="cb-tile-bar-name">{skill.name}</span>
              <span className="cb-tile-meter">
                <span
                  className={`cb-tile-bar${isFall ? ' is-fall' : ''}`}
                  style={{ width: `${isFall ? 0 : (change / peak) * 100}%` }}
                />
              </span>
              <span className={`cb-tile-bar-val${isFall ? ' is-fall' : ''}`}>{formatPercent(change)}</span>
            </li>
          )
        })}
      </ul>
    </SummaryTile>
  )
}

function RecommendedResourcesCard({ roadmap, onOpen }) {
  const picks = roadmap.slice(0, 2).flatMap((skill) =>
    skill.resources.slice(0, 2).map((resource) => ({ resource, skill })),
  ).slice(0, 3)

  return (
    <SummaryTile
      title="Recommended resources"
      icon={<BulbIcon />}
      actionLabel="View all"
      actionName="View all recommended resources"
      onAction={onOpen}
    >
      <ul className="cb-tile-resources">
        {picks.map(({ resource, skill }) => (
          <li key={`${skill.id}-${resource}`}>
            <span className="cb-tile-res-name">{resource}</span>
            <span className="cb-tile-res-meta">
              {skill.name} · {skill.type}
            </span>
          </li>
        ))}
      </ul>
    </SummaryTile>
  )
}

function OverviewSummaryRow({ profile, roadmap, onOpenRoles, onOpenMarket, onOpenResources }) {
  return (
    <div className="cb-tiles">
      <TopMatchingRolesCard profile={profile} roadmapLength={roadmap.length} onOpen={onOpenRoles} />
      <JobMarketInsightsCard roadmap={roadmap} onOpen={onOpenMarket} />
      <RecommendedResourcesCard roadmap={roadmap} onOpen={onOpenResources} />
    </div>
  )
}

/* Request state for the route. It reuses the dashed surface already used by the
   empty workspace views, so an in-flight or failed request reads as part of the
   page rather than as an overlay. Live regions carry the state for assistive
   technology, and the failure copy is written for a reader, not a developer. */
function RoadmapStatus({ loading, pending, error, hasRoute }) {
  if (error) {
    return (
      <div className="cb-status is-error" role="alert">
        <span className="cb-status-title">{error.title}</span>
        <p className="cb-status-body">{error.message}</p>
        {error.detail && <p className="cb-status-note">{error.detail}</p>}
        {error.kind === 'unsupported-role' && (
          <p className="cb-status-note">
            Everything else in Career Bridge still works — the time budget, the skill gap list and the role details are
            unchanged. Set <code>VITE_CAREER_BRIDGE_TARGET_ROLE</code> to a role listed above to plan against the live
            service.
          </p>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <p className="cb-status is-loading" aria-live="polite">
        Building your route from the SkillBridge service…
      </p>
    )
  }

  /* A completed refetch that already has a route on screen stays a quiet note, so
     moving the slider never blanks the list it is describing. */
  if (pending && hasRoute) {
    return (
      <p className="cb-status is-updating" aria-live="polite">
        Recomputing the route for the new time budget…
      </p>
    )
  }

  return null
}

/* ----------------------------------------------------------------- page */

/* Roadmap and proof requests are service calls in API mode, so the page owns their
   lifecycle. Each effect cancels its own in-flight request, which both prevents a
   slow response overwriting a newer budget and avoids overlapping requests when
   the slider moves quickly. */
const EMPTY_ROADMAP = { items: [], band: CAREER_BRIDGE_DEFAULT_BUDGET, committedHours: 0 }

export default function CareerBridge() {
  const [mode, setMode] = useState('demo')
  const [budget, setBudget] = useState(CAREER_BRIDGE_DEFAULT_BUDGET)
  const [selectedId, setSelectedId] = useState('python')
  const [evidenceOpen, setEvidenceOpen] = useState(false)
  const [view, setView] = useState(CAREER_BRIDGE_VIEWS.overview)

  const [roadmapData, setRoadmapData] = useState(EMPTY_ROADMAP)
  const [proofs, setProofs] = useState([])
  const [vendorFlags, setVendorFlags] = useState([])
  const [roadmapLoading, setRoadmapLoading] = useState(true)
  const [roadmapPending, setRoadmapPending] = useState(false)
  const [roadmapError, setRoadmapError] = useState(null)
  const [auxError, setAuxError] = useState(null)

  /* Real inputs remain separate from Demo data. The extracted text is submitted
     only when the user explicitly requests a real roadmap. */
  const [resume, setResume] = useState({ file: null, text: '', status: 'idle', error: null })
  const [jobDescription, setJobDescription] = useState('')
  const resumeRequestId = useRef(0)
  const roadmapRequestId = useRef(0)
  const roadmapRequest = useRef(null)

  const profile = useMemo(() => loadDemoProfile(), [])
  const marks = useMemo(() => getRecalibrationMarks(), [])

  useEffect(
    () => () => {
      resumeRequestId.current += 1
      roadmapRequestId.current += 1
      roadmapRequest.current?.abort()
    },
    [],
  )

  useEffect(() => {
    if (mode !== 'demo') return undefined

    const controller = new AbortController()
    setRoadmapPending(true)

    loadDemoRoadmap({ budgetHours: budget, signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return
        setRoadmapData(data)
        setRoadmapError(null)
      })
      .catch((error) => {
        if (controller.signal.aborted) return
        setRoadmapData(EMPTY_ROADMAP)
        setRoadmapError({
          kind: 'demo',
          title: 'Demo roadmap unavailable',
          message: error instanceof Error ? error.message : 'The local demo roadmap could not be loaded.',
          detail: '',
        })
      })
      .finally(() => {
        if (controller.signal.aborted) return
        setRoadmapPending(false)
        setRoadmapLoading(false)
      })

    return () => controller.abort()
  }, [budget, mode])

  /* Evidence and vendor flags decorate the route rather than drive it, so a
     failure in one is reported instead of being swallowed into an empty list. */
  useEffect(() => {
    if (mode !== 'demo') {
      setProofs([])
      setVendorFlags([])
      setAuxError(null)
      return undefined
    }

    let active = true
    const controller = new AbortController()
    Promise.all([loadDemoProofs({ signal: controller.signal }), loadDemoVendorFlags({ signal: controller.signal })])
      .then(([loadedProofs, loadedFlags]) => {
        if (!active) return
        setProofs(loadedProofs)
        setVendorFlags(loadedFlags)
        setAuxError(null)
      })
      .catch((error) => {
        if (!active) return
        setAuxError({
          title: 'Demo insights unavailable',
          message: error instanceof Error ? error.message : 'The local demo insights could not be loaded.',
        })
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [mode])

  const { band, committedHours } = roadmapData

  const roadmap = roadmapData.items

  /* Before the first response there is nothing to select, so the panel keeps its
     documented empty state rather than reaching into an empty array. */
  const selected = roadmap.find((skill) => skill.id === selectedId) ?? roadmap[0]

  useEffect(() => {
    if (!roadmap.length) return
    setSelectedId((current) => (roadmap.some((skill) => skill.id === current) ? current : roadmap[0].id))
  }, [roadmap])

  const handleSelect = (id) => setSelectedId(id)

  const invalidateRealRoadmap = () => {
    roadmapRequestId.current += 1
    roadmapRequest.current?.abort()
    roadmapRequest.current = null
    setRoadmapData(EMPTY_ROADMAP)
    setRoadmapError(null)
    setRoadmapLoading(false)
    setRoadmapPending(false)
  }

  const handleBudgetChange = (event) => {
    if (mode === 'real') invalidateRealRoadmap()
    setBudget(Number(event.target.value))
  }

  const handleModeChange = (nextMode) => {
    if (nextMode === mode) return
    roadmapRequestId.current += 1
    roadmapRequest.current?.abort()
    roadmapRequest.current = null
    setRoadmapData(EMPTY_ROADMAP)
    setRoadmapError(null)
    setRoadmapPending(false)
    setRoadmapLoading(nextMode === 'demo')
    setMode(nextMode)
    setView(CAREER_BRIDGE_VIEWS.overview)
  }

  const handleJobDescriptionChange = (value) => {
    if (mode === 'real') invalidateRealRoadmap()
    setJobDescription(value)
  }

  const handleResumeSelect = (file, input) => {
    if (!file) return
    invalidateRealRoadmap()
    const requestId = resumeRequestId.current + 1
    resumeRequestId.current = requestId
    setResume({ file, text: '', status: 'extracting', error: null })
    input.value = ''

    try {
      validateResumeFile(file)
    } catch (error) {
      setResume({
        file,
        text: '',
        status: 'error',
        error: error instanceof Error ? error.message : 'This resume file is not supported.',
      })
      return
    }

    extractResumeText(file).then(
      (text) => {
        if (resumeRequestId.current !== requestId) return
        setResume({ file, text, status: 'ready', error: null })
      },
      (error) => {
        if (resumeRequestId.current !== requestId) return
        setResume({
          file,
          text: '',
          status: 'error',
          error: error instanceof Error ? error.message : 'This resume could not be read. Try another file.',
        })
      },
    )
  }

  const handleResumeClear = () => {
    invalidateRealRoadmap()
    resumeRequestId.current += 1
    setResume({ file: null, text: '', status: 'idle', error: null })
  }

  const handleRealSubmit = () => {
    if (resume.status !== 'ready' || !resume.text.trim() || !jobDescription.trim()) {
      setRoadmapError({
        kind: 'invalid-input',
        title: 'Complete both inputs first',
        message: 'Select and extract a resume, then enter a job description before generating a roadmap.',
        detail: '',
      })
      return
    }

    roadmapRequestId.current += 1
    const requestId = roadmapRequestId.current
    const controller = new AbortController()
    roadmapRequest.current?.abort()
    roadmapRequest.current = controller
    setRoadmapData(EMPTY_ROADMAP)
    setRoadmapError(null)
    setRoadmapLoading(true)
    setRoadmapPending(true)

    submitRoadmap({
      resumeText: resume.text,
      jdText: jobDescription,
      budgetHours: budget,
      signal: controller.signal,
    })
      .then((data) => {
        if (roadmapRequestId.current !== requestId) return
        setRoadmapData(data)
      })
      .catch((error) => {
        if (roadmapRequestId.current !== requestId || isAbortError(error)) return
        setRoadmapError(describeApiError(error))
      })
      .finally(() => {
        if (roadmapRequestId.current !== requestId) return
        roadmapRequest.current = null
        setRoadmapLoading(false)
        setRoadmapPending(false)
      })
  }

  /* Skill Gap lists the same stops the Overview detail panel describes, so picking
     one there selects it and returns to the view that can explain it. */
  const handleGapSelect = (id) => {
    setSelectedId(id)
    setView(CAREER_BRIDGE_VIEWS.overview)
  }

  const isOverview = view === CAREER_BRIDGE_VIEWS.overview
  const isDemo = mode === 'demo'

  return (
    <section className="career-bridge" id="career-bridge">
      <div className="cb-shell">
        <CareerBridgeSidebar view={view} mode={mode} onChange={setView} />
        <div className="cb-main-col">
          <div className="cb-inner">
        <CareerBridgeModeSwitch mode={mode} onChange={handleModeChange} />

        {isOverview && (
        <header className="cb-intro">
          {/* The approved hero artwork is a static raster asset. It already carries the
              student, floating skill cards, handwritten annotations, arrows, background
              shapes and hero typography, so none of it is redrawn in CSS/SVG here.
              The copy below is retained for screen readers only. */}
          <div className="cb-hero-sr">
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
          <figure className="cb-hero-figure">
            <img
              className="cb-hero-art"
              src={CB_HERO_ART.src}
              width={CB_HERO_ART.width}
              height={CB_HERO_ART.height}
              alt="A student stands at the centre of a wide illustrated scene, surrounded by floating skill cards for Python, Machine Learning, Java, Cloud Computing, SQL and Web Development, with handwritten annotations and hand-drawn arrows pointing across the gap."
              decoding="async"
            />
          </figure>
        </header>
        )}

        {isOverview && (
        <section className="cb-summary" aria-label="Analysis inputs" data-summary="1">
          {isDemo ? (
            <>
              <DemoInputCard
                icon={<FileIcon />}
                label="Resume profile"
                title="Curated sample learner"
                detail={`Demo data: ${profile.resume.detail}`}
              />
              <DemoInputCard
                icon={<TargetIcon />}
                label="Target role"
                title={profile.jobDescription.file}
                detail={`Demo data: ${profile.jobDescription.detail}`}
              />
            </>
          ) : (
            <>
              <ResumeInputCard
                file={resume.file}
                status={resume.status}
                text={resume.text}
                error={resume.error}
                onSelect={handleResumeSelect}
                onClear={handleResumeClear}
              />
              <JobDescriptionInputCard value={jobDescription} onChange={handleJobDescriptionChange} />
            </>
          )}
          <TimeCard
            budget={budget}
            onChange={handleBudgetChange}
            committedHours={committedHours}
            band={band}
            marks={marks}
            skillCount={roadmap.length}
            mode={mode}
          />
        </section>
        )}

        {!isDemo && isOverview && (
          <div className="cb-stage-note">
            <strong>{roadmap.length ? 'Live roadmap from your inputs' : 'Build a roadmap from your inputs'}</strong>
            <p>
              The extracted resume text, job description and available hours are sent to the SkillBridge service when
              you submit. The file itself is never uploaded.
            </p>
            {API_TARGET_ROLE_WARNING && (
              <p role="status">
                Configured target role “{API_TARGET_ROLE_WARNING}” is not currently plannable. It will be omitted from
                the request; the roadmap will use your resume and job description.
              </p>
            )}
            <div className="cb-real-submit-row">
              <p aria-live="polite">
                {resume.status !== 'ready'
                  ? 'Select a supported resume and wait for text extraction.'
                  : !jobDescription.trim()
                    ? 'Add a job description to continue.'
                    : 'Your inputs are ready to submit.'}
              </p>
              <button
                className="cb-real-submit"
                type="button"
                onClick={handleRealSubmit}
                disabled={roadmapLoading || resume.status !== 'ready' || !resume.text.trim() || !jobDescription.trim()}
              >
                {roadmapLoading ? 'Building roadmap…' : 'Generate roadmap'}
              </button>
            </div>
          </div>
        )}

        {isOverview && (
          <RoadmapStatus
            loading={roadmapLoading}
            pending={roadmapPending}
            error={roadmapError}
            hasRoute={roadmap.length > 0}
          />
        )}

        {/* The route itself still renders when this fails; the missing decoration
            is named rather than shown as if it had returned nothing. */}
        {isDemo && auxError && isOverview && (
          <div className="cb-status is-error" role="status">
            <span className="cb-status-title">{auxError.title}</span>
            <p className="cb-status-body">
              {auxError.message} The roadmap route is unaffected; its evidence and vendor
              annotations are unavailable.
            </p>
          </div>
        )}

        {isOverview && (
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
            {roadmap.length > 0 ? (
            <ol className="cb-routes" key={band}>
              {roadmap.map((skill, index) => {
                const isActive = selected?.id === skill.id
                return (
                  <li key={skill.id}>
                    <button
                      type="button"
                      className={`cb-route${isActive ? ' is-active' : ''}`}
                      onClick={() => handleSelect(skill.id)}
                      aria-current={isActive ? 'true' : undefined}
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
            ) : (
              /* The panel keeps its shape and states the outcome, rather than
                 collapsing to nothing when the service returns no route. */
              <p className="cb-detail-empty">No route to show for this time budget yet.</p>
            )}
          </section>

          <DetailPanel skill={selected} total={roadmap.length} />
        </div>
        )}

        {view === CAREER_BRIDGE_VIEWS.resume && (
          <ResumeAnalyzerView
            mode={mode}
            profile={profile}
            resume={resume}
            onSelect={handleResumeSelect}
            onClear={handleResumeClear}
            roadmap={roadmap}
          />
        )}

        {view === CAREER_BRIDGE_VIEWS.role && (
          <RoleExplorerView
            mode={mode}
            profile={profile}
            roadmap={roadmap}
            jobDescription={jobDescription}
            onChangeJobDescription={handleJobDescriptionChange}
          />
        )}

        {isDemo && view === CAREER_BRIDGE_VIEWS.gap && <SkillGapView roadmap={roadmap} onSelect={handleGapSelect} />}

        {isDemo && view === CAREER_BRIDGE_VIEWS.planner && (
          <LearningPlannerView
            budget={budget}
            onBudgetChange={handleBudgetChange}
            committedHours={committedHours}
            band={band}
            marks={marks}
            roadmap={roadmap}
            skillCount={roadmap.length}
          />
        )}

        {isDemo && view === CAREER_BRIDGE_VIEWS.market && <MarketInsightsView roadmap={roadmap} />}

        {isDemo && view === CAREER_BRIDGE_VIEWS.resources && <ResourcesView roadmap={roadmap} />}

        {isDemo && view === CAREER_BRIDGE_VIEWS.community && (
          <ComingSoonView
            label="Community"
            title="Community"
            icon={<CommunityIcon />}
            message="Community workspace coming soon"
          />
        )}

        {isDemo && view === CAREER_BRIDGE_VIEWS.settings && (
          <ComingSoonView
            label="Settings"
            title="Settings"
            icon={<SettingsIcon />}
            message="Settings workspace coming soon"
          />
        )}

        {isDemo && isOverview && (
          <OverviewSummaryRow
            profile={profile}
            roadmap={roadmap}
            onOpenRoles={() => setView(CAREER_BRIDGE_VIEWS.role)}
            onOpenMarket={() => setView(CAREER_BRIDGE_VIEWS.market)}
            onOpenResources={() => setView(CAREER_BRIDGE_VIEWS.resources)}
          />
        )}

        {isDemo && isOverview && (
          <>
            <section className="cb-evidence" aria-labelledby="cb-evidence-title">
            <h2 className="cb-evidence-heading" id="cb-evidence-title">
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
          </h2>
          {evidenceOpen && (
            <div className="cb-evidence-panel cb-evidence-in" id="cb-evidence-panel">
              <div className="cb-proofs">
                {proofs.map((proof) => (
                  <ProofRow
                    proof={proof}
                    skill={selected}
                    flagCount={vendorFlags.length}
                    key={proof.id}
                  />
                ))}
              </div>
            </div>
          )}
        </section>

        <footer className="cb-footer">
          {isDemo ? (
            <>
              <span>Demo mode / local deterministic data</span>
              <span>Move the time dial. The route responds.</span>
            </>
          ) : (
            <>
              <span>Real input mode · live service</span>
              <span>Generate roadmap sends your resume text, job description and hours to the SkillBridge service.</span>
            </>
          )}
        </footer>
          </>
        )}
          </div>
        </div>
      </div>
    </section>
  )
}
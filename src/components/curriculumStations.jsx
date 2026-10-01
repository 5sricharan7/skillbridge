import { useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  classificationLabel,
  formatCount,
  formatDate,
  formatFrequency,
  formatHours,
  formatObservation,
} from '../data/curriculumSource'

const ICON = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': 'true',
  focusable: 'false',
}

const AlertIcon = (props) => (
  <svg {...ICON} {...props}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 8v5M12 15.5v.01" />
  </svg>
)

const CheckIcon = (props) => (
  <svg {...ICON} {...props}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m8.5 12.2 2.4 2.4 4.6-5" />
  </svg>
)

const DashIcon = (props) => (
  <svg {...ICON} {...props}>
    <path d="M5 12h14" />
  </svg>
)

const ChevronIcon = (props) => (
  <svg {...ICON} {...props}>
    <path d="m7 9.5 5 5 5-5" />
  </svg>
)

const ArrowIcon = (props) => (
  <svg {...ICON} {...props}>
    <path d="M5 12h13M13 6.5 18.5 12 13 17.5" />
  </svg>
)

const CloseIcon = (props) => (
  <svg {...ICON} {...props}>
    <path d="m6.5 6.5 11 11M17.5 6.5l-11 11" />
  </svg>
)

const PulseIcon = (props) => (
  <svg {...ICON} {...props}>
    <path d="M3.5 12h3.2l2.1-5.6 3.4 11.2 2.3-7.1 1.6 1.5h4.4" />
  </svg>
)

const MapIcon = (props) => (
  <svg {...ICON} {...props}>
    <path d="M3.5 6.5 9 4.5v13l-5.5 2zM9 4.5l6 2v13l-6-2zM15 6.5l5.5-2v13L15 19.5z" />
  </svg>
)

const TrendIcon = (props) => (
  <svg {...ICON} {...props}>
    <path d="M4 19h16" />
    <path d="m5 15.5 4.5-5 3.5 3L18.5 7" />
    <path d="M15 7h3.5v3.5" />
  </svg>
)

const MatrixIcon = (props) => (
  <svg {...ICON} {...props}>
    <rect x="3.5" y="3.5" width="7" height="7" rx="1.4" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="1.4" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="1.4" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="1.4" />
  </svg>
)

const ProposalIcon = (props) => (
  <svg {...ICON} {...props}>
    <path d="M4.5 5.5h15v13h-15z" />
    <path d="M4.5 10h15M9 3.5v4M15 3.5v4" />
    <path d="m9 14.5 2 2 4-4" />
  </svg>
)

const SearchIcon = (props) => (
  <svg {...ICON} {...props}>
    <circle cx="10.5" cy="10.5" r="5.5" />
    <path d="m15 15 4.5 4.5" />
  </svg>
)

const ClockIcon = (props) => (
  <svg {...ICON} {...props}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
)

const StampIcon = (props) => (
  <svg {...ICON} {...props}>
    <path d="M5 20.5h14" />
    <path d="M8.5 17.5v-3.2l1.6-1.4V8.4a2.4 2.4 0 0 1 4.8 0v4.5l1.6 1.4v3.2" />
  </svg>
)

const LinkIcon = (props) => (
  <svg {...ICON} {...props}>
    <path d="M10 14a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1.2 1.2" />
    <path d="M14 10a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1.2-1.2" />
  </svg>
)

const StackIcon = (props) => (
  <svg {...ICON} {...props}>
    <path d="m12 4 8 4-8 4-8-4z" />
    <path d="m4 12 8 4 8-4M4 16l8 4 8-4" />
  </svg>
)

export { DashIcon, MapIcon, MatrixIcon, ProposalIcon, PulseIcon, StampIcon, TrendIcon }

/* Every status chip carries the service's own string, so the tint is never the only
   thing distinguishing an outcome. */
const STATUS_TONE = {
  placed: 'ok',
  placed_in_recorded_semester: 'ok',
  recommended_with_recorded_placement: 'ok',
  recorded_and_resolved_in_curriculum: 'ok',
  covered: 'ok',
  usable_prerequisite: 'ok',
  sufficient: 'ok',
  insufficient_data: 'warn',
  insufficient_data_usable_prerequisite: 'warn',
  prerequisites_not_recorded: 'warn',
  prerequisite_skill_absent_from_curriculum: 'warn',
  no_industry_record: 'warn',
  unmatched_curriculum_skill: 'warn',
  not_recorded: 'warn',
  unrecorded: 'warn',
  blocked: 'stop',
  blocked_prerequisite_cycle: 'stop',
  blocked_recorded_prerequisite_cycle: 'stop',
  blocked_prerequisite_dangling: 'stop',
  blocked_recorded_dangling_prerequisite: 'stop',
  recorded_cycle_in_curriculum_chain: 'stop',
  recorded_dangling_in_curriculum_chain: 'stop',
  blocked_no_recorded_prerequisites: 'stop',
  unplaced_no_usable_prerequisite: 'stop',
}

function statusTone(value) {
  return STATUS_TONE[String(value ?? '').toLowerCase()] ?? 'plain'
}

/** The recorded sign, also drawn as a glyph so the tint never carries it alone. */
function movementOf(absoluteChange) {
  if (absoluteChange === null || absoluteChange === undefined) {
    return { tone: 'none', glyph: 'â€“', label: 'not comparable' }
  }
  if (absoluteChange > 0) return { tone: 'rise', glyph: 'â–²', label: 'higher in the later slice' }
  if (absoluteChange < 0) return { tone: 'fall', glyph: 'â–¼', label: 'lower in the later slice' }
  return { tone: 'stable', glyph: '=', label: 'unchanged between the slices' }
}

const DISTINCT_CLASSIFICATIONS = ['core', 'mid', 'noise']

/* ---------------------------------------------------------- small pieces */

function NotRecorded({ children = 'Not recorded' }) {
  return (
    <span className="ctm-unrecorded">
      <AlertIcon />
      {children}
    </span>
  )
}

/** A recorded number, or the fact that nothing was recorded for it. */
function Value({ value, unit }) {
  if (value === null || value === undefined) return <NotRecorded />
  return (
    <span className="ctm-num">
      {formatCount(value)}
      {unit ? <span className="ctm-unit"> {unit}</span> : null}
    </span>
  )
}

function StatusChip({ value }) {
  if (!value) return <NotRecorded>No status recorded</NotRecorded>
  return <span className={`ctm-chip ctm-status-chip is-${statusTone(value)}`}>{value}</span>
}

function ClassificationChip({ value }) {
  if (!value) return null
  return <span className={`ctm-chip ctm-class-chip is-${value.toLowerCase()}`}>{classificationLabel(value)}</span>
}

function HoursValue({ hours, source }) {
  return (
    <span className="ctm-hours">
      <ClockIcon />
      {hours === null || hours === undefined ? (
        <NotRecorded>No learning hours recorded</NotRecorded>
      ) : (
        <span className="ctm-hours-value">
          {formatHours(hours)}
          {source ? <span className="ctm-hours-source"> Â· {source}</span> : null}
        </span>
      )}
    </span>
  )
}

export function Fields({ children, className = '' }) {
  return <dl className={`ctm-facts ${className}`.trim()}>{children}</dl>
}

export function Field({ label, children, wide = false }) {
  return (
    <div className={`ctm-fact${wide ? ' is-wide' : ''}`.trim()}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

/** A labelled block for facts that stand outside a field list. */
function FieldBlock({ label, children }) {
  return (
    <div className="ctm-fieldblock">
      <p className="ctm-fieldblock-label">{label}</p>
      <div className="ctm-fieldblock-value">{children}</div>
    </div>
  )
}

function PanelHead({ label, icon, title, count, action }) {
  return (
    <div className="ctm-panel-head">
      <div className="ctm-panel-heading">
        {label ? (
          <p className="ctm-label">
            {icon ? <span className="ctm-label-ic">{icon}</span> : null}
            {label}
          </p>
        ) : null}
        {title ? <h3 className="ctm-panel-title">{title}</h3> : null}
      </div>
      {count ? <p className="ctm-count">{count}</p> : null}
      {action ? <div className="ctm-panel-action">{action}</div> : null}
    </div>
  )
}

function Panel({ label, icon, title, count, note, foot, action, children, className = '' }) {
  return (
    <section className={`ctm-panel ${className}`.trim()}>
      <PanelHead label={label} icon={icon} title={title} count={count} action={action} />
      {note ? <p className="ctm-panel-note">{note}</p> : null}
      {children}
      {foot ? <p className="ctm-panel-foot">{foot}</p> : null}
    </section>
  )
}

function SearchInput({ label, value, onChange, matched, total, placeholder }) {
  const inputId = useId()
  return (
    <div className="ctm-search">
      <label className="ctm-search-label" htmlFor={inputId}>
        <SearchIcon className="ctm-search-ic" />
        <span className="ctm-visually-hidden">{label}</span>
        <input
          id={inputId}
          type="search"
          className="ctm-search-input"
          value={value}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck="false"
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
      <p className="ctm-search-count ctm-num" aria-live="polite">
        {formatCount(matched)} of {formatCount(total)}
      </p>
    </div>
  )
}

/** One classification or status choice. The word is the value, never a score. */
function FilterChip({ value, label, active, onClick }) {
  return (
    <button type="button" className={`ctm-filter${active ? ' is-active' : ''}`} aria-pressed={active} onClick={onClick}>
      {label ?? value}
    </button>
  )
}

function Toolbar({ children, className = '' }) {
  return <div className={`ctm-toolbar ${className}`.trim()}>{children}</div>
}

function Limitations({ items, title = 'Evidence limitations' }) {
  if (!items || items.length === 0) {
    return (
      <p className="ctm-inline-note">
        <CheckIcon />
        The service recorded no evidence limitation for this item.
      </p>
    )
  }
  return (
    <div className="ctm-limit">
      <p className="ctm-limit-title">
        <AlertIcon />
        {title}
      </p>
      <ul className="ctm-limit-list">
        {items.map((item, index) => (
          <li key={`${item.code}-${index}`}>
            <code className="ctm-code">{item.code}</code>
            <span>{item.note}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function NotAvailableList({ items, title = 'Not available in this record' }) {
  if (!items || items.length === 0) return null
  return (
    <div className="ctm-notice">
      <p className="ctm-notice-title">
        <AlertIcon />
        {title}
      </p>
      <ul className="ctm-notice-list">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

function CountMap({ value, empty = 'The service recorded no counts for this map.' }) {
  const entries = value ? Object.entries(value) : []
  if (entries.length === 0) return <p className="ctm-inline-note">{empty}</p>
  return (
    <ul className="ctm-map">
      {entries.map(([key, count]) => (
        <li className="ctm-map-row" key={key}>
          <StatusChip value={key} />
          <span className="ctm-map-count">{formatCount(count)}</span>
        </li>
      ))}
    </ul>
  )
}

export function Disclosure({ id, title, count, open, onToggle, children }) {
  const bodyId = `${id}-panel`
  return (
    <div className="ctm-disclosure">
      <button
        type="button"
        id={id}
        className="ctm-disclosure-btn"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={onToggle}
      >
        <ChevronIcon className={open ? 'ctm-disclosure-chevron is-open' : 'ctm-disclosure-chevron'} />
        <span className="ctm-disclosure-title">{title}</span>
        {count ? <span className="ctm-disclosure-count">{count}</span> : null}
      </button>
      <div id={bodyId} className="ctm-disclosure-panel" role="region" aria-labelledby={id}>
        {open ? children : null}
      </div>
    </div>
  )
}

/**
 * Counts a recorded number up from zero once, over 0.4s, and then holds it. The
 * final frame is the service's own value, so the animation never changes what is
 * stated, and a reader who prefers reduced motion sees it immediately.
 */
function useCountUp(value, delay = 0) {
  const [shown, setShown] = useState(0)

  useEffect(() => {
    if (typeof document === 'undefined') return undefined
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(value)
      return undefined
    }

    let frame = 0
    const duration = 400
    let start = null

    const step = (timestamp) => {
      if (start === null) start = timestamp
      const progress = Math.min(1, (timestamp - start) / duration)
      setShown(value * (1 - (1 - progress) ** 3))
      if (progress < 1) frame = requestAnimationFrame(step)
    }

    const timer = setTimeout(() => {
      frame = requestAnimationFrame(step)
    }, delay)

    return () => {
      clearTimeout(timer)
      cancelAnimationFrame(frame)
    }
  }, [value, delay])

  return shown
}

/**
 * A compact record card. The number counts up once on mount, from zero, so a
 * change of role or artifact is noticed without the number ever being wrong at
 * rest. Numbers are the service's, never a score this page invented.
 */
function MetricTile({ icon, label, value, detail, tone = 'plain', onClick, active, delay = 0 }) {
  const numeric = typeof value === 'number'
  const shown = useCountUp(numeric ? value : 0, delay)
  const display = numeric ? formatCount(Math.round(shown)) : value
  const content = (
    <>
      <span className="ctm-tile-label">{label}</span>
      <span className={`ctm-tile-value is-${tone} ctm-num`}>{display}</span>
      {detail ? <span className="ctm-tile-detail">{detail}</span> : null}
      {icon ? <span className={`ctm-tile-icon is-${tone}`}>{icon}</span> : null}
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        className={`ctm-tile is-${tone}${active ? ' is-active' : ''}`}
        style={{ '--ctm-tile-delay': `${delay}ms` }}
        aria-pressed={active}
        onClick={onClick}
      >
        {content}
      </button>
    )
  }

  return (
    <div className={`ctm-tile is-${tone}`} style={{ '--ctm-tile-delay': `${delay}ms` }}>
      {content}
    </div>
  )
}

/**
 * One endpoint's loading and failure state, reported inside the view that lost it
 * rather than blanking the workspace and hiding the views that did load.
 */
function ResourceState({ status, error, loadingNote, onRetry, children }) {
  if (status === 'loading') {
    return (
      <div className="ctm-status" role="status" aria-live="polite">
        <p className="ctm-status-title">
          <span className="ctm-spinner" aria-hidden="true" />
          Loading recorded data
        </p>
        <p className="ctm-status-note">{loadingNote}</p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="ctm-notice ctm-notice-error" role="alert">
        <p className="ctm-notice-title">
          <AlertIcon />
          {error?.title ?? 'This data could not be loaded.'}
        </p>
        <p className="ctm-notice-body">{error?.detail || error?.message}</p>
        {onRetry ? (
          <button type="button" className="ctm-retry" onClick={onRetry}>
            Reload this data
          </button>
        ) : null}
      </div>
    )
  }

  return children
}

export function RetryButton({ onRetry, children = 'Reload recorded data' }) {
  if (!onRetry) return null
  return (
    <button type="button" className="ctm-retry" onClick={onRetry}>
      {children}
    </button>
  )
}

/**
 * The one detail surface in the workspace. A real dialog, so Escape, the focus
 * order, and the return of focus behave; on a narrow screen it becomes a full-width
 * sheet anchored to the bottom of the viewport.
 */
export function WorkspaceDrawer({ open, onClose, title, subtitle, kicker, children, footer }) {
  const panelRef = useRef(null)
  const returnFocusRef = useRef(null)
  const headingId = useId()

  useEffect(() => {
    if (!open) return undefined
    returnFocusRef.current = document.activeElement
    panelRef.current?.focus()

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = panelRef.current?.querySelectorAll(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      if (!focusable?.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      if (returnFocusRef.current instanceof HTMLElement) returnFocusRef.current.focus()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="ctm-scrim" onClick={onClose}>
      <div
        className="ctm-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        tabIndex={-1}
        ref={panelRef}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="ctm-drawer-head">
          <div className="ctm-drawer-heading">
            {kicker ? <p className="ctm-label">{kicker}</p> : null}
            <h3 className="ctm-drawer-title" id={headingId}>
              {title}
            </h3>
            {subtitle ? <p className="ctm-drawer-sub">{subtitle}</p> : null}
          </div>
          <button type="button" className="ctm-drawer-close" onClick={onClose} aria-label="Close this detail view">
            <CloseIcon />
          </button>
        </div>
        <div className="ctm-drawer-body">{children}</div>
        {footer ? <div className="ctm-drawer-foot">{footer}</div> : null}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------- selectors */

export function gapGroups(gaps) {
  if (!gaps) return []
  return [
    { key: 'gaps', group: gaps.groups.gaps, count: gaps.counts.gapCount, label: 'Not covered' },
    { key: 'covered', group: gaps.groups.covered, count: gaps.counts.coveredCount, label: 'Covered' },
    {
      key: 'noIndustryRecord',
      group: gaps.groups.noIndustryRecord,
      count: gaps.counts.noIndustryRecordCount,
      label: 'No industry record',
    },
    {
      key: 'unmatched',
      group: gaps.groups.unmatched,
      count: gaps.counts.unmatchedCount,
      label: 'Unmatched curriculum',
    },
  ].map((entry) => ({ ...entry, rows: entry.group ?? [] }))
}

function classificationsOf(rows) {
  const seen = new Set()
  for (const row of rows) {
    if (row.classification) seen.add(row.classification.toLowerCase())
  }
  return DISTINCT_CLASSIFICATIONS.filter((value) => seen.has(value))
}

function matchesSearch(rows, term) {
  const needle = term.trim().toLowerCase()
  if (!needle) return rows
  return rows.filter((row) => String(row.skill ?? row.name ?? '').toLowerCase().includes(needle))
}

/* The service names its own placement outcomes, and the placed one is not the word
   "placed" â€” it is a full status string. A recommendation counts as placed only when
   its placement_status begins with that word, so an unplaced row is never drawn as a
   flow the service did not publish. */
function isPlaced(row) {
  return String(row.placementStatus ?? '').startsWith('placed')
}

/* ------------------------------------------------------- canvas: overview */

function pulseSegments({ gaps }) {
  const covered = gaps?.counts?.coveredCount ?? null
  const notCovered = gaps?.counts?.gapCount ?? null
  const known = covered !== null && notCovered ? covered + notCovered : null
  return [
    { key: 'covered', label: 'Covered', value: covered, total: known, tone: 'ok' },
    { key: 'gaps', label: 'Not covered', value: notCovered, total: known, tone: 'stop' },
  ]
}

export function OverviewCanvas({ record, intelligence, gaps, proposals, statuses, onGoTo }) {
  const tiles = [
    {
      key: 'record',
      label: 'Courses recorded',
      value: record?.counts?.courses ?? null,
      detail: record?.counts?.semesters ? `${formatCount(record.counts.semesters)} semesters` : null,
      tone: 'plain',
      view: 'curriculum',
    },
    {
      key: 'intelligence',
      label: 'Industry skills',
      value: intelligence?.skills?.length ?? null,
      detail: intelligence?.slices ? `${formatCount(intelligence.slices.slices.length)} recorded slices` : null,
      tone: 'plain',
      view: 'evolution',
    },
    {
      key: 'covered',
      label: 'Covered skills',
      value: gaps?.counts?.coveredCount ?? null,
      detail: 'a course already records the skill',
      tone: 'ok',
      view: 'gaps',
    },
    {
      key: 'gaps',
      label: 'Industry gaps',
      value: gaps?.counts?.gapCount ?? null,
      detail: 'no course records the skill',
      tone: 'stop',
      view: 'gaps',
    },
    {
      key: 'placed',
      label: 'Placeable recommendations',
      value: proposals?.summary?.placedCount ?? null,
      detail: proposals?.summary?.recommendationCount
        ? `of ${formatCount(proposals.summary.recommendationCount)} recommendations`
        : null,
      tone: 'ok',
      view: 'proposal',
    },
  ]

  const segments = pulseSegments({ gaps })

  /* The service's own placement-outcome words and counts, minus the placed one. A
     count is never relabelled here: the chip shows the exact status string the
     service published and the number it published with it. */
  const unresolved = []
  const byPlacement = proposals?.summary?.byPlacementStatus ?? null
  if (byPlacement) {
    for (const [key, value] of Object.entries(byPlacement)) {
      if (key.startsWith('placed')) continue
      unresolved.push({ key, value: value ?? null })
    }
  }
  for (const [key, value] of [
    ['no_industry_record', gaps?.counts?.noIndustryRecordCount ?? null],
    ['unmatched_curriculum_skill', gaps?.counts?.unmatchedCount ?? null],
  ]) {
    if (value !== null) unresolved.push({ key, value })
  }

  const artifactsReady = Boolean(byPlacement) && Boolean(gaps) && Boolean(proposals)
  const loadingArtifact = Object.entries(statuses ?? {}).find(([, status]) => status === 'loading')
  const failedArtifact = Object.entries(statuses ?? {}).find(([, status]) => status === 'error')

  return (
    <div className="ctm-canvas">
      {loadingArtifact ? (
        <p className="ctm-canvas-status" role="status" aria-live="polite">
          <span className="ctm-spinner" aria-hidden="true" />
          Loading the recorded artifacts for this role.
        </p>
      ) : null}
      {failedArtifact ? (
        <p className="ctm-canvas-status is-error" role="alert">
          <AlertIcon />
          One endpoint did not answer, so part of this pulse is incomplete. Open the affected view to retry it.
        </p>
      ) : null}
      <div className="ctm-pulse">
        {tiles.map((tile, index) => (
          <MetricTile
            key={tile.key}
            label={tile.label}
            value={tile.value ?? 'â€”'}
            detail={tile.detail}
            tone={tile.tone}
            delay={index * 40}
            active={false}
            onClick={tile.view ? () => onGoTo(tile.view) : undefined}
          />
        ))}
      </div>

      <div className="ctm-overview-grid">
        <Panel
          label="How the four parts connect"
          icon={<LinkIcon />}
          title="One comparison, four recorded parts"
          note="Each band below is a recorded count. The width is the count relative to the counts beside it; no percentage is stated and no band is a score."
        >
          <ol className="ctm-flow">
            <li className="ctm-flow-step">
              <p className="ctm-flow-kicker">1 Â· Curriculum</p>
              <p className="ctm-flow-value ctm-num">{formatCount(record?.counts?.courses ?? null)}</p>
              <p className="ctm-flow-label">courses in the recorded programme</p>
            </li>
            <li className="ctm-flow-arrow" aria-hidden="true">
              <ArrowIcon />
              <span className="ctm-visually-hidden">compared against</span>
            </li>
            <li className="ctm-flow-step">
              <p className="ctm-flow-kicker">2 Â· Industry evidence</p>
              <p className="ctm-flow-value ctm-num">{formatCount(intelligence?.skills?.length ?? null)}</p>
              <p className="ctm-flow-label">skills published for this role</p>
            </li>
            <li className="ctm-flow-arrow" aria-hidden="true">
              <ArrowIcon />
              <span className="ctm-visually-hidden">compared against</span>
            </li>
            <li className="ctm-flow-step">
              <p className="ctm-flow-kicker">3 Â· Gap analysis</p>
              {segments[0].value !== null && segments[1].value !== null ? (
                <>
                  <p
                    className="ctm-composition"
                    role="img"
                    aria-label={`${formatCount(segments[0].value)} covered and ${formatCount(segments[1].value)} not covered`}
                  >
                    {segments.map((segment) => (
                      <span
                        key={segment.key}
                        className={`ctm-composition-band is-${segment.tone}`}
                        style={{ flexGrow: segment.total ? segment.value : 0 }}
                      />
                    ))}
                  </p>
                  <p className="ctm-composition-legend">
                    {segments.map((segment) => (
                      <span className="ctm-composition-key" key={segment.key}>
                        <span className={`ctm-swatch is-${segment.tone}`} aria-hidden="true" />
                        {segment.label}
                        <span className="ctm-num ctm-composition-count">{formatCount(segment.value)}</span>
                      </span>
                    ))}
                  </p>
                </>
              ) : (
                <p className="ctm-flow-label ctm-num">â€”</p>
              )}
            </li>
            <li className="ctm-flow-arrow" aria-hidden="true">
              <ArrowIcon />
              <span className="ctm-visually-hidden">proposed as</span>
            </li>
            <li className="ctm-flow-step">
              <p className="ctm-flow-kicker">4 Â· Proposed future</p>
              <p className="ctm-flow-value ctm-num">{formatCount(proposals?.summary?.placedCount ?? null)}</p>
              <p className="ctm-flow-label">placements the service made</p>
            </li>
          </ol>
        </Panel>

        <Panel
          label="Still unresolved"
          icon={<AlertIcon />}
          title="Counts the service did not place"
          note="These are recorded as separate outcomes in the service's own words. They are not folded into the totals above."
        >
          {loadingArtifact && !artifactsReady ? (
            <p className="ctm-inline-note">
              <span className="ctm-spinner" aria-hidden="true" />
              Waiting on the recorded outcome counts.
            </p>
          ) : null}
          {failedArtifact ? (
            <p className="ctm-inline-note">
              <AlertIcon />
              An endpoint failed, so these counts are incomplete. Open the view that lost its data to retry it.
            </p>
          ) : null}
          {artifactsReady ? (
            <ul className="ctm-unresolved">
              {unresolved.map((entry) => (
                <li className="ctm-unresolved-row" key={entry.key}>
                  <StatusChip value={entry.key} />
                  <span className="ctm-unresolved-count ctm-num">{formatCount(entry.value ?? null)}</span>
                </li>
              ))}
              {unresolved.length === 0 ? (
                <li className="ctm-unresolved-row">
                  <CheckIcon />
                  <span className="ctm-unresolved-count">The service recorded no unresolved outcomes.</span>
                </li>
              ) : null}
            </ul>
          ) : null}
          <button type="button" className="ctm-ghost-btn" onClick={() => onGoTo('proposal')}>
            Open Proposed Future
          </button>
        </Panel>
      </div>

      <Panel
        label="Where to go next"
        icon={<MapIcon />}
        title="Four views over the same four artifacts"
        note="Every view reads the data already loaded for this role. Choosing one changes the canvas, not the requests."
      >
        <ul className="ctm-jump">
          {[
            { view: 'curriculum', label: 'Curriculum', detail: 'Year, semester, and course nodes' },
            { view: 'evolution', label: 'Industry Evolution', detail: 'Recorded slices and per-skill evidence' },
            { view: 'gaps', label: 'Gap Analysis', detail: 'The four comparison groups side by side' },
            { view: 'proposal', label: 'Proposed Future', detail: 'Placements and the reasons for the rest' },
          ].map((entry) => (
            <li key={entry.view}>
              <button type="button" className="ctm-jump-btn" onClick={() => onGoTo(entry.view)}>
                <span className="ctm-jump-label">{entry.label}</span>
                <span className="ctm-jump-detail">{entry.detail}</span>
              </button>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  )
}

/* ------------------------------------------------------ canvas: curriculum */

function courseNodes(record) {
  const years = []
  for (const { programme, version, year, semester, course } of record?.courses ?? []) {
    let yearEntry = years.find((entry) => entry.yearId === year.academicYearId)
    if (!yearEntry) {
      yearEntry = {
        yearId: year.academicYearId,
        label: year.label ?? year.academicYearId,
        startYear: year.startYear,
        endYear: year.endYear,
        isEntryCohort: year.isEntryCohort,
        versionLabel: version.versionLabel,
        programmeName: programme.name,
        semesters: [],
      }
      years.push(yearEntry)
    }
    let semEntry = yearEntry.semesters.find((entry) => entry.semesterId === semester.semesterId)
    if (!semEntry) {
      semEntry = {
        semesterId: semester.semesterId,
        label: semester.label ?? semester.semesterId,
        term: semester.term,
        sequence: semester.sequence,
        recordedCredits: semester.recordedCredits,
        courses: [],
      }
      yearEntry.semesters.push(semEntry)
    }
    semEntry.courses.push(course)
  }
  return years
}

export function CurriculumCanvas({ record, status, error, onRetry, onInspect }) {
  const years = useMemo(() => courseNodes(record), [record])

  return (
    <ResourceState status={status} error={error} loadingNote="Reading the recorded curriculum record." onRetry={onRetry}>
      <div className="ctm-canvas">
        <Panel
          label="Curriculum map"
          icon={<MapIcon />}
          title="Year, semester, course"
          count={`${formatCount(record?.counts?.courses)} courses`}
          note="Only connections the service recorded are drawn. A course with no recorded prerequisites shows no line, because none was recorded."
        >
          {years.length === 0 ? <p className="ctm-inline-note">The record holds no academic year.</p> : null}
          <div className="ctm-mapcanvas">
            {years.map((year) => (
              <section className="ctm-yearcol" key={year.yearId}>
                <header className="ctm-year-head">
                  <p className="ctm-year-label">{year.label}</p>
                  <p className="ctm-year-meta">
                    {year.programmeName}
                    {year.versionLabel ? ` Â· ${year.versionLabel}` : ''}
                    {year.isEntryCohort ? ' Â· entry cohort' : ''}
                  </p>
                </header>
                {year.semesters.map((semester) => (
                  <div className="ctm-semcol" key={semester.semesterId}>
                    <button
                      type="button"
                      className="ctm-sem-head"
                      onClick={() => onInspect({ kind: 'semester', semester, year })}
                    >
                      <span className="ctm-sem-label">{semester.label}</span>
                      <span className="ctm-sem-meta ctm-num">
                        {formatCount(semester.courses.length)} courses
                        {semester.recordedCredits !== null && semester.recordedCredits !== undefined
                          ? ` Â· ${formatCount(semester.recordedCredits)} cr`
                          : ''}
                      </span>
                    </button>
                    <ul className="ctm-courselist">
                      {semester.courses.map((course) => {
                        const prereqs = course.prerequisites?.recorded ? course.prerequisites.courseIds : null
                        return (
                          <li key={course.courseId}>
                            <button type="button" className="ctm-course" onClick={() => onInspect({ kind: 'course', course })}>
                              <span className="ctm-course-top">
                                <span className="ctm-course-name">{course.name ?? course.courseId}</span>
                                {/* The service's recorded identifier, preferring the
                                    human code when one exists. Without it two courses
                                    with the same name would be indistinguishable. */}
                                <span className="ctm-course-code">{course.code ?? course.courseId}</span>
                              </span>
                              <span className="ctm-course-meta ctm-num">
                                {formatCount(course.credits)} cr
                                {course.hours !== null && course.hours !== undefined ? ` Â· ${formatCount(course.hours)} h` : ''}
                              </span>
                              {course.skills.length > 0 ? (
                                <span className="ctm-course-skills">
                                  {course.skills.slice(0, 3).map((skill) => (
                                    <span className="ctm-skillchip" key={skill.skill}>
                                      {skill.skill}
                                    </span>
                                  ))}
                                  {course.skills.length > 3 ? (
                                    <span className="ctm-skillchip is-more ctm-num">+{course.skills.length - 3}</span>
                                  ) : null}
                                </span>
                              ) : null}
                              {prereqs === null ? (
                                <span className="ctm-course-prereq">
                                  <NotRecorded>No prerequisite graph recorded</NotRecorded>
                                </span>
                              ) : prereqs.length === 0 ? (
                                <span className="ctm-course-prereq">
                                  <CheckIcon />
                                  <span className="ctm-visually-hidden">Recorded with no prerequisites</span>
                                </span>
                              ) : (
                                <span className="ctm-course-prereq">
                                  <LinkIcon />
                                  <span className="ctm-num">{formatCount(prereqs.length)}</span>
                                  <span className="ctm-visually-hidden">recorded prerequisites</span>
                                </span>
                              )}
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))}
              </section>
            ))}
          </div>
        </Panel>
      </div>
    </ResourceState>
  )
}

/* ------------------------------------------------------- canvas: evolution */

export function EvolutionCanvas({ intelligence, status, error, onRetry, onInspect }) {
  const [term, setTerm] = useState('')
  const [tier, setTier] = useState('all')

  const skills = useMemo(() => intelligence?.skills ?? [], [intelligence])
  const tiers = useMemo(() => classificationsOf(skills), [skills])
  const rows = useMemo(() => {
    const filtered = tier === 'all' ? skills : skills.filter((skill) => (skill.classification ?? '').toLowerCase() === tier)
    return matchesSearch(filtered, term)
  }, [skills, tier, term])

  const tierCounts = useMemo(() => {
    const counts = new Map()
    for (const skill of skills) {
      const key = (skill.classification ?? '').toLowerCase()
      if (!key) continue
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return counts
  }, [skills])

  const slices = intelligence?.slices?.slices ?? []
  const maxObserved = slices.reduce((max, slice) => Math.max(max, slice.observedSkills ?? 0), 0)

  return (
    <ResourceState status={status} error={error} loadingNote="Reading the recorded industry evidence." onRetry={onRetry}>
      <div className="ctm-canvas">
        <div className="ctm-evo-grid">
          <Panel
            label="Recorded time slices"
            icon={<TrendIcon />}
            title="Only the slices the service recorded"
            count={`${formatCount(intelligence?.slices?.compared)} comparable`}
            note={
              intelligence?.slices?.unmeasured
                ? `${formatCount(intelligence.slices.unmeasured)} of ${formatCount(skills.length)} skills lack one of their two slices, so no movement is stated for them.`
                : null
            }
          >
            {slices.length === 0 ? (
              <p className="ctm-inline-note">No time slice was recorded for this role.</p>
            ) : (
              <ul className="ctm-slicecanvas">
                {slices.map((slice) => (
                  <li className="ctm-slicecanvas-row" key={slice.timeSlice}>
                    <p className="ctm-slicecanvas-id">{slice.timeSlice}</p>
                    <span className="ctm-slicecanvas-track" aria-hidden="true">
                      <span
                        className="ctm-slicecanvas-fill"
                        style={{ width: maxObserved ? `${(slice.observedSkills / maxObserved) * 100}%` : '0%' }}
                      />
                    </span>
                    <p className="ctm-slicecanvas-count ctm-num">
                      {formatCount(slice.observedSkills)} skills
                      {slice.totalPostings !== null ? ` Â· ${formatCount(slice.totalPostings)} postings` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel label="Recorded classification" icon={<StackIcon />} title="How the service tiered these skills">
            <ul className="ctm-tiers">
              {tiers.map((value) => (
                <li className="ctm-tier-row" key={value}>
                  <ClassificationChip value={value} />
                  <span className="ctm-num ctm-tier-count">{formatCount(tierCounts.get(value) ?? 0)}</span>
                </li>
              ))}
              {tiers.length === 0 ? <li className="ctm-inline-note">No classification was recorded.</li> : null}
            </ul>
          </Panel>
        </div>

        <Panel
          label="Industry skills"
          icon={<StackIcon />}
          title="Recorded skill evidence"
          count={`${formatCount(rows.length)} of ${formatCount(skills.length)}`}
          note="Select a skill to read the recorded frequency, movement, and observations in the detail drawer."
        >
          <Toolbar>
            <SearchInput
              label="Search industry skills"
              value={term}
              onChange={setTerm}
              matched={rows.length}
              total={skills.length}
              placeholder="Search recorded skills"
            />
            <div className="ctm-filterrow">
              <FilterChip value="all" label="All" active={tier === 'all'} onClick={() => setTier('all')} />
              {tiers.map((value) => (
                <FilterChip
                  key={value}
                  value={value}
                  label={classificationLabel(value)}
                  active={tier === value}
                  onClick={() => setTier(value)}
                />
              ))}
            </div>
          </Toolbar>

          {rows.length === 0 ? (
            <p className="ctm-inline-note">
              <AlertIcon />
              No recorded skill matches the current search and filter.
            </p>
          ) : (
            <ul className="ctm-chiprail">
              {rows.map((skill, index) => (
                <li key={skill.id} style={{ '--ctm-rail-index': index }}>
                  <button type="button" className="ctm-chipnode" onClick={() => onInspect({ kind: 'skill', skill })}>
                    <span className="ctm-chipnode-name">{skill.name}</span>
                    <span className="ctm-chipnode-meta ctm-num">
                      {formatFrequency(skill.frequency)}
                      {skill.absoluteChange !== null ? ` Â· ${movementOf(skill.absoluteChange).glyph} ${formatFrequency(Math.abs(skill.absoluteChange))}` : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </ResourceState>
  )
}

/* --------------------------------------------------------- canvas: gaps */

export function GapCanvas({ gaps, status, error, onRetry, onInspect }) {
  const [term, setTerm] = useState('')
  const [groupKey, setGroupKey] = useState('gaps')
  const [tier, setTier] = useState('all')

  const groups = useMemo(() => gapGroups(gaps), [gaps])
  const active = groups.find((entry) => entry.key === groupKey) ?? groups[0]
  const tiers = useMemo(() => classificationsOf(active?.rows ?? []), [active])

  const rows = useMemo(() => {
    const filtered = tier === 'all' ? (active?.rows ?? []) : (active?.rows ?? []).filter((row) => (row.classification ?? '').toLowerCase() === tier)
    return matchesSearch(filtered, term)
  }, [active, tier, term])

  return (
    <ResourceState status={status} error={error} loadingNote="Reading the recorded gap analysis." onRetry={onRetry}>
      <div className="ctm-canvas">
        <div className="ctm-matrix">
          {groups.map((entry) => (
            <button
              type="button"
              key={entry.key}
              className={`ctm-matrix-col${entry.key === active?.key ? ' is-active' : ''}`}
              aria-pressed={entry.key === active?.key}
              onClick={() => setGroupKey(entry.key)}
            >
              <span className="ctm-matrix-count ctm-num">{formatCount(entry.rows.length)}</span>
              <span className="ctm-matrix-label">{entry.label}</span>
              <span className="ctm-matrix-status">{entry.rows[0]?.coverageStatus ?? entry.key}</span>
            </button>
          ))}
        </div>

        <Panel
          label={`${active?.label ?? 'Group'} Â· recorded rows`}
          icon={<MatrixIcon />}
          title={active?.label ?? 'Comparison group'}
          count={`${formatCount(rows.length)} of ${formatCount(active?.rows?.length ?? 0)}`}
          note="The four groups are the service's own. A covered skill and a gap are different facts about different directions of the comparison, so they are never merged."
        >
          <Toolbar>
            <SearchInput
              label={`Search ${active?.label ?? 'recorded'} skills`}
              value={term}
              onChange={setTerm}
              matched={rows.length}
              total={active?.rows?.length ?? 0}
              placeholder={`Search ${active?.label ?? 'recorded'} skills`}
            />
            <div className="ctm-filterrow">
              <FilterChip value="all" label="All" active={tier === 'all'} onClick={() => setTier('all')} />
              {tiers.map((value) => (
                <FilterChip
                  key={value}
                  value={value}
                  label={classificationLabel(value)}
                  active={tier === value}
                  onClick={() => setTier(value)}
                />
              ))}
            </div>
          </Toolbar>

          {rows.length === 0 ? (
            <p className="ctm-inline-note">
              <AlertIcon />
              No recorded row matches the current search and filter.
            </p>
          ) : (
            <div className="ctm-tablewrap">
              <table className="ctm-matrix-table">
                <caption className="ctm-visually-hidden">Recorded {active?.label ?? ''} skills with coverage, classification, and curriculum courses</caption>
                <thead>
                  <tr>
                    <th scope="col">Skill</th>
                    <th scope="col">Coverage status</th>
                    <th scope="col">Classification</th>
                    <th scope="col">Courses</th>
                    <th scope="col">Learning hours</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.skill}>
                      <th scope="row">
                        <button type="button" className="ctm-rowbtn" onClick={() => onInspect({ kind: 'gap', row })}>
                          {row.skill}
                        </button>
                      </th>
                      <td>
                        <StatusChip value={row.coverageStatus} />
                      </td>
                      <td>{row.classification ? <ClassificationChip value={row.classification} /> : <NotRecorded />}</td>
                      <td className="ctm-num">{formatCount(row.courses.length)}</td>
                      <td>
                        <HoursValue hours={row.learning.hours} source={row.learning.hoursSource} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </ResourceState>
  )
}

/* ------------------------------------------------------- canvas: proposal */

export function ProposalCanvas({ proposals, status, error, onRetry, onInspect, gapLookup }) {
  const [choice, setChoice] = useState(null)

  const all = useMemo(() => proposals?.recommendations ?? [], [proposals])
  const placed = useMemo(() => all.filter(isPlaced), [all])

  /* Grouped by the service's own placement_status strings, in the order they were
     published, so the outcome filter never invents a category of its own. */
  const outcomes = useMemo(() => {
    const order = []
    const counts = new Map()
    for (const row of all) {
      const key = row.placementStatus ?? null
      if (!counts.has(key)) {
        counts.set(key, 0)
        order.push(key)
      }
      counts.set(key, counts.get(key) + 1)
    }
    return order.map((key) => ({ key, value: counts.get(key) }))
  }, [all])

  const placedKey = outcomes.find((entry) => entry.key && entry.key.startsWith('placed'))?.key ?? null
  const active = choice !== null && outcomes.some((entry) => entry.key === choice) ? choice : placedKey
  const visible = active === placedKey ? placed : all.filter((row) => (row.placementStatus ?? null) === active)

  return (
    <ResourceState status={status} error={error} loadingNote="Reading the recorded proposal set." onRetry={onRetry}>
      <div className="ctm-canvas">
        <Panel
          label="Placements the service made"
          icon={<ProposalIcon />}
          title="Current curriculum â†’ industry gap â†’ proposed placement"
          count={`${formatCount(placed.length)} placed`}
          note="Only recommendations the service placed are drawn as a flow. Everything else is reported as a count with the reason the service published."
        >
          <div className="ctm-filterrow">
            {outcomes.map((entry) => (
              <FilterChip
                key={entry.key ?? 'none'}
                value={entry.key ?? 'none'}
                label={entry.key ? `${entry.key} Â· ${formatCount(entry.value)}` : `no placement status recorded Â· ${formatCount(entry.value)}`}
                active={entry.key === active}
                onClick={() => setChoice(entry.key)}
              />
            ))}
          </div>

          {visible.length === 0 ? (
            <p className="ctm-inline-note">
              <AlertIcon />
              {active === placedKey
                ? 'The service placed no recommendation for this role.'
                : 'No recorded recommendation carries this placement outcome.'}
            </p>
          ) : active === placedKey ? (
            <ol className="ctm-placement">
              {visible.map((row, index) => {
                const gap = gapLookup?.get(row.skill) ?? null
                return (
                  <li className="ctm-placement-chain" key={row.skill} style={{ '--ctm-chain-index': index }}>
                    <div className="ctm-placement-leg">
                      <p className="ctm-placement-stage">Current curriculum</p>
                      {gap && gap.courses.length > 0 ? (
                        <p className="ctm-placement-text">{gap.courses.map((course) => course.name ?? course.courseId).join(', ')}</p>
                      ) : (
                        <p className="ctm-placement-text ctm-placement-muted">
                          No curriculum course records this skill
                        </p>
                      )}
                    </div>
                    <ArrowIcon className="ctm-placement-arrow" />
                    <div className="ctm-placement-leg">
                      <p className="ctm-placement-stage">Industry gap</p>
                      <button type="button" className="ctm-placement-skill" onClick={() => onInspect({ kind: 'proposal', row })}>
                        {row.skill}
                      </button>
                      <p className="ctm-placement-meta">
                        <StatusChip value={row.coverageStatus} />
                      </p>
                    </div>
                    <ArrowIcon className="ctm-placement-arrow" />
                    <div className="ctm-placement-leg">
                      <p className="ctm-placement-stage">Proposed placement</p>
                      <p className="ctm-placement-text">{row.targetSemester?.label ?? row.targetSemester?.semesterId ?? 'â€”'}</p>
                      <p className="ctm-placement-text">{row.targetCourse?.name ?? row.targetCourse?.courseId ?? 'â€”'}</p>
                      <p className="ctm-placement-meta ctm-num">
                        {row.targetCourse?.code ? `${row.targetCourse.code} Â· ` : ''}
                        {formatCount(row.targetCourse?.credits)} cr
                      </p>
                    </div>
                  </li>
                )
              })}
            </ol>
          ) : (
            <ul className="ctm-outcomes">
              {visible.map((row) => (
                <li className="ctm-outcome-row" key={row.skill}>
                  <button type="button" className="ctm-rowbtn" onClick={() => onInspect({ kind: 'proposal', row })}>
                    {row.skill}
                  </button>
                  <StatusChip value={row.placementStatus} />
                  <span className="ctm-outcome-reason">{row.reason ?? 'No reason recorded.'}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="ctm-evo-grid">
          <Panel label="Excluded before placement" icon={<AlertIcon />} title="Why nothing was proposed">
            <ul className="ctm-map">
              {[
                ['Covered skill', proposals?.excluded?.coveredSkill],
                ['No industry record', proposals?.excluded?.noIndustryRecord],
                ['Unmatched curriculum skill', proposals?.excluded?.unmatchedCurriculumSkill],
              ].map(([label, entry]) => (
                <li className="ctm-map-row" key={label}>
                  <span className="ctm-map-label">{label}</span>
                  <span className="ctm-map-count ctm-num">{formatCount(entry?.count ?? null)}</span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel label="Recorded totals" icon={<StackIcon />} title="The service's own counts">
            <CountMap value={proposals?.summary?.byPlacementStatus} />
            <CountMap value={proposals?.summary?.byPrerequisiteStatus} />
          </Panel>
        </div>
      </div>
    </ResourceState>
  )
}

/* ------------------------------------------------------- drawer contents */

export function CourseDetail({ course, record }) {
  const prereqs = course.prerequisites?.recorded ? course.prerequisites.courseIds : null
  const resolved = prereqs
    ? prereqs
        .map((id) => record?.byCourseId?.get(id))
        .filter(Boolean)
        .map((entry) => entry.course)
    : []

  return (
    <>
      <Fields>
        <Field label="Course identifier">{course.courseId ?? <NotRecorded />}</Field>
        <Field label="Course code">{course.code ?? <NotRecorded />}</Field>
        <Field label="Credits">
          <Value value={course.credits} unit="cr" />
        </Field>
        <Field label="Contact hours">
          <Value value={course.hours} unit="h" />
        </Field>
        <Field label="Level">{course.level ?? <NotRecorded />}</Field>
        <Field label="Delivery">{course.deliveryFormat ?? <NotRecorded />}</Field>
        <Field label="Elective">
          {course.isElective === null ? <NotRecorded /> : course.isElective ? 'Recorded as elective' : 'Recorded as core'}
        </Field>
      </Fields>

      {course.description ? <p className="ctm-detail-lede">{course.description}</p> : null}

      <FieldBlock label={`Recorded skills on this course (${formatCount(course.skills.length)})`}>
        {course.skills.length === 0 ? (
          <p className="ctm-inline-note">
            <AlertIcon />
            The record holds no skill for this course.
          </p>
        ) : (
          <ul className="ctm-skillset-list">
            {course.skills.map((skill) => (
              <li key={skill.skill}>
                <span className="ctm-skillset-name">{skill.skill}</span>
                <span className="ctm-skillset-meta">
                  {skill.matchType ? <StatusChip value={skill.matchType} /> : null}
                  {skill.coverage ? <span className="ctm-skillset-coverage">{skill.coverage}</span> : null}
                </span>
                {skill.canonicalSkill === null ? <NotRecorded>No canonical skill</NotRecorded> : null}
              </li>
            ))}
          </ul>
        )}
      </FieldBlock>

      <FieldBlock label="Recorded prerequisites">
        {prereqs === null ? (
          <NotRecorded>No prerequisite graph recorded</NotRecorded>
        ) : prereqs.length === 0 ? (
          <span className="ctm-inline-note">
            <CheckIcon />
            Recorded, with no prerequisites
          </span>
        ) : (
          <ul className="ctm-skillset-list">
            {prereqs.map((id) => (
              <li key={id}>
                <span className="ctm-skillset-name">{resolved.find((item) => item.courseId === id)?.name ?? id}</span>
              </li>
            ))}
          </ul>
        )}
      </FieldBlock>

      <FieldBlock label="Provenance">
        <Fields>
          <Field label="Reference">{course.source?.reference ?? <NotRecorded />}</Field>
          <Field label="Recorded at">{course.source?.recordedAt ? formatDate(course.source.recordedAt) : <NotRecorded />}</Field>
          <Field label="Verified">
            {course.source?.verified === null ? <NotRecorded /> : course.source?.verified ? 'Yes' : 'No'}
          </Field>
          <Field label="Note">{course.source?.note ?? <NotRecorded />}</Field>
        </Fields>
      </FieldBlock>
    </>
  )
}

export function SemesterDetail({ semester, year }) {
  const withSkills = semester.courses.filter((course) => course.skills.length > 0).length
  const credits = semester.recordedCredits
  return (
    <>
      <Fields>
        <Field label="Term">{semester.term ?? <NotRecorded />}</Field>
        <Field label="Sequence">
          <Value value={semester.sequence} />
        </Field>
        <Field label="Recorded credits">
          <Value value={credits} unit="cr" />
        </Field>
        <Field label="Courses">
          <Value value={semester.courses.length} />
        </Field>
        <Field label="Courses with recorded skills">
          <Value value={withSkills} />
        </Field>
        <Field label="Academic year">{year?.label ?? <NotRecorded />}</Field>
        <Field label="Programme">{year?.programmeName ?? <NotRecorded />}</Field>
        <Field label="Version">{year?.versionLabel ?? <NotRecorded />}</Field>
      </Fields>

      <FieldBlock label={`Courses in ${semester.label}`}>
        <ul className="ctm-skillset-list">
          {semester.courses.map((course) => (
            <li key={course.courseId}>
              <span className="ctm-skillset-name">{course.name ?? course.courseId}</span>
              <span className="ctm-skillset-meta ctm-num">{formatCount(course.credits)} cr</span>
            </li>
          ))}
        </ul>
      </FieldBlock>
    </>
  )
}

export function SkillDetail({ skill }) {
  return (
    <>
      <Fields>
        <Field label="Classification">{skill.classification ? <ClassificationChip value={skill.classification} /> : <NotRecorded />}</Field>
        <Field label="Frequency in role postings">
          <Value value={skill.frequency} />
        </Field>
        <Field label="Recorded velocity score">
          <Value value={skill.velocityScore} />
        </Field>
        <Field label="Difference between slices">
          <span className={`ctm-velocity is-${movementOf(skill.absoluteChange).tone}`}>
            <span className="ctm-velocity-glyph" aria-hidden="true">
              {movementOf(skill.absoluteChange).glyph}
            </span>
            {skill.absoluteChange === null ? <NotRecorded /> : <Value value={skill.absoluteChange} />}
            <span className="ctm-velocity-label">{movementOf(skill.absoluteChange).label}</span>
          </span>
        </Field>
        <Field label="Slice pair">
          {skill.timeSlicesUsed ? <code className="ctm-code">{skill.timeSlicesUsed}</code> : <NotRecorded />}
        </Field>
        <Field label="Learning hours">
          <HoursValue hours={skill.hours} source={skill.hoursSource} />
        </Field>
        <Field label="Published position">
          <Value value={skill.order} />
        </Field>
      </Fields>

      <FieldBlock label="Recorded observations">
        <div className="ctm-slices">
          {[skill.baseline, skill.latest].map((slice, index) =>
            slice ? (
              <div className="ctm-slice" key={slice.timeSlice}>
                <p className="ctm-slice-label">
                  {index === 0 ? 'Earlier' : 'Later'} Â· {slice.timeSlice}
                </p>
                <p className="ctm-slice-count ctm-num">{formatObservation(slice)}</p>
                <p className="ctm-slice-frequency ctm-num">frequency {formatFrequency(slice.frequency)}</p>
              </div>
            ) : null,
          )}
        </div>
      </FieldBlock>

      <FieldBlock label="Recorded prerequisites">
        {skill.prerequisites === null ? (
          <NotRecorded>No prerequisite graph recorded</NotRecorded>
        ) : skill.prerequisites.length === 0 ? (
          <span className="ctm-inline-note">
            <CheckIcon />
            Recorded, with no prerequisites
          </span>
        ) : (
          <span className="ctm-skillset">
            {skill.prerequisites.map((name) => (
              <code className="ctm-code" key={name}>
                {name}
              </code>
            ))}
          </span>
        )}
      </FieldBlock>
    </>
  )
}

export function GapDetail({ row }) {
  return (
    <>
      <Fields>
        <Field label="Coverage status">
          <StatusChip value={row.coverageStatus} />
        </Field>
        <Field label="Recorded as a gap">{row.isGap ? 'Yes' : 'No'}</Field>
        <Field label="Classification">{row.classification ? <ClassificationChip value={row.classification} /> : <NotRecorded />}</Field>
        <Field label="Frequency in role postings">
          <Value value={row.evidence?.frequency} />
        </Field>
        <Field label="Recorded courses">
          <Value value={row.courses.length} />
        </Field>
        <Field label="Learning hours">
          <HoursValue hours={row.learning.hours} source={row.learning.hoursSource} />
        </Field>
      </Fields>

      <FieldBlock label={`Curriculum courses (${formatCount(row.courses.length)})`}>
        {row.courses.length === 0 ? (
          <p className="ctm-inline-note">
            <AlertIcon />
            No curriculum course records this skill.
          </p>
        ) : (
          <ul className="ctm-skillset-list">
            {row.courses.map((course) => (
              <li key={course.courseId ?? course.code ?? course.name}>
                <span className="ctm-skillset-name">{course.name ?? course.courseId}</span>
                <span className="ctm-skillset-meta ctm-num">{formatCount(course.credits)} cr</span>
              </li>
            ))}
          </ul>
        )}
      </FieldBlock>

      {row.evidence ? (
        <FieldBlock label="Recorded industry observations">
          <div className="ctm-slices">
            {[row.evidence.baseline, row.evidence.latest].map((slice, index) =>
              slice ? (
                <div className="ctm-slice" key={slice.timeSlice}>
                  <p className="ctm-slice-label">
                    {index === 0 ? 'Earlier' : 'Later'} Â· {slice.timeSlice}
                  </p>
                  <p className="ctm-slice-count ctm-num">{formatObservation(slice)}</p>
                </div>
              ) : null,
            )}
          </div>
        </FieldBlock>
      ) : null}

      <Limitations items={row.limitations} />
    </>
  )
}

export function ProposalDetail({ row }) {
  return (
    <>
      <Fields>
        <Field label="Recommendation status">
          <StatusChip value={row.recommendationStatus} />
        </Field>
        <Field label="Placement status">
          <StatusChip value={row.placementStatus} />
        </Field>
        <Field label="Coverage status">
          <StatusChip value={row.coverageStatus} />
        </Field>
        <Field label="Prerequisite status">
          <StatusChip value={row.prerequisiteStatus} />
        </Field>
        <Field label="Learning hours">
          <HoursValue hours={row.learningHours} source={row.hoursSource} />
        </Field>
        <Field label="Reason">{row.reason ?? <NotRecorded />}</Field>
      </Fields>

      <FieldBlock label="Proposed placement">
        {row.targetSemester || row.targetCourse ? (
          <Fields>
            <Field label="Semester">
              {row.targetSemester?.label ?? row.targetSemester?.semesterId ?? <NotRecorded />}
            </Field>
            <Field label="Term">{row.targetSemester?.term ?? <NotRecorded />}</Field>
            <Field label="Course">{row.targetCourse?.name ?? row.targetCourse?.courseId ?? <NotRecorded />}</Field>
            <Field label="Course code">{row.targetCourse?.code ?? <NotRecorded />}</Field>
            <Field label="Credits">
              <Value value={row.targetCourse?.credits} unit="cr" />
            </Field>
            <Field label="Elective">
              {row.targetCourse?.isElective === null || row.targetCourse?.isElective === undefined ? (
                <NotRecorded />
              ) : row.targetCourse.isElective ? (
                'Recorded as elective'
              ) : (
                'Recorded as core'
              )}
            </Field>
          </Fields>
        ) : (
          <NotRecorded>The service placed no semester or course for this recommendation.</NotRecorded>
        )}
      </FieldBlock>

      <FieldBlock label="Prerequisite chain">
        {row.chain.length === 0 ? (
          <NotRecorded>No prerequisite chain recorded</NotRecorded>
        ) : (
          <ul className="ctm-chainlist">
            {row.chain.map((link) => (
              <li key={link.joinKey ?? link.prerequisite}>
                <p className="ctm-chain-head">
                  <code className="ctm-code">{link.prerequisite}</code>
                  {link.joinKey ? <span className="ctm-chain-join">{link.joinKey}</span> : null}
                </p>
                <p className="ctm-chain-parts">
                  <span>
                    <span className="ctm-chain-label">Usable courses</span>
                    {link.usableCourses.length ? link.usableCourses.join(', ') : <NotRecorded />}
                  </span>
                  <span>
                    <span className="ctm-chain-label">Excluded courses</span>
                    {link.excludedCourses.length ? link.excludedCourses.join(', ') : <NotRecorded />}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </FieldBlock>

      <Limitations items={row.limitations} />
    </>
  )
}

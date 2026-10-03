/**
 * Presentational primitives for the Institution / Cohort Dashboard.
 *
 * Split from `CohortDashboard.jsx` for the same reason the Curriculum Time
 * Machine is split across two files: the page holds workflow and state, and this
 * file holds the pieces that only draw. Every class is `--cohort-*`, scoped by
 * `cohortDashboard.css` to `.cohort`, so nothing here can style another route.
 *
 * Icons are hand-authored 24x24 `currentColor` strokes, matching DESIGN.md §11.
 * No icon library is added.
 */

import { useId, useRef, useState } from 'react'
import {
  EMPTY_VALUE,
  classificationLabel,
  formatCount,
  formatCoverage,
  formatDate,
  formatGap,
  formatShare,
} from '../data/cohortSource'

/* ------------------------------------------------------------------ icons */

export function CohortIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
      <circle cx="17.5" cy="9.5" r="2.2" />
      <path d="M16.4 14.4c2.4.3 4.1 2.1 4.1 5.1" />
    </svg>
  )
}

export function MapIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 6.5 9 4l6 2.5L20.5 4v13.5L15 20l-6-2.5L3.5 20z" />
      <path d="M9 4v13.5M15 6.5V20" />
    </svg>
  )
}

export function StampIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 20.5h10" />
      <path d="M9 17.5h6l-.6-3.1-1.7-1.3V9.6a2.7 2.7 0 0 0-5.4 0v3.5l-1.7 1.3z" />
    </svg>
  )
}

/* One icon per workflow step, so a step is recognisable by shape alone in the
   vertical stepper, the horizontal flow bar and the preview cards alike. */
export function RosterIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 6.5h15M4.5 12h15M4.5 17.5h9" />
    </svg>
  )
}

export function PulseIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5h16" />
      <path d="M7.5 19.5v-5M12 19.5V8M16.5 19.5v-8.5" />
    </svg>
  )
}

export function LinkIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13.8a4 4 0 0 0 5.7.2l2.6-2.6a4 4 0 0 0-5.7-5.7l-1.5 1.5" />
      <path d="M14 10.2a4 4 0 0 0-5.7-.2l-2.6 2.6a4 4 0 0 0 5.7 5.7l1.5-1.5" />
    </svg>
  )
}

export function AlertIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4.5 21 19.5H3z" />
      <path d="M12 10v4M12 16.6v.4" />
    </svg>
  )
}

export function ChevronIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="m7 10 5 5 5-5" />
    </svg>
  )
}

export function DashIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <path d="M6 12h12" />
    </svg>
  )
}

export function SearchIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="6" />
      <path d="m15.5 15.5 4 4" />
    </svg>
  )
}

export function ArrowIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 12h15M13.5 6l6 6-6 6" />
    </svg>
  )
}

/* -------------------------------------------------------------- structure */

export function Fields({ children, className = '' }) {
  return <dl className={`cohort-facts ${className}`.trim()}>{children}</dl>
}

export function Field({ label, children, wide = false }) {
  return (
    <div className={`cohort-fact${wide ? ' is-wide' : ''}`.trim()}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

/** A dash standing in for a value the service did not record. */
export function Recorded({ value }) {
  if (value === null || value === undefined || value === '') return <DashIcon className="cohort-dash" />
  return <>{value}</>
}

export function NotAvailableList({ items, title = 'Not available from this service' }) {
  if (!items || items.length === 0) return null
  return (
    <div className="cohort-notice">
      <p className="cohort-notice-title">
        <AlertIcon />
        {title}
      </p>
      <ul className="cohort-notice-list">
        {items.map((item) => (
          <li key={item}>{item.replace(/_/g, ' ')}</li>
        ))}
      </ul>
    </div>
  )
}

export function Disclosure({ id, title, count, open, onToggle, children }) {
  const bodyId = `${id}-panel`
  return (
    <div className="cohort-disclosure">
      <button type="button" id={id} className="cohort-disclosure-btn" aria-expanded={open} aria-controls={bodyId} onClick={onToggle}>
        <ChevronIcon className={open ? 'cohort-disclosure-chevron is-open' : 'cohort-disclosure-chevron'} />
        <span className="cohort-disclosure-title">{title}</span>
        {count ? <span className="cohort-disclosure-count">{count}</span> : null}
      </button>
      <div id={bodyId} className="cohort-disclosure-panel" role="region" aria-labelledby={id}>
        {open ? children : null}
      </div>
    </div>
  )
}

/** A real `<details>`, so keyboard and screen-reader behaviour come for free. */
export function RecordDisclosure({ summary, children }) {
  const [open, setOpen] = useState(false)
  const bodyId = useId()
  return (
    <div className={`cohort-record${open ? ' is-open' : ''}`}>
      <button type="button" className="cohort-record-btn" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen((value) => !value)}>
        <ChevronIcon className={open ? 'cohort-record-chevron is-open' : 'cohort-record-chevron'} />
        <span>{summary}</span>
      </button>
      <div id={bodyId} className="cohort-record-panel" role="region">
        {open ? children : null}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------- bits */

/** A figure the service recorded, with the sentence that says what it means. */
export function Stat({ label, value, note, tone = 'neutral' }) {
  return (
    <div className={`cohort-stat${tone !== 'neutral' ? ` is-${tone}` : ''}`}>
      <p className="cohort-stat-label">{label}</p>
      <p className="cohort-stat-value cohort-num">{value}</p>
      {note ? <p className="cohort-stat-note">{note}</p> : null}
    </div>
  )
}

/** The recorded classification word as a chip, or nothing when unrecorded. */
export function TierChip({ value }) {
  if (!value) return null
  return <span className={`cohort-tier is-${value.tier ?? 'unknown'}`}>{classificationLabel(value.classification)}</span>
}

/**
 * One row of the comparison: the skill, how much of the cohort records it, and
 * how often the baseline names it.
 *
 * The two bars are decorative (`aria-hidden`) and the numbers beside them carry
 * the whole meaning. A row the baseline does not record renders no market bar at
 * all: a zero-width bar beside "—" would read as a recorded demand of zero, which
 * is a different fact from the baseline saying nothing.
 */
export function CompareBars({ row }) {
  const cohortWidth = row.proficiency === null ? 0 : Math.round(row.proficiency * 100)
  const marketWidth = row.marketDemand === null ? 0 : Math.round(row.marketDemand * 100)

  return (
    <div className="cohort-compare">
      <div className="cohort-compare-row">
        <span className="cohort-compare-label">Cohort coverage</span>
        <span className="cohort-compare-meter" aria-hidden="true">
          <span className="cohort-compare-fill is-cohort" style={{ width: `${Math.max(0, Math.min(100, cohortWidth))}%` }} />
        </span>
        <span className="cohort-compare-val cohort-num">{formatCoverage(row)}</span>
      </div>

      <div className="cohort-compare-row">
        <span className="cohort-compare-label">Market baseline</span>
        {row.hasMarketFigure ? (
          <>
            <span className="cohort-compare-meter" aria-hidden="true">
              <span className="cohort-compare-fill is-market" style={{ width: `${Math.max(0, Math.min(100, marketWidth))}%` }} />
            </span>
            <span className="cohort-compare-val cohort-num">{formatShare(row.marketDemand)}</span>
          </>
        ) : (
          <>
            <span className="cohort-compare-none">Not recorded for this role</span>
            <span className="cohort-compare-val cohort-num">{EMPTY_VALUE}</span>
          </>
        )}
      </div>
    </div>
  )
}

/** The recorded gap, kept apart from any "score" language. */
export function GapFigure({ row }) {
  if (row.gap === null) {
    return <span className="cohort-gap is-absent">No market figure</span>
  }
  const tone = row.gap > 0 ? 'is-behind' : row.gap < 0 ? 'is-ahead' : 'is-even'
  return <span className={`cohort-gap cohort-num ${tone}`}>{formatGap(row.gap)}</span>
}

/* ------------------------------------------------------------------ rows */

/**
 * One skill in the gap map.
 *
 * Everything shown is a value the service published for this row. The student
 * list is behind a disclosure rather than shown inline, because a cohort of a few
 * hundred would otherwise bury the comparison it is meant to explain.
 */
export function GapRow({ row }) {
  return (
    <li className={`cohort-row${row.hasMarketFigure ? '' : ' is-unrecorded'}`}>
      <div className="cohort-row-head">
        <h3 className="cohort-row-name">{row.skill}</h3>
        <div className="cohort-row-tags">
          <TierChip value={{ classification: row.classification, tier: row.tier }} />
          {row.hasMarketFigure ? null : <span className="cohort-row-flag">Outside this role&rsquo;s baseline</span>}
        </div>
      </div>

      <div className="cohort-row-body">
        <CompareBars row={row} />
        <div className="cohort-row-gap">
          <p className="cohort-row-gap-label">Gap</p>
          <GapFigure row={row} />
        </div>
      </div>

      <RecordDisclosure
        summary={
          row.studentsListing === null
            ? 'Recorded figures'
            : `${formatCount(row.studentsListing)} ${row.studentsListing === 1 ? 'student' : 'students'} record this`
        }
      >
        <Fields>
          <Field label="Cohort coverage">
            <span className="cohort-num">{formatShare(row.proficiency)}</span>{' '}
            <span className="cohort-unit">({formatCoverage(row)})</span>
          </Field>
          <Field label="Market baseline share">
            <Recorded value={row.marketDemand === null ? null : <span className="cohort-num">{formatShare(row.marketDemand)}</span>} />
          </Field>
          <Field label="Gap (baseline − coverage)">
            <Recorded value={row.gap === null ? null : <span className="cohort-num">{formatGap(row.gap)}</span>} />
          </Field>
          <Field label="Recorded classification">
            <Recorded value={row.classification ? classificationLabel(row.classification) : null} />
          </Field>
          <Field label="Students naming this skill" wide>
            {row.students.length ? (
              <span className="cohort-students">{row.students.join(', ')}</span>
            ) : (
              <span className="cohort-muted">No submitted record names this skill. That is an absence in the pasted roster, not a measured lack.</span>
            )}
          </Field>
        </Fields>
      </RecordDisclosure>
    </li>
  )
}

/* ------------------------------------------------------------- workflow */

/**
 * The four steps of the institutional workflow, declared once.
 *
 * The vertical stepper, the horizontal flow bar and the preview cards all read
 * from this list, so the page cannot offer two different vocabularies for the
 * same sequence. `blurb` is the one-line explanation a reader gets before any
 * data exists; it describes the step's purpose, never a result.
 */
export const COHORT_STEPS = [
  {
    id: 'roster',
    num: '01',
    title: 'Roster',
    blurb: 'Add your students',
    note: 'One JSON list, one student per record.',
    Icon: RosterIcon,
  },
  {
    id: 'pulse',
    num: '02',
    title: 'Cohort Pulse',
    blurb: 'Coverage at a glance',
    note: 'Recorded totals across the roster you submitted.',
    Icon: PulseIcon,
  },
  {
    id: 'gaps',
    num: '03',
    title: 'Skill Gaps',
    blurb: 'Against the baseline',
    note: 'Coverage beside recorded demand, widest gap first.',
    Icon: MapIcon,
  },
  {
    id: 'curriculum',
    num: '04',
    title: 'Curriculum Link',
    blurb: 'Hand off to the CTM',
    note: 'Open what this role teaches today.',
    Icon: LinkIcon,
  },
]

/**
 * The JSON editor, with a line-number gutter.
 *
 * A textarea is kept as the input rather than replaced by a code component: the
 * repository holds no editor dependency and adding one for a gutter is not
 * justified. The gutter is `aria-hidden` and mirrors scroll position on scroll,
 * so it is decoration over a real control rather than a second editor.
 */
export function JsonEditor({ id, value, onChange, describedBy, rows = 9 }) {
  const gutter = useRef(null)
  const lineCount = value.split('\n').length

  return (
    <div className="cohort-editor">
      <div className="cohort-editor-gutter" ref={gutter} aria-hidden="true">
        {Array.from({ length: lineCount }, (_, index) => (
          <span key={index}>{index + 1}</span>
        ))}
      </div>
      <textarea
        id={id}
        className="cohort-roster"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onScroll={(event) => {
          if (gutter.current) gutter.current.scrollTop = event.currentTarget.scrollTop
        }}
        spellCheck={false}
        rows={rows}
        placeholder={'[\n  { "student_id": "S-001", "skills": ["python", "sql"] }\n]'}
        aria-describedby={describedBy}
      />
    </div>
  )
}

/**
 * The roster step's illustration: the cohort workflow plate.
 *
 * It states the same pipeline the rail and the Institutional Loop state in words
 * -- students in, SkillBridge organizes, cohort insights out -- and carries no
 * figure anywhere, so nothing on the initial state can be mistaken for a
 * measurement.
 *
 * `width` and `height` are the plate's intrinsic pixels, so the browser knows the
 * ratio before the file loads and the image is never stretched, cropped or
 * rotated. At 1159x1358 the plate is close to square, so the illustration column
 * can cap it by WIDTH alone and it lands at a natural size beside the editor
 * rather than towering over it.
 */
export function RosterIllustration() {
  return (
    <div className="cohort-figure">
      <img
        className="cohort-figure-img"
        src="/references/19acabe3-b5fa-4496-bd9e-7aa751f30ecb.png"
        alt="Students' skills are processed into cohort-level insights"
        width={1159}
        height={1358}
        decoding="async"
      />
    </div>
  )
}

/**
 * The Institutional Loop -- why this page and the Curriculum Time Machine are two
 * ends of one product.
 *
 * A disclosure, not a second navigation bar: one row until a reader opens it, and
 * it explains a relationship rather than offering a destination of its own. The
 * one action inside it goes to the CTM, which is already reachable from the top
 * navigation, so nothing here is reachable only through this panel.
 *
 * Every figure it reports is a value the service returned for this roster. Before
 * a comparison exists it states the relationship and no number, so an un-analysed
 * page cannot imply a measurement it does not have.
 */
export function InstitutionalLoop({ analysis, roleLabel, onOpen }) {
  const [open, setOpen] = useState(false)
  const bodyId = useId()
  const observed = analysis ? formatCount(analysis.distinctCohortSkills) : null

  return (
    <section className={`cohort-loop${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="cohort-loop-toggle"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((value) => !value)}
      >
        <ChevronIcon className="cohort-loop-chevron" />
        <span className="cohort-loop-head">
          <span className="cohort-loop-title">Institutional Loop</span>
          <span className="cohort-loop-sub">Cohort gaps are the input to the curriculum</span>
        </span>
      </button>

      <div className="cohort-loop-body" id={bodyId} hidden={!open}>
        <ol className="cohort-loop-chain">
          <li className="cohort-loop-stop">
            <span className="cohort-loop-name">Cohort Dashboard</span>
            <span className="cohort-loop-note">
              {observed ? `${observed} skills observed` : 'Submit a roster to observe skills'}
            </span>
          </li>
          <li className="cohort-loop-arrow" aria-hidden="true" />
          <li className="cohort-loop-stop">
            <span className="cohort-loop-name">Skill gaps identified</span>
            <span className="cohort-loop-note">
              {analysis ? `Compared against ${roleLabel}` : 'Available once a roster is analysed'}
            </span>
          </li>
          <li className="cohort-loop-arrow" aria-hidden="true" />
          <li className="cohort-loop-stop">
            <span className="cohort-loop-name">Curriculum Time Machine</span>
            <span className="cohort-loop-note">Does the curriculum already teach it?</span>
          </li>
        </ol>

        <button type="button" className="cohort-loop-go" onClick={onOpen}>
          Open Curriculum Time Machine
          <ArrowIcon className="cohort-loop-go-arrow" />
        </button>
      </div>
    </section>
  )
}
/* ------------------------------------------------------------- states */

export function LoadingPanel() {
  return (
    <div className="cohort-state" role="status" aria-live="polite">
      <span className="cohort-state-spinner" aria-hidden="true" />
      <p className="cohort-state-title">Comparing the cohort against the recorded baseline</p>
      <p className="cohort-state-lead">One request. The roster is not stored.</p>
    </div>
  )
}

/** A failed request, reported as a failure with the service's own wording. */
export function ErrorPanel({ error, onRetry }) {
  return (
    <div className="cohort-state is-error" role="alert">
      <span className="cohort-state-ic" aria-hidden="true">
        <AlertIcon />
      </span>
      <h2 className="cohort-state-title">{error.title}</h2>
      <p className="cohort-state-lead">{error.message}</p>
      {error.detail ? <p className="cohort-state-detail">{error.detail}</p> : null}
      {onRetry ? (
        <button type="button" className="cohort-retry" onClick={onRetry}>
          Analyse again
        </button>
      ) : null}
    </div>
  )
}

/** Provenance: exactly which recorded corpus the comparison was made against. */
export function AuditPanel({ analysis, open, onToggle }) {
  const { baseline } = analysis
  return (
    <Disclosure id="cohort-audit" title="Audit &amp; data provenance" count="service metadata" open={open} onToggle={onToggle}>
      <div className="cohort-audit">
        <section className="cohort-audit-block">
          <h3 className="cohort-audit-title">Market baseline</h3>
          <p className="cohort-audit-note">
            This comparison reads the prepared static baseline, the same numbers <code className="cohort-code">/curriculum-intelligence</code>{' '}
            serves. It is not a live feed and is never merged with the live posting sample.
          </p>
          <Fields>
            <Field label="Role identifier">
              <code className="cohort-code">{baseline.role}</code>
            </Field>
            <Field label="Layer">
              <Recorded value={baseline.layer} />
            </Field>
            <Field label="Recorded skills">
              <span className="cohort-num">{formatCount(baseline.skillCount)}</span>
            </Field>
            <Field label="Role postings">
              <span className="cohort-num">{formatCount(baseline.postings)}</span>
            </Field>
          </Fields>
        </section>

        <section className="cohort-audit-block">
          <h3 className="cohort-audit-title">Corpus</h3>
          <Fields>
            <Field label="Postings artifact">
              <Recorded value={baseline.corpus.postingsArtifact} />
            </Field>
            <Field label="Rows">
              <span className="cohort-num">{formatCount(baseline.corpus.datasetRows)}</span>
            </Field>
            <Field label="Date range">
              {formatDate(baseline.corpus.dateMin)} to {formatDate(baseline.corpus.dateMax)}
            </Field>
          </Fields>
        </section>

        <section className="cohort-audit-block">
          <h3 className="cohort-audit-title">Submitted roster</h3>
          <Fields>
            <Field label="Students">
              <span className="cohort-num">{formatCount(analysis.cohortSize)}</span>
            </Field>
            <Field label="Students with at least one skill">
              <span className="cohort-num">{formatCount(analysis.studentsWithSkills)}</span>
            </Field>
            <Field label="Skill entries submitted">
              <span className="cohort-num">{formatCount(analysis.skillRecordsSubmitted)}</span>
            </Field>
            <Field label="Blank or repeated entries folded">
              <span className="cohort-num">{formatCount(analysis.skillRecordsDeduplicated)}</span>
            </Field>
            <Field label="Distinct skills in the roster">
              <span className="cohort-num">{formatCount(analysis.distinctCohortSkills)}</span>
            </Field>
            <Field label="Roster skills outside the baseline" wide>
              {analysis.skillsNotInBaseline.length ? analysis.skillsNotInBaseline.join(', ') : <span className="cohort-muted">Every submitted skill is recorded for this role.</span>}
            </Field>
          </Fields>
        </section>

        <section className="cohort-audit-block">
          <h3 className="cohort-audit-title">Endpoint</h3>
          <ul className="cohort-audit-endpoints">
            <li>
              <code className="cohort-code">POST /cohort-analysis</code>
            </li>
          </ul>
          {analysis.methodNote ? <p className="cohort-audit-note">{analysis.methodNote}</p> : null}
        </section>

        <NotAvailableList items={analysis.notAvailable} title="Not available from this service" />
      </div>
    </Disclosure>
  )
}
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { navigate } from '../router'
import {
  COHORT_DEFAULT_ROLE,
  COHORT_ROLES,
  CohortParseError,
  EXAMPLE_COHORT_INPUT,
  analyzeCohort,
  describeCohortError,
  formatCount,
  isAbortError,
  parseCohortInput,
} from '../data/cohortSource'
import {
  ArrowIcon,
  AuditPanel,
  CohortIcon,
  ErrorPanel,
  GapRow,
  LoadingPanel,
  MapIcon,
  RecordDisclosure,
  SearchIcon,
  StampIcon,
  StartPanel,
  Stat,
} from './cohortStations'
import './cohortDashboard.css'

/* One filter per axis the rows actually vary on. `recorded` splits the skills the
   baseline knows about from the ones it says nothing about, which is the
   difference between a gap and an absence; `tier` splits the recorded rows by the
   classification word the service published. */
const FILTERS = [
  { id: 'all', label: 'All skills' },
  { id: 'gap', label: 'Market-backed' },
  { id: 'unrecorded', label: 'Outside baseline' },
]

const TIERS = [
  { id: 'all', label: 'Any tier' },
  { id: 'core', label: 'Core' },
  { id: 'mid', label: 'Mid' },
  { id: 'noise', label: 'Noise' },
]

/**
 * Holds one request at a time.
 *
 * A roster is sent once per analysis and never stored: the state here is the
 * response and the textarea the reader typed, nothing else. Each new submission
 * aborts the request before it, and a stale response is discarded by generation
 * rather than trusted, so a slow earlier answer cannot overwrite a newer one.
 */
function useCohortAnalysis() {
  const [state, setState] = useState({ status: 'idle', data: null, error: null })
  const generation = useRef(0)
  const controller = useRef(null)

  const run = useCallback((cohort, role) => {
    const current = ++generation.current
    controller.current?.abort()
    const active = new AbortController()
    controller.current = active

    setState({ status: 'loading', data: null, error: null })

    analyzeCohort(cohort, role, { signal: active.signal })
      .then((data) => {
        if (current !== generation.current) return
        setState({ status: 'ready', data, error: null })
      })
      .catch((caught) => {
        if (isAbortError(caught) || current !== generation.current) return
        setState({ status: 'error', data: null, error: describeCohortError(caught) })
      })
  }, [])

  useEffect(() => () => controller.current?.abort(), [])

  const reset = useCallback(() => {
    generation.current += 1
    controller.current?.abort()
    setState({ status: 'idle', data: null, error: null })
  }, [])

  return { ...state, run, reset }
}

function WorkspaceHead({ role, onRoleChange }) {
  return (
    <header className="cohort-top">
      <div className="cohort-top-copy">
        <p className="cohort-kicker">Institution &amp; Cohort</p>
        <h1 className="cohort-topline">
          Where a cohort stands. <em>Against recorded demand.</em>
        </h1>
        <p className="cohort-lead">
          Submit a roster, pick one role, and every skill is reported twice: how much of the cohort records it, and how often
          that role&rsquo;s prepared baseline names it. Coverage is a share of the records you pasted — not an assessed level.
        </p>
      </div>

      <div className="cohort-topmeta">
        <div className="cohort-rolefield">
          <span className="cohort-rolefield-label" id="cohort-role-label">
            Compare against
          </span>
          <div className="cohort-roles" role="group" aria-labelledby="cohort-role-label">
            {COHORT_ROLES.map((entry) => {
              const active = entry.id === role
              return (
                <button
                  key={entry.id}
                  type="button"
                  className={`cohort-role${active ? ' is-active' : ''}`}
                  aria-pressed={active}
                  onClick={() => onRoleChange(entry.id)}
                >
                  {entry.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </header>
  )
}

/**
 * The roster composer.
 *
 * A textarea of JSON rather than a file control, because this repository holds no
 * roster parser and inventing one would be a claim that a spreadsheet was read
 * when nothing read it. Parsing and its error copy live in the data layer, so
 * this component only ever holds text.
 */
function RosterComposer({ value, onChange, onExample, status, message, messageTone }) {
  return (
    <section className="cohort-composer" aria-labelledby="cohort-composer-title">
      <div className="cohort-composer-heading">
        <p className="cohort-label">
          <span className="cohort-label-ic" aria-hidden="true">
            <CohortIcon />
          </span>
          Cohort roster
        </p>
        <h2 className="cohort-composer-title" id="cohort-composer-title">
          One student per record
        </h2>
        <p className="cohort-composer-note">
          A JSON list of <code className="cohort-code">{'{ student_id, skills }'}</code> records. Blank entries and a skill
          repeated inside one student are folded by the service and counted in the audit panel — a repeat is one student
          holding the skill once, not two students.
        </p>
      </div>

      <label className="cohort-sr" htmlFor="cohort-roster">
        Cohort roster as JSON
      </label>
      <textarea
        id="cohort-roster"
        className="cohort-roster"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
        rows={9}
        placeholder={'[\n  { "student_id": "S-001", "skills": ["python", "sql"] }\n]'}
        aria-describedby="cohort-roster-help"
      />

      <div className="cohort-composer-actions">
        <button type="submit" className="cohort-submit" disabled={status === 'loading'}>
          {status === 'loading' ? 'Analysing…' : 'Compare cohort'}
        </button>
        <button type="button" className="cohort-example" onClick={onExample}>
          Fill an example roster
        </button>
        <p className="cohort-composer-meta" id="cohort-roster-help">
          Sent once as <code className="cohort-code">POST /cohort-analysis</code>. Nothing is stored.
        </p>
      </div>

      {message ? (
        <p className={`cohort-composer-message is-${messageTone}`} role={messageTone === 'error' ? 'alert' : 'status'}>
          {message}
        </p>
      ) : null}
    </section>
  )
}

function SummaryStrip({ analysis }) {
  const { counts } = analysis
  return (
    <section className="cohort-summary" aria-label="Recorded comparison totals">
      <Stat
        label="Students compared"
        value={formatCount(analysis.cohortSize)}
        note={
          analysis.studentsWithSkills === null
            ? null
            : `${formatCount(analysis.studentsWithSkills)} recorded at least one skill`
        }
      />
      <Stat
        label="Skills in the baseline"
        value={formatCount(analysis.baseline.skillCount)}
        note={`Recorded across ${formatCount(analysis.baseline.postings)} postings`}
      />
      <Stat
        label="Skills behind the baseline"
        value={formatCount(counts.gapSkills)}
        note="Market names them more often than this cohort records them"
        tone={counts.gapSkills > 0 ? 'warn' : 'neutral'}
      />
      <Stat
        label="Nobody records"
        value={formatCount(counts.uncovered)}
        note="Baseline skills this roster names for no one"
        tone={counts.uncovered > 0 ? 'warn' : 'neutral'}
      />
      <Stat
        label="Outside this baseline"
        value={formatCount(counts.withoutMarketFigure)}
        note="Roster skills the baseline records nothing about"
      />
    </section>
  )
}

function GapMap({ analysis, onInspect }) {
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState('all')
  const [tier, setTier] = useState('all')

  const rows = analysis.skills

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return rows.filter((row) => {
      if (scope === 'gap' && !row.hasMarketFigure) return false
      if (scope === 'unrecorded' && row.hasMarketFigure) return false
      if (tier !== 'all' && row.tier !== tier) return false
      if (!needle) return true
      if (row.skill.toLowerCase().includes(needle)) return true
      /* Matching a student id is how a reader finds one person in a long roster,
         so the search covers the recorded student list as well as the skill name. */
      return row.students.some((id) => id.toLowerCase().includes(needle))
    })
  }, [rows, query, scope, tier])

  const hidden = rows.length - visible.length

  return (
    <section className="cohort-map" aria-labelledby="cohort-map-title">
      <div className="cohort-map-heading">
        <p className="cohort-label">
          <span className="cohort-label-ic" aria-hidden="true">
            <MapIcon />
          </span>
          Skill gap map
        </p>
        <h2 className="cohort-map-title" id="cohort-map-title">
          Cohort coverage against the recorded baseline
        </h2>
        <p className="cohort-map-note">
          Ordered as the service published it: recorded skills by widest gap first, then alphabetical, then the skills this
          baseline records nothing about. A bar is drawn only where a figure was recorded.
        </p>
      </div>

      <div className="cohort-filters">
        <div className="cohort-search">
          <SearchIcon className="cohort-search-ic" />
          <label className="cohort-sr" htmlFor="cohort-search">
            Search skills or student identifiers
          </label>
          <input
            id="cohort-search"
            className="cohort-search-input"
            type="search"
            value={query}
            placeholder="Search a skill or a student id"
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div className="cohort-filtergroup" role="group" aria-label="Filter by whether the baseline records the skill">
          {FILTERS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={`cohort-filter${scope === entry.id ? ' is-active' : ''}`}
              aria-pressed={scope === entry.id}
              onClick={() => setScope(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </div>

        <div className="cohort-filtergroup" role="group" aria-label="Filter by recorded classification">
          {TIERS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={`cohort-filter${tier === entry.id ? ' is-active' : ''}`}
              aria-pressed={tier === entry.id}
              onClick={() => setTier(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </div>

        <p className="cohort-filtercount" aria-live="polite">
          Showing {formatCount(visible.length)} of {formatCount(rows.length)} skills
          {hidden > 0 ? ` · ${formatCount(hidden)} filtered out` : ''}
        </p>
      </div>

      {visible.length ? (
        <ul className="cohort-rows">
          {visible.map((row) => (
            <GapRow key={row.skill} row={row} />
          ))}
        </ul>
      ) : (
        <p className="cohort-empty">
          No recorded skill matches these filters. Clear the search or widen the scope to see all {formatCount(rows.length)} rows.
        </p>
      )}

      <RecordDisclosure summary={`How to read this map · method note`}>
        <p className="cohort-method">{analysis.methodNote}</p>
      </RecordDisclosure>

      <div className="cohort-bridge">
        <div className="cohort-bridge-copy">
          <p className="cohort-label">
            <span className="cohort-label-ic" aria-hidden="true">
              <StampIcon />
            </span>
            Next step
          </p>
          <p className="cohort-bridge-note">
            The Curriculum Time Machine shows what {analysis.roleLabel} teaches today and where a curriculum already meets this
            baseline. This page compares a roster against the same baseline; it does not place skills into courses.
          </p>
        </div>
        <button type="button" className="cohort-bridge-btn" onClick={onInspect}>
          Inspect {analysis.roleLabel}
          <ArrowIcon className="cohort-bridge-arrow" />
        </button>
      </div>
    </section>
  )
}

export default function CohortDashboard() {
  const [role, setRole] = useState(COHORT_DEFAULT_ROLE)
  const [roster, setRoster] = useState('')
  const [notice, setNotice] = useState(null)
  const [auditOpen, setAuditOpen] = useState(false)
  const { status, data, error, run, reset } = useCohortAnalysis()
  /* The roster that produced the current state, so a retry after a failure
     re-sends exactly what the reader submitted rather than re-parsing a textarea
     they may have edited in the meantime. */
  const submitted = useRef(null)

  const submit = useCallback(
    (event) => {
      event.preventDefault()
      let cohort
      try {
        cohort = parseCohortInput(roster)
      } catch (caught) {
        /* A roster this page cannot read exactly is refused before any request is
           made, so a half-understood paste never produces a confident comparison
           of the wrong students. */
        setNotice({ tone: 'error', text: caught instanceof CohortParseError ? caught.message : 'That roster could not be read.' })
        return
      }
      setNotice(null)
      submitted.current = cohort
      run(cohort, role)
    },
    [roster, role, run],
  )

  /* Switching the role invalidates the comparison on screen: it was made against
     the previous role's baseline, so keeping it visible under a new role label
     would attribute one role's recorded figures to another. */
  const changeRole = useCallback(
    (next) => {
      setRole(next)
      if (status !== 'idle') {
        reset()
        submitted.current = null
        setNotice({ tone: 'info', text: 'Role changed. Compare the roster again to analyse it against the new baseline.' })
      }
    },
    [status, reset],
  )

  const fillExample = useCallback(() => {
    setRoster(EXAMPLE_COHORT_INPUT)
    setNotice({ tone: 'info', text: 'Example roster filled in. It is a four-student sample; the figures come from the service, not from this page.' })
  }, [])

  const retry = useCallback(() => {
    if (submitted.current) run(submitted.current, role)
  }, [role, run])

  const goToCurriculum = useCallback(() => {
    navigate('/curriculum-time-machine')
  }, [])

  return (
    <div className="cohort">
      <div className="cohort-shell">
        <main className="cohort-main">
          <WorkspaceHead role={role} onRoleChange={changeRole} />

          <form id="cohort-form" onSubmit={submit} noValidate>
            <RosterComposer
              value={roster}
              onChange={setRoster}
              onExample={fillExample}
              status={status}
              message={notice?.text ?? null}
              messageTone={notice?.tone ?? 'info'}
            />
          </form>

          {status === 'idle' ? <StartPanel onExample={fillExample} /> : null}
          {status === 'loading' ? <LoadingPanel /> : null}
          {status === 'error' && error ? <ErrorPanel error={error} onRetry={retry} /> : null}

          {status === 'ready' && data ? (
            <>
              <SummaryStrip analysis={data} />
              <GapMap analysis={data} onInspect={goToCurriculum} />
              <AuditPanel analysis={data} open={auditOpen} onToggle={() => setAuditOpen((open) => !open)} />
            </>
          ) : null}
        </main>
      </div>
    </div>
  )
}
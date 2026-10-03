import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { navigate } from '../router'
import { RailContext, WorkspaceRail, WorkspaceShell } from './workspaceShell'
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
  COHORT_STEPS,
  CohortIcon,
  ErrorPanel,
  GapRow,
  InstitutionalLoop,
  JsonEditor,
  LoadingPanel,
  MapIcon,
  RecordDisclosure,
  RosterIllustration,
  SearchIcon,
  StampIcon,
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

/** The three things a reader is entitled to know before pasting anything. */
const ROSTER_CHIPS = [
  'One student per record',
  'Skills are normalized',
  'Duplicate skills are ignored',
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

/**
 * The compact hero.
 *
 * The role control is a native `<select>`, not a custom listbox: the set is the
 * roles the service can actually plan, so a popup would cost more than it returns
 * and the native control is already keyboard- and screen-reader-correct. It keeps
 * the one role the service publishes figures for, so an unsupported role still
 * cannot be selected here.
 */
function WorkspaceHead({ role, onRoleChange }) {
  return (
    <header className="cohort-hero">
      <div className="cohort-hero-copy">
        <p className="cohort-kicker">Institution &amp; Cohort</p>
        <h1 className="cohort-hero-title">
          From your students to <em>curriculum impact.</em>
        </h1>
        <p className="cohort-lead">
          Submit a cohort, compare every skill it records against the recorded industry demand for one role, then take the
          findings to your curriculum.
        </p>
      </div>

      <div className="cohort-rolefield">
        <label className="cohort-rolefield-label" htmlFor="cohort-role">
          Compare against
        </label>
        <select
          id="cohort-role"
          className="cohort-select"
          value={role}
          onChange={(event) => onRoleChange(event.target.value)}
        >
          {COHORT_ROLES.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.label}
            </option>
          ))}
        </select>
        <p className="cohort-rolefield-note">Roles the service can plan figures for.</p>
      </div>
    </header>
  )
}

/**
 * Step 01 — the roster composer.
 *
 * A textarea of JSON rather than a file control, because this repository holds no
 * roster parser and inventing one would be a claim that a spreadsheet was read
 * when nothing read it. Parsing and its error copy live in the data layer, so
 * this component only ever holds text.
 */
function RosterStep({ value, onChange, onExample, status, error, onRetry, message, messageTone }) {
  return (
    <section className="cohort-steppanel" aria-labelledby="cohort-roster-title">
      <header className="cohort-stephead">
        <p className="cohort-label">
          <span className="cohort-label-ic" aria-hidden="true">
            <CohortIcon />
          </span>
          Step 01 · Roster
        </p>
        <h2 className="cohort-steptitle" id="cohort-roster-title">
          Add your cohort roster
        </h2>
        <p className="cohort-stepnote">
          Provide a list of students and their skills. Each student should appear once.
        </p>
      </header>

      <div className="cohort-roster-grid">
        <div className="cohort-roster-main">
          <div className="cohort-editor-bar">
            <span className="cohort-editor-label" id="cohort-editor-label">
              Paste JSON
            </span>
            <RecordDisclosure summary="Expected format">
              <p className="cohort-method">
                A JSON array of objects, each with a <code className="cohort-code">student_id</code> and a{' '}
                <code className="cohort-code">skills</code> array of strings. An object wrapper of the form{' '}
                <code className="cohort-code">{'{ "cohort": [...] }'}</code> is also accepted. Nothing else is read.
              </p>
            </RecordDisclosure>
          </div>

          <JsonEditor id="cohort-roster" value={value} onChange={onChange} describedBy="cohort-roster-help" />

          <ul className="cohort-chips">
            {ROSTER_CHIPS.map((chip) => (
              <li key={chip} className="cohort-chip">
                {chip}
              </li>
            ))}
          </ul>

          <p className="cohort-pasteonly">
            Paste only. This page has no file reader, so nothing is read from disk or from a document.
          </p>
        </div>

        <RosterIllustration />
      </div>

      <div className="cohort-stepactions">
        <button type="submit" className="cohort-submit" disabled={status === 'loading'}>
          {status === 'loading' ? 'Analysing…' : 'Analyze Cohort'}
          {status === 'loading' ? null : <ArrowIcon className="cohort-bridge-arrow" />}
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

      {status === 'loading' ? <LoadingPanel /> : null}
      {status === 'error' && error ? <ErrorPanel error={error} onRetry={onRetry} /> : null}
    </section>
  )
}

/**
 * Step 02 — the cohort pulse.
 *
 * The recorded totals, plus the two limits that are easy to misread: coverage is a
 * share of the records that were submitted, not an assessed level, and a skill the
 * baseline says nothing about is not a skill with zero demand.
 */
function PulseStep({ analysis }) {
  return (
    <section className="cohort-steppanel" aria-labelledby="cohort-pulse-title">
      <header className="cohort-stephead">
        <p className="cohort-label">
          <span className="cohort-label-ic" aria-hidden="true">
            <CohortIcon />
          </span>
          Step 02 · Cohort Pulse
        </p>
        <h2 className="cohort-steptitle" id="cohort-pulse-title">
          What this cohort records
        </h2>
        <p className="cohort-stepnote">
          Totals from the roster you submitted, read against {analysis.roleLabel}&rsquo;s recorded baseline.
        </p>
      </header>

      <SummaryStrip analysis={analysis} />

      <ul className="cohort-caveats">
        <li>Coverage is the share of submitted records naming a skill. It is not an assessed level, and no student is scored or ranked.</li>
        <li>A skill the baseline does not record for this role gets no market figure, rather than a demand of zero.</li>
        <li>The live posting sample is not part of this comparison. It is too small to carry a share.</li>
      </ul>
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

/**
 * Step 03 — the gap map.
 *
 * The working surface: two bars per skill, a search that also matches student ids,
 * and filters that split the skills the baseline records from the ones it does not.
 */
function GapMap({ analysis }) {
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
          Step 03 · Skill Gaps
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

      <RecordDisclosure summary="How to read this map · method note">
        <p className="cohort-method">{analysis.methodNote}</p>
      </RecordDisclosure>
    </section>
  )
}

/**
 * Step 04 — the hand-off to the Curriculum Time Machine.
 *
 * It says plainly what the hand-off is not: this page compares a roster against a
 * baseline and does not place skills into courses, so the reader is not promised a
 * curriculum edit they will not get.
 */
function CurriculumStep({ analysis, onInspect }) {
  return (
    <section className="cohort-steppanel" aria-labelledby="cohort-curriculum-title">
      <header className="cohort-stephead">
        <p className="cohort-label">
          <span className="cohort-label-ic" aria-hidden="true">
            <StampIcon />
          </span>
          Step 04 · Curriculum Link
        </p>
        <h2 className="cohort-steptitle" id="cohort-curriculum-title">
          Take this to your curriculum
        </h2>
        <p className="cohort-stepnote">
          The Curriculum Time Machine shows what {analysis.roleLabel} teaches today and where a curriculum already meets this
          baseline.
        </p>
      </header>

      <div className="cohort-bridge">
        <div className="cohort-bridge-copy">
          <p className="cohort-bridge-note">
            This page compares a roster against the same baseline the Time Machine reads. It does not place skills into
            courses, and it does not rewrite a curriculum — the two surfaces meet at the baseline, and the comparison above
            is what you take across.
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

/* The four workflow steps, mapped onto the shared rail's item contract. This is
   the page's ONE workflow navigation: the sequence is named once, in the rail,
   and nowhere else. A step with no comparison behind it stays in the list and
   reports itself when pressed, because a sequence a reader cannot see is a
   sequence they cannot anticipate. */
function railGroups(reached) {
  return [
    {
      label: 'Workflow',
      items: COHORT_STEPS.map((entry) => ({
        id: entry.id,
        num: entry.num,
        label: entry.title,
        note: entry.blurb,
        icon: <entry.Icon />,
        locked: !reached.includes(entry.id),
      })),
    },
  ]
}

export default function CohortDashboard() {
  const [role, setRole] = useState(COHORT_DEFAULT_ROLE)
  const [roster, setRoster] = useState('')
  const [notice, setNotice] = useState(null)
  const [auditOpen, setAuditOpen] = useState(false)
  const [step, setStep] = useState('roster')
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
        setStep('roster')
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

  /* A completed comparison advances the reader one step, so the sequence they were
     told about — add students, then see coverage, then see gaps — is the sequence
     they actually walk. */
  useEffect(() => {
    if (status === 'ready') setStep('pulse')
  }, [status])

  /* Steps past the roster exist only once the service has returned figures, so an
     un-analysed page marks them as upcoming instead of opening an empty surface. */
  const reached = useMemo(
    () => (status === 'ready' ? COHORT_STEPS.map((entry) => entry.id) : ['roster']),
    [status],
  )

  const selectStep = useCallback(
    (id) => {
      if (!reached.includes(id)) return
      setStep(id)
    },
    [reached],
  )

  /* A locked step explains itself rather than doing nothing, and stays focusable
     so the reason is reachable by keyboard. */
  const explainLocked = useCallback((entry) => {
    setStep('roster')
    setNotice({ tone: 'info', text: `${entry.title} opens once a roster has been analysed. Add a roster and compare it first.` })
  }, [])

  const hasData = status === 'ready' && data

  return (
    <div className="cohort">
      <WorkspaceShell
        rail={
          <WorkspaceRail
            label="Institution & Cohort"
            navLabel="Cohort workflow steps"
            groups={railGroups(reached)}
            activeId={step}
            onSelect={selectStep}
            onLocked={explainLocked}
            context={
              <RailContext
                label="Submitted roster"
                meta={
                  hasData
                    ? `${formatCount(data.cohortSize)} student records · sent once, never stored`
                    : 'No roster submitted yet. Nothing is stored.'
                }
              />
            }
          />
        }
      >
        <WorkspaceHead role={role} onRoleChange={changeRole} />

        {step === 'roster' ? (
          <form id="cohort-form" onSubmit={submit} noValidate>
            <RosterStep
              value={roster}
              onChange={setRoster}
              onExample={fillExample}
              status={status}
              error={error}
              onRetry={retry}
              message={notice?.text ?? null}
              messageTone={notice?.tone ?? 'info'}
            />
          </form>
        ) : null}

        {step === 'pulse' && hasData ? <PulseStep analysis={data} /> : null}
        {step === 'gaps' && hasData ? <GapMap analysis={data} /> : null}
        {step === 'curriculum' && hasData ? <CurriculumStep analysis={data} onInspect={goToCurriculum} /> : null}

        {hasData ? (
          <AuditPanel analysis={data} open={auditOpen} onToggle={() => setAuditOpen((open) => !open)} />
        ) : null}

        {/* The one panel that explains why this page and the Curriculum Time
            Machine are two ends of one product. It is a disclosure rather than a
            bar: one row until opened. */}
        <InstitutionalLoop
          analysis={hasData ? data : null}
          roleLabel={data?.roleLabel ?? COHORT_ROLES.find((entry) => entry.id === role)?.label ?? role}
          onOpen={goToCurriculum}
        />
      </WorkspaceShell>
    </div>
  )
}
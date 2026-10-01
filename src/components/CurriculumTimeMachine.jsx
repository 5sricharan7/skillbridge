import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CTM_DEFAULT_ROLE,
  CTM_ROLES,
  describeCurriculumError,
  formatCount,
  formatDate,
  isAbortError,
  loadCurriculumGaps,
  loadCurriculumIntelligence,
  loadCurriculumRecord,
  loadCurriculumRecommendations,
} from '../data/curriculumSource'
import {
  CourseDetail,
  CurriculumCanvas,
  DashIcon,
  Disclosure,
  EvolutionCanvas,
  Field,
  Fields,
  GapCanvas,
  GapDetail,
  MapIcon,
  MatrixIcon,
  NotAvailableList,
  OverviewCanvas,
  ProposalCanvas,
  ProposalDetail,
  ProposalIcon,
  PulseIcon,
  RetryButton,
  SkillDetail,
  SemesterDetail,
  StampIcon,
  TrendIcon,
  WorkspaceDrawer,
  gapGroups,
} from './curriculumStations'
import './ctm.css'

/* One entry per artifact the workflow reads. The curriculum record has no role in
   its path, so every loader takes the role and only the role-scoped ones use it. */
const LOADERS = {
  record: (_role, { signal }) => loadCurriculumRecord({ signal }),
  intelligence: (role, { signal }) => loadCurriculumIntelligence(role, { signal }),
  gaps: (role, { signal }) => loadCurriculumGaps(role, { signal }),
  proposals: (role, { signal }) => loadCurriculumRecommendations(role, { signal }),
}

const RESOURCE_KEYS = Object.keys(LOADERS)
const ROLE_SCOPED_KEYS = RESOURCE_KEYS.filter((key) => key !== 'record')

const ENDPOINT = {
  record: '/curriculum-record',
  intelligence: '/curriculum-intelligence/{role}',
  gaps: '/curriculum-gaps/{role}',
  proposals: '/curriculum-recommendations/{role}',
}

/* The five views. One list names every view, so the rail, the canvas switch, and
   the deep-link hash all read the same source. */
const VIEWS = [
  { id: 'overview', label: 'Overview', icon: PulseIcon, kicker: 'Curriculum Pulse' },
  { id: 'curriculum', label: 'Curriculum', icon: MapIcon, kicker: 'What is taught today' },
  { id: 'evolution', label: 'Industry Evolution', icon: TrendIcon, kicker: 'What the evidence records' },
  { id: 'gaps', label: 'Gap Analysis', icon: MatrixIcon, kicker: 'Where the two disagree' },
  { id: 'proposal', label: 'Proposed Future', icon: ProposalIcon, kicker: 'What the service placed' },
]

function loadingResource() {
  return { status: 'loading', data: null, error: null }
}

function initialResources() {
  return Object.fromEntries(RESOURCE_KEYS.map((key) => [key, loadingResource()]))
}

/**
 * Loads the four artifacts for one role. Each request settles on its own, so a
 * view that depends on a failed artifact reports that failure in place while the
 * rest of the workspace stays on screen, and each artifact can be retried without
 * reloading the others.
 */
function useWorkflow(role) {
  const [resources, setResources] = useState(initialResources)
  const generation = useRef(0)
  const controller = useRef(null)
  const recordSettled = useRef(false)

  const run = useCallback((keys, targetRole) => {
    const current = ++generation.current
    const active = new AbortController()
    controller.current = active

    setResources((previous) => {
      const next = {}
      for (const key of RESOURCE_KEYS) next[key] = keys.includes(key) ? loadingResource() : previous[key]
      return next
    })

    for (const key of keys) {
      LOADERS[key](targetRole, { signal: active.signal })
        .then((data) => {
          /* A slower earlier request must not overwrite a newer role's record. */
          if (current !== generation.current) return
          if (key === 'record') recordSettled.current = true
          setResources((previous) => ({ ...previous, [key]: { status: 'ready', data, error: null } }))
        })
        .catch((caught) => {
          if (isAbortError(caught) || current !== generation.current) return
          if (key === 'record') recordSettled.current = true
          setResources((previous) => ({
            ...previous,
            [key]: { status: 'error', data: null, error: describeCurriculumError(caught) },
          }))
        })
    }
  }, [])

  useEffect(() => {
    /* The record has no role in its path, so once it has settled a role switch has
       nothing new to fetch for it. Re-requesting would blank a view whose data did
       not change. Gating on settlement (not on mount) keeps StrictMode's second
       effect invocation loading it, because the first one is aborted. */
    run(recordSettled.current ? ROLE_SCOPED_KEYS : RESOURCE_KEYS, role)
    return () => controller.current?.abort()
  }, [role, run])

  const retry = useCallback((key) => run([key], role), [role, run])
  const reload = useCallback(() => run(RESOURCE_KEYS, role), [role, run])

  return { resources, retry, reload }
}

function WorkspaceHead({ role, onRoleChange, resources }) {
  const record = resources.record.data
  const gaps = resources.gaps.data
  const proposals = resources.proposals.data

  return (
    <header className="ctm-top">
      <span className="ctm-top-art" aria-hidden="true">
        <img className="ctm-top-art-img" src="/assets/curriculum-campus-banner.png" alt="" decoding="async" />
        <span className="ctm-top-art-veil" />
      </span>

      <div className="ctm-top-copy">
        <p className="ctm-kicker">Curriculum Time Machine</p>
        <h1 className="ctm-topline">
          Same foundation. <em>Brighter futures.</em>
        </h1>
        <p className="ctm-lead">
          One role, four recorded artifacts, five views. Every figure is a value the service recorded — nothing here is
          estimated, scored, or ranked.
        </p>
      </div>

      <div className="ctm-topmeta">
        {record?.isDemo || gaps?.isDemo || proposals?.isDemo ? (
          <p className="ctm-flag">
            <StampIcon />
            Demonstration record
          </p>
        ) : null}
        <div className="ctm-rolefield">
          <span className="ctm-rolefield-label" id="ctm-role-label">
            Role
          </span>
          <div className="ctm-roles" role="group" aria-labelledby="ctm-role-label">
            {CTM_ROLES.map((entry) => {
              const active = entry.id === role
              return (
                <button
                  key={entry.id}
                  type="button"
                  className={`ctm-role${active ? ' is-active' : ''}`}
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

function RailContext({ resources }) {
  const record = resources.record.data
  const intelligence = resources.intelligence.data
  const slices = intelligence?.slices?.slices ?? []

  return (
    <div className="ctm-railcontext">
      <p className="ctm-railcontext-label">Reading</p>
      {slices.length > 0 ? (
        <ul className="ctm-railcontext-list">
          {slices.map((slice) => (
            <li key={slice.timeSlice} className="ctm-num">
              {slice.timeSlice}
            </li>
          ))}
        </ul>
      ) : (
        <p className="ctm-railcontext-empty">No slice recorded</p>
      )}
      <p className="ctm-railcontext-meta">
        {record?.corpus?.artifact ? (
          <>
            {formatDate(record.corpus.dateMin)} to {formatDate(record.corpus.dateMax)}
          </>
        ) : (
          'Curriculum record unavailable'
        )}
      </p>
    </div>
  )
}

function WorkspaceRail({ view, onChange, resources }) {
  return (
    <aside className="ctm-rail">
      <nav className="ctm-railnav" aria-label="Curriculum workspace views">
        {VIEWS.map((entry) => {
          const Icon = entry.icon
          const active = entry.id === view
          return (
            <button
              key={entry.id}
              type="button"
              className={`ctm-railbtn${active ? ' is-active' : ''}`}
              aria-current={active ? 'page' : undefined}
              onClick={() => onChange(entry.id)}
            >
              <span className="ctm-railbtn-ic" aria-hidden="true">
                <Icon />
              </span>
              <span className="ctm-railbtn-text">
                <span className="ctm-railbtn-label">{entry.label}</span>
                <span className="ctm-railbtn-kicker">{entry.kicker}</span>
              </span>
            </button>
          )
        })}
      </nav>
      <RailContext resources={resources} />
    </aside>
  )
}

function CanvasFrame({ view, children, actions }) {
  const meta = VIEWS.find((entry) => entry.id === view) ?? VIEWS[0]
  return (
    <div className="ctm-view">
      <div className="ctm-view-head">
        <div className="ctm-view-heading">
          <p className="ctm-view-kicker">{meta.kicker}</p>
          <h2 className="ctm-view-title">{meta.label}</h2>
        </div>
        {actions ? <div className="ctm-view-actions">{actions}</div> : null}
      </div>
      <div className="ctm-view-body" key={view}>
        {children}
      </div>
    </div>
  )
}

function AuditPanel({ resources, open, onToggle }) {
  const record = resources.record.data
  const intelligence = resources.intelligence.data
  const gaps = resources.gaps.data
  const proposals = resources.proposals.data

  return (
    <Disclosure
      id="ctm-audit"
      title="Audit &amp; data provenance"
      count="service metadata"
      open={open}
      onToggle={onToggle}
    >
      <div className="ctm-audit">
        <section className="ctm-audit-block">
          <h3 className="ctm-audit-title">Curriculum record</h3>
          {record?.disclaimer ? <p className="ctm-audit-note">{record.disclaimer}</p> : null}
          <Fields>
            <Field label="Record id">{record?.recordId ?? <DashIcon />}</Field>
            <Field label="Kind">{record?.recordKind ?? <DashIcon />}</Field>
            <Field label="Label">{record?.label ?? <DashIcon />}</Field>
            <Field label="Contract version">{record?.contractVersion ?? <DashIcon />}</Field>
            <Field label="Demonstration record">{record?.isDemo ? 'Yes' : record?.isDemo === false ? 'No' : <DashIcon />}</Field>
            <Field label="Vocabulary size">
              <span className="ctm-num">{formatCount(record?.vocabulary?.size ?? null)}</span>
            </Field>
          </Fields>
        </section>

        <section className="ctm-audit-block">
          <h3 className="ctm-audit-title">Coverage basis</h3>
          <Fields>
            <Field label="Gaps endpoint basis" wide>
              {gaps?.coverageBasis ?? <DashIcon />}
            </Field>
            <Field label="Proposals endpoint basis" wide>
              {proposals?.coverageBasis ?? <DashIcon />}
            </Field>
            <Field label="Placement basis" wide>
              {proposals?.placementBasis ?? <DashIcon />}
            </Field>
            <Field label="Prerequisite basis" wide>
              {proposals?.prerequisiteBasis ?? <DashIcon />}
            </Field>
            <Field label="Ordering basis" wide>
              {proposals?.orderingBasis ?? <DashIcon />}
            </Field>
          </Fields>
        </section>

        <section className="ctm-audit-block">
          <h3 className="ctm-audit-title">Industry corpus</h3>
          <Fields>
            <Field label="Artifact">{intelligence?.corpus?.artifact ?? <DashIcon />}</Field>
            <Field label="Postings artifact">{intelligence?.corpus?.postingsArtifact ?? <DashIcon />}</Field>
            <Field label="Rows">
              <span className="ctm-num">{formatCount(intelligence?.corpus?.datasetRows ?? null)}</span>
            </Field>
            <Field label="Date range">
              {formatDate(intelligence?.corpus?.dateMin)} to {formatDate(intelligence?.corpus?.dateMax)}
            </Field>
            <Field label="Role postings">
              <span className="ctm-num">{formatCount(intelligence?.corpus?.rolePostings ?? null)}</span>
            </Field>
            <Field label="Velocity reproducibility">{intelligence?.reproducibility?.status ?? <DashIcon />}</Field>
            <Field label="Plannable role">{intelligence?.plannable ? 'Yes' : 'No'}</Field>
          </Fields>
        </section>

        <section className="ctm-audit-block">
          <h3 className="ctm-audit-title">Classification thresholds</h3>
          <Fields>
            <Field label="Artifact">{intelligence?.thresholds?.artifact ?? <DashIcon />}</Field>
            <Field label="Core minimum frequency">
              <span className="ctm-num">{formatCount(intelligence?.thresholds?.coreMinFrequency ?? null)}</span>
            </Field>
            <Field label="Noise maximum frequency">
              <span className="ctm-num">{formatCount(intelligence?.thresholds?.noiseMaxFrequency ?? null)}</span>
            </Field>
            <Field label="Similarity cutoff">
              <span className="ctm-num">{formatCount(intelligence?.thresholds?.similarityCutoff ?? null)}</span>
            </Field>
          </Fields>
        </section>

        <section className="ctm-audit-block">
          <h3 className="ctm-audit-title">Validation</h3>
          <Fields>
            <Field label="Dangling prerequisites">
              <span className="ctm-num">{formatCount(record?.validation?.danglingPrerequisites?.length)}</span>
            </Field>
            <Field label="Unmatched skills">
              <span className="ctm-num">{formatCount(record?.validation?.unmatchedSkills?.length)}</span>
            </Field>
            <Field label="Courses without recorded skills">
              <span className="ctm-num">{formatCount(record?.validation?.coursesWithoutRecordedSkills?.length)}</span>
            </Field>
            <Field label="Prerequisite cycles">
              <span className="ctm-num">{formatCount(record?.validation?.prerequisiteCycles?.length)}</span>
            </Field>
          </Fields>
        </section>

        <section className="ctm-audit-block">
          <h3 className="ctm-audit-title">Service endpoints</h3>
          <ul className="ctm-audit-endpoints">
            {RESOURCE_KEYS.map((key) => (
              <li key={key}>
                <code className="ctm-code">{ENDPOINT[key]}</code>
              </li>
            ))}
          </ul>
        </section>

        <div className="ctm-audit-flags">
          <NotAvailableList items={record?.notRecorded} title="Not recorded in the curriculum record" />
          <NotAvailableList items={intelligence?.notAvailable} title="Not available in the industry evidence" />
          <NotAvailableList items={proposals?.notAvailable} title="Not available in the proposal set" />
        </div>
      </div>
    </Disclosure>
  )
}

export default function CurriculumTimeMachine() {
  const [role, setRole] = useState(CTM_DEFAULT_ROLE)
  const [view, setView] = useState(VIEWS[0].id)
  const [detail, setDetail] = useState(null)
  const [auditOpen, setAuditOpen] = useState(false)
  const { resources, retry, reload } = useWorkflow(role)

  const closeDrawer = useCallback(() => setDetail(null), [])

  /* Changing the role invalidates anything the reader had open, because the record
     it described was for the previous role. */
  useEffect(() => {
    setDetail(null)
    setAuditOpen(false)
  }, [role])

  const gapLookup = useMemo(() => {
    if (!resources.gaps.data) return new Map()
    const lookup = new Map()
    for (const group of gapGroups(resources.gaps.data)) {
      for (const row of group.rows) if (!lookup.has(row.skill)) lookup.set(row.skill, row)
    }
    return lookup
  }, [resources.gaps.data])

  const inspect = useCallback((payload) => setDetail(payload), [])

  const drawer = (() => {
    if (!detail) return null
    if (detail.kind === 'course') {
      const course = detail.course
      return {
        kicker: 'Curriculum course',
        title: course.name ?? course.courseId,
        subtitle: [course.code, course.credits !== null ? `${formatCount(course.credits)} credits` : null]
          .filter(Boolean)
          .join(' · '),
        body: <CourseDetail course={course} record={resources.record.data} />,
      }
    }
    if (detail.kind === 'semester') {
      return {
        kicker: 'Curriculum semester',
        title: detail.semester.label ?? detail.semester.semesterId,
        subtitle: detail.year?.label,
        body: <SemesterDetail semester={detail.semester} year={detail.year} />,
      }
    }
    if (detail.kind === 'skill') {
      return {
        kicker: 'Industry skill',
        title: detail.skill.name,
        subtitle: detail.skill.classification ? `Recorded as ${detail.skill.classification}` : null,
        body: <SkillDetail skill={detail.skill} />,
      }
    }
    if (detail.kind === 'gap') {
      return {
        kicker: 'Comparison row',
        title: detail.row.skill,
        subtitle: detail.row.coverageStatus,
        body: <GapDetail row={detail.row} />,
      }
    }
    return {
      kicker: 'Recommendation',
      title: detail.row.skill,
      subtitle: detail.row.placementStatus,
      body: <ProposalDetail row={detail.row} />,
    }
  })()

  const canvas = (() => {
    if (view === 'curriculum') {
      return (
        <CurriculumCanvas
          record={resources.record.data}
          status={resources.record.status}
          error={resources.record.error}
          onRetry={() => retry('record')}
          onInspect={inspect}
        />
      )
    }
    if (view === 'evolution') {
      return (
        <EvolutionCanvas
          intelligence={resources.intelligence.data}
          status={resources.intelligence.status}
          error={resources.intelligence.error}
          onRetry={() => retry('intelligence')}
          onInspect={inspect}
        />
      )
    }
    if (view === 'gaps') {
      return (
        <GapCanvas
          gaps={resources.gaps.data}
          status={resources.gaps.status}
          error={resources.gaps.error}
          onRetry={() => retry('gaps')}
          onInspect={inspect}
        />
      )
    }
    if (view === 'proposal') {
      return (
        <ProposalCanvas
          proposals={resources.proposals.data}
          status={resources.proposals.status}
          error={resources.proposals.error}
          onRetry={() => retry('proposals')}
          onInspect={inspect}
          gapLookup={gapLookup}
        />
      )
    }
    return (
      <OverviewCanvas
        record={resources.record.data}
        intelligence={resources.intelligence.data}
        gaps={resources.gaps.data}
        proposals={resources.proposals.data}
        statuses={Object.fromEntries(RESOURCE_KEYS.map((key) => [key, resources[key].status]))}
        onGoTo={setView}
      />
    )
  })()

  return (
    <div className="ctm">
      {/* Same shell as the Evidence subpage: sidebar and main column are siblings
          in one grid, so the rail and the banner start at the same horizontal
          content boundary and the banner lives inside the main column. */}
      <div className="ctm-shell">
        <WorkspaceRail view={view} onChange={setView} resources={resources} />

        <main className="ctm-main">
          <WorkspaceHead role={role} onRoleChange={setRole} resources={resources} />

          <CanvasFrame view={view} actions={<RetryButton onRetry={reload} />}>
            {canvas}
          </CanvasFrame>

          <AuditPanel resources={resources} open={auditOpen} onToggle={() => setAuditOpen((open) => !open)} />
        </main>
      </div>

      {drawer ? (
        <WorkspaceDrawer
          open
          onClose={closeDrawer}
          kicker={drawer.kicker}
          title={drawer.title}
          subtitle={drawer.subtitle}
        >
          {drawer.body}
        </WorkspaceDrawer>
      ) : null}
    </div>
  )
}

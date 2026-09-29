import { useEffect, useId, useMemo, useRef, useState } from 'react'
import './ctm.css'
import {
  CTM_DEFAULT_ROLE,
  CTM_ROLES,
  classificationLabel,
  describeCurriculumError,
  formatCount,
  formatDate,
  formatDelta,
  formatFrequency,
  formatHours,
  formatObservation,
  formatVelocity,
  isAbortError,
  loadCurriculumIntelligence,
  buildReport,
  reportReadiness,
  roleLabel,
  REPORT_STANDING_LIMITATION,
} from '../data/curriculumSource'

/* ---------------------------------------------------------------- icons */
/* 24x24 viewBox, stroke currentColor, hand-authored. No icon library. */

const ICON_ATTRS = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': 'true',
}

const CorpusIcon = () => (
  <svg {...ICON_ATTRS}>
    <ellipse cx="12" cy="6" rx="7.5" ry="3" />
    <path d="M4.5 6v6c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3V6" />
    <path d="M4.5 12v6c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3v-6" />
  </svg>
)

const LayersIcon = () => (
  <svg {...ICON_ATTRS}>
    <path d="M12 3.5 20.5 8 12 12.5 3.5 8z" />
    <path d="M3.5 12.5 12 17l8.5-4.5" strokeWidth="1.4" />
  </svg>
)

const ClockIcon = () => (
  <svg {...ICON_ATTRS}>
    <circle cx="12" cy="12" r="8.4" />
    <path d="M12 7.4V12l3 2.1" />
  </svg>
)

const PathIcon = () => (
  <svg {...ICON_ATTRS}>
    <path d="M5 6.5h5.5a3.5 3.5 0 0 1 0 7H8a3.5 3.5 0 0 0 0 7h11" strokeWidth="1.6" />
    <path d="M16.5 4.5 19.5 7l-3 2.5" strokeWidth="1.6" />
  </svg>
)

const ScaleIcon = () => (
  <svg {...ICON_ATTRS}>
    <path d="M12 3.6v16.8M4.5 8h15" strokeWidth="1.5" />
    <path d="M7.5 4.6 4 11h7zM16.5 4.6 13 11h7z" strokeWidth="1.5" />
  </svg>
)

const InfoIcon = () => (
  <svg {...ICON_ATTRS}>
    <circle cx="12" cy="12" r="8.4" />
    <path d="M12 11v5" strokeWidth="1.6" />
    <path d="M12 8.2h.01" strokeWidth="1.8" />
  </svg>
)

const ChevronIcon = () => (
  <svg {...ICON_ATTRS} strokeWidth="2">
    <path d="M5 9l7 7 7-7" />
  </svg>
)

const ArrowRightIcon = () => (
  <svg {...ICON_ATTRS} strokeWidth="1.6">
    <path d="M4 12h15" />
    <path d="M14.5 7.5 19 12l-4.5 4.5" />
  </svg>
)

const AlertIcon = () => (
  <svg {...ICON_ATTRS}>
    <path d="M12 4.2 21 19.5H3z" />
    <path d="M12 10v4" strokeWidth="1.6" />
    <path d="M12 16.8h.01" strokeWidth="1.8" />
  </svg>
)

const VelocityUpIcon = () => (
  <svg {...ICON_ATTRS} strokeWidth="1.8" viewBox="0 0 24 24">
    <path d="M5 15l4.5-4.5L13 14l6-6" />
    <path d="M19 8h-4.4M19 8v4.4" strokeWidth="1.6" />
  </svg>
)

const VelocityFlatIcon = () => (
  <svg {...ICON_ATTRS} strokeWidth="1.8">
    <path d="M4.5 16.5h6M13 16.5h6.5" />
    <path d="M16.5 13.5l3 3-3 3" strokeWidth="1.6" />
  </svg>
)

const VelocityDownIcon = () => (
  <svg {...ICON_ATTRS} strokeWidth="1.8" viewBox="0 0 24 24">
    <path d="M5 9l4.5 4.5L13 10l6 6" />
    <path d="M19 16h-4.4M19 16v-4.4" strokeWidth="1.6" />
  </svg>
)

/* --------------------------------------------------------- small pieces */

/* Direction is carried three ways: the signed number, the glyph's shape, and
   the tint. Nothing here reduces a recorded score to a verdict, and the word
   beside the number is the label that carries the meaning. */
function VelocityMark({ score, label = 'velocity' }) {
  if (score === null || score === undefined) {
    return (
      <span className="ctm-vmark is-unrecorded">
        <span className="ctm-vmark-dot" aria-hidden="true">
          <svg {...ICON_ATTRS} strokeWidth="2">
            <path d="M6 12h12" />
          </svg>
        </span>
        {label} not recorded
      </span>
    )
  }

  const direction = score > 0 ? 'up' : score < 0 ? 'down' : 'flat'
  const glyph = direction === 'up' ? <VelocityUpIcon /> : direction === 'down' ? <VelocityDownIcon /> : <VelocityFlatIcon />

  return (
    <span className={`ctm-vmark is-${direction}`}>
      <span className="ctm-vmark-dot" aria-hidden="true">
        {glyph}
      </span>
      {label} {formatVelocity(score)}
    </span>
  )
}

function ClassificationChip({ classification, tier }) {
  if (!classification) return null
  return (
    <span className={`ctm-chip is-tier${tier ? `-${tier}` : '-unclassified'}`}>
      {classificationLabel(classification)}
    </span>
  )
}

/* A field the artifacts do not record, stated rather than left blank. */
function NotRecorded({ children = 'not recorded' }) {
  return <span className="ctm-unrecorded">{children}</span>
}

/* ------------------------------------------------------------ page head */

function PageHead({ role, onRoleChange }) {
  return (
    <header className="ctm-head">
      <div className="ctm-head-copy">
        {/* Demoted from h1 to h2: the restored hero banner owns the page h1, and a
            document must not carry two. The kicker is relabelled because the hero
            immediately above it already reads "Curriculum Time Machine" in the
            same pill, and two identical stacked pills is a visible defect. */}
        <span className="ctm-kicker">Recorded record</span>
        <h2 className="ctm-headline">
          What a role asks for, <em>and what changed.</em>
        </h2>
        <p className="ctm-lead">
          Every figure on this page is a recorded count from the cleaned job-posting corpus. This repository holds no
          university, programme, year, credit, or course record, so nothing here describes an existing curriculum.
        </p>
      </div>

      <div className="ctm-rolefield">
        <span className="ctm-rolefield-label" id="ctm-role-label">
          Target role
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
    </header>
  )
}

/* -------------------------------------------------------------- summary */

function Summary({ data }) {
  const { corpus, skills, path } = data
  const frequencyCount = skills.filter((skill) => skill.frequency !== null).length
  const velocityCount = skills.filter((skill) => skill.velocityScore !== null).length

  return (
    <div className="ctm-summary">
      <div className="ctm-summary-card">
        <div className="ctm-summary-top">
          <span className="ctm-summary-icon" aria-hidden="true">
            <CorpusIcon />
          </span>
          <span className="ctm-summary-label">Posting corpus</span>
        </div>
        <span className="ctm-summary-title">{formatCount(corpus.datasetRows)} postings</span>
        <div className="ctm-summary-foot">
          <span className="ctm-summary-detail">
            {formatDate(corpus.dateMin)} to {formatDate(corpus.dateMax)}
          </span>
          <span className="ctm-summary-detail">
            {formatCount(corpus.rolePostings)} in {data.roleLabel}
          </span>
        </div>
      </div>

      <div className="ctm-summary-card">
        <div className="ctm-summary-top">
          <span className="ctm-summary-icon" aria-hidden="true">
            <LayersIcon />
          </span>
          <span className="ctm-summary-label">Skills tracked</span>
        </div>
        <span className="ctm-summary-title">{skills.length} skills</span>
        <div className="ctm-summary-foot">
          <span className="ctm-summary-detail">{frequencyCount} with a recorded frequency</span>
          <span className="ctm-summary-detail">{velocityCount} with a recorded velocity score</span>
        </div>
      </div>

      <div className="ctm-summary-card">
        <div className="ctm-summary-top">
          <span className="ctm-summary-icon" aria-hidden="true">
            <ClockIcon />
          </span>
          <span className="ctm-summary-label">Recorded learning hours</span>
        </div>
        <span className="ctm-summary-title">{formatHours(path.hoursTotal)}</span>
        <div className="ctm-summary-foot">
          <span className="ctm-summary-detail">
            across {path.hoursTotalCount} of {skills.length} tracked skills
          </span>
          <span className="ctm-summary-detail">sum of the recorded per-skill hours</span>
        </div>
      </div>
    </div>
  )
}

/* ----------------------------------------------------------- skill list */

function SkillList({ skills, selectedId, onSelect }) {
  return (
    <section className="ctm-panel ctm-list-panel" aria-labelledby="ctm-list-title">
      <header className="ctm-panel-head">
        <div>
          <span className="ctm-label">
            <span className="ctm-label-ic" aria-hidden="true">
              <LayersIcon />
            </span>
            Skills
          </span>
          <h2 id="ctm-list-title">Recorded skill frequency</h2>
        </div>
        <span className="ctm-count">{skills.length}</span>
      </header>

      <p className="ctm-panel-note">
        Ordered by recorded frequency. <strong>frequency</strong> is the share of this role&rsquo;s postings that mention
        the skill, as a decimal. <strong>hours</strong> is the recorded learning time; where it reads &ldquo;not
        recorded&rdquo;, the artifacts hold none for that skill.
      </p>

      <ol className="ctm-list">
        {skills.map((skill) => {
          const active = skill.id === selectedId
          return (
            <li key={skill.id}>
              <button
                type="button"
                className={`ctm-row${active ? ' is-active' : ''}`}
                onClick={() => onSelect(skill.id)}
                aria-current={active ? 'true' : undefined}
              >
                <span className="ctm-row-rank" aria-hidden="true">
                  {skill.rank}
                </span>
                <span className="ctm-row-name">{skill.name}</span>
                <ClassificationChip classification={skill.classification} tier={skill.tier} />
                <span className="ctm-row-frequency">{formatFrequency(skill.frequency)}</span>
                <span className="ctm-row-hours">
                  {skill.hours === null ? <NotRecorded /> : formatHours(skill.hours)}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

/* --------------------------------------------------------- skill detail */

function DetailSection({ title, children }) {
  return (
    <div className="ctm-detail-section">
      <span className="ctm-detail-label">{title}</span>
      {children}
    </div>
  )
}

function SkillDetail({ skill, thresholds, byName }) {
  if (!skill) {
    return (
      <aside className="ctm-panel ctm-detail" aria-live="polite">
        <p className="ctm-detail-empty">Select a skill to see its recorded frequency, velocity score, hours, and prerequisites.</p>
      </aside>
    )
  }

  return (
    <aside className="ctm-panel ctm-detail" aria-live="polite" key={skill.id}>
      <span className="ctm-label">
        {skill.classification ? `Classified ${classificationLabel(skill.classification)}` : 'Not classified'}
      </span>

      <div className="ctm-detail-head">
        <h3>{skill.name}</h3>
        <span className="ctm-detail-rank">#{skill.rank}</span>
      </div>

      <div className="ctm-detail-meta">
        <ClassificationChip classification={skill.classification} tier={skill.tier} />
        <span className="ctm-chip is-plain">
          frequency <span className="ctm-num">{formatFrequency(skill.frequency)}</span>
        </span>
      </div>

      <div className="ctm-detail-velocity">
        <VelocityMark score={skill.velocityScore} />
      </div>

      <div className="ctm-detail-why">
        <p>
          {skill.baseline && skill.latest
            ? `${formatObservation(skill.baseline)} in ${skill.baseline.timeSlice} became ${formatObservation(skill.latest)} in ${skill.latest.timeSlice}.`
            : 'No velocity score was recorded for this skill, so no movement between the two slices can be stated.'}
        </p>
      </div>

      <DetailSection title="Between the two recorded slices">
        {skill.baseline && skill.latest ? (
          <div className="ctm-slices">
            <div className="ctm-slice">
              <span className="ctm-slice-label">{skill.baseline.timeSlice}</span>
              <span className="ctm-slice-count">{formatObservation(skill.baseline)}</span>
              <span className="ctm-slice-frequency">frequency {formatFrequency(skill.baseline.frequency)}</span>
            </div>
            <span className="ctm-slice-arrow" aria-hidden="true">
              <ArrowRightIcon />
            </span>
            <div className="ctm-slice">
              <span className="ctm-slice-label">{skill.latest.timeSlice}</span>
              <span className="ctm-slice-count">{formatObservation(skill.latest)}</span>
              <span className="ctm-slice-frequency">frequency {formatFrequency(skill.latest.frequency)}</span>
            </div>
            <div className="ctm-slice-delta">
              <span>recorded frequency change</span>
              <span className="ctm-num">{formatDelta(skill.absoluteChange)}</span>
            </div>
          </div>
        ) : (
          <p className="ctm-not-provided">
            The velocity artifact records a score for this skill without the two observations behind it, so the slices
            cannot be shown.
          </p>
        )}
      </DetailSection>

      <DetailSection title="Learning hours">
        {skill.hours === null ? (
          <p className="ctm-not-provided">No learning hours are recorded for this skill in the artifacts.</p>
        ) : (
          <div className="ctm-hours">
            <span className="ctm-hours-value">{formatHours(skill.hours)}</span>
            <span className="ctm-hours-source">
              <span className="ctm-hours-source-label">source</span>
              {skill.hoursSource}
            </span>
          </div>
        )}
      </DetailSection>

      <DetailSection title="Recorded prerequisites">
        {!skill.prerequisitesRecorded ? (
          <p className="ctm-not-provided">
            The prerequisite graph records nothing for this skill, so it is not placed in the learning path.
          </p>
        ) : skill.prerequisites.length === 0 ? (
          <p className="ctm-not-provided">The graph records this skill as a first-stage skill with no prerequisites.</p>
        ) : (
          <ul className="ctm-prereqs">
            {skill.prerequisites.map((prerequisite) => {
              const known = byName.has(prerequisite)
              return (
                <li key={prerequisite} className="ctm-prereq">
                  <span className="ctm-prereq-dot" aria-hidden="true" />
                  {prerequisite}
                  {!known && <span className="ctm-prereq-flag">not a node in this role&rsquo;s graph</span>}
                </li>
              )
            })}
          </ul>
        )}
      </DetailSection>

      <DetailSection title="How this was classified">
        <p className="ctm-not-provided">
          {skill.classification
            ? `The recorded thresholds set core at frequency ${formatFrequency(thresholds.coreMinFrequency)} and noise at ${formatFrequency(thresholds.noiseMaxFrequency)}. This skill sits at ${formatFrequency(skill.frequency)}.`
            : 'No classification threshold was applied to this skill.'}
        </p>
      </DetailSection>
    </aside>
  )
}

/* ---------------------------------------------------------- what changed */

function WhatChanged({ data }) {
  const { change, velocitySlices, corpus, recommendations } = data
  const [from, to] = change.slices.length === 2 ? [change.slices[0], change.slices[1]] : [null, null]

  const direction = useMemo(() => {
    const counts = { higher: 0, lower: 0, unchanged: 0 }
    for (const skill of data.skills) {
      if (skill.absoluteChange === null) continue
      if (skill.absoluteChange > 0) counts.higher += 1
      else if (skill.absoluteChange < 0) counts.lower += 1
      else counts.unchanged += 1
    }
    return counts
  }, [data.skills])

  return (
    <section className="ctm-panel ctm-change" aria-labelledby="ctm-change-title">
      <header className="ctm-panel-head">
        <div>
          <span className="ctm-label">
            <span className="ctm-label-ic" aria-hidden="true">
              <ScaleIcon />
            </span>
            What changed
          </span>
          <h2 id="ctm-change-title">
            {velocitySlices.length === 1 ? velocitySlices[0].replace('->', '→') : 'Between the recorded slices'}
          </h2>
        </div>
        <span className="ctm-count">{change.compared} compared</span>
      </header>

      <p className="ctm-panel-note">
        The corpus holds {corpus.usableSlices.length} half-year slices; the recorded velocity score compares the first
        and the last. Every value below is a recorded count or a recorded frequency decimal, so no growth rate, coverage
        percentage, or curriculum revision is implied.
      </p>

      {from && to ? (
        <div className="ctm-change-grid">
          <div className="ctm-slice">
            <span className="ctm-slice-label">{from.timeSlice}</span>
            <span className="ctm-slice-count">
              {from.totalPostings === null ? <NotRecorded /> : `${formatCount(from.totalPostings)} postings`}
            </span>
            <span className="ctm-slice-frequency">{from.observedSkills} of {data.skills.length} skills observed</span>
          </div>
          <span className="ctm-slice-arrow" aria-hidden="true">
            <ArrowRightIcon />
          </span>
          <div className="ctm-slice">
            <span className="ctm-slice-label">{to.timeSlice}</span>
            <span className="ctm-slice-count">
              {to.totalPostings === null ? <NotRecorded /> : `${formatCount(to.totalPostings)} postings`}
            </span>
            <span className="ctm-slice-frequency">{to.observedSkills} of {data.skills.length} skills observed</span>
          </div>
          <div className="ctm-change-counts">
            <div className="ctm-change-count">
              <span className="ctm-num">{direction.higher}</span>
              <span>frequency higher in {to.timeSlice}</span>
            </div>
            <div className="ctm-change-count">
              <span className="ctm-num">{direction.lower}</span>
              <span>frequency lower in {to.timeSlice}</span>
            </div>
            <div className="ctm-change-count">
              <span className="ctm-num">{direction.unchanged}</span>
              <span>unchanged</span>
            </div>
            {change.unmeasured > 0 && (
              <div className="ctm-change-count">
                <span className="ctm-num">{change.unmeasured}</span>
                <span>not measured in both slices</span>
              </div>
            )}          </div>
        </div>
      ) : (
        <p className="ctm-not-provided">Only one recorded slice is available, so no comparison can be made.</p>
      )}

      {change.movers.length > 0 && (
        <div className="ctm-movers">
          <span className="ctm-detail-label">Largest recorded frequency movement</span>
          <ul className="ctm-mover-list">
            {change.movers.map((skill) => (
              <li key={skill.id} className="ctm-mover">
                <span className="ctm-mover-name">{skill.name}</span>
                <span className="ctm-mover-slices">
                  {skill.baseline.timeSlice} {formatObservation(skill.baseline)} &rarr; {skill.latest.timeSlice}{' '}
                  {formatObservation(skill.latest)}
                </span>
                <span className="ctm-mover-delta ctm-num">{formatDelta(skill.absoluteChange)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {recommendations.insufficient.length > 0 && (
        <div className="ctm-insufficient">
          <span className="ctm-detail-label">Insufficient data</span>
          <p className="ctm-insufficient-note">
            {recommendations.insufficient.length} of {recommendations.total} tracked skills were not observed in both
            recorded slices, so no movement can be stated for them. This is a gap in the record, not a low ranking: an
            absent comparison is not a measurement of a small one.
          </p>
          <ul className="ctm-insufficient-list">
            {recommendations.insufficient.map((entry) => (
              <li key={entry.id} className="ctm-insufficient-row">
                <span className="ctm-insufficient-name">{entry.name}</span>
                <span className="ctm-insufficient-reason">{entry.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

/* -------------------------------------------------------- recommendations
 *
 * Each row states the recorded fields that placed it in this order, so the
 * ordering can be audited against the payload rather than taken on trust. There
 * is no score on the page: a blended priority number would be a value the
 * artifacts never recorded.
 */

function RecommendationBasis({ entry }) {
  return (
    <dl className="ctm-basis">
      <div className="ctm-basis-row">
        <dt>classification</dt>
        <dd>{entry.classification ? classificationLabel(entry.classification) : <NotRecorded />}</dd>
      </div>
      <div className="ctm-basis-row">
        <dt>frequency</dt>
        <dd className="ctm-num">{formatFrequency(entry.frequency)}</dd>
      </div>
      <div className="ctm-basis-row">
        <dt>velocity_score</dt>
        <dd>
          {entry.velocityScore === null ? <NotRecorded /> : <span className="ctm-num">{formatVelocity(entry.velocityScore)}</span>}
        </dd>
      </div>
      <div className="ctm-basis-row">
        <dt>absolute_change</dt>
        <dd>
          {entry.absoluteChange === null ? (
            <NotRecorded />
          ) : (
            <span className="ctm-num">
              {formatDelta(entry.absoluteChange)} <span className="ctm-basis-note">({entry.direction})</span>
            </span>
          )}
        </dd>
      </div>
      <div className="ctm-basis-row">
        <dt>slices</dt>
        <dd>
          {entry.baseline.timeSlice} {formatObservation(entry.baseline)} &rarr; {entry.latest.timeSlice}{' '}
          {formatObservation(entry.latest)}
        </dd>
      </div>
      <div className="ctm-basis-row">
        <dt>hours</dt>
        <dd>
          {entry.hours === null ? <NotRecorded /> : <span className="ctm-num">{formatHours(entry.hours)}</span>}
          {entry.hoursSource && <span className="ctm-basis-note"> · {entry.hoursSource}</span>}
        </dd>
      </div>
      <div className="ctm-basis-row">
        <dt>stage</dt>
        <dd>{entry.stage === null ? <NotRecorded /> : <span className="ctm-num">{entry.stage + 1}</span>}</dd>
      </div>
      <div className="ctm-basis-row">
        <dt>prerequisites</dt>
        <dd>
          {!entry.prerequisitesRecorded ? (
            <NotRecorded />
          ) : entry.prerequisites.length === 0 ? (
            <span className="ctm-basis-note">recorded, none</span>
          ) : (
            <span className="ctm-code">{entry.prerequisites.join(', ')}</span>
          )}
          {entry.danglingPrerequisites.length > 0 && (
            <span className="ctm-basis-note is-warn">
              {' '}
              · not a node in this role&rsquo;s graph: {entry.danglingPrerequisites.join(', ')}
            </span>
          )}
        </dd>
      </div>
    </dl>
  )
}

function Recommendations({ data }) {
  const { recommendations, evidence, roleLabel: label } = data
  const [order, setOrder] = useState(recommendations.recommendations.length)
  const visible = recommendations.recommendations.slice(0, order)
  const all = order >= recommendations.recommendations.length

  return (
    <section className="ctm-panel ctm-recs" aria-labelledby="ctm-recs-title">
      <header className="ctm-panel-head">
        <div>
          <span className="ctm-label">
            <span className="ctm-label-ic" aria-hidden="true">
              <PathIcon />
            </span>
            Recommendations
          </span>
          <h2 id="ctm-recs-title">Order to work through {label} skills</h2>
        </div>
        <span className="ctm-count">{recommendations.placed} of {recommendations.total}</span>
      </header>

      <p className="ctm-panel-note">
        Ordered by recorded prerequisite stage, then by recorded classification (core, mid, noise), then by recorded
        frequency, then by recorded absolute change, then by name. Every step is a field the service returned, and the
        name is a final tiebreak, so the same payload always produces this same list. No score, weight, or blend of the
        fields is applied, because the artifacts do not record one.
      </p>

      {visible.length === 0 ? (
        <p className="ctm-not-provided">
          No skill was observed in both recorded slices, so nothing can be ordered. The {recommendations.insufficient.length}{' '}
          skills without a comparison are listed under insufficient data above.
        </p>
      ) : (
        <>
          <ol className="ctm-rec-list">
            {visible.map((entry) => (
              <li key={entry.id} className="ctm-rec">
                <div className="ctm-rec-head">
                  <span className="ctm-rec-order" aria-hidden="true">
                    {entry.order}
                  </span>
                  <h3 className="ctm-rec-name">{entry.name}</h3>
                  <ClassificationChip classification={entry.classification} tier={entry.tier} />
                  {entry.direction !== 'unchanged' && entry.absoluteChange !== null && (
                    <span className={`ctm-rec-move is-${entry.direction}`}>
                      {formatDelta(entry.absoluteChange)} {entry.direction}
                    </span>
                  )}
                </div>
                <RecommendationBasis entry={entry} />
              </li>
            ))}
          </ol>

          {!all && (
            <button type="button" className="ctm-rec-more" onClick={() => setOrder(recommendations.recommendations.length)}>
              Show all {recommendations.recommendations.length} recommendations
            </button>
          )}
        </>
      )}

      <div className="ctm-rec-evidence">
        <span className="ctm-detail-label">
          <span className="ctm-inline-icon" aria-hidden="true">
            <ScaleIcon />
          </span>
          What this ordering rests on
        </span>
        <p className="ctm-panel-note">
          Frequency, velocity, classification, hours, and the prerequisite graph all come from the same corpus this page
          already reports. The evaluation records behind those fields, and the limits recorded against them, are listed
          in full under limits of this record below.
        </p>
        <ul className="ctm-rec-caveats">
          {evidence.flatMap((record) =>
            record.caveats.map((caveat) => (
              <li key={`${record.id}-${caveat}`} className="ctm-rec-caveat">
                <span className="ctm-rec-caveat-src">{record.label}</span>
                <span>{caveat}</span>
              </li>
            )),
          )}
        </ul>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ report
 *
 * The service has no report endpoint, so this action issues no request. It writes
 * the record the page is already showing to a text file, and the readiness gate
 * says plainly why that is or is not possible. It never fabricates a report, and
 * it never implies a document was stored anywhere it is not.
 */

function ReportSection({ data }) {
  const readiness = useMemo(() => reportReadiness(data), [data])
  const [result, setResult] = useState(null)

  function handleGenerate() {
    const text = buildReport(data)
    const filename = `curriculum-time-machine-${data.role}.txt`
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
    setResult({ filename, lines: text.split('\n').length, bytes: blob.size })
  }

  return (
    <section className="ctm-panel ctm-report" aria-labelledby="ctm-report-title">
      <header className="ctm-panel-head">
        <div>
          <span className="ctm-label">
            <span className="ctm-label-ic" aria-hidden="true">
              <InfoIcon />
            </span>
            Review report
          </span>
          <h2 id="ctm-report-title">
            {readiness.ready ? 'This record is ready to review' : 'This record is not ready to review'}
          </h2>
        </div>
        <span className="ctm-count">{readiness.ready ? 'ready' : 'unavailable'}</span>
      </header>

      <p className="ctm-panel-note">
        The SkillBridge service has no report endpoint, so this action makes no request. It writes the record already on
        this page to a plain text file: the role and corpus, every ranked skill with the recorded fields behind its
        position, the insufficient-data list, the evaluation records and their caveats, and the fields the artifacts do
        not record. Nothing is generated, inferred, or filled in, and the file is saved to your own machine rather than
        stored anywhere.
      </p>

      {!readiness.ready ? (
        <div className="ctm-report-blocked" role="status">
          <span className="ctm-report-blocked-title">Report unavailable</span>
          <ul className="ctm-report-blockers">
            {readiness.blockers.map((blocker) => (
              <li key={blocker}>{blocker}</li>
            ))}
          </ul>
        </div>
      ) : (
        <>
          <div className="ctm-report-manifest">
            <span className="ctm-detail-label">What the file will contain</span>
            <ul className="ctm-report-list">
              <li className="ctm-report-item">
                <span className="ctm-report-item-name">Header and corpus</span>
                <span className="ctm-report-item-body">
                  {data.roleLabel}, {formatCount(data.corpus.datasetRows)} postings,{' '}
                  {formatDate(data.corpus.dateMin)} to {formatDate(data.corpus.dateMax)}, both recorded slices, and the
                  recorded reproducibility status.
                </span>
              </li>
              <li className="ctm-report-item">
                <span className="ctm-report-item-name">Ranked skills</span>
                <span className="ctm-report-item-body">
                  {data.recommendations.placed} skills in the same order shown above, each with its recorded
                  classification, frequency, both slice observations, velocity score, absolute change, hours and hours
                  source, stage, and prerequisites.
                </span>
              </li>
              <li className="ctm-report-item">
                <span className="ctm-report-item-name">Insufficient data</span>
                <span className="ctm-report-item-body">
                  {data.recommendations.insufficient.length} skills with the recorded reason their slices could not be
                  compared.
                </span>
              </li>
              <li className="ctm-report-item">
                <span className="ctm-report-item-name">Evidence and limits</span>
                <span className="ctm-report-item-body">
                  {data.evidence.length} evaluation records with their caveats reproduced verbatim, plus the{' '}
                  {data.notAvailable.length} fields the service names as not in the artifacts.
                </span>
              </li>
            </ul>
          </div>

          {readiness.warnings.length > 0 && (
            <div className="ctm-report-warnings">
              <span className="ctm-detail-label">Read the report with these in view</span>
              <ul className="ctm-report-warn-list">
                {readiness.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          <button type="button" className="ctm-report-generate" onClick={handleGenerate}>
            Generate Curriculum Review Report
          </button>

          <p className="ctm-report-note">{REPORT_STANDING_LIMITATION}</p>

          <p className="ctm-report-result" role="status" aria-live="polite">
            {result
              ? `Saved ${result.filename} to your downloads, ${result.lines} lines, ${result.bytes} bytes. The file is on this machine only; nothing was uploaded.`
              : ''}
          </p>
        </>
      )}
    </section>
  )
}

/* --------------------------------------------------------- learning path */

function LearningPath({ data }) {
  const { path, skills, roleLabel } = data
  const withoutHours = skills.filter((skill) => skill.hours === null).length

  return (
    <section className="ctm-panel ctm-path" aria-labelledby="ctm-path-title">
      <header className="ctm-panel-head">
        <div>
          <span className="ctm-label">
            <span className="ctm-label-ic" aria-hidden="true">
              <PathIcon />
            </span>
            Learning path
          </span>
          <h2 id="ctm-path-title">Recorded prerequisite order for {roleLabel}</h2>
        </div>
        <span className="ctm-count">{formatHours(path.hoursRecorded)} recorded</span>
      </header>

      <p className="ctm-panel-note">
        A stage is the longest recorded prerequisite chain ending at a skill, so a stage is the earliest point the
        recorded graph says a skill can be started. Only skills the graph records are placed; the hours shown are the
        recorded per-skill hours and the source is reproduced verbatim.
      </p>

      {path.stages.length === 0 ? (
        <p className="ctm-detail-empty">The prerequisite graph records no nodes for this role.</p>
      ) : (
        <ol className="ctm-stages">
          {path.stages.map((stage) => (
            <li key={stage.level} className="ctm-stage">
              <div className="ctm-stage-rail" aria-hidden="true">
                <span className="ctm-stage-node">{stage.level + 1}</span>
              </div>
              <div className="ctm-stage-body">
                <span className="ctm-stage-label">Stage {stage.level + 1}</span>
                <ul className="ctm-stage-skills">
                  {stage.skills.map((skill) => (
                    <li key={skill.id} className="ctm-stage-skill">
                      <div className="ctm-stage-skill-head">
                        <span className="ctm-stage-skill-name">{skill.name}</span>
                        <ClassificationChip classification={skill.classification} tier={skill.tier} />
                        <span className="ctm-stage-skill-hours">
                          {skill.hours === null ? <NotRecorded /> : formatHours(skill.hours)}
                        </span>
                      </div>
                      <p className="ctm-stage-skill-after">
                        {skill.prerequisites.length === 0
                          ? 'No recorded prerequisites.'
                          : `After: ${skill.prerequisites.join(', ')}.`}
                      </p>
                      {skill.hoursSource && <p className="ctm-stage-skill-source">{skill.hoursSource}</p>}
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ol>
      )}

      {path.dangling.length > 0 && (
        <div className="ctm-notice">
          <span className="ctm-notice-icon" aria-hidden="true">
            <AlertIcon />
          </span>
          <div>
            <span className="ctm-notice-title">Unresolved prerequisite edges</span>
            <ul className="ctm-notice-list">
              {path.dangling.map((edge) => (
                <li key={`${edge.skill}-${edge.prerequisite}`}>
                  <code className="ctm-code">
                    {String(edge.skill ?? '—')} &rarr; {String(edge.prerequisite ?? '—')}
                  </code>
                  <span>
                    the artifact records this edge, but the prerequisite is not a node in this role&rsquo;s graph, so it
                    contributes no stage
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <p className="ctm-panel-foot">
        {path.unplaced.length} of {skills.length} tracked skills are not in the recorded prerequisite graph, and{' '}
        {withoutHours} of {skills.length} have no recorded learning hours. They are listed in the skill table and left
        unplaced rather than ordered by assumption.
      </p>
    </section>
  )
}

/* ------------------------------------------------------- limits + record */

function Limits({ data, open, onToggle, panelId, buttonId }) {
  return (
    <div className="ctm-disclosure">
      <button
        type="button"
        id={buttonId}
        className={`ctm-disclosure-btn${open ? ' is-open' : ''}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
      >
        <span className="ctm-disclosure-title">
          Limits of this record
          <span className="ctm-disclosure-count">
            {data.evidence.length} evaluation {data.evidence.length === 1 ? 'record' : 'records'} · {data.notAvailable.length}{' '}
            fields not in the artifacts
          </span>
        </span>
        <span className="ctm-disclosure-chevron" aria-hidden="true">
          <ChevronIcon />
        </span>
      </button>

      {open && (
        <div className="ctm-disclosure-panel" id={panelId} role="region" aria-labelledby={buttonId}>
          <div className="ctm-evidence-grid">
            {data.evidence.map((record) => (
              <article key={record.id} className="ctm-evidence">
                <div className="ctm-evidence-head">
                  <span className="ctm-evidence-title">{record.label}</span>
                  <span className={`ctm-chip${record.isSynthetic ? ' is-warn' : ' is-plain'}`}>
                    {record.isSynthetic ? 'synthetic' : 'recorded'}
                  </span>
                </div>
                <p className="ctm-evidence-summary">{record.summary}</p>
                {record.role && <p className="ctm-evidence-scope">Scoped to {roleLabel(record.role)}.</p>}
                {record.source && <p className="ctm-evidence-source">Source: {record.source}</p>}
                {record.caveats.length > 0 && (
                  <ul className="ctm-evidence-caveats">
                    {record.caveats.map((caveat) => (
                      <li key={caveat}>{caveat}</li>
                    ))}
                  </ul>
                )}
                {record.artifactSource && <p className="ctm-evidence-artifact">Artifact: {record.artifactSource}</p>}
              </article>
            ))}
          </div>

          <div className="ctm-limits">
            <span className="ctm-detail-label">
              <span className="ctm-inline-icon" aria-hidden="true">
                <InfoIcon />
              </span>
              Not in the artifacts
            </span>
            <p className="ctm-panel-note">
              The service names these fields explicitly rather than leaving them blank. Nothing on this page is derived
              from them.
            </p>
            <ul className="ctm-limit-list">
              {data.notAvailable.map((field) => (
                <li key={field} className="ctm-limit">
                  {field.replace(/_/g, ' ')}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------- request */

function RequestState({ loading, error, empty }) {
  if (error) {
    return (
      <div className="ctm-status is-error" role="alert">
        <span className="ctm-status-title">{error.title}</span>
        <p className="ctm-status-body">{error.message}</p>
        {error.detail && <p className="ctm-status-note">{error.detail}</p>}
      </div>
    )
  }

  if (loading) {
    return (
      <p className="ctm-status is-loading" aria-live="polite">
        Reading the recorded curriculum intelligence for this role…
      </p>
    )
  }

  if (empty) {
    return (
      <div className="ctm-status is-empty">
        <span className="ctm-status-title">No skills recorded for this role</span>
        <p className="ctm-status-body">
          The service answered with an empty skill list, so there is no frequency, velocity, hours, or prerequisite
          information to show.
        </p>
      </div>
    )
  }

  return null
}

/* ----------------------------------------------------------------- page */

const EMPTY_STATUS = 'not reported'

export default function CurriculumTimeMachine() {
  const [role, setRole] = useState(CTM_DEFAULT_ROLE)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [limitsOpen, setLimitsOpen] = useState(false)

  const requestId = useRef(0)
  const disclosureId = useId()

  useEffect(() => {
    const controller = new AbortController()
    requestId.current += 1
    const current = requestId.current

    setLoading(true)
    setError(null)

    loadCurriculumIntelligence(role, { signal: controller.signal })
      .then((payload) => {
        /* A slower earlier request must not overwrite the newer role's record. */
        if (current !== requestId.current) return
        setData(payload)
        setSelectedId(null)
        setLimitsOpen(false)
      })
      .catch((caught) => {
        if (isAbortError(caught) || current !== requestId.current) return
        setData(null)
        setError(describeCurriculumError(caught))
      })
      .finally(() => {
        if (current !== requestId.current) return
        setLoading(false)
      })

    return () => controller.abort()
  }, [role])

  const ready = data !== null && data.role === role
  const empty = ready && data.skills.length === 0
  const selected = ready && !empty ? data.skills.find((skill) => skill.id === selectedId) ?? data.skills[0] : null

  return (
    <div className="ctm">
      <div className="ctm-inner">
        {/* Hero banner. Restored verbatim from the pre-7B component; the asset was
            never deleted, only the markup that referenced it. It sits at the top of
            the document and the real-data panels flow below it, so it covers the
            illustration only. */}
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
        </div>

        <PageHead role={role} onRoleChange={setRole} />

        <RequestState loading={loading || !ready} error={error} empty={empty} />

        {ready && !empty && (
          <>
            <Summary data={data} />

            <div className="ctm-split">
              <SkillList skills={data.skills} selectedId={selected?.id ?? null} onSelect={setSelectedId} />
              <SkillDetail skill={selected} thresholds={data.thresholds} byName={data.byName} />
            </div>

            <WhatChanged data={data} />

            <Recommendations data={data} />

            <LearningPath data={data} />

            <Limits
              data={data}
              open={limitsOpen}
              onToggle={() => setLimitsOpen((open) => !open)}
              panelId={`${disclosureId}-panel`}
              buttonId={`${disclosureId}-button`}
            />

            <ReportSection data={data} />

            <footer className="ctm-footer">
              <span>
                {data.artifacts.length} artifacts ·{' '}
                {formatDate(data.corpus.dateMin)} to {formatDate(data.corpus.dateMax)}
              </span>
              <span>
                velocity reproducibility {data.reproducibility.status ?? EMPTY_STATUS} ·{' '}
                {formatCount(data.reproducibility.matchedScores)} of {formatCount(data.reproducibility.checkedScores)}{' '}
                scores matched
              </span>
            </footer>
          </>
        )}
      </div>
    </div>
  )
}

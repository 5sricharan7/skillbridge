/**
 * Stage 14C — a learner-asserted skill completion, held for the session only.
 *
 * A learner marks a recommended skill complete. Nothing in this repository can
 * check that they did, so the assertion is recorded as exactly that: the
 * learner's own statement, unverified. `COMPLETION_SOURCE` is
 * `learner_asserted` and `VERIFICATION_STATUS` is `not_verified` on every
 * result, and the two labels below are the words the UI shows beside them.
 *
 * What the assertion does here is narrow. It is added to the learner's skill
 * state, the existing roadmap request runs again with that skill added, and the
 * service measures the model-internal gap-closure delta between the two
 * results. That delta says the engine's own requirement score for one skill
 * moved because the text it was given now names a skill it did not name before.
 * It is not a learner's improvement, not mastery, not employability, not a
 * placement or hiring outcome, and `normalizeCompletionResult` never invents a
 * field that would read as one.
 *
 * ---------------------------------------------------------------------------
 * Stage 14E — the validation panel's content
 * ---------------------------------------------------------------------------
 *
 * The panel's words live here rather than in the component, so there is one place
 * where a label or a figure can be wrong and the labels can be tested without a
 * DOM. Three groups: `completionValidationRows` (the model-internal comparison,
 * which is the useful result), `completionProvenanceRows` (what the assertion is),
 * and `completionObservedRows` (what cannot be reported).
 *
 * The last group is the point of the stage. `observed_gain` and
 * `prediction_error` have no input in this repository, so they are carried as
 * `COMPLETION_NOT_AVAILABLE` and printed as "Not available". They are never
 * derived from `delta`, from `after_score` or from the assertion, and no payload
 * field can turn them into a number — which is why the two are constants in the
 * normalizer rather than reads of the response.
 *
 * ---------------------------------------------------------------------------
 * No persistence
 * ---------------------------------------------------------------------------
 *
 * There is no database in this stage and none is introduced. `createCompletionState`
 * returns a plain object the caller holds for as long as the page is mounted;
 * nothing is written to storage, no cookie is set, and reloading the page starts
 * from nothing. The assertions belong to the learner context they were made in,
 * so changing the target role or the submitted texts drops them
 * (`syncCompletionContext`) rather than carrying them into a comparison they were
 * not made against. The time budget is a planning dial, not learner context, so
 * moving it keeps the assertions and only re-plans the route.
 *
 * This module is deliberately free of imports so it can be exercised on its own:
 * the network call is injected into `createCompletionFlow`, and the service
 * response is validated here so a malformed payload fails in one place instead
 * of at the first field that reads it.
 */

/* ------------------------------------------------------------- provenance */

/** Where a completion came from. A learner statement, never an assessment. */
export const COMPLETION_SOURCE = 'learner_asserted'

/** What has been done to check that statement. Nothing. */
export const VERIFICATION_STATUS = 'not_verified'

/** The label that sits beside a completed stop. */
export const COMPLETION_SOURCE_LABEL = 'Asserted by learner'

/** The secondary line under it, and the tooltip on the action. */
export const COMPLETION_VERIFICATION_NOTE = 'Self-reported; not independently verified.'

/* The action's own words. They live here with the rest of the provenance copy so
 * the panel's text has a single source and the strings a learner reads are
 * testable without a DOM. */

export const COMPLETION_ACTION_LABEL = 'Mark complete'

export const COMPLETION_ACTION_PENDING_LABEL = 'Asserting…'

/** The settled state. The tick is redundant with the word, so the word carries it. */
export const COMPLETION_ASSERTED_LABEL = '✓ Completed'

/** Stated wherever the delta is shown, so the number is never read alone. */
export const COMPLETION_BOUNDARY_NOTE =
  'Model-internal gap-closure delta. Completion was asserted by the learner.'

/* --------------------------------------------------- the missing half (14E) */

/**
 * The machine token for a figure that has no input to be computed from.
 *
 * This is the same string `backend/data/calibration.py` uses, deliberately: the
 * two halves of the Stage 14 loop agree on how absence is spelled, so a payload,
 * a log line and this view model all read the same way.
 *
 * It is never a number. `0` and `0.00` would claim the learner did not improve,
 * which is exactly as unsupported as claiming they did, and `null` renders as
 * nothing at all — which reads as "no change" to anyone scanning the panel.
 */
export const COMPLETION_NOT_AVAILABLE = 'not_available'

/** What the panel prints for {@link COMPLETION_NOT_AVAILABLE}. */
export const COMPLETION_NOT_AVAILABLE_LABEL = 'Not available'

/**
 * Why the observed figures are unavailable, in the words the panel shows.
 *
 * Quoted in the specification and repeated verbatim so the two cannot drift.
 */
export const COMPLETION_OBSERVED_NOTE =
  'Observed learner improvement is not available. The completion was self-reported and is not independently verified.'

/** The two provenance rows under the figures, as label text. */
export const COMPLETION_PROVENANCE_ROWS = Object.freeze({
  source: 'Learner completion: asserted',
  verification: 'Verification: not independently verified',
})

/** The consistency verdict. Text carries the meaning; the glyph is redundant. */
export const COMPLETION_CONSISTENT_LABEL = 'Consistent'
export const COMPLETION_INCONSISTENT_LABEL = 'Not consistent'

/** The figures this stage cannot compute, named so a reader can ask about them. */
export const COMPLETION_OBSERVED_ROWS = Object.freeze([
  Object.freeze({ key: 'observedGain', label: 'Observed learner gain' }),
  Object.freeze({ key: 'predictionError', label: 'Prediction error' }),
])

/* ------------------------------------------------------------ edge results */

/** Reported instead of a number when a figure cannot be measured. */
export const COMPLETION_UNMEASURED = '—'

export const COMPLETION_REJECTED_EMPTY_SKILL = 'empty-skill'
export const COMPLETION_REJECTED_DUPLICATE = 'duplicate'
export const COMPLETION_REJECTED_NO_CONTEXT = 'no-learner-context'

export const COMPLETION_STATUS_COMPLETED = 'completed'
export const COMPLETION_STATUS_ERROR = 'error'
export const COMPLETION_STATUS_STALE = 'stale'

const GAP_STATUS_COPY = {
  already_present:
    'The engine already recorded this skill as present, so there was no recorded gap to close and the score did not move.',
  not_closed: 'The engine did not record this skill as a gap that closed, so there is no closure to report.',
}

/**
 * The claims this stage must never present, however they arrive.
 *
 * A `/skill-completion` payload is fixed by the response schema, so these should
 * not be reachable. They are checked at this boundary anyway, in one place,
 * because the failure this stage exists to prevent is a panel that shows a
 * verified-sounding figure next to a learner assertion — and the cheapest place
 * to stop that is before the payload is read into render state, not after.
 */
export const FORBIDDEN_COMPLETION_KEYS = Object.freeze([
  'verified',
  'actual_gain',
  'actualGain',
  'skill_mastery',
  'skillMastery',
  'learner_improvement',
  'learnerImprovement',
  'employability_score',
  'employabilityScore',
  'placement',
  'hiring',
])

function findForbiddenKey(value, keys, depth = 0) {
  if (depth > 6 || !value || typeof value !== 'object') return null
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findForbiddenKey(entry, keys, depth + 1)
      if (found) return found
    }
    return null
  }
  for (const [key, entry] of Object.entries(value)) {
    if (keys.includes(key)) return key
    const found = findForbiddenKey(entry, keys, depth + 1)
    if (found) return found
  }
  return null
}

/* ------------------------------------------------------------------ errors */

/**
 * A request this module refuses to send or a payload it refuses to read.
 *
 * `kind` is the same vocabulary `careerBridgeSource` uses on its own errors, so
 * the page can hand the value to the existing `describeApiError` copy rather
 * than inventing a second error presentation for completions.
 */
export class CompletionRequestError extends Error {
  constructor(message, { kind = 'invalid-input', path = '/skill-completion' } = {}) {
    super(message)
    this.name = 'CompletionRequestError'
    this.kind = kind
    this.status = 0
    this.path = path
  }
}

/* -------------------------------------------------------------- skill keys */

/**
 * The key one skill is compared and de-duplicated under.
 *
 * Casefold plus collapsed whitespace, matching the key the service normalizes
 * with, so `Machine Learning` and `machine learning` are one completion rather
 * than two clicks the duplicate guard would miss.
 */
export function normalizeCompletionSkill(skill) {
  if (typeof skill !== 'string') return ''
  return skill.trim().toLowerCase().replace(/\s+/g, ' ')
}

function sameContext(left, right) {
  if (!left || !right) return false
  return (
    left.targetRole === right.targetRole &&
    left.resumeText === right.resumeText &&
    left.jdText === right.jdText
  )
}

/* ------------------------------------------------------------------- state */

/**
 * An empty session state: no context, no assertions, nothing stored.
 */
export function createCompletionState() {
  return { context: null, skills: [] }
}

/**
 * Drop assertions that were made in a different learner context.
 *
 * A completion is a claim about this resume, this job description and this
 * target role. When any of them changes the previous claims were made against
 * something else, so they are cleared rather than silently compared against a
 * context they do not belong to.
 */
export function syncCompletionContext(state, context) {
  if (!context || typeof context !== 'object') return state
  if (sameContext(state?.context, context)) return state
  return { context: { ...context }, skills: [] }
}

/** Whether this session already holds an assertion for the skill. */
export function isSkillAsserted(state, skill) {
  const key = normalizeCompletionSkill(skill)
  return key !== '' && (state?.skills ?? []).includes(key)
}

/**
 * Record one assertion, or explain why it was not recorded.
 *
 * Returns the next state rather than mutating, plus `accepted`: false with a
 * reason for a blank name or a skill already asserted in this session, so a
 * duplicate click is ignored before it spends a request.
 *
 * `priorSkills` is what the service needs in order to compose the AFTER text:
 * the skills held *before* this one. The skill being asserted is deliberately
 * excluded, because the service appends it itself and would refuse a request
 * that already listed it as an earlier completion.
 */
export function assertSkillComplete(state, { skill, context }) {
  const synced = syncCompletionContext(state, context)
  const key = normalizeCompletionSkill(skill)

  if (!key) {
    return {
      state: synced,
      priorSkills: assertedSkills(synced),
      accepted: false,
      reason: COMPLETION_REJECTED_EMPTY_SKILL,
      skill: '',
    }
  }
  if (synced.skills.includes(key)) {
    return {
      state: synced,
      priorSkills: assertedSkills(synced),
      accepted: false,
      reason: COMPLETION_REJECTED_DUPLICATE,
      skill: key,
    }
  }

  return {
    state: { ...synced, skills: [...synced.skills, key] },
    priorSkills: assertedSkills(synced),
    accepted: true,
    reason: null,
    skill: key,
  }
}

/** The skill names asserted so far, in the order they were asserted. */
export function assertedSkills(state) {
  return [...(state?.skills ?? [])]
}

/**
 * Why an assertion was not recorded, in the words the page shows.
 *
 * The codes above are what the flow branches on; this is the only place they
 * become sentences, so the page cannot phrase a refusal differently from the one
 * the guard meant. Every message says what was *not* done rather than
 * suggesting the skill is unlearned — nothing here checks that.
 */
export function completionRejectionReason(reason) {
  switch (reason) {
    case COMPLETION_REJECTED_DUPLICATE:
      return 'Already completed in this session.'
    case COMPLETION_REJECTED_EMPTY_SKILL:
      return 'Pick a skill to mark complete.'
    case COMPLETION_REJECTED_NO_CONTEXT:
      return 'Add your resume text and a job description first — there is nothing to compare yet.'
    default:
      return 'That completion was not recorded.'
  }
}

/**
 * The learner's text with the asserted skills appended.
 *
 * Kept next to the state so the caller can read what would be compared without
 * composing it itself. The service composes the same join from the learner's
 * text and `completed_skills`; this is here for inspection and for tests, not as
 * a second place the two texts are decided.
 */
export function resumeTextWithAssertions(resumeText, skills) {
  const base = typeof resumeText === 'string' ? resumeText.trim() : ''
  const additions = assertedSkills({ skills: Array.isArray(skills) ? skills : [] })
  return [base, ...additions].filter(Boolean).join('\n')
}

/* -------------------------------------------------------------- normalizer */

function requireFiniteNumber(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new CompletionRequestError(
      `The service returned a completion without a usable ${field}.`,
      { kind: 'malformed' },
    )
  }
  return value
}

function requireBoolean(value, field) {
  if (typeof value !== 'boolean') {
    throw new CompletionRequestError(
      `The service returned a completion without a usable ${field}.`,
      { kind: 'malformed' },
    )
  }
  return value
}

function formatScore(value) {
  return Number.isFinite(value) ? String(Number(value.toFixed(2))) : COMPLETION_UNMEASURED
}

function formatDelta(value) {
  if (!Number.isFinite(value)) return COMPLETION_UNMEASURED
  const rounded = Number(value.toFixed(2))
  return `${rounded > 0 ? '+' : ''}${rounded}`
}

/**
 * Read one `/skill-completion` response into the shape the panel renders.
 *
 * The two provenance fields are checked rather than assumed: a payload claiming
 * any other completion source or verification status is refused, because a
 * panel that labelled a verified measurement "self-reported" would be the one
 * claim this stage exists to prevent.
 *
 * Only fields the service measured are carried through. No `actualGain`,
 * `employability`, `placement`, `mastery` or `improvement` field is created
 * here, and the figures that were not measured stay `null` and render as the
 * unavailable mark rather than a zero.
 */
export function normalizeCompletionResult(payload, { before = null, after = null } = {}) {
  const skill = normalizeCompletionSkill(payload?.skill)
  if (!skill) {
    throw new CompletionRequestError('The service returned a completion without a skill name.', {
      kind: 'malformed',
    })
  }
  if (payload?.completion_source !== COMPLETION_SOURCE) {
    throw new CompletionRequestError(
      `The service reported completion source ${String(payload?.completion_source)}, not a learner assertion.`,
      { kind: 'malformed' },
    )
  }
  if (payload?.verification_status !== VERIFICATION_STATUS) {
    throw new CompletionRequestError(
      `The service reported verification status ${String(payload?.verification_status)} for a learner-asserted completion.`,
      { kind: 'malformed' },
    )
  }
  if (payload?.is_synthetic !== false) {
    throw new CompletionRequestError(
      'The service returned a synthetic completion, which cannot be presented as a learner assertion.',
      { kind: 'malformed' },
    )
  }
  const forbidden = findForbiddenKey(payload, FORBIDDEN_COMPLETION_KEYS)
  if (forbidden) {
    throw new CompletionRequestError(
      `The service returned a completion carrying ${forbidden}, which this stage cannot present.`,
      { kind: 'malformed' },
    )
  }

  const beforeScore = requireFiniteNumber(payload?.before_score, 'before score')
  const afterScore = requireFiniteNumber(payload?.after_score, 'after score')
  const delta = requireFiniteNumber(payload?.delta, 'delta')
  const predictedGain = requireFiniteNumber(payload?.predicted_gain, 'predicted gain')
  const gapClosed = requireBoolean(payload?.gap_closed, 'gap state')
  const gapStatus = typeof payload?.gap_status === 'string' ? payload.gap_status : 'not_closed'
  const asserted = Array.isArray(payload?.asserted_skills)
    ? payload.asserted_skills.filter((name) => typeof name === 'string')
    : []

  /* Stage 14D. The magnitude behind `matches_predicted_gain`, when the service
   * reports it. A null or non-finite value is treated as unavailable rather than
   * as zero: this field was added after the response shape was pinned, so a
   * payload without it is an older service, and inventing a magnitude for it
   * would be the one figure in this panel that nothing measured. */
  const consistencyError = Number.isFinite(payload?.model_internal_consistency_error)
    ? Number(payload.model_internal_consistency_error)
    : null
  /* The magnitude is authoritative. `matches_predicted_gain` is the fallback and
   * the two can differ: it additionally requires a closure, so a comparison where
   * nothing was expected and nothing moved is consistent but not a match. */
  const isConsistent = consistencyError === null
    ? payload?.matches_predicted_gain === true
    : consistencyError === 0

  return {
    skill,
    label: skill,
    completionSource: COMPLETION_SOURCE,
    verificationStatus: VERIFICATION_STATUS,
    isSynthetic: false,

    sourceLabel: COMPLETION_SOURCE_LABEL,
    verificationNote: COMPLETION_VERIFICATION_NOTE,
    boundaryNote: COMPLETION_BOUNDARY_NOTE,

    beforeScore,
    afterScore,
    delta,
    predictedGain,
    gapClosed,
    gapStatus,
    gapStatusNote: typeof payload?.gap_status_note === 'string' && payload.gap_status_note
      ? payload.gap_status_note
      : (GAP_STATUS_COPY[gapStatus] ?? ''),
    matchesPredictedGain: payload?.matches_predicted_gain === true,

    /* Stage 14D. `delta` above is this signed figure: the model-internal change,
     * named as such in the panel so it cannot be read as a learner gain. */
    modelInternalDelta: delta,
    modelInternalDeltaText: formatDelta(delta),
    consistencyError,
    consistencyErrorText: formatScore(consistencyError),
    isConsistent,
    consistencyLabel: isConsistent
      ? COMPLETION_CONSISTENT_LABEL
      : COMPLETION_INCONSISTENT_LABEL,

    /* Stage 14E. There is no legitimate observed learner outcome anywhere in
     * this flow, so these two are carried as the unavailable token and rendered
     * from that. They are not derived from `delta`, from `after_score`, or from
     * the assertion, and no field of the payload can change them. */
    observedGain: COMPLETION_NOT_AVAILABLE,
    predictionError: COMPLETION_NOT_AVAILABLE,
    observedGainText: COMPLETION_NOT_AVAILABLE_LABEL,
    predictionErrorText: COMPLETION_NOT_AVAILABLE_LABEL,
    observedNote: COMPLETION_OBSERVED_NOTE,

    beforeScoreText: formatScore(beforeScore),
    afterScoreText: formatScore(afterScore),
    deltaText: formatDelta(delta),
    predictedGainText: formatScore(predictedGain),

    assertedSkills: asserted,
    assertionCount: Number.isFinite(payload?.assertion_count) ? payload.assertion_count : asserted.length,

    /* Both plans are preserved as returned. The learner can compare the route
     * they were shown against the one the service re-planned. */
    before,
    after,

    notAMeasureOf: Array.isArray(payload?.not_a_measure_of)
      ? payload.not_a_measure_of.filter((entry) => typeof entry === 'string')
      : [],
  }
}

/* ------------------------------------------------------- the panel's content

   The rows below are the panel's text, built here rather than in the component
   so there is exactly one place where a label or a figure can be wrong, and so
   the labels are testable without a DOM. The component maps over them and adds
   no words of its own.

   `tone` is presentation intent, not a colour: the component decides what
   `consistent` looks like, so the accessibility of that decision stays in one
   stylesheet rather than being spread across inline class logic. */

export function completionValidationRows(result) {
  return [
    { key: 'before', label: 'Before', value: result.beforeScoreText, tone: 'neutral' },
    { key: 'after', label: 'After', value: result.afterScoreText, tone: 'neutral' },
    {
      key: 'delta',
      label: 'Model-internal change',
      value: result.modelInternalDeltaText,
      tone: 'neutral',
    },
    {
      key: 'expected',
      label: 'Expected gap-closure magnitude',
      value: result.predictedGainText,
      tone: 'neutral',
    },
    {
      key: 'consistency',
      label: 'Consistency check',
      /* Text, not only a glyph: the verdict has to survive a screen reader and a
       * monochrome render, so the word is the value and the tick is decoration. */
      value: result.consistencyLabel,
      tone: result.isConsistent ? 'consistent' : 'inconsistent',
    },
    {
      key: 'consistencyError',
      label: 'Consistency error',
      value: result.consistencyErrorText,
      tone: 'neutral',
    },
  ]
}

export function completionProvenanceRows(result) {
  return [
    { key: 'source', label: COMPLETION_PROVENANCE_ROWS.source, value: result.completionSource },
    { key: 'verification', label: COMPLETION_PROVENANCE_ROWS.verification, value: result.verificationStatus },
  ]
}

/** The secondary block: what cannot be reported, and why. */
export function completionObservedRows(result) {
  return COMPLETION_OBSERVED_ROWS.map((row) => ({
    ...row,
    value: result[`${row.key}Text`],
    tone: 'unavailable',
  }))
}

/**
 * Keep one comparison per skill, in the order the learner asserted them.
 *
 * A session can assert several skills, and each one is its own model-internal
 * comparison against the text as it stood at that moment — not a share of a
 * session total. So results are held per skill rather than summed, and a skill
 * already present replaces its earlier entry instead of adding a second row for
 * the same skill.
 *
 * Nothing here aggregates. There is no session score, because the deltas are
 * measured against different texts and adding them would produce a number that
 * corresponds to no comparison the service ever made.
 */
export function mergeCompletionResult(results, result) {
  if (!result) return Array.isArray(results) ? results : []
  const existing = Array.isArray(results) ? results : []
  const index = existing.findIndex((entry) => entry.skill === result.skill)
  if (index === -1) return [...existing, result]
  return existing.map((entry, at) => (at === index ? result : entry))
}

/* ------------------------------------------------------------------- flow */

/**
 * The completion flow, with the service call injected.
 *
 * One `run` is one learner assertion: it records the assertion, re-plans the
 * route with the skill added, and reports what came back. It never retries and
 * never falls back — a failed request is a failed request, and the page shows
 * it through the same error surface as the roadmap.
 *
 * Two guards live here rather than in the component, because both are about the
 * request rather than about rendering:
 *
 *  - **Duplicate.** A skill already asserted in this session is ignored without
 *    spending a request. The second click of a double-click cannot produce a
 *    second measurement.
 *  - **Stale.** A newer assertion supersedes an in-flight one: the older
 *    request is aborted and its result is discarded, so a slow response cannot
 *    overwrite a comparison the learner has already moved past.
 *
 * The flow holds no rendering state. `run` returns the next session state
 * alongside the outcome, and the caller stores it.
 */
export function createCompletionFlow({ submit }) {
  if (typeof submit !== 'function') {
    throw new TypeError('createCompletionFlow requires a submit function.')
  }

  let sequence = 0
  let controller = null

  function supersede() {
    sequence += 1
    const previous = controller
    controller = null
    previous?.abort()
    return sequence
  }

  return {
    /** Abandon any in-flight request without recording anything new. */
    cancel: supersede,

    /**
     * Assert one skill complete.
     *
     * Resolves to `{ state, accepted, reason, status, result?, error? }`.
     * `accepted: false` means nothing was recorded and nothing was sent.
     */
    async run({ state, skill, context, inputs }) {
      /* Checked before anything is recorded: an assertion the service never got
         to compare would leave the session holding a completion no result ever
         described, and the row would read "completed" with nothing behind it. */
      const resumeText = typeof inputs?.resumeText === 'string' ? inputs.resumeText : ''
      const jdText = typeof inputs?.jdText === 'string' ? inputs.jdText : ''
      if (!resumeText.trim() || !jdText.trim()) {
        return {
          state: syncCompletionContext(state, context),
          accepted: false,
          reason: COMPLETION_REJECTED_NO_CONTEXT,
          skill: normalizeCompletionSkill(skill),
        }
      }

      const guard = assertSkillComplete(state, { skill, context })

      if (!guard.accepted) {
        return { state: guard.state, accepted: false, reason: guard.reason, skill: guard.skill }
      }

      const requestId = supersede()
      const active = new AbortController()
      controller = active

      try {
        const result = await submit({
          resumeText,
          jdText,
          budgetHours: inputs?.budgetHours,
          targetRole: inputs?.targetRole,
          skill: guard.skill,
          /* The skills held before this assertion. The service appends this one
             itself, so sending it here would arrive as a duplicate. */
          completedSkills: guard.priorSkills,
          signal: active.signal,
        })

        if (requestId !== sequence) {
          return { state: guard.state, accepted: true, reason: null, skill: guard.skill, status: COMPLETION_STATUS_STALE }
        }

        return {
          state: guard.state,
          accepted: true,
          reason: null,
          skill: guard.skill,
          status: COMPLETION_STATUS_COMPLETED,
          result,
        }
      } catch (error) {
        if (requestId !== sequence) {
          return { state: guard.state, accepted: true, reason: null, skill: guard.skill, status: COMPLETION_STATUS_STALE }
        }

        /* The learner did assert it, so the assertion stays recorded and the
         * skill cannot be asserted twice. What failed is the comparison, and it
         * is reported as exactly that. An abort is the caller's own
         * cancellation, not a service failure. */
        if (error?.name === 'AbortError') {
          return {
            state: guard.state,
            accepted: true,
            reason: null,
            skill: guard.skill,
            status: COMPLETION_STATUS_STALE,
          }
        }

        return {
          state: guard.state,
          accepted: true,
          reason: null,
          skill: guard.skill,
          status: COMPLETION_STATUS_ERROR,
          error,
        }
      } finally {
        if (requestId === sequence) controller = null
      }
    },
  }
}

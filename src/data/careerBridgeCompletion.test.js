/* Stage 14C, verified with Node's built-in test runner rather than a new
   dependency. The flow takes its `submit` by injection, so these tests exercise
   the guards, the request lifecycle and the normalization against a stub â€”
   nothing here starts Vite, reads the filesystem, or touches a service.

   `apiResult()` mirrors a `POST /skill-completion` response from
   `backend/data/completion.py`. If that contract changes, this file fails, which
   is the point of pinning it: the frontend and the service would otherwise drift
   apart silently. */

import test from 'node:test'
import assert from 'node:assert/strict'

import {
  COMPLETION_ACTION_LABEL,
  COMPLETION_ACTION_PENDING_LABEL,
  COMPLETION_ASSERTED_LABEL,
  COMPLETION_BOUNDARY_NOTE,
  COMPLETION_CONSISTENT_LABEL,
  COMPLETION_INCONSISTENT_LABEL,
  COMPLETION_NOT_AVAILABLE,
  COMPLETION_NOT_AVAILABLE_LABEL,
  COMPLETION_OBSERVED_NOTE,
  COMPLETION_PROVENANCE_ROWS,
  COMPLETION_REJECTED_DUPLICATE,
  COMPLETION_REJECTED_EMPTY_SKILL,
  COMPLETION_REJECTED_NO_CONTEXT,
  COMPLETION_SOURCE,
  COMPLETION_SOURCE_LABEL,
  COMPLETION_STATUS_COMPLETED,
  COMPLETION_STATUS_ERROR,
  COMPLETION_STATUS_STALE,
  COMPLETION_VERIFICATION_NOTE,
  CompletionRequestError,
  FORBIDDEN_COMPLETION_KEYS,
  VERIFICATION_STATUS,
  assertSkillComplete,
  assertedSkills,
  completionObservedRows,
  completionProvenanceRows,
  completionRejectionReason,
  completionValidationRows,
  createCompletionFlow,
  createCompletionState,
  mergeCompletionResult,
  normalizeCompletionResult,
  resumeTextWithAssertions,
} from './careerBridgeCompletion.js'

const CONTEXT = { targetRole: 'data_science', resumeText: 'Java and SQL', jdText: 'Python role' }
const INPUTS = { resumeText: 'Java and SQL', jdText: 'Python role', budgetHours: 60, targetRole: 'data_science' }

function apiResult(overrides = {}) {
  return {
    skill: 'python',
    completion_source: 'learner_asserted',
    verification_status: 'not_verified',
    is_synthetic: false,
    before_score: 0.52,
    after_score: 0.12,
    delta: -0.4,
    predicted_gain: 0.4,
    gap_closed: true,
    gap_status: 'closed',
    gap_status_note: '',
    matches_predicted_gain: false,
    model_internal_consistency_error: 0,
    before_budget_hours: 60,
    after_budget_hours: 60,
    before_roadmap: [{ skill: 'python', hours: 40 }],
    after_roadmap: [{ skill: 'sql', hours: 20 }],
    target_role: 'data_science',
    asserted_skills: ['python'],
    assertion_count: 1,
    not_a_measure_of: ['actual_gain'],
    ...overrides,
  }
}

/* The provenance constants are the contract this stage exists to hold, so they
   are asserted by value rather than by shape: a label that drifts becomes a
   claim nobody approved. */
test('the provenance constants are the agreed strings and nothing else', () => {
  assert.equal(COMPLETION_SOURCE, 'learner_asserted')
  assert.equal(VERIFICATION_STATUS, 'not_verified')
  assert.equal(COMPLETION_SOURCE_LABEL, 'Asserted by learner')
  assert.equal(COMPLETION_VERIFICATION_NOTE, 'Self-reported; not independently verified.')
})

test('the boundary note names the delta as model-internal', () => {
  assert.match(COMPLETION_BOUNDARY_NOTE, /model-internal/i)
  assert.match(COMPLETION_BOUNDARY_NOTE, /asserted by the learner/i)
})

test('the forbidden keys cover the claims this stage must not make', () => {
  for (const key of ['verified', 'actual_gain', 'skill_mastery', 'employability_score', 'placement']) {
    assert.ok(FORBIDDEN_COMPLETION_KEYS.includes(key), `${key} must be refused`)
  }
})

/* ---------------------------------------------------------------- state */

test('a new session asserts nothing', () => {
  const state = createCompletionState()

  assert.deepEqual(assertedSkills(state), [])
  assert.equal(state.context, null)
})

test('an assertion is recorded once and a second one for the same skill is refused', () => {
  const first = assertSkillComplete(createCompletionState(), { skill: 'Python', context: CONTEXT })

  assert.equal(first.accepted, true)
  assert.deepEqual(assertedSkills(first.state), ['python'])

  const second = assertSkillComplete(first.state, { skill: 'PYTHON  ', context: CONTEXT })

  assert.equal(second.accepted, false)
  assert.equal(second.reason, COMPLETION_REJECTED_DUPLICATE)
  assert.deepEqual(assertedSkills(second.state), ['python'])
})

test('a blank skill name is refused and records nothing', () => {
  const outcome = assertSkillComplete(createCompletionState(), { skill: '   ', context: CONTEXT })

  assert.equal(outcome.accepted, false)
  assert.equal(outcome.reason, COMPLETION_REJECTED_EMPTY_SKILL)
  assert.deepEqual(assertedSkills(outcome.state), [])
})

test('distinct skills accumulate in the order they were asserted', () => {
  const one = assertSkillComplete(createCompletionState(), { skill: 'Python', context: CONTEXT })
  const two = assertSkillComplete(one.state, { skill: 'SQL', context: CONTEXT })

  assert.deepEqual(assertedSkills(two.state), ['python', 'sql'])
})

test('changing the learner context drops claims made in the previous one', () => {
  const held = assertSkillComplete(createCompletionState(), { skill: 'Python', context: CONTEXT }).state

  const moved = assertSkillComplete(held, {
    skill: 'SQL',
    context: { ...CONTEXT, targetRole: 'devops' },
  })

  assert.deepEqual(assertedSkills(moved.state), ['sql'])
})

test('priorSkills excludes the skill being asserted', () => {
  const held = assertSkillComplete(createCompletionState(), { skill: 'Python', context: CONTEXT }).state
  const next = assertSkillComplete(held, { skill: 'SQL', context: CONTEXT })

  assert.deepEqual(next.priorSkills, ['python'])
  assert.deepEqual(assertedSkills(next.state), ['python', 'sql'])
})

/* ------------------------------------------------------ request composition */

test('assertions join the learner text the way the service joins them', () => {
  assert.equal(resumeTextWithAssertions('Java', ['python']), 'Java\npython')
  assert.equal(resumeTextWithAssertions('Java', []), 'Java')
  assert.equal(resumeTextWithAssertions('Java', undefined), 'Java')
})

/* -------------------------------------------------------- normalization */

test('a service payload becomes a render-ready result', () => {
  const result = normalizeCompletionResult(apiResult(), {
    before: [{ skill: 'python' }],
    after: [{ skill: 'sql' }],
  })

  assert.equal(result.label, 'python')
  assert.equal(result.completionSource, COMPLETION_SOURCE)
  assert.equal(result.verificationStatus, VERIFICATION_STATUS)
  assert.equal(result.isSynthetic, false)
  assert.equal(result.beforeScoreText, '0.52')
  assert.equal(result.afterScoreText, '0.12')
  assert.equal(result.deltaText, '-0.4')
  assert.equal(result.predictedGainText, '0.4')
  assert.equal(result.gapClosed, true)
  assert.equal(result.assertionCount, 1)
  assert.equal(result.boundaryNote, COMPLETION_BOUNDARY_NOTE)
  assert.deepEqual(result.before, [{ skill: 'python' }])
  assert.deepEqual(result.after, [{ skill: 'sql' }])
  assert.deepEqual(result.notAMeasureOf, ['actual_gain'])
})

test('the result carries no field that could read as a verified gain', () => {
  const result = normalizeCompletionResult(apiResult())

  for (const key of FORBIDDEN_COMPLETION_KEYS) {
    assert.equal(Object.hasOwn(result, key), false, `${key} must not reach render state`)
  }
})

test('a payload carrying a verified-sounding claim is refused rather than shown', () => {
  assert.throws(() => normalizeCompletionResult(apiResult({ actual_gain: 0.4 })), CompletionRequestError)
  assert.throws(() => normalizeCompletionResult(apiResult({ verified: true })), CompletionRequestError)
  assert.throws(
    () => normalizeCompletionResult(apiResult({ not_a_measure_of: ['actual_gain'], verified: true })),
    CompletionRequestError,
  )
})

test('a payload that is not a learner assertion is refused', () => {
  assert.throws(() => normalizeCompletionResult(apiResult({ completion_source: 'measured' })), CompletionRequestError)
  assert.throws(() => normalizeCompletionResult(apiResult({ verification_status: 'verified' })), CompletionRequestError)
  assert.throws(() => normalizeCompletionResult(apiResult({ is_synthetic: true })), CompletionRequestError)
})

test('a payload without a measurable figure is refused rather than shown as zero', () => {
  assert.throws(() => normalizeCompletionResult(apiResult({ delta: null })), CompletionRequestError)
  assert.throws(() => normalizeCompletionResult(apiResult({ before_score: null })), CompletionRequestError)
  assert.throws(() => normalizeCompletionResult(apiResult({ predicted_gain: undefined })), CompletionRequestError)
  assert.throws(() => normalizeCompletionResult(apiResult({ gap_closed: 'yes' })), CompletionRequestError)
  assert.throws(() => normalizeCompletionResult(apiResult({ skill: '  ' })), CompletionRequestError)
})

test('a gap that stayed open is reported in words rather than implied closed', () => {
  const result = normalizeCompletionResult(apiResult({ gap_closed: false, gap_status: 'not_closed' }), {
    before: [],
    after: [],
  })

  assert.equal(result.gapClosed, false)
  assert.match(result.gapStatusNote, /did not record/i)
})

/* ------------------------------------------------------------ the flow */

test('the flow records the assertion, returns the replanned route and the comparison', async () => {
  const flow = createCompletionFlow({
    submit: async (request) =>
      normalizeCompletionResult(apiResult(), { after: request.afterRoadmap }),
  })

  const outcome = await flow.run({
    state: createCompletionState(),
    skill: 'Python',
    context: CONTEXT,
    inputs: INPUTS,
  })

  assert.equal(outcome.accepted, true)
  assert.equal(outcome.status, COMPLETION_STATUS_COMPLETED)
  assert.equal(outcome.result.label, 'python')
  assert.equal(outcome.result.verificationStatus, VERIFICATION_STATUS)
  assert.deepEqual(assertedSkills(outcome.state), ['python'])
})

test('the service is sent the skills held before this assertion, never this one', async () => {
  let seen = null
  const flow = createCompletionFlow({
    submit: async (request) => {
      seen = request
      return normalizeCompletionResult(apiResult())
    },
  })

  const held = assertSkillComplete(createCompletionState(), { skill: 'Python', context: CONTEXT }).state
  await flow.run({ state: held, skill: 'SQL', context: CONTEXT, inputs: INPUTS })

  assert.deepEqual(seen.completedSkills, ['python'])
  assert.equal(seen.skill, 'sql')
})

test('a duplicate assertion spends nothing and changes nothing', async () => {
  let calls = 0
  const flow = createCompletionFlow({
    submit: async () => {
      calls += 1
      return normalizeCompletionResult(apiResult())
    },
  })

  const held = assertSkillComplete(createCompletionState(), { skill: 'Python', context: CONTEXT }).state
  const outcome = await flow.run({ state: held, skill: 'Python', context: CONTEXT, inputs: INPUTS })

  assert.equal(outcome.accepted, false)
  assert.equal(outcome.reason, COMPLETION_REJECTED_DUPLICATE)
  assert.equal(calls, 0)
  assert.deepEqual(assertedSkills(outcome.state), ['python'])
})

test('a second assertion while one is in flight supersedes the first', async () => {
  const flow = createCompletionFlow({
    submit: async (request) => {
      await new Promise((resolve) => setTimeout(resolve, request.skill === 'python' ? 40 : 1))
      return normalizeCompletionResult(apiResult({ skill: request.skill, asserted_skills: [request.skill] }))
    },
  })

  const outcomes = await Promise.all([
    flow.run({ state: createCompletionState(), skill: 'Python', context: CONTEXT, inputs: INPUTS }),
    flow.run({ state: createCompletionState(), skill: 'SQL', context: CONTEXT, inputs: INPUTS }),
  ])

  const completed = outcomes.filter((entry) => entry.status === COMPLETION_STATUS_COMPLETED)
  const stale = outcomes.filter((entry) => entry.status === COMPLETION_STATUS_STALE)

  assert.equal(completed.length, 1)
  assert.equal(completed[0].result.label, 'sql')
  assert.equal(stale.length, 1)
  assert.equal(stale[0].result, undefined)
})

test('with no text to compare against, the assertion is not recorded', async () => {
  let calls = 0
  const flow = createCompletionFlow({
    submit: async () => {
      calls += 1
      return normalizeCompletionResult(apiResult())
    },
  })

  const outcome = await flow.run({
    state: createCompletionState(),
    skill: 'Python',
    context: { ...CONTEXT, resumeText: '' },
    inputs: { ...INPUTS, resumeText: '' },
  })

  assert.equal(outcome.accepted, false)
  assert.equal(outcome.reason, COMPLETION_REJECTED_NO_CONTEXT)
  assert.equal(calls, 0)
  assert.deepEqual(assertedSkills(outcome.state), [])
})

test('a failed comparison keeps the assertion and reports the failure', async () => {
  const failure = new CompletionRequestError('The service could not compare this completion.', {
    kind: 'invalid-input',
    path: '/skill-completion',
  })
  const flow = createCompletionFlow({
    submit: async () => {
      throw failure
    },
  })

  const outcome = await flow.run({ state: createCompletionState(), skill: 'Python', context: CONTEXT, inputs: INPUTS })

  assert.equal(outcome.accepted, true)
  assert.equal(outcome.status, COMPLETION_STATUS_ERROR)
  assert.equal(outcome.error, failure)
  assert.equal(outcome.result, undefined)
  /* The learner did assert it, so it stays held and cannot be asserted twice;
     only the comparison is missing. */
  assert.deepEqual(assertedSkills(outcome.state), ['python'])
})

test('cancel stops an in-flight comparison from settling as a result', async () => {
  const flow = createCompletionFlow({
    submit: async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
      return normalizeCompletionResult(apiResult())
    },
  })

  const pending = flow.run({ state: createCompletionState(), skill: 'Python', context: CONTEXT, inputs: INPUTS })
  flow.cancel()

  const outcome = await pending

  assert.equal(outcome.status, COMPLETION_STATUS_STALE)
  assert.equal(outcome.result, undefined)
})

test('a flow cannot be built without a submit function', () => {
  assert.throws(() => createCompletionFlow({}), TypeError)
})

/* -------------------------------------------------------------- wording */

test('the rejection copy is a sentence and says what was not done', () => {
  for (const reason of [COMPLETION_REJECTED_DUPLICATE, COMPLETION_REJECTED_EMPTY_SKILL, COMPLETION_REJECTED_NO_CONTEXT]) {
    const message = completionRejectionReason(reason)

    assert.equal(typeof message, 'string')
    assert.ok(message.endsWith('.'), `${reason} must be a sentence`)
  }

  assert.match(completionRejectionReason(COMPLETION_REJECTED_DUPLICATE), /already completed/i)
  assert.match(completionRejectionReason(COMPLETION_REJECTED_EMPTY_SKILL), /pick a skill/i)
  assert.match(completionRejectionReason(COMPLETION_REJECTED_NO_CONTEXT), /nothing to compare/i)
  /* None of them tell the learner the skill is unlearned â€” nothing checks that. */
  assert.doesNotMatch(completionRejectionReason(COMPLETION_REJECTED_DUPLICATE), /not (yet )?complete|haven't/i)
})
/* =============================================================================
   Stage 14E — the validation panel's content
   =============================================================================

   The panel is a pure function of the normalized result, so its text is built in
   `careerBridgeCompletion.js` and asserted here. That covers what the DOM will
   receive — every label and every value — without a DOM, which matters because
   this stage ships no jsdom and runs no browser. What is NOT covered here is the
   rendered layout, the responsive stacking and the focus ring; those need a
   browser and are stated as unverified rather than assumed.

   The refusal assertions are the substance. The panel shows four figures and two
   absences, and the absences are the part that could quietly become claims. */

const rowsByKey = (rows) => Object.fromEntries(rows.map((row) => [row.key, row]))
const allText = (rows) => rows.flatMap((row) => [row.label, row.value]).join(' ')

function validated(overrides = {}) {
  return normalizeCompletionResult(apiResult(overrides))
}

/* ------------------------------------------------------------ 1. the action */

test('14e-01 the action offers to mark a skill complete', () => {
  assert.equal(COMPLETION_ACTION_LABEL, 'Mark complete')
  /* The pending label is the same verb, so the control never changes identity
     mid-request — the button is the same button, only disabled. */
  assert.equal(COMPLETION_ACTION_PENDING_LABEL, 'Asserting…')
})

test('14e-02 the settled state says completed', () => {
  assert.equal(COMPLETION_ASSERTED_LABEL, '✓ Completed')
})

test('14e-03 the completed state is labelled as asserted by the learner', () => {
  assert.equal(COMPLETION_SOURCE_LABEL, 'Asserted by learner')
  assert.equal(validated().sourceLabel, COMPLETION_SOURCE_LABEL)
})

test('14e-04 the completed state says it is not independently verified', () => {
  assert.match(COMPLETION_VERIFICATION_NOTE, /not independently verified/i)
  assert.equal(validated().verificationNote, COMPLETION_VERIFICATION_NOTE)
})

/* The four forbidden words. A panel that claims any of them is claiming
   something this repository cannot know, so they are pinned by value rather than
   searched for, which would also catch them inside a legitimate negation. */
test('14e-04b no label or note claims the forbidden four', () => {
  const result = validated()
  const spoken = [
    COMPLETION_ACTION_LABEL,
    COMPLETION_ACTION_PENDING_LABEL,
    COMPLETION_ASSERTED_LABEL,
    COMPLETION_SOURCE_LABEL,
    COMPLETION_VERIFICATION_NOTE,
    COMPLETION_BOUNDARY_NOTE,
    COMPLETION_OBSERVED_NOTE,
    ...Object.values(COMPLETION_PROVENANCE_ROWS),
    ...allText(completionValidationRows(result)).split(' '),
    ...allText(completionObservedRows(result)).split(' '),
  ].join(' ')

  for (const claim of ['mastered', 'mastery', 'improved', 'learned']) {
    assert.doesNotMatch(spoken, new RegExp(claim, 'i'), `"${claim}" must not be claimed`)
  }
})

/* -------------------------------------------------------- 2. the four figures */

test('14e-05 the panel shows the before score', () => {
  const result = validated()
  const rows = rowsByKey(completionValidationRows(result))

  assert.equal(rows.before.label, 'Before')
  assert.equal(rows.before.value, '0.52')
})

test('14e-06 the panel shows the after score', () => {
  const rows = rowsByKey(completionValidationRows(validated()))

  assert.equal(rows.after.label, 'After')
  assert.equal(rows.after.value, '0.12')
})

test('14e-07 the model-internal change is shown as a signed figure', () => {
  const result = validated()
  const rows = rowsByKey(completionValidationRows(result))

  assert.equal(rows.delta.label, 'Model-internal change')
  assert.equal(rows.delta.value, '-0.4')
  /* It is the same signed number the service measured, under the name that says
     whose arithmetic it is. */
  assert.equal(result.modelInternalDelta, -0.4)
})

test('14e-08 the consistency error is shown, and so is the verdict', () => {
  const rows = rowsByKey(completionValidationRows(validated()))

  assert.equal(rows.consistencyError.label, 'Consistency error')
  assert.equal(rows.consistencyError.value, '0')
  assert.equal(rows.consistency.label, 'Consistency check')
  assert.equal(rows.consistency.value, COMPLETION_CONSISTENT_LABEL)
})

test('14e-08b a result that does not match the model says so in words', () => {
  const rows = rowsByKey(completionValidationRows(validated({ model_internal_consistency_error: 0.24 })))

  /* Text, not only a tint: the word is the answer and the class is decoration. */
  assert.equal(rows.consistency.value, COMPLETION_INCONSISTENT_LABEL)
  assert.equal(rows.consistency.tone, 'inconsistent')
  assert.equal(rows.consistencyError.value, '0.24')
})

test('14e-08c the consistency error is the magnitude, not the boolean', () => {
  /* The two are deliberately allowed to differ. `matches_predicted_gain` also
     requires a closure, so a comparison where nothing was expected and nothing
     moved is consistent but is not a match. */
  const result = validated({ gap_closed: false, delta: 0, predicted_gain: 0, model_internal_consistency_error: 0 })

  assert.equal(result.isConsistent, true)
  assert.equal(result.matchesPredictedGain, false)
})

test('14e-08d an unreported consistency error is unavailable, not zero', () => {
  /* An older service omits the field. Inventing a magnitude for it would be the
     one figure in this panel that nothing measured. */
  const payload = apiResult()
  delete payload.model_internal_consistency_error
  const rows = rowsByKey(completionValidationRows(normalizeCompletionResult(payload)))

  assert.equal(rows.consistencyError.value, '—')
})

test('14e-08e the expected magnitude is named for what it is', () => {
  const rows = rowsByKey(completionValidationRows(validated()))

  assert.equal(rows.expected.label, 'Expected gap-closure magnitude')
  assert.equal(rows.expected.value, '0.4')
  /* Not "gain": the figure is what the model expected, not something earned. */
  assert.doesNotMatch(rows.expected.label, /gain/i)
})

/* ------------------------------------------- 3. the observed-outcome boundary */

test('14e-09 the observed learner gain reports as not available', () => {
  const rows = rowsByKey(completionObservedRows(validated()))

  assert.equal(rows.observedGain.label, 'Observed learner gain')
  assert.equal(rows.observedGain.value, COMPLETION_NOT_AVAILABLE_LABEL)
  assert.equal(rows.observedGain.value, 'Not available')
})

test('14e-10 the prediction error reports as not available', () => {
  const rows = rowsByKey(completionObservedRows(validated()))

  assert.equal(rows.predictionError.label, 'Prediction error')
  assert.equal(rows.predictionError.value, COMPLETION_NOT_AVAILABLE_LABEL)
})

test('14e-10b unavailable is a token, not a number and not an absence', () => {
  const result = validated()

  assert.equal(COMPLETION_NOT_AVAILABLE, 'not_available')
  assert.equal(result.observedGain, COMPLETION_NOT_AVAILABLE)
  assert.equal(result.predictionError, COMPLETION_NOT_AVAILABLE)

  /* Zero would claim the learner did not improve, which is as unsupported as
     claiming they did. Null would render as nothing, which reads as "no change". */
  for (const value of [result.observedGain, result.predictionError]) {
    assert.equal(typeof value, 'string')
    assert.notEqual(value, 0)
    assert.notEqual(value, '0')
    assert.notEqual(value, '0.00')
    assert.notEqual(value, null)
  }
})

test('14e-10c no payload field can turn the unavailable figures into numbers', () => {
  /* Every plausible source of a substitute, in one place. `delta`,
   * `after_score` and the assertion are all refused as observed gains — feeding
   * the model's own delta back would make every prediction perfect. */
  const attempts = [
    apiResult(),
    apiResult({ observed_gain: 0.4 }),
    apiResult({ actual_gain: 0.4 }),
    apiResult({ learner_improvement: 0.4 }),
    apiResult({ prediction_error: 0 }),
    apiResult({ after_score: 0.9 }),
  ]

  for (const payload of attempts) {
    let result
    try {
      result = normalizeCompletionResult(payload)
    } catch (error) {
      /* A payload carrying a forbidden claim is refused outright, which is also
         an acceptable outcome: it never reaches a panel. */
      assert.ok(error instanceof CompletionRequestError)
      continue
    }

    assert.equal(result.observedGain, COMPLETION_NOT_AVAILABLE, 'observed gain stayed unavailable')
    assert.equal(result.predictionError, COMPLETION_NOT_AVAILABLE, 'prediction error stayed unavailable')
    assert.equal(completionObservedRows(result).every((row) => row.value === 'Not available'), true)
  }
})

test('14e-10d the boundary says why in the agreed words', () => {
  assert.equal(
    COMPLETION_OBSERVED_NOTE,
    'Observed learner improvement is not available. The completion was self-reported and is not independently verified.',
  )
  assert.equal(validated().observedNote, COMPLETION_OBSERVED_NOTE)
})

/* ------------------------------------------------ 4. no misleading analytics */

test('14e-11 the panel draws no percentage, chart or progress figure', () => {
  const result = validated()
  const spoken = [
    ...allText(completionValidationRows(result)).split(' '),
    ...allText(completionObservedRows(result)).split(' '),
    ...Object.values(COMPLETION_PROVENANCE_ROWS),
  ].join(' ')

  assert.doesNotMatch(spoken, /%/)
  assert.doesNotMatch(spoken, /\b\d+\s*(percent|pct)\b/i)
  /* The forbidden analytics words, which are the ones a progress bar implies. */
  for (const claim of ['accuracy', 'learning gain', 'progress']) {
    assert.doesNotMatch(spoken, new RegExp(claim, 'i'), `"${claim}" must not appear`)
  }
})

test('14e-11b the panel has no series, so there is nothing to chart', () => {
  /* A chart needs at least two points per axis. The panel holds one comparison
     per skill, which is the reason it is a before/after row and not a chart.
     The two plans are the roadmap the learner is shown, not a series of
     measurements, and they are null unless the caller passes them. */
  const result = validated()

  assert.equal(result.before, null)
  assert.equal(result.after, null)
  assert.equal(completionValidationRows(result).length, 6)

  const withPlans = normalizeCompletionResult(apiResult(), {
    before: [{ skill: 'python', hours: 40 }],
    after: [{ skill: 'sql', hours: 20 }],
  })
  /* Nothing in the result is an array of bare figures to plot. */
  for (const [key, value] of Object.entries(withPlans)) {
    if (Array.isArray(value)) {
      assert.ok(
        !value.some((entry) => typeof entry === 'number'),
        `${key} must not hold a series of figures`,
      )
    }
  }
})

/* -------------------------------------------- 5. several completions, one each */

test('14e-12 each asserted skill keeps its own comparison', () => {
  const python = validated()
  const sql = normalizeCompletionResult(
    apiResult({ skill: 'sql', before_score: 0.9, after_score: 0.5, delta: -0.4 }),
  )

  const merged = mergeCompletionResult([], python)
  const both = mergeCompletionResult(merged, sql)

  assert.deepEqual(both.map((entry) => entry.skill), ['python', 'sql'])
})

test('14e-12b a repeated skill replaces its row instead of adding one', () => {
  const first = validated()
  const again = normalizeCompletionResult(apiResult({ before_score: 0.11 }))

  const merged = mergeCompletionResult([first], again)

  assert.equal(merged.length, 1)
  assert.equal(merged[0].beforeScore, 0.11)
})

test('14e-12c results are never summed into a session figure', () => {
  const python = validated()
  const sql = normalizeCompletionResult(apiResult({ skill: 'sql', delta: -0.2 }))
  const both = mergeCompletionResult(mergeCompletionResult([], python), sql)

  /* Each delta was measured against a different text, so their sum corresponds
     to no comparison the service ever made. */
  assert.deepEqual(both.map((entry) => entry.delta), [-0.4, -0.2])
  for (const entry of both) {
    for (const key of ['totalDelta', 'sessionDelta', 'overallScore', 'totalGain', 'score']) {
      assert.equal(Object.hasOwn(entry, key), false, `${key} would be an invented aggregate`)
    }
  }
})

test('14e-12d the completed-skill state is untouched by keeping a result', () => {
  const state = createCompletionState()
  const outcome = assertSkillComplete(state, { skill: 'python', context: CONTEXT })

  assert.equal(outcome.accepted, true)
  assert.deepEqual(assertedSkills(outcome.state), ['python'])

  /* Keeping a comparison is a separate record from asserting a skill: merging a
     result into the panels cannot assert anything, so the row and the completed
     state cannot drift apart. */
  const merged = mergeCompletionResult([], validated())

  assert.deepEqual(merged.map((entry) => entry.skill), ['python'])
  assert.deepEqual(assertedSkills(state), [])
})

/* ----------------------------------------------- 6. errors are not absence */

test('14e-13 a failed request and an unavailable figure are different things', () => {
  /* The panel prints "Not available" for figures nobody measured. A request that
     actually failed is an error, and is surfaced by the page through
     `.cb-status.is-error` with the flow's own status — never as "Not available",
     which would report a working service as having nothing to measure. */
  const result = validated()

  assert.equal(result.observedGainText, 'Not available')
  assert.ok(
    !Object.values(result).some((value) => value === 'unavailable'),
    'an error must never be spelled as unavailability',
  )
})

test('14e-13b an unavailable figure never appears where an error is rendered', () => {
  /* The panel and the error surface are different components: the panel renders
     observed rows, and it renders no error rows at all. So neither can stand in
     for the other. Checked on the words, not the keys — `predictionError` is the
     model's error, not a failed request, and its key would match any search for
     the word. */
  const rows = completionObservedRows(validated())

  assert.deepEqual(rows.map((row) => row.label), ['Observed learner gain', 'Prediction error'])
  for (const row of rows) {
    assert.doesNotMatch(row.value, /error|failed|could not|unavailable/i)
    assert.equal(row.value, 'Not available')
  }
})

test('14e-13c the flow still reports a failure as a failure', async () => {
  /* The real `submitSkillCompletion` raises a CompletionRequestError, so the stub
     does too. The flow passes the error through unchanged rather than rewrapping
   it, which is what lets the page tell a refusal from an outage. */
  const failure = new CompletionRequestError('The service could not compare this completion.', {
    kind: 'network',
  })
  const flow = createCompletionFlow({ submit: async () => { throw failure } })

  const outcome = await flow.run({
    state: createCompletionState(),
    skill: 'python',
    context: CONTEXT,
    inputs: INPUTS,
  })

  assert.equal(outcome.accepted, true)
  assert.equal(outcome.status, COMPLETION_STATUS_ERROR)
  assert.equal(outcome.error, failure)
  /* And no panel result is produced, so nothing can be rendered as "Not
     available" in place of a request that actually failed. */
  assert.equal(outcome.result, undefined)
})

test('14e-13d a refused payload is a failure, not an unavailability', async () => {
  const flow = createCompletionFlow({
    submit: async () => { throw new CompletionRequestError('unusable before score', { kind: 'malformed' }) },
  })

  const outcome = await flow.run({
    state: createCompletionState(),
    skill: 'python',
    context: CONTEXT,
    inputs: INPUTS,
  })

  /* The page renders this through `.cb-status.is-error` with the title "Could not
     read that comparison", so a service that answered badly is never reported as
     having nothing to measure. */
  assert.equal(outcome.status, COMPLETION_STATUS_ERROR)
  assert.equal(outcome.error.kind, 'malformed')
  assert.equal(outcome.result, undefined)
})

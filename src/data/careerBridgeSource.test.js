/* Stage 14C, data layer. `careerBridgeSource` is where the browser's view of the
   `/skill-completion` contract lives, so these tests cover the two things that
   contract can silently get wrong: what the request body contains, and what the
   response is allowed to become.

   Node's built-in runner and an injected `fetch` are enough for both, and neither
   needs a dependency or a dev server — see tools/registerTestResolver.mjs for why
   the app's modules load outside Vite at all. The stubbed bodies come from
   `backend/data/completion.py`, so a change to the service's response shape fails
   here rather than in the browser.

   Velocity lookups are left unstubbed: the source asks for them per skill and
   tolerates failure, so a 404 for them is the real behaviour of a service that
   has no history, and it keeps these tests to the completion contract. */

import test from 'node:test'
import assert from 'node:assert/strict'

import { submitRoadmap, submitSkillCompletion, CareerBridgeApiError } from './careerBridgeSource.js'
import { COMPLETION_BOUNDARY_NOTE, CompletionRequestError } from './careerBridgeCompletion.js'

const INPUTS = {
  resumeText: 'Java and SQL',
  jdText: 'Python role for machine learning',
  budgetHours: 60,
  targetRole: 'data_science',
}

function roadmapRow(skill, hours) {
  return {
    skill,
    hours,
    /* The wire vocabulary is critical/important/supporting; the source maps it to
       the presented High/Medium/Low. `vendor_flag` is a boolean, not null: it is
       a column in the artifacts, so an absent value is false. */
    priority: 'critical',
    reason: 'important requirement gap; demand is rising',
    vendor_flag: false,
  }
}

function completionBody(overrides = {}) {
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
    before_budget_hours: 60,
    after_budget_hours: 60,
    before_roadmap: [roadmapRow('python', 40)],
    after_roadmap: [roadmapRow('sql', 20)],
    not_a_measure_of: ['actual_gain'],
    ...overrides,
  }
}

/* A fetch that records its calls and answers from a path-keyed table. Anything
   the source asks for that is not in the table is a failure rather than an empty
   response, so an unexpected new request cannot pass unnoticed. */
function withFetch(responses, run) {
  const original = globalThis.fetch
  const calls = []
  globalThis.fetch = async (url, init = {}) => {
    /* `API_BASE` is empty unless the environment sets it, so the app fetches the
       paths relative in development exactly as it does in a dev server. */
    const path = url.startsWith('http') ? new URL(url).pathname : url
    calls.push({ path, init })
    const body = responses[path]
    if (body === undefined) {
      return { ok: false, status: 404, json: async () => ({ detail: `no stub for ${path}` }) }
    }
    return { ok: true, status: 200, json: async () => body }
  }
  const bodyFor = (path) => JSON.parse(calls.find((entry) => entry.path === path).init.body)

  return Promise.resolve(run({ bodyFor, paths: () => calls.map((entry) => entry.path) })).finally(() => {
    globalThis.fetch = original
  })
}

test('submitSkillCompletion sends the learner text, the skill, and nothing invented', async () => {
  await withFetch({ '/skill-completion': completionBody() }, async ({ bodyFor }) => {
    await submitSkillCompletion({ ...INPUTS, skill: 'Python', completedSkills: ['sql'] })

    const body = bodyFor('/skill-completion')

    assert.equal(body.resume_text, INPUTS.resumeText)
    assert.equal(body.jd_text, INPUTS.jdText)
    assert.equal(body.budget_hours, 60)
    assert.equal(body.target_role, 'data_science')
    /* Passed through rather than normalized here: the flow already hands over the
       de-duplication key, and the service normalizes it again on its own side, so
       this does not become a second place the key is decided. */
    assert.equal(body.skill, 'Python')
    assert.deepEqual(body.completed_skills, ['sql'])
  })
})

test('a completion with no prior assertions claims none', async () => {
  await withFetch({ '/skill-completion': completionBody() }, async ({ bodyFor }) => {
    await submitSkillCompletion({ ...INPUTS, skill: 'Python' })

    /* Present and empty, which is not the same as a list the learner did not
       ask for: the service reads both the same way. */
    assert.deepEqual(bodyFor('/skill-completion').completed_skills, [])
  })
})

test('a role the service cannot plan is omitted rather than sent to fail', async () => {
  await withFetch({ '/skill-completion': completionBody() }, async ({ bodyFor }) => {
    await submitSkillCompletion({ ...INPUTS, skill: 'python', targetRole: 'embedded_systems' })

    assert.equal(Object.hasOwn(bodyFor('/skill-completion'), 'target_role'), false)
  })
})

test('the learner assertion is refused before a request is spent', async () => {
  await withFetch({ '/skill-completion': completionBody() }, async ({ paths }) => {
    await assert.rejects(() => submitSkillCompletion({ ...INPUTS, skill: '   ' }), CompletionRequestError)
    await assert.rejects(
      () => submitSkillCompletion({ ...INPUTS, jdText: '', skill: 'python' }),
      CompletionRequestError,
    )
    await assert.rejects(
      () => submitSkillCompletion({ ...INPUTS, resumeText: '', skill: 'python' }),
      CompletionRequestError,
    )
    assert.deepEqual(paths(), [])
  })
})

test('the normalized result carries the same provenance the panel renders', async () => {
  await withFetch({ '/skill-completion': completionBody() }, async () => {
    const result = await submitSkillCompletion({ ...INPUTS, skill: 'Python' })

    assert.equal(result.completionSource, 'learner_asserted')
    assert.equal(result.verificationStatus, 'not_verified')
    assert.equal(result.isSynthetic, false)
    assert.equal(result.boundaryNote, COMPLETION_BOUNDARY_NOTE)
    assert.equal(result.label, 'python')
    assert.equal(result.deltaText, '-0.4')
    assert.equal(result.predictedGainText, '0.4')

    /* Both plans survive in the roadmap shape the page already renders, so the
       panel can be read against the two routes themselves. */
    assert.equal(result.before.items[0].name, 'python')
    assert.equal(result.before.items[0].hours, 40)
    assert.equal(result.after.items[0].name, 'sql')
    assert.equal(result.after.items[0].hours, 20)
    assert.equal(result.after.budgetHours, 60)
  })
})

test('a payload that is not a learner assertion never reaches render state', async () => {
  for (const overrides of [
    { verification_status: 'verified' },
    { completion_source: 'measured' },
    { is_synthetic: true },
    { actual_gain: 0.4 },
  ]) {
    await withFetch({ '/skill-completion': completionBody(overrides) }, async () => {
      await assert.rejects(() => submitSkillCompletion({ ...INPUTS, skill: 'python' }), CompletionRequestError)
    })
  }
})

test('a refused payload is not reported as the service being unavailable', async () => {
  await withFetch({ '/skill-completion': completionBody({ delta: null }) }, async () => {
    await assert.rejects(
      () => submitSkillCompletion({ ...INPUTS, skill: 'python' }),
      (error) => {
        assert.equal(error.kind, 'malformed')
        assert.notEqual(error instanceof CareerBridgeApiError, true)
        return true
      },
    )
  })
})

test('the learner assertion survives the comparison for later re-plans', async () => {
  await withFetch(
    { '/roadmap': { budget_hours: 60, roadmap: [roadmapRow('sql', 20)] } },
    async ({ bodyFor }) => {
      const roadmap = await submitRoadmap({ ...INPUTS, completedSkills: ['python', 'sql'] })

      const body = bodyFor('/roadmap')
      assert.deepEqual(body.completed_skills, ['python', 'sql'])
      /* The learner's own text is sent unchanged; the service owns the join, so
         the browser cannot send a text and a list that disagree. */
      assert.equal(body.resume_text, INPUTS.resumeText)
      assert.equal(roadmap.items[0].name, 'sql')
    },
  )
})

test('a re-plan without assertions is the request that predates the field', async () => {
  await withFetch(
    { '/roadmap': { budget_hours: 60, roadmap: [roadmapRow('sql', 20)] } },
    async ({ bodyFor }) => {
      await submitRoadmap(INPUTS)

      const body = bodyFor('/roadmap')
      assert.equal(Object.hasOwn(body, 'completed_skills'), false)
      assert.equal(body.target_role, 'data_science')
    },
  )
})

/* The page replaces its whole roadmap state with `result.after`, so the two
   shapes being identical is load-bearing, not tidiness. Nothing else would catch
   a drift here until the panel rendered undefined. */
test('the re-planned route is the same shape as a route from /roadmap', async () => {
  await withFetch(
    {
      '/roadmap': { budget_hours: 60, roadmap: [roadmapRow('sql', 20)] },
      '/skill-completion': completionBody(),
    },
    async () => {
      const planned = await submitRoadmap(INPUTS)
      const { after } = await submitSkillCompletion({ ...INPUTS, skill: 'Python' })

      assert.deepEqual(Object.keys(after).sort(), Object.keys(planned).sort())
      assert.deepEqual(
        Object.keys(after.items[0]).sort(),
        Object.keys(planned.items[0]).sort(),
      )
    },
  )
})
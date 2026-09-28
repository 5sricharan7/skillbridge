# AGENTS.md — SkillBridge Engineering Operating System

Binding rules for any coding agent working in this repository. Read fully before
starting a task. If a rule here conflicts with an assumption you were about to make,
the rule wins and you verify.

---

## 1. Project context

SkillBridge is an education-to-employment platform. It reads a learner's resume,
compares it against a target role, and returns a ranked skill roadmap sized to the
learner's available hours.

**This file governs** how agents work in this repo: how to investigate, how to scope
changes, how to verify, and when to stop and ask.

**`DESIGN.md` is the authoritative visual and design specification.** It is binding.
Before writing any UI code, read the relevant sections. Tokens, radii, shadows,
motion durations, breakpoints, and accessibility rules all live there — not in
ad-hoc CSS you write now. `DESIGN.md` §17 defines the change protocol for extending
the design system.

### Verified stack

| Layer | Tech |
|---|---|
| Frontend | React 18, Vite 5, plain CSS. No TypeScript, no CSS framework, no UI kit, no icon library. |
| Routing | Hand-rolled History API in `src/router.js`. No react-router. |
| Animation | GSAP 3 |
| 3D | Three.js is a dependency but **not imported by the app** — see §2. |
| Backend | FastAPI + Pydantic v2, Python. `backend/` |
| Tests | pytest (backend only) |

### Commands

```bash
# Frontend (only three scripts exist — there is no lint, typecheck, or test script)
npm run dev
npm run build
npm run preview

# Backend tests — MUST run from the repository root (tests import `backend.main`)
python -m pytest backend/tests -q

# Backend server
uvicorn backend.main:app --reload
```

**Do not invent a lint or typecheck command.** None is configured. If a task
requires one, say so rather than fabricating a passing result.

### Environment notes (verified on this machine)

- **Windows / PowerShell:** `npm.ps1` is blocked by the execution policy, so plain
  `npm` fails. Use `cmd /c "npm run build"`.
- **`dist/` is tracked in git and is not gitignored.** Running `npm run build`
  rewrites tracked files. Expect `dist/` in `git status` after a build, and do not
  mistake it for an unrelated change.
- `.gitignore` currently contains only `.playwright-cli/`. `node_modules/` and
  `.pytest_cache/` are untracked-but-unignored; leave that alone unless asked.

---

## 2. Inspect before modifying

**Never assume a component, route, API, field, or feature exists or doesn't exist
without opening the file.** Both directions of assumption have cost this repo real
work.

Read before you edit. Minimum inspection for any change:

- **Frontend:** `src/App.jsx` (routes), `src/router.js`, the target component and
  its stylesheet, and `src/data/careerBridgeMock.js` if data is involved.
- **Backend:** `backend/main.py` (endpoints), `backend/schemas.py` (contract),
  the relevant `backend/engines/*`, and the matching `backend/tests/*`.

Facts that are easy to get wrong — confirm them again if they matter:

- **The frontend calls the backend through one module.** All service access goes
  through `src/data/careerBridgeSource.js`, which owns the `fetch` calls, the
  `VITE_CAREER_BRIDGE_*` config, and the response normalizers. No component calls
  `fetch` directly, and there is no axios. The mode is
  `VITE_CAREER_BRIDGE_MODE` (`api` by default, `mock` to opt out); mock mode issues
  no requests and reads `src/data/careerBridgeMock.js`. An API failure surfaces as
  an error state and **never** falls back to mock data, so do not add a silent
  fallback. See `.env.example` for the variables. Do not "fix" the mock data to match
  the API unless that is the explicit task.
- **The live backend cannot plan the product's own target role.**
  `Embedded Systems Engineer` is not an artifact role, so `POST /roadmap` answers 422
  for it and the UI says so. Plan against a supported category such as
  `VITE_CAREER_BRIDGE_TARGET_ROLE=data_science`. Do not paper over this by inventing
  a roadmap for the unsupported role.
- **The hero 3D scene is dead code.** `src/three/*` imports `three` internally but
  **nothing in `src/components/` imports it**. The live hero is `HeroCardField.jsx`
  (DOM + CSS) plus a static raster asset in `public/references/`. The
  `Generated an empty chunk: "three"` build warning is expected and pre-existing.
- **Routes are exactly four:** `/`, `/career-bridge`, `/curriculum-time-machine`,
  `/evidence`. Page titles are mapped in the `TITLES` object in `src/App.jsx`.
- **There are two CSS token scopes** and they must not be mixed — global `:root`
  tokens in `src/styles.css`, and `--cb-*` tokens scoped to `.career-bridge` in
  `src/components/careerBridge.css`. See `DESIGN.md` §3.
- `career-bridge-preview.html` and `src/careerBridgePreview.jsx` are a standalone
  isolated preview with its own inline styles. They are not part of the app and
  don't share its stylesheet.

---

## 3. Scope control

- **Change only what the task requires.** The smallest coherent change wins.
- **No unrelated refactors.** Do not "tidy" adjacent code, rename things, reorder
  imports, or reformat files you are not otherwise required to change.
- **Do not rewrite working architecture.** The hand-rolled router, the CSS token
  system, the `getMockRoadmap` band pipeline, and the engine function signatures
  are all working. Leave them.
- **Preserve** existing routes, API contracts, `backend/schemas.py` shapes, the
  History API navigation behavior, and all current functionality unless the task
  explicitly says otherwise.
- **Ask for approval before** any architectural change: adding a router or state
  library, introducing TypeScript, adding a CSS framework or UI kit, splitting or
  renaming tokens scopes, or changing the `POST /roadmap` request/response shape.
  Propose it; don't just do it.
- **The design system is not a backlog.** `DESIGN.md` documents the system as it
  exists. Fixing a documented `[KNOWN GAP]` is fine when you touch that code, but
  reworking untouched patterns is out of scope for a feature task.

---

## 4. Design system

**`DESIGN.md` is the single source of truth for visual design.** Consult it before
and during any UI change. It covers, with exact values: product identity and voice
(§1), atmosphere (§2), both color palettes and verified contrast ratios (§3),
typography and the type scale (§4), spacing and grid (§5), navigation (§6), buttons
and interaction states (§7), radii/borders/shadows and the gradient policy (§8),
forms and inputs (§9), data and dashboard patterns (§10), icons (§11), motion and
reduced motion (§12), responsive breakpoints (§13), and accessibility (§14).

Hard rules:

- **Reuse before creating.** If a token, radius, shadow, duration, or pattern
  already exists, use it. If you need a genuinely new one, add it to the correct
  scope **and** document it in `DESIGN.md` per §17.
- **Never hardcode a value that has a token** — no stray hex colors, no ad-hoc
  `border-radius`, no one-off transition durations.
- **Follow the anti-generic-AI-UI rules in `DESIGN.md` §15** without exception.
  Specifically: no gradients as a brand signal, no glassmorphism or
  `backdrop-filter`, no random off-palette colors, no excessive rounded cards
  (radii encode hierarchy: pills for actions, `16px` panels, `8px` tiles), no
  decorative elements without design justification, no emoji as UI chrome, and no
  generic dark-mode toggle. Hand-authored 24×24 `currentColor` SVG only — do not
  add an icon library.

### Skills

`.agents/skills/` is version-pinned by `skills-lock.json`. Use the relevant skill
rather than improvising:

| Skill | Use when |
|---|---|
| `design-taste-frontend` | Any frontend/UI work. Audit the existing design first on redesigns. |
| `web-design-guidelines` | Reviewing UI for accessibility and Web Interface Guidelines compliance. |
| `vercel-react-best-practices` | Writing, reviewing, or refactoring React code; performance and bundle work. |
| `vercel-composition-patterns` | Component architecture, composition, and state placement decisions. |

The `playwright-cli` skill lives in `.claude/skills/playwright-cli/`. Read it before
your first browser verification rather than guessing the command surface.

---

## 5. Implementation principles

- **Prefer existing components, utilities, and patterns** over creating new ones.
  Read the neighboring file and match it.
- **Keep components maintainable and composable.** Follow the existing composition
  approach; consult `vercel-composition-patterns` for anything non-trivial.
- **Avoid unnecessary dependencies.** The project is deliberately lean (GSAP and
  Three.js only). Do not add a library for something CSS or ~20 lines of JS can do.
  Any new dependency requires approval.
- **Keep state management appropriate to the existing architecture.** Local
  `useState` + `useMemo` for derived values, as in `CareerBridge.jsx`. There is no
  global store; do not introduce one unasked.
- **Preserve responsive behavior.** Check the existing breakpoints in `DESIGN.md`
  §13. Grids collapse to one column; decorative scenes are removed, not shrunk.
- **Maintain accessibility.** Focus-visible rings, real `<button>` vs `<a>`,
  labeled inputs, meaningful alt text, `aria-hidden` on decorative SVG,
  `aria-live` for state changes, and a `prefers-reduced-motion` rule for any new
  animation. Baseline is WCAG 2.1 AA.
- **Do not duplicate logic.** Reuse the band/threshold helpers in
  `careerBridgeMock.js` and the engine functions in `backend/engines/`.
- **Keep changes understandable and production-oriented** — no dead code, no
  commented-out blocks, no debug logging left behind.

---

## 6. UI/UX workflow

For any UI change, in order:

1. **Inspect the existing page** — open the component, its stylesheet, and render it
   in a browser before changing anything.
2. **Understand the user flow** — what the user is trying to do on this screen, and
   what must not break.
3. **Consult `DESIGN.md`** for the specific values you need.
4. **Reuse existing patterns** for anything similar.
5. **Implement** the smallest coherent change.
6. **Verify desktop and mobile.** Check at 1440, 1024, 720, and 390 — the widths
   `DESIGN.md` §13 names.
7. **Verify hover, focus, and active states** on every interactive element you
   touched, including `:focus-visible` via keyboard (`Tab`, not mouse).
8. **Verify accessibility** — semantics, names, contrast of any new color, and
   reduced-motion.
9. **Use Playwright CLI** for real browser verification whenever practical.

---

## 7. Engineering workflow

For substantial tasks, follow this loop. Scale it to the task — a one-line fix does
not need all nine steps, but never skip verification because a change looked small.

```
SPEC → PLAN → IMPLEMENT → BUILD/LINT → PLAYWRIGHT → INSPECT → FIX → VERIFY
```

**SPEC** — Understand the requested outcome and the constraints. State what is
actually being asked before deciding how to build it.

**PLAN** — Identify the files to touch and the approach *before* editing. If the
plan requires an architectural change, stop and get approval (§3).

**IMPLEMENT** — Make the smallest coherent change that satisfies the task. Reuse
existing patterns and tokens.

**BUILD/LINT** — Run the project's actual checks. For frontend:
`cmd /c "npm run build"`. For backend: `python -m pytest backend/tests -q`. There is
no lint or typecheck configured; do not claim one passed.

**PLAYWRIGHT** — For user-facing web changes, verify the real application in a
browser. Start the dev server (`cmd /c "npm run dev"`), then drive it with
`playwright-cli` per §8.

**INSPECT** — Examine the result: rendered UI, console errors, failed network
requests, layout, responsive behavior, and the interactions you changed.

**FIX** — Resolve everything found during inspection. Do not defer known issues.

**VERIFY** — Re-run the relevant checks and confirm the requested behavior actually
works. Then confirm the browser is clean.

---

## 8. Playwright rules

Real browser verification is required for meaningful frontend changes. Source
inspection alone is not verification.

```bash
playwright-cli open http://localhost:5173/     # dev server default
playwright-cli snapshot                       # accessibility tree + refs
playwright-cli find "text or /regex/i"        # locate content
playwright-cli click e15                      # interact by snapshot ref
playwright-cli hover e4
playwright-cli press Tab                      # keyboard + focus checks
playwright-cli resize 390 844                 # responsive checks
playwright-cli eval "document.title"          # inspect state
playwright-cli console                        # console errors/warnings
playwright-cli screenshot --filename=out.png
playwright-cli close
```

- **Prefer `snapshot` and targeted interactions over screenshots.** A screenshot is
  for layout judgment; a snapshot is for structure. Screenshot only when you need to
  look at the pixels.
- **Check `console` on every verification pass.** A clean render with console errors
  is not done.
- **Check responsive layouts** whenever the change affects responsive UI — use
  `resize` and confirm at the four widths in `DESIGN.md` §13.
- **Use refs from a fresh `snapshot`**, not from memory; refs are positional and go
  stale after a re-render.
- **Never declare a UI task complete based only on source-code inspection.**
- Close the browser when finished.

---

## 9. Validation

Before declaring any task complete:

- [ ] The requested functionality actually works.
- [ ] `cmd /c "npm run build"` passes (frontend changes).
- [ ] `python -m pytest backend/tests -q` passes (backend changes).
- [ ] Affected UI verified in a real browser, desktop and mobile widths.
- [ ] Hover, focus-visible, and active states checked by keyboard.
- [ ] No console errors or failed network requests in the browser.
- [ ] `git status` reviewed — confirm no unrelated files changed. Account for
      `dist/` if you ran a build.
- [ ] Report what changed **and** what was verified.
- [ ] **Explicitly state any remaining limitation, skipped check, or failure.**
      Silence is not a pass.

If a check cannot be run, say so plainly and name it. Never imply verification you
did not perform.

---

## 10. Git safety

- **Never overwrite or revert unrelated user changes.** The working tree is often
  dirty. Read `git status` and `git diff` before making broad changes, and never
  use `git checkout --`, `git restore`, or `git stash` on files you did not intend
  to touch.
- **Do not commit unless explicitly requested.** When asked, stage only the intended
  files, write a message matching the repo's style, and show the diff first.
- **Do not delete files unless the task requires it.** Confirm before removing
  anything, including dead code and stray files at the repo root.
- **Never modify secrets or expose API keys/tokens.** No credentials belong in
  source, in `AGENTS.md`, or in commit messages. If you find one committed, report
  it rather than reproducing it.
- Do not amend, force-push, or rewrite history without explicit instruction.
- Do not modify `.gitignore` to hide problems.

---

## 11. Error handling

- **Do not hide errors.** No silent `catch {}`, no swallowed rejections, no
  disabling a lint or test to make a run green.
- **Investigate the root cause** before applying a workaround. A workaround that
  masks a cause is a defect, not a fix.
- **If a dependency, API, credential, or external service is unavailable, report it
  clearly** — name what is missing and what it blocks. Do not stub around a missing
  backend and present it as working.
- **Never claim success when verification failed.** Report the failure, the
  evidence, and the remaining options.
- Leave the codebase in a state where the next agent can pick it up: no temporary
  debug code, no commented-out experiments, no half-finished migrations.

---

## 12. Completion standard

Writing code is not the same as finishing. A task is **done** only when:

- [ ] Implementation is complete and matches the request.
- [ ] Relevant build and/or test checks pass.
- [ ] Browser behavior is verified for user-facing changes.
- [ ] No known critical errors remain.
- [ ] Requested scope was respected — nothing extra, nothing missing.
- [ ] Limitations are stated explicitly.

**If any box is unchecked, the task is not done.** Report it accurately instead of
implying completion.

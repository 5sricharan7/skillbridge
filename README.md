# SkillBridge

### Turn career goals into a focused path from skills to proof.

SkillBridge is an education-to-employment product prototype for connecting a
learner's current skills to a target role, a practical learning plan, and
evidence that can be evaluated. It brings learner planning, curriculum
adaptation, and proof concepts together in one experience.

> **Project status:** The frontend is a working product demo. It calls the FastAPI
> service by default and can be switched to local mock data with
> `VITE_CAREER_BRIDGE_MODE=mock`. Demo content and illustrative benchmarks are not
> live labor-market data or independently verified outcomes; the served proof
> records carry their own synthetic and role-scoped caveats.

## Product thesis

People often have to bridge the gap between what they can do and what a role
requires without a clear, credible next step. SkillBridge's thesis is that the
bridge should be explicit: identify relevant gaps, fit learning to a person's
available time, and make the resulting work easier to inspect.

The prototype explores four connected product surfaces:

| Surface | What it explores |
| --- | --- |
| **Career Bridge** | Compare a learner profile with a target role and shape a skill roadmap around a time budget. |
| **Curriculum Time Machine** | Explore how learning priorities and a curriculum plan might change as needs evolve. |
| **Evidence** | Organize proof and validation concepts around work products, evaluation, and review. |
| **Multiplier Effect** | Show the product thesis as a reinforcing relationship between learners, education, and employers. |

These are product concepts, not claims that the prototype has deployed a
network, verified credentials, or measured employment outcomes.

## What makes the approach distinctive

- **A connected journey:** roadmap planning, curriculum adaptation, and proof
  are presented as related parts of career preparation.
- **Time-aware planning:** Career Bridge's backend prototype can allocate
  learning work against an available-hours budget.
- **Inspectable reasoning:** the backend separates role signals, skill
  velocity, and roadmap optimization into readable engine modules.
- **A proof-oriented product direction:** Evidence explores how a learner's
  work could be reviewed rather than treating course completion alone as proof.
- **An honest prototype boundary:** current UI data is labeled and treated as
  demo or illustrative content; no live outcome claims are made.

## Product surfaces

### Career Bridge

Career Bridge is the learner-facing roadmap concept. The experience is designed
around a learner profile, a target role, skill gaps, and an available learning
budget. Its local UI data is mock-first. The separate backend accepts a roadmap
request and runs a deterministic prototype pipeline; the default frontend
configuration does not submit requests to that service.

### Curriculum Time Machine

Curriculum Time Machine is an illustrative planning surface for exploring
curriculum and learning-priority changes over time. Its current content comes
from local demo data. It is not connected to a live institution information
system or a production scheduling service.

### Evidence

Evidence presents proof and validation concepts, including example evidence
types and evaluation views. The frontend content is illustrative. Backend
`/proofs` serves normalized Notebook artifact records; `/vendor-flags` currently
returns an empty list. No external credential provider or evaluator is connected.

### Multiplier Effect

Multiplier Effect visualizes the thesis that learner progress, educational
planning, and employer signals can reinforce one another. It is a product
concept, not an automated feedback network. The homepage's Multiplier Effect
navigation uses the existing full-screen route transition; Career Bridge
navigation is direct.

## Architecture

```mermaid
flowchart LR
    Person[Learner or visitor] --> UI
    subgraph FrontendRuntime["Browser"]
        UI[React interface]
        Router[History API router]
        Local[Local mock and demo data]
        Adapter[Optional Career Bridge API adapter]
        UI --> Router
        UI --> Local
        UI -. enabled explicitly .-> Adapter
    end
    subgraph BackendRuntime["FastAPI service"]
        Routes[Roadmap and read endpoints]
        Engines[Signal, velocity, and optimizer engines]
        RoleAdapter[Explicit role adapter]
        ProofAdapter[Proof normalizer]
        ArtifactReader[Read-only artifact loader]
        Routes --> Engines
        Routes --> RoleAdapter
        RoleAdapter --> Engines
        RoleAdapter --> ArtifactReader
        Routes --> ProofAdapter
        ProofAdapter --> ArtifactReader
        ArtifactReader --> ArtifactFiles[(Local artifacts)]
    end
    Adapter -. HTTP when configured .-> Routes
    Static[Public images and static assets] --> UI
```

The frontend and backend are intentionally separate in the current setup. The
read-only artifact loader remains independent of the engines; the Stage 4
adapter layer explicitly reads its data for role-scoped roadmap enrichment and
the proof endpoint. The frontend calls it through
`src/data/careerBridgeSource.js` when `VITE_CAREER_BRIDGE_MODE` is `api`.

## Data flow

```mermaid
flowchart TD
    Learner[User explores a product surface] --> Route[React view selected by path]
    Route --> Mock[Local mock or illustrative data]
    Mock --> Render[Rendered roadmap, plan, or proof concept]
    Route -. only after explicit adapter selection .-> Request[Career Bridge API request]
    Request --> Service[FastAPI endpoint]
    Service --> Adapter[Role adapter only for explicit target_role]
    Adapter --> Result[Deterministic prototype response]
    Result --> Render
    Note[Default experience uses local data; no API request is made] -.-> Mock
```

Career Bridge's source selection lives in
[`src/data/careerBridgeSource.js`](src/data/careerBridgeSource.js). It currently
selects `mock`. Switching to the API adapter is an explicit code/configuration
choice, not automatic service discovery.

## Career Bridge pipeline

```mermaid
flowchart LR
    Request[Roadmap request] --> Normalize[Normalize role and skill inputs]
    Normalize --> Signals[Extract role skill signals]
    Signals --> Velocity[Estimate skill learning velocity]
    Velocity --> OptionalRole{target_role supplied?}
    OptionalRole -- no --> Gaps[Keep legacy signal path]
    OptionalRole -- yes --> RoleAdapter[Attach role priors, hours, resolved DAG]
    RoleAdapter --> Gaps[Compare current skills with role needs]
    Gaps --> Optimize[Prioritize work within time budget]
    Optimize --> Roadmap[Ranked roadmap response]
```

This diagram describes the backend prototype's processing stages. It does not
imply that the live website currently sends a learner's information to the API.

## Curriculum Time Machine flow

```mermaid
flowchart TD
    Demo[Illustrative curriculum and demand data] --> Context[Select the planning context]
    Context --> Compare[Compare priorities and skill needs]
    Compare --> Plan[Explore a time-aware learning sequence]
    Plan --> View[Review the curriculum-change concept]
    View -. future integration .-> Sources[Institution and labor-market systems]
```

The current interface uses local illustrative data. The final node is a
potential integration direction, not a current data source.

## Evidence and proof architecture

```mermaid
flowchart LR
    Work[Learner work or project] --> Candidate[Potential evidence item]
    Candidate --> Review[Evaluation and review concept]
    Review --> Proof[Proof record concept]
    Proof --> LearnerView[Learner-facing Evidence surface]
    Proof --> EmployerView[Potential employer inspection]
    Demo[Illustrative frontend examples] -. current UI content .-> LearnerView
    API[Backend normalizes Proof B, C, and E artifacts] -. separate from frontend demo .-> Proof
```

The diagram is a conceptual model. The current prototype does not establish
that work has been independently assessed or that a proof record is a
production credential.

## Multiplier Effect flywheel

```mermaid
flowchart LR
    Signals[Employer and role signals] --> Priorities[Learning priorities]
    Priorities --> Learning[Focused learner practice]
    Learning --> Evidence[Reviewable work and evidence]
    Evidence --> Insight[Potential skills insight]
    Insight --> Curriculum[Potential curriculum refinement]
    Curriculum --> Signals
```

The flywheel describes the product's intended reinforcing loop. Its
integrations and feedback cycles are not automated in this prototype.

## Key interactions

- Navigate among the homepage, Career Bridge, Curriculum Time Machine,
  Evidence, and Multiplier Effect.
- Explore product-specific roadmap, planning, and proof views using their
  current demo content.
- Follow homepage calls to action into Career Bridge with standard direct
  navigation.
- Use the full-screen transition for the Multiplier Effect route.
- Run the FastAPI roadmap endpoint independently for backend development and
  testing.

## Routes

| Path | Page | Data and behavior |
| --- | --- | --- |
| `/` | Homepage | Product introduction and navigation |
| `/career-bridge` | Career Bridge | Mock-first learner roadmap experience |
| `/curriculum-time-machine` | Curriculum Time Machine | Illustrative curriculum planning experience |
| `/evidence` | Evidence | Proof and validation concepts with illustrative data |
| `/multiplier-effect` | Multiplier Effect | Product thesis visualization and existing route transition |

Routing is implemented with the browser History API in
[`src/router.js`](src/router.js); there is no routing framework.

## Technology

| Area | Technology |
| --- | --- |
| Frontend | React 18, Vite 5, JavaScript, plain CSS |
| Navigation | Hand-rolled History API |
| Motion | GSAP and CSS |
| Backend | Python, FastAPI, Pydantic v2 |
| Backend tests | pytest |
| 3D dependency | Three.js is installed but is not imported by the live app |

## Repository structure

```text
.
├── backend/
│   ├── data/                 # Read-only artifacts and explicit adapters
│   ├── engines/              # Roadmap signals, velocity, and optimization
│   ├── tests/                # Backend tests
│   ├── main.py               # FastAPI application and endpoints
│   └── schemas.py            # Request and response contracts
├── public/
│   ├── assets/               # Static product assets
│   └── references/           # Product reference images
├── src/
│   ├── components/           # Shared and product-surface components
│   ├── data/                 # Mock and illustrative UI data
│   ├── pages/                # Route-level page components
│   ├── App.jsx               # Route composition and page titles
│   ├── router.js             # History API navigation
│   └── styles.css            # Global styles and tokens
├── DESIGN.md                 # Visual design system
├── index.html
└── package.json
```

## Setup and running

### Frontend

Requirements: Node.js and npm.

```bash
npm install
npm run dev
```

Vite prints the local development URL. To create a production build:

```bash
npm run build
```

To serve the generated build locally:

```bash
npm run preview
```

### Backend

Requirements: Python 3.10 or newer.

```bash
python -m venv .venv
```

Activate the environment in PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

Then install the backend requirements and start the service from the repository
root:

```bash
python -m pip install -r backend/requirements.txt
python -m uvicorn backend.main:app --reload
```

The interactive API schema is available at `http://127.0.0.1:8000/docs`.
### Implemented backend endpoints

| Method | Path | Current purpose |
| --- | --- | --- |
| `GET` | `/health` | Minimal liveness response: `{"status":"ok"}` |
| `POST` | `/roadmap` | Generate a roadmap; optional `target_role` enables artifact enrichment |
| `GET` | `/velocity/{skill}` | Existing velocity response, currently backed by deterministic development fixtures |
| `GET` | `/proofs` | Normalized, role-scoped Proof B plus Proof C and Proof E artifact records |
| `GET` | `/curriculum-intelligence/{role}` | One role's recorded skill frequency, classification, velocity, learning hours, prerequisite graph, and proof references |

### Placeholder / not implemented

`GET /vendor-flags` exists but currently returns an empty list. It does not
perform vendor detection.

### Frontend data boundary

The frontend reads the backend through `src/data/careerBridgeSource.js`, which owns
every `fetch` call, the `VITE_CAREER_BRIDGE_*` configuration and the response
normalizers. The mode is chosen with `VITE_CAREER_BRIDGE_MODE`: `api` (the default)
calls the endpoints below, and `mock` reads the local checked-in data and issues no
requests. See `.env.example` for the variables. A failed request surfaces as an
error state; it never falls back to mock data.

Note that the product's own target role, `Embedded Systems Engineer`, is not one of
the backend's artifact roles, so `POST /roadmap` returns 422 for it by default. Set
`VITE_CAREER_BRIDGE_TARGET_ROLE` to a plannable category such as `data_science` to
plan against the live service.

Supported artifact roles are `data_science`, `backend_ml_engineer`, and
`other`. Only the first two are plannable because they have both role-scoped
hours and DAG data. Unknown roles and `other` are rejected when explicitly
requested; omitting `target_role` preserves the original roadmap path.

The frontend source adapter includes a configurable API base URL, but the
default source is `mock`. To develop against the service, explicitly select
the API source in `src/data/careerBridgeSource.js` and set
`VITE_CAREER_BRIDGE_API` to the backend URL before starting Vite. The frontend
does not automatically switch to the API when the service is running.

Local Vite origins `http://localhost:5173` and `http://127.0.0.1:5173` are
allowed by the backend CORS middleware. Configure a comma-separated allowlist
with `SKILLBRIDGE_CORS_ORIGINS` when the frontend uses a different development
origin; CORS credentials are disabled.

### Tests

Run backend tests from the repository root:

```bash
python -m pytest backend/tests -q
```

There is no configured frontend test, lint, or type-check script.

## Current limitations

- Frontend data is local mock or illustrative data by default; it is not a
  production learner profile or live labor-market feed.
- The web app and FastAPI backend are not connected by default.
- Career Bridge processing is a deterministic prototype, not a validated
  career recommendation service.
- Curriculum Time Machine is not connected to institutional curriculum
  systems. It has no institution, programme, year, credit, or course data, and
  no curriculum-revision history. `GET /curriculum-intelligence/{role}` serves
  the job-posting role categories the artifacts actually record, with the two
  velocity slices the artifacts actually measured (`2025-H1 -> 2026-H2`) and an
  explicit `not_available` list for everything no artifact records. It is not a
  curriculum record.
- Evidence examples and evaluation benchmarks are illustrative; no production
  verification provider or audited outcomes are represented.
- `/vendor-flags` currently returns an empty list. `/proofs` exposes only the
  existing Proof B, C, and E artifacts; it does not imply production
  verification or include backtest data as proof.
- `/velocity/{skill}` retains its existing deterministic sample-fixture
  behavior; artifact-derived velocity history is internal and does not alter
  that endpoint's response.
- Artifact velocity history is enabled internally only after it reproduces all
  stored velocity scores within `1e-9`; it does not create a trend label or
  change the `/velocity/{skill}` response.
- Authentication, persistent learner accounts, and production deployment
  configuration are outside the current prototype.

## Roadmap

Potential next steps, subject to product and data validation:

1. Define privacy, consent, and data-retention requirements before accepting
   real learner records.
2. Connect the frontend to the backend behind explicit, tested contracts.
3. Validate role-skill mappings and time-budget recommendations with domain
   experts and representative data.
4. Design evidence review workflows and integrations with appropriate
   verification partners.
5. Explore institution and employer integrations only after access, governance,
   and evaluation criteria are established.
6. Add end-to-end and accessibility coverage as the interactive flows mature.

No outcome, adoption, accuracy, or employment metric is claimed by this
roadmap.

## Design and contribution notes

[`DESIGN.md`](DESIGN.md) is the source of truth for interface tokens,
responsive behavior, accessibility, and visual patterns. Keep changes within
the existing React/CSS architecture, preserve the separation between local UI
data and backend contracts, and run the relevant build or test command before
submitting changes.

/* -----------------------------------------------------------------------
   Evidence Workspace — Data Model & Proof Metrics
   Page copy and illustrative examples only. Measured Proof B / C / E values
   come from the live /proofs response (see src/data/careerBridgeSource.js).
   Everything here is either illustrative or grounded in a checked-in
   repository artifact; nothing here is a production accuracy claim.
   ----------------------------------------------------------------------- */

export const EVIDENCE_META = {
  title: 'What the evidence supports',
  subtitle: 'Recorded results, stated limits.',
  lead: 'SkillBridge evaluates its signal engine against role-scoped reference sets and recorded controlled cases. This page separates measured results from illustrative examples and states what each record does not show.',
  disclaimer:
    'Illustrative evaluation benchmarks and synthetic test sets. These are not audited real-world claims or production accuracy estimates.',
}

export const EVIDENCE_HIGHLIGHTS = [
  {
    id: 'sources',
    num: '329 postings',
    desc: 'Cleaned job postings across four half-year slices',
    icon: 'sources',
    viz: 'documents',
  },
  {
    id: 'proofs',
    num: '4 proofs',
    desc: 'A is illustrative; B, C and E are served by /proofs',
    icon: 'proofs',
    viz: 'nodes',
  },
  {
    id: 'transparency',
    num: 'Recorded thresholds',
    desc: 'Frequency and similarity bounds from thresholds.json',
    icon: 'methods',
    viz: 'thresholds',
  },
  {
    id: 'limits',
    num: 'Stated limits',
    desc: 'Synthetic cases and null results are labelled, not hidden',
    icon: 'results',
    viz: 'limits',
  },
]

/* Proof A is illustrative page content. The service serves Proof B, C and E
   only, and no Proof A is synthesised to fill the gap. Its figures are a
   concept sketch, so the panel names that status rather than implying a
   historical validation. The recorded backtest artifact is cited only in the
   takeaways, in the terms that artifact actually records. */
export const PROOF_A_DATA = {
  title: 'Proof A — Velocity Concept (illustrative)',
  shortTitle: 'Velocity Concept',
  tagline:
    'An illustrative sketch of trend detection. This concept is not returned by /proofs and is not a historical validation.',
  method: 'Illustrative concept — no recorded backtest is shown here',
  source: 'Illustrative concept — not a served artifact',
  years: ['2021', '2022', '2023', '2024', '2025', '2026'],
  risingSkill: {
    name: 'Rising trend (illustrative)',
    points: [42, 45, 52, 64, 82, 98],
  },
  decliningSkill: {
    name: 'Declining trend (illustrative)',
    points: [78, 70, 58, 46, 34, 22],
  },
  takeaways: [
    'Illustrative only: these trend lines and figures are a concept sketch, not measured data.',
    'This proof is not returned by the /proofs service, so it is not evidence of forecast accuracy.',
    'The recorded backtest artifact covers 329 postings from 2022-05-28 to 2026-09-26 and records one rising candidate (artificial intelligence) with no declining candidate.',
  ],
}

/* Proof B in mock mode. Kept structurally identical to the live shape so the
   same panel renders, and it records presence/absence only — never a second
   frequency. Live mode overrides this with role-scoped /proofs records. */
export const PROOF_B_DATA = {
  title: 'Proof B — External Cross-Check',
  shortTitle: 'External Cross-Check',
  tagline: 'Illustrative example of a role-scoped overlap against an external reference set.',
  source: 'Illustrative mock reference set',
  sourceUrls: [],
  role: 'illustrative',
  roleLabel: 'Illustrative role scope',
  overallAgreement: 60,
  matched: 3,
  roles: [],
  referenceSize: 5,
  skills: [
    { name: 'Generative AI', skillbridgeScore: 88, externalMatch: true },
    { name: 'Cloud Computing', skillbridgeScore: 78, externalMatch: true },
    { name: 'Data Engineering', skillbridgeScore: 84, externalMatch: true },
    { name: 'Cybersecurity', skillbridgeScore: 72, externalMatch: false },
    { name: 'Product Mgmt', skillbridgeScore: 66, externalMatch: false },
  ],
  takeaways: [
    'Illustrative mock scope; the live service returns one role-scoped record per role.',
    'The reference set records presence only, so this panel shows match / no match rather than a second frequency.',
  ],
}

/* Proof C in mock mode. The warning and sample size mirror the live contract so
   the synthetic limitation is never dropped. */
export const PROOF_C_DATA = {
  title: 'Proof C — Naive Baseline Comparison',
  shortTitle: 'Naive Baseline',
  tagline: 'Signal engine against keyword matching on recorded controlled cases.',
  dataset: 'Synthetic controlled cases (n=20)',
  sampleSize: 20,
  warning:
    'Not a production precision estimate; cases are derived from the current skill vocabulary.',
  metrics: [
    { label: 'Precision', skillbridge: 1.0, baseline: 0.678, improvement: '+47.5%' },
    { label: 'Structural hits', skillbridge: 40, baseline: 40, improvement: '0%' },
    { label: 'Flagged gaps', skillbridge: 40, baseline: 59, improvement: '32.2% fewer' },
  ],
  takeaways: [
    'Not a production precision estimate; cases are derived from the current skill vocabulary.',
    'Both methods flag the same 40 structural hits across 20 cases.',
    'The signal engine flags 40 gaps against 59 for the naive keyword baseline.',
  ],
}

/* Proof E in mock mode. Budgets are illustrative, so the card derives its
   labels from this list rather than assuming 20h / 100h. */
export const PROOF_E_DATA = {
  title: 'Proof E — Time-Budget Sensitivity',
  shortTitle: 'Time-Budget Sensitivity',
  tagline: 'An illustrative example of a roadmap at different time budgets, not a general proof of sensitivity.',
  note: 'Illustrative example output, not a production outcome.',
  profile: {
    targetRole: 'Illustrative example',
  },
  plansIdentical: false,
  budgets: [
    {
      hours: 60,
      tier: 'Quick Start (60h)',
      focus: 'High-leverage essential tooling & immediate practical gaps',
      skills: [
        '1. Python Data Stack (Pandas / NumPy refresher)',
        '2. SQL for Analytics & Data Extraction',
        '3. Core Supervised ML Algorithms',
        '4. Exploratory Data Analysis & Viz (Seaborn)',
        '5. End-to-End Capstone Project',
      ],
      strategy: 'Illustrative example output, not a production outcome.',
    },
    {
      hours: 120,
      tier: 'Balanced (120h)',
      focus: 'Full pipeline competency: feature engineering, cloud, and deployment',
      skills: [
        '1. Advanced Feature Engineering & Pipeline Design',
        '2. Deep Learning Fundamentals (PyTorch)',
        '3. Cloud Fundamentals (AWS / GCP Data Pipelines)',
        '4. Model Evaluation, Validation & Drift Monitoring',
        '5. Production API Deployment with FastAPI & Docker',
      ],
      strategy: 'Illustrative example output, not a production outcome.',
    },
    {
      hours: 150,
      tier: 'Advanced (150h)',
      focus: 'Production MLOps, LLM integration, and scalable system architecture',
      skills: [
        '1. Distributed Data Processing (PySpark)',
        '2. Generative AI, RAG & LLM Fine-Tuning Patterns',
        '3. MLOps CI/CD Automation & Model Registry (MLflow)',
        '4. Scalable Inference & GPU Optimization (ONNX / TensorRT)',
        '5. Distributed System Design for Machine Learning',
      ],
      strategy: 'Illustrative example output, not a production outcome.',
    },
  ],
  takeaways: [
    'Illustrative budget example only; it is not a general demonstration of budget sensitivity.',
    'The optimizer fits the highest-signal prerequisite-closed set within the recorded hour budget.',
    'Hours are heuristic planning estimates, not measured learning times.',
  ],
}

/* Methodology values are limited to what the repository artifacts actually
   record: thresholds.json, hours_per_skill.json, dag_structure.json, the skill
   catalog, and the optimizer. No external taxonomy, embedding service, or
   curriculum benchmark is claimed. */
export const METHODOLOGY_DATA = {
  title: 'Methodology & Thresholds',
  shortTitle: 'Methodology & Thresholds',
  tagline: 'Recorded parameters, heuristics, and pipeline stages, with the artifact each one comes from.',
  parameters: [
    {
      name: 'Core Skill Frequency',
      value: '0.393 minimum',
      glyph: '0.393',
      glyphUnit: 'min frequency',
      viz: 'frequency',
      type: 'Recorded threshold',
      typeClass: 'standard',
      desc: 'Minimum role-posting frequency for a skill to be treated as core (thresholds.json).',
    },
    {
      name: 'Noise Frequency Cutoff',
      value: '0.012 maximum',
      glyph: '0.012',
      glyphUnit: 'max frequency',
      viz: 'noise',
      type: 'Recorded threshold',
      typeClass: 'standard',
      desc: 'Postings below this recorded frequency are treated as noise (thresholds.json).',
    },
    {
      name: 'Similarity Cutoff',
      value: '0.248 cosine',
      glyph: '0.248',
      glyphUnit: 'cosine',
      viz: 'similarity',
      type: 'Recorded threshold',
      typeClass: 'standard',
      desc: 'Similarity bound recorded in thresholds.json. The tuning artifact names sentence-transformers as the embedding backend used when tuned.',
    },
    {
      name: 'Live Skill Matching',
      value: 'Tokens and aliases',
      glyph: 'tokens',
      glyphUnit: 'aliases',
      viz: 'tokens',
      type: 'Recorded catalog',
      typeClass: 'standard',
      desc: 'The live signal engine matches tokenized skill names and aliases from the repository skill catalog; it does not call an external taxonomy service.',
    },
    {
      name: 'Prerequisite Graph',
      value: 'Recorded DAG per role',
      glyph: 'DAG',
      glyphUnit: 'per role',
      viz: 'network',
      type: 'Recorded structure',
      typeClass: 'standard',
      desc: 'Prerequisite edges recorded in dag_structure.json. Recorded cycles are reported rather than repaired.',
    },
    {
      name: 'Hours per Skill',
      value: '8 – 24 hours / unit',
      glyph: '8–24',
      glyphUnit: 'hrs / unit',
      viz: 'hours',
      type: 'Heuristic',
      typeClass: 'heuristic',
      desc: 'Recorded per-skill estimates carried with the source wording "heuristic; …" (hours_per_skill.json). They are planning estimates, not measured learning times.',
    },
    {
      name: 'Budget Solver',
      value: '0–1 knapsack over recorded hours',
      glyph: '0–1',
      glyphUnit: 'knapsack',
      viz: 'solver',
      type: 'Deterministic algorithm',
      typeClass: 'heuristic',
      desc: 'The optimizer selects the highest-signal prerequisite-closed set within the hour budget using the recorded planning estimates.',
    },
  ],
  pipelineSteps: [
    {
      step: '01',
      title: 'Signal Ingestion',
      desc: 'Resume and job-description text is tokenized; recorded postings supply role frequencies.',
    },
    {
      step: '02',
      title: 'Skill Matching',
      desc: 'Tokens are matched to repository skill names and aliases. No external taxonomy or embedding service is called.',
    },
    {
      step: '03',
      title: 'Velocity Read',
      desc: 'Recorded role-slice velocity scores are read from the artifact; the live /velocity endpoint returns deterministic fixtures.',
    },
    {
      step: '04',
      title: 'Constrained Sizing',
      desc: 'A 0–1 knapsack fits the highest-signal prerequisite-closed set within the available hours.',
    },
  ],
}

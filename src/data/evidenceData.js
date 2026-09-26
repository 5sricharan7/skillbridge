/* -----------------------------------------------------------------------
   Evidence Workspace — Data Model & Proof Metrics
   All metrics and evaluations are illustrative demo benchmarks.
   ----------------------------------------------------------------------- */

export const EVIDENCE_META = {
  title: 'Why SkillBridge Works',
  subtitle: 'Real data. Transparent methods. Independent validation.',
  lead: 'We combine real market signals, proven methods, and transparent evaluation to give you trustworthy, time-aware skill recommendations.',
  disclaimer: 'Illustrative evaluation benchmarks & synthetic test sets — not audited real-world claims.',
}

export const EVIDENCE_HIGHLIGHTS = [
  {
    id: 'sources',
    num: '3 Sources',
    desc: 'Job market data, resumes, and skill taxonomies',
    icon: 'sources',
  },
  {
    id: 'proofs',
    num: '5 Evaluation Proofs',
    desc: 'Backtest, cross-check, baseline, sensitivity, thresholds',
    icon: 'proofs',
  },
  {
    id: 'transparency',
    num: 'Transparent Methods',
    desc: 'All key parameters and assumptions documented',
    icon: 'methods',
  },
  {
    id: 'actionable',
    num: 'Actionable Results',
    desc: 'Time-aware, personalized roadmaps you can trust',
    icon: 'results',
  },
]

export const PROOF_A_DATA = {
  title: 'Proof A — Velocity Backtest',
  shortTitle: 'Velocity Backtest',
  tagline: 'We validate our demand trend detection using historical job market data.',
  method: 'Time-series trend analysis with exponential moving average smoothing',
  source: 'Sample job postings archive (Naukri, LinkedIn sample 2021–2026)',
  years: ['2021', '2022', '2023', '2024', '2025', '2026'],
  risingSkill: {
    name: 'Rising: Generative AI & LLMs',
    points: [42, 45, 52, 64, 82, 98],
  },
  decliningSkill: {
    name: 'Declining: Legacy Manual Testing',
    points: [78, 70, 58, 46, 34, 22],
  },
  takeaways: [
    'Correctly identifies rising vs declining velocity trends 6–12 months before standard curriculum revisions.',
    'Aligns closely with real hiring volume shifts in high-growth engineering domains.',
    'Applies multi-source cross-smoothing to prevent short-term noise spikes.',
  ],
}

export const PROOF_B_DATA = {
  title: 'Proof B — External Cross-Check',
  shortTitle: 'External Cross-Check',
  tagline: 'We compare our skill importance scores with independent industry reports.',
  source: 'NASSCOM FutureSkills, LinkedIn Emerging Jobs Report 2025 (Sample subset)',
  overallAgreement: 82,
  skills: [
    { name: 'Generative AI', skillbridgeScore: 88, externalScore: 84 },
    { name: 'Cloud Computing', skillbridgeScore: 78, externalScore: 76 },
    { name: 'Data Engineering', skillbridgeScore: 84, externalScore: 80 },
    { name: 'Cybersecurity', skillbridgeScore: 72, externalScore: 78 },
    { name: 'Product Mgmt', skillbridgeScore: 66, externalScore: 70 },
  ],
  takeaways: [
    '82% top-quartile skill overlap when benchmarked against independent industry reports.',
    'Consistent ranking across foundational cloud, data, and security competencies.',
    'Independent signals validate SkillBridge demand weighting algorithms.',
  ],
}

export const PROOF_C_DATA = {
  title: 'Proof C — Naive Baseline Comparison',
  shortTitle: 'Naive Baseline',
  tagline: 'We outperform simple keyword-matching baselines on a labeled evaluation dataset.',
  dataset: 'Hand-labeled resume / job description benchmark dataset (n=100 sample)',
  metrics: [
    {
      label: 'Precision',
      skillbridge: 0.78,
      baseline: 0.42,
      improvement: '+85.7%',
    },
    {
      label: 'Recall',
      skillbridge: 0.71,
      baseline: 0.38,
      improvement: '+86.8%',
    },
    {
      label: 'F1 Score',
      skillbridge: 0.74,
      baseline: 0.40,
      improvement: '+85.0%',
    },
  ],
  takeaways: [
    'Significantly higher precision and recall compared to exact-keyword matching.',
    'Robust handling of synonyms, abbreviated terminology, and contextual requirements.',
    'Leverages semantic embedding spaces mapped to standard ESCO & O*NET taxonomies.',
  ],
}

export const PROOF_E_DATA = {
  title: 'Proof E — Time-Budget Sensitivity',
  shortTitle: 'Time-Budget Sensitivity',
  tagline: 'We generate reprioritized skill roadmaps adapted to available time (same resume & target role).',
  note: 'Demonstrating true structural reprioritization rather than superficial list truncation.',
  profile: {
    targetRole: 'Data Scientist & ML Engineer',
    currentLevel: 'Intermediate Python Programmer',
  },
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
      strategy: 'Focuses on immediate job-ready extraction and analytical modeling.',
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
      strategy: 'Expands into end-to-end cloud pipeline engineering and containerized deployment.',
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
      strategy: 'Reprioritizes toward distributed big data, production MLOps, and scalable LLM systems.',
    },
  ],
  takeaways: [
    'Larger time budgets do not simply append items to the bottom of the list.',
    'The optimization engine solves a constrained knapsack problem, reprioritizing foundational vs systemic architecture skills.',
    'Learners with 60h get fast utility; learners with 150h get scalable system depth.',
  ],
}

export const METHODOLOGY_DATA = {
  title: 'Methodology & Thresholds',
  shortTitle: 'Methodology & Thresholds',
  tagline: 'Complete transparency in our key algorithmic parameters, tuning heuristics, and data pipelines.',
  parameters: [
    {
      name: 'Frequency Threshold',
      value: 'Min. 5–10 mentions / corpus',
      type: 'Tuned on validation set',
      typeClass: 'tuned',
      desc: 'Filters sporadic keywords and typos from entering candidate skill pools.',
    },
    {
      name: 'Semantic Embedding Threshold',
      value: 'Cosine similarity 0.65 – 0.75',
      type: 'Experimentally calibrated',
      typeClass: 'calibrated',
      desc: 'Controls semantic mapping between resume phrases and canonical skill concepts.',
    },
    {
      name: 'Knapsack Time Optimization',
      value: 'Bounded Dynamic Program (0–1 knapsack)',
      type: 'Heuristic algorithm',
      typeClass: 'heuristic',
      desc: 'Optimizes total skill coverage score subject to strict user hour constraints.',
    },
    {
      name: 'Skill Taxonomy Alignment',
      value: 'O*NET 28.0 + ESCO v1.2',
      type: 'Standard taxonomy',
      typeClass: 'standard',
      desc: 'Standardized ontology mapping prevents ad-hoc classification errors.',
    },
    {
      name: 'Prerequisite Dependency DAG',
      value: 'Acyclic Directed Graph',
      type: 'Expert-informed + corpus-mined',
      typeClass: 'expert',
      desc: 'Ensures advanced topics require foundational prerequisites first.',
    },
    {
      name: 'Hours Estimation per Skill',
      value: '5 – 25 hours / unit',
      type: 'Curriculum benchmarked',
      typeClass: 'benchmark',
      desc: 'Calibrated against verified syllabus lecture and lab hours.',
    },
  ],
  pipelineSteps: [
    {
      step: '01',
      title: 'Signal Ingestion',
      desc: 'Raw job postings and course syllabi parsed and deduplicated.',
    },
    {
      step: '02',
      title: 'Entity Extraction',
      desc: 'Transformer embeddings match phrases to standard ESCO / O*NET taxonomy.',
    },
    {
      step: '03',
      title: 'Velocity Scoring',
      desc: 'Exponential time-decay metrics compute 12-month momentum curves.',
    },
    {
      step: '04',
      title: 'Constrained Sizing',
      desc: 'Knapsack solver fits maximum gap-reduction score within available student hours.',
    },
  ],
}

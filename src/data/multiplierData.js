export const MULTIPLIER_SECTIONS = [
  {
    id: 'overview',
    label: 'Overview & Thesis',
    kicker: 'Strategic System',
    title: 'The Multiplier Effect: Bridging Education to Employment',
    lead: 'How real-time labor market intelligence transforms static degrees into dynamic, time-budgeted career roadmaps for Bharat’s learners.',
    badge: 'Core Thesis',
  },
  {
    id: 'business-model',
    label: 'Business Model',
    kicker: 'Visual Centerpiece',
    title: 'Interactive Multi-Sided Network',
    lead: 'An interconnected ecosystem connecting learners, higher-ed institutions, and hiring employers through continuous skill alignment.',
    badge: 'Network Engine',
  },
  {
    id: 'market-opportunity',
    label: 'Market & Scalability',
    kicker: 'Context & Scale',
    title: 'Syllabus Latency & Algorithmic Reach',
    lead: 'Addressing multi-year curriculum lag across technical colleges with lightweight, low-compute optimization algorithms.',
    badge: 'Scale Architecture',
  },
  {
    id: 'stakeholders',
    label: 'Stakeholder Impact',
    kicker: 'Ecosystem Value',
    title: 'Compounding Value Across the Value Chain',
    lead: 'Measurable outcomes for Students, Academic Institutions, Corporate Recruiters, and National Workforce Development.',
    badge: '4 Constituents',
  },
  {
    id: 'comparison',
    label: 'How SkillBridge Differs',
    kicker: 'Capability Matrix',
    title: 'Factual Comparison Against Existing Alternatives',
    lead: 'A capability-by-capability breakdown comparing market-signal routing, time budgeting, and curriculum tooling.',
    badge: 'Capability Audit',
  },
  {
    id: 'roadmap',
    label: 'Execution Roadmap',
    kicker: 'Phased Milestones',
    title: 'From Campus Pilots to National Infrastructure',
    lead: 'A disciplined 4-stage deployment roadmap focused on Tier 2/3 engineering colleges and employer feedback loops.',
    badge: '4 Phases',
  },
]

export const OVERVIEW_DATA = {
  thesis: {
    problem: 'Technical curricula in colleges typically update on 3–5 year cycles, while modern job requirements shift every 6–12 months. This structural latency leaves students studying deprecated stacks.',
    solution: 'SkillBridge ingests live market signals (job postings, ESCO/O*NET taxonomies) and computes individual, time-constrained learning roadmaps (5h to 20h/week) using deterministic knapsack algorithms.',
    multiplier: 'When learners acquire verified, high-demand skills, placement velocity increases, corporate retraining costs drop, and institutions gain empirical data for outcome-based curriculum audits.',
  },
  pillars: [
    {
      title: 'Time-Budget Optimization',
      desc: 'Sizes learning plans to the student’s actual weekly availability (e.g. 10 hours/week) instead of open-ended 100-hour video playlists.',
      tag: 'Deterministic Routing',
    },
    {
      title: 'Real-Time Signal Ingestion',
      desc: 'Normalizes job requisitions against standardized skill taxonomies to identify rising versus declining industry requirements.',
      tag: 'Signal Taxonomy',
    },
    {
      title: 'Curriculum Co-Pilot for Deans',
      desc: 'Provides department heads with empirical gap audits and micro-module recommendations to augment existing university syllabi.',
      tag: 'Institutional Layer',
    },
    {
      title: 'Verifiable Evidence Scores',
      desc: 'Pairs skill self-assessments with code artifacts, backtested proof benchmarks, and portfolio proof items for employers.',
      tag: 'Proof Layer',
    },
  ],
}

export const NETWORK_FLOW_STEPS = [
  {
    id: 'learners',
    title: 'Learners',
    sub: 'Students & Job Seekers',
    role: 'Upload background, declare weekly hours, receive ranked roadmap.',
    color: '#5b46d8',
    outputs: ['Time-aware skill sequence', 'Verifiable portfolio proof', 'Targeted interview prep'],
  },
  {
    id: 'skillbridge',
    title: 'SkillBridge Engine',
    sub: 'Optimization & Taxonomy Core',
    role: 'Ingests market signals, performs knapsack graph allocation, computes curriculum gaps.',
    color: '#4332a6',
    outputs: ['ESCO/O*NET mapping', 'Weekly hour sizing', 'Curriculum audit scores'],
  },
  {
    id: 'institutions',
    title: 'Institutions & Colleges',
    sub: 'Deans, HODs & Placement Cells',
    role: 'Audit branch syllabi, schedule elective micro-modules, track cohort readiness.',
    color: '#2d8a4e',
    outputs: ['Outcome-based education data', 'NAAC/NBA metric packs', 'Higher placement rates'],
  },
  {
    id: 'employers',
    title: 'Employers & Industry',
    sub: 'Talent Acquisition & Tech Teams',
    role: 'Post verified role benchmarks, discover candidates by proven competency rather than college brand.',
    color: '#b35300',
    outputs: ['Lower screening overhead', 'Reduced day-1 onboarding', 'Direct Tier 2/3 talent pipeline'],
  },
  {
    id: 'impact',
    title: 'Multiplied Outcome',
    sub: 'Ecosystem & Regional Economic Yield',
    role: 'Accelerated time-to-first-job, increased starting compensation, and regional talent retention.',
    color: '#15131c',
    outputs: ['Accelerated job placement', 'Household income uplift', 'Modernized technical education'],
  },
]

export const BUSINESS_MODEL_STREAMS = [
  {
    segment: 'B2C Learners (Freemium)',
    model: 'Self-Paced Career Navigation',
    pricing: 'Free Basic / Pro Subscription (₹499/mo illustrative)',
    features: ['Instant skill gap scan', 'Time-budgeted weekly planner', 'Artifact generator & interview bank'],
  },
  {
    segment: 'B2B Technical Colleges',
    model: 'Annual Department SaaS License',
    pricing: 'Per-student annual campus fee (₹800–₹1,200 illustrative)',
    features: ['Curriculum Time Machine syllabus audits', 'NAAC/NBA accreditation data exports', 'Cohort placement readiness dashboards'],
  },
  {
    segment: 'B2B Employers & Recruiters',
    model: 'Verified Talent Intelligence',
    pricing: 'Subscription + hiring intelligence tier',
    features: ['Competency-based candidate shortlisting', 'Custom skill benchmark mapping', 'Direct Tier 2/3 campus discovery'],
  },
  {
    segment: 'Ecosystem Integrations',
    model: 'Open Taxonomy & Optimization API',
    pricing: 'Usage-based API for bootcamps & LMS partners',
    features: ['Curriculum auditing endpoints', 'Skill graph traversal API', 'Credential verification hooks'],
  },
]

export const MARKET_SCALABILITY_DATA = {
  marketContext: [
    { label: 'Technical Graduates / Year', val: '1.5M+', note: 'Engineering & MCA graduates entering the workforce annually', source: 'AISHE / Industry Estimates' },
    { label: 'Skill-to-Job Latency Gap', val: '50%+', note: 'Graduates requiring 3–6 months company retraining upon hiring', source: 'Corporate Hiring Audits' },
    { label: 'University Syllabus Revision Cycle', val: '3–5 Yrs', note: 'Standard university academic council approval timeframe', source: 'Academic Council Baseline' },
    { label: 'Technical Colleges Across Bharat', val: '10,000+', note: 'Tier 1, Tier 2, and Tier 3 engineering institutions nationwide', source: 'AICTE Institutional Scope' },
  ],
  cascadeFlow: [
    { num: '01', phase: 'Market Signals', desc: 'Continuous crawl of real job requisitions mapped to ESCO/O*NET skill taxonomies' },
    { num: '02', phase: 'Algorithmic Scale', desc: 'Deterministic knapsack solver sizes individual plans to student hours in <50ms' },
    { num: '03', phase: 'Campus Distribution', desc: 'College placement cells deploy Curriculum Time Machine for cohort-wide adoption' },
    { num: '04', phase: 'Compounded Impact', desc: 'Higher placement velocity, lower corporate retraining, and verified portfolio proofs' },
  ],
  scalabilityFactors: [
    {
      title: 'Deterministic Algorithmic Routing',
      insight: 'Sub-second knapsack optimization scales to 500,000+ learners with near-zero marginal server cost compared to linear LLM token inference.',
      desc: 'Mathematical graph optimization sizes each student’s weekly roadmap (5h–20h) against prerequisite trees without expensive model re-training.',
    },
    {
      title: 'Unified Skill Graph Standard',
      insight: 'A single taxonomy update propagates across 200+ career profiles simultaneously in real time.',
      desc: 'ESCO and O*NET skill nodes are normalized into a shared graph, eliminating manual curriculum authoring and linear maintenance overhead.',
    },
    {
      title: 'Institutional Placement Flywheel',
      insight: 'Partnering directly with engineering deans provides organic, campus-wide onboarding with zero customer acquisition cost per student.',
      desc: 'Department heads use Curriculum Time Machine for NAAC/NBA accreditation data, driving natural student uptake across entire college branches.',
    },
  ],
}

export const STAKEHOLDER_CARDS = [
  {
    title: 'For Learners & Students',
    role: 'Clarity, Confidence & Focused Time',
    gains: [
      'Stop guessing which technologies to learn first with limited weekly hours.',
      'Build practical code evidence that bypasses arbitrary college pedigree filters.',
      'Sized roadmap fits alongside university exam and project commitments.',
    ],
  },
  {
    title: 'For Academic Institutions',
    role: 'Curriculum Modernization & Placement Growth',
    gains: [
      'Empirical gap identification between existing syllabus and current hiring demand.',
      'Structured outcome-based education documentation for NAAC and NBA reviews.',
      'Improved campus placement metrics across engineering disciplines.',
    ],
  },
  {
    title: 'For Hiring Employers',
    role: 'Quality Sourcing & Reduced Onboarding',
    gains: [
      'Evaluate candidates by verified skill mastery and project proof artifacts.',
      'Reduce day-1 corporate bootcamp duration for entry-level hires.',
      'Access undiscovered engineering talent in Tier 2 and Tier 3 cities.',
    ],
  },
  {
    title: 'For National Workforce',
    role: 'Inclusive Skill Mobilization',
    gains: [
      'Democratizes career intelligence beyond elite metro institutions.',
      'Aligns regional technical education capacity with national digital growth.',
      'Fosters merit-based talent matching across states and languages.',
    ],
  },
]

export const COMPARISON_TABLE = [
  {
    dimension: 'Market Signal Freshness',
    skillbridge: 'Monthly live requisition crawls + ESCO taxonomy updates',
    jobPortals: 'Static keyword postings with no curriculum mapping',
    coursePlatforms: 'Pre-recorded courses updated every 2–4 years',
    aiTools: 'Generic text prompts without verified labor datasets',
  },
  {
    dimension: 'Time-Budget Optimization',
    skillbridge: 'Deterministic knapsack sizing (e.g. 5h, 10h, 20h/week plans)',
    jobPortals: 'None (job search only)',
    coursePlatforms: 'Rigid fixed-duration 40–100 hour video playlists',
    aiTools: 'Generic unconstrained study schedules',
  },
  {
    dimension: 'Curriculum Co-Pilot for Colleges',
    skillbridge: 'Curriculum Time Machine with NAAC/NBA outcome mapping',
    jobPortals: 'None',
    coursePlatforms: 'Competes against colleges rather than augmenting them',
    aiTools: 'None',
  },
  {
    dimension: 'Verifiable Evidence Layer',
    skillbridge: 'Transparent backtests, sensitivity models & proof artifacts',
    jobPortals: 'Unverified self-reported resumes',
    coursePlatforms: 'Completion certificates without proof validation',
    aiTools: 'AI-generated text without empirical verification',
  },
  {
    dimension: 'Tier 2 & 3 Bharat Focus',
    skillbridge: 'Accessible, pedigree-agnostic skill benchmarking',
    jobPortals: 'Pedigree-biased campus filtering',
    coursePlatforms: 'High fee barriers (₹50,000–₹1,50,000 bootcamps)',
    aiTools: 'Western-centric prompt defaults',
  },
]

export const ROADMAP_PHASES = [
  {
    phase: 'Phase 1: Pilot & Evidence Validation',
    status: 'Current Active',
    focus: '20 Pilot Colleges (25,000 Students)',
    deliverables: [
      'Validate time-budgeting completion rates across student cohorts.',
      'Deploy Curriculum Time Machine for syllabus gap audits.',
      'Establish employer feedback loops on verified proof artifacts.',
    ],
  },
  {
    phase: 'Phase 2: Institutional SaaS Expansion',
    status: 'Upcoming',
    focus: '100+ Campuses across South & West India',
    deliverables: [
      'Automate college LMS and student roster synchronization.',
      'Launch Dean & HOD accreditation reporting pack (NAAC/NBA).',
      'Expand skill taxonomies to Data Engineering, VLSI, and Cloud Native.',
    ],
  },
  {
    phase: 'Phase 3: Multi-Region Bharat Scale',
    status: 'Planned',
    focus: '500+ Campuses across 18 States',
    deliverables: [
      'Introduce localized learning roadmap interfaces.',
      'Launch verified candidate talent discovery portal for employers.',
      'Partner with state skill development missions.',
    ],
  },
  {
    phase: 'Phase 4: Open Infrastructure Standard',
    status: 'Vision',
    focus: 'National Open Skill Graph Standard',
    deliverables: [
      'Publish Open SkillBridge Optimization API for third-party EdTech.',
      'Support continuous alumni and workforce upskilling tracks.',
    ],
  },
]

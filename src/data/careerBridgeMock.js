export const CAREER_BRIDGE_MIN_BUDGET = 10
export const CAREER_BRIDGE_MAX_BUDGET = 200
export const CAREER_BRIDGE_DEFAULT_BUDGET = 60
export const CAREER_BRIDGE_BANDS = [30, 60, 90, 120, 150]

export const CAREER_BRIDGE_PROFILE = {
  targetRole: 'Embedded Systems Engineer',
  resume: {
    label: 'Resume',
    file: 'Resume.pdf',
    status: 'Analyzed',
    detail: '28 skills found',
  },
  jobDescription: {
    label: 'Target role',
    file: 'Embedded Systems Engineer',
    status: 'Analyzed',
    detail: '42 key skills identified',
  },
  analysisNote: 'Signal set · local mock analysis',
}

const SKILLS = [
  {
    id: 'python',
    name: 'Python',
    rankByBand: { 30: 3, 60: 1, 90: 1, 120: 2, 150: 3 },
    hoursByBand: { 30: 4, 60: 10, 90: 14, 120: 18, 150: 22 },
    priority: 'High',
    trend: 'Rising',
    demand: '+38%',
    type: 'Core Skill',
    description:
      'Python is widely required for automation, data analysis, embedded tooling and machine learning. It provides a strong foundation for multiple career paths.',
    why: 'Found in 78% of target job descriptions.',
    prerequisites: ['Basic programming logic'],
    topics: ['Python Basics', 'Data Structures', 'Libraries (NumPy)', 'Scripting for Embedded', 'Mini Projects'],
    resources: ['freeCodeCamp', 'Python Official Docs', 'Corey Schafer', 'GeeksforGeeks'],
  },
  {
    id: 'embedded',
    name: 'Embedded Systems',
    rankByBand: { 30: 2, 60: 2, 90: 3, 120: 4, 150: 5 },
    hoursByBand: { 30: 6, 60: 12, 90: 16, 120: 20, 150: 22 },
    priority: 'High',
    trend: 'Rising',
    demand: '+41%',
    type: 'Core Skill',
    description:
      'Embedded Systems is the core domain of the target role, covering firmware structure, microcontroller workflows and systems-level debugging.',
    why: 'Appears explicitly in 86% of target job descriptions.',
    prerequisites: ['C programming'],
    topics: ['Microcontrollers', 'GPIO & peripherals', 'Firmware basics', 'Debug tooling'],
    resources: ['ARM developer docs', 'Bare-metal walkthroughs', 'Embedded Linux intro'],
  },
  {
    id: 'c-programming',
    name: 'C Programming',
    rankByBand: { 30: 1, 60: 3, 90: 5, 120: 6, 150: 7 },
    hoursByBand: { 30: 4, 60: 8, 90: 8, 120: 8, 150: 10 },
    priority: 'High',
    trend: 'Stable',
    demand: '+18%',
    type: 'Core Skill',
    description:
      'C is the primary language of embedded firmware. A solid grasp of pointers, memory and compilation maps directly onto microcontroller work.',
    why: 'Listed as a requirement in 71% of target postings.',
    prerequisites: ['Basic programming logic'],
    topics: ['Pointers & memory', 'Structs & control flow', 'Build tooling', 'Debugging basics'],
    resources: ['K&R examples', 'Compiler docs', 'Practice problems'],
  },
  {
    id: 'machine-learning',
    name: 'Machine Learning',
    rankByBand: { 30: 5, 60: 4, 90: 2, 120: 1, 150: 1 },
    hoursByBand: { 30: 4, 60: 6, 90: 18, 120: 24, 150: 30 },
    priority: 'Medium',
    trend: 'Rising',
    demand: '+52%',
    type: 'Advanced Skill',
    description:
      'Machine learning adds signal to edge devices and analytics. It becomes worth serious time as the route expands beyond the core firmware path.',
    why: 'Mentioned in about half of the more senior target descriptions.',
    prerequisites: ['Python', 'Statistics basics'],
    topics: ['NumPy & pandas', 'Supervised models', 'Model evaluation', 'Edge inference'],
    resources: ['Scikit-learn guides', 'fast.ai notes', 'Kaggle fundamentals'],
  },
  {
    id: 'vlsi',
    name: 'VLSI Fundamentals',
    rankByBand: { 30: 6, 60: 6, 90: 7, 120: 7, 150: 6 },
    hoursByBand: { 30: 3, 60: 4, 90: 6, 120: 10, 150: 14 },
    priority: 'Medium',
    trend: 'Stable',
    demand: '+9%',
    type: 'Specialized Skill',
    description:
      'Basic VLSI concepts explain how hardware is designed and verified, giving context for the faster, lower-power tradeoffs on real targets.',
    why: 'Shows up in hardware-focused variants of the role.',
    prerequisites: ['Electronics basics'],
    topics: ['Digital logic', 'Synthesis overview', 'Verification flow'],
    resources: ['Harris & Harris chapters', 'Vendor tutorials'],
  },
  {
    id: 'aws',
    name: 'AWS (Cloud)',
    rankByBand: { 30: 7, 60: 7, 90: 6, 120: 3, 150: 2 },
    hoursByBand: { 30: 2, 60: 4, 90: 8, 120: 16, 150: 24 },
    priority: 'Medium',
    trend: 'Rising',
    demand: '+30%',
    type: 'Support Skill',
    description:
      'Cloud services support device fleets, data pipelines and remote diagnostics. The value grows as the roadmap moves toward deployment.',
    why: 'Required in the cloud-leaning share of the target set.',
    prerequisites: ['Networking basics'],
    topics: ['EC2 & IAM', 'Data pipelines', 'Device onboarding'],
    resources: ['AWS free-tier labs', 'Official workshops'],
  },
  {
    id: 'sql',
    name: 'SQL',
    rankByBand: { 30: 4, 60: 5, 90: 4, 120: 5, 150: 4 },
    hoursByBand: { 30: 4, 60: 6, 90: 10, 120: 12, 150: 14 },
    priority: 'Medium',
    trend: 'Stable',
    demand: '+14%',
    type: 'Support Skill',
    description:
      'SQL handles the data side of the job — reading telemetry, querying logs and structuring metrics for the broader system.',
    why: 'Referenced steadily across analyzed postings.',
    prerequisites: ['None required'],
    topics: ['SELECT & joins', 'Aggregations', 'Querying telemetry'],
    resources: ['Postgres docs', 'Interactive SQL courses'],
  },
  {
    id: 'web',
    name: 'Web Development',
    rankByBand: { 30: 8, 60: 8, 90: 8, 120: 8, 150: 8 },
    hoursByBand: { 30: 2, 60: 4, 90: 4, 120: 6, 150: 8 },
    priority: 'Low',
    trend: 'Declining',
    demand: '-6%',
    type: 'Support Skill',
    description:
      'Web development appears least often in the target descriptions and stays last in the route, useful only as a peripheral skill.',
    why: 'Present in the smallest share of analyzed postings.',
    prerequisites: ['Basic programming logic'],
    topics: ['HTML & CSS', 'Simple dashboards'],
    resources: ['MDN course', 'Minimal project briefs'],
  },
]

const BANDS = CAREER_BRIDGE_BANDS

export function pickBand(budget) {
  if (budget < 60) return 30
  if (budget < 90) return 60
  if (budget < 120) return 90
  if (budget < 150) return 120
  return 150
}

export function getBudgetBand(budget) {
  return pickBand(budget)
}

export function getMockRoadmap(budget) {
  const band = pickBand(budget)
  return SKILLS.map((skill) => ({
    id: skill.id,
    name: skill.name,
    type: skill.type,
    hours: skill.hoursByBand[band],
    priority: skill.priority,
    trend: skill.trend,
    demand: skill.demand,
    rank: skill.rankByBand[band],
    description: skill.description,
    why: skill.why,
    prerequisites: skill.prerequisites,
    topics: skill.topics,
    resources: skill.resources,
  }))
    .sort((a, b) => a.rank - b.rank)
    .map((skill, index) => ({ ...skill, position: index + 1 }))
}

export function getRoadmapHours(roadmap) {
  return roadmap.reduce((sum, skill) => sum + skill.hours, 0)
}
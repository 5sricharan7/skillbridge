import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

const STEPS = [
  { n: '01', title: 'Explore Roles', body: 'Discover roles based on your interests.' },
  { n: '02', title: 'See Skill Gaps', body: 'Compare your skills with real job data.' },
  { n: '03', title: 'Get Timed Plan', body: 'Our AI creates a time-aware learning roadmap.' },
  { n: '04', title: 'Track & Grow', body: 'Monitor progress and get updated recommendations.' }
]

const PATH_D = 'M150 30 C 275 42, 375 18, 450 30 C 575 42, 675 18, 750 30 C 875 42, 975 18, 1050 30'
const NODE_X = [150, 450, 750, 1050]

function StepIcon({ i }) {
  const d = [
    'M5 19v-6l3 1 1 5 5-1 1 5 M15 7h4 M17 5v4',
    'M6 4v16M18 4v16M6 12h12l-4 5 M6 12l4-5',
    'M12 6v6l4 2 M19 8a7 7 0 1 1-2-5',
    'M6 4v16M18 4v16M8 8h8M8 13h8M8 18h5'
  ][i]
  return (
    <span className="jstep-ico" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <path d={d} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

export default function JourneySection() {
  const rootRef = useRef(null)
  const svgRef = useRef(null)
  const stepRefs = useRef([])

  useEffect(() => {
    let ctx
    const raf = requestAnimationFrame(() => {
      const svg = svgRef.current
      if (!svg) return
      const progress = svg.querySelector('.jny-progress')
      const total = progress.getTotalLength()

      const boundaries = [0]
      let cursor = 0
      const STEP = 2
      for (let i = 1; i < NODE_X.length; i++) {
        const target = NODE_X[i]
        let lastX = -1
        while (cursor <= total) {
          lastX = progress.getPointAtLength(cursor).x
          if (lastX >= target) break
          cursor += STEP
        }
        boundaries.push(Math.min(cursor, total))
      }

      gsap.set(progress, { strokeDasharray: total, strokeDashoffset: total })

      const update = (t) => {
        progress.style.strokeDashoffset = total * (1 - t)
        let count = 1
        for (let i = 1; i < boundaries.length; i++) {
          if (t >= boundaries[i] / total) count = i + 1
        }
        stepRefs.current.forEach((el, i) => {
          if (el) el.classList.toggle('is-active', i < count)
        })
      }

      ctx = gsap.context(() => {
        ScrollTrigger.create({
          trigger: rootRef.current,
          start: 'top 90%',
          end: 'bottom 40%',
          scrub: 0.35,
          onUpdate: (self) => update(gsap.utils.clamp(0, 1, self.progress))
        })
      }, rootRef)
    })

    return () => {
      cancelAnimationFrame(raf)
      if (ctx) ctx.revert()
    }
  }, [])

  return (
    <section id="journey" className="journey" ref={rootRef}>
      <div className="journey-head">
        <div className="section-kicker">How it works</div>
        <h2 className="section-title">
          From Your Goals
          <br />
          <em>to a Clear Plan.</em>
        </h2>
      </div>

      <div className="journey-wrap">
        <svg
          className="journey-svg"
          viewBox="0 0 1200 52"
          preserveAspectRatio="none"
          aria-hidden="true"
          ref={svgRef}
        >
          <path className="jny-base" d={PATH_D} />
          <path className="jny-progress" d={PATH_D} />
        </svg>

        <div className="journey-steps">
          {STEPS.map((s, i) => (
            <div
              key={s.n}
              className={`jstep jstep-${i + 1}${i === 0 ? ' is-active' : ''}`}
              ref={(el) => {
                stepRefs.current[i] = el
              }}
            >
              <span className="jstep-num">{s.n}</span>
              <StepIcon i={i} />
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
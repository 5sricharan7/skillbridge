import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { navigate } from '../router'

gsap.registerPlugin(ScrollTrigger)

const GAPS = [
  { name: 'Python', pct: 26 },
  { name: 'SQL', pct: 58 },
  { name: 'Statistics', pct: 76 }
]

const PRIO = [
  { rank: '01', name: 'SQL fundamentals', tag: 'Foundation' },
  { rank: '02', name: 'Statistics', tag: 'Priority' },
  { rank: '03', name: 'Python', tag: 'Long run' }
]

const ROAD = ['Foundations', 'Analyze', 'Model', 'Package']

function Ico({ d }) {
  return (
    <span className="ico" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <path d={d} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

function RmGauge() {
  const r = 26
  const c = 2 * Math.PI * r
  return (
    <svg viewBox="0 0 64 64" className="rm-gauge" aria-hidden="true">
      <circle cx="32" cy="32" r={r} fill="none" stroke="#edeaf6" strokeWidth="6" />
      <circle
        className="rm-gauge-fill"
        cx="32"
        cy="32"
        r={r}
        fill="none"
        stroke="var(--indigo)"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c}
        transform="rotate(-90 32 32)"
      />
      <text x="32" y="27" textAnchor="middle" className="rm-gauge-t">
        68%
      </text>
      <text x="32" y="40" textAnchor="middle" className="rm-gauge-l">
        aligned
      </text>
    </svg>
  )
}

export default function CareerRoadmap() {
  const secRef = useRef(null)
  const cardRef = useRef(null)
  const barRefs = useRef([])

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        cardRef.current,
        { y: 20, scale: 0.98, rotate: -2.2, autoAlpha: 0.85, transformOrigin: '50% 72%' },
        {
          y: 0,
          scale: 1,
          rotate: -1.2,
          autoAlpha: 1,
          ease: 'power3.out',
          duration: 0.95,
          scrollTrigger: { trigger: cardRef.current, start: 'top 86%', once: true }
        }
      )

      gsap.fromTo(
        '.roadmap-visual',
        { y: 14 },
        {
          y: -14,
          ease: 'none',
          scrollTrigger: { trigger: '#roadmap', start: 'top bottom', end: 'bottom top', scrub: 0.4 }
        }
      )

      barRefs.current.forEach((el, i) => {
        const w = el.dataset.w
        gsap.fromTo(
          el,
          { width: 0 },
          {
            width: w,
            ease: 'power2.out',
            duration: 0.9,
            delay: 0.2 + i * 0.08,
            scrollTrigger: { trigger: cardRef.current, start: 'top 66%', once: true }
          }
        )
      })

      const gauge = document.querySelector('.rm-gauge-fill')
      const c = 2 * Math.PI * 26
      gsap.fromTo(
        gauge,
        { strokeDashoffset: c },
        {
          strokeDashoffset: c * (1 - 0.68),
          ease: 'power2.out',
          duration: 1.2,
          delay: 0.35,
          scrollTrigger: { trigger: cardRef.current, start: 'top 66%', once: true }
        }
      )
    }, secRef)

    return () => ctx.revert()
  }, [])

  return (
    <section id="roadmap" className="roadmap" ref={secRef}>
      <div className="roadmap-intro">
        <div className="section-kicker">Our solution</div>
        <h2 className="section-title">
          A Smarter, Personalized
          <br />
          <em>Career Roadmap.</em>
        </h2>
        <p className="section-lead">
          SkillBridge analyzes real job market data to show you what skills matter, how big your
          gap is, and what to learn based on your time.
        </p>
        <div className="roadmap-cta">
          <button type="button" className="btn btn-dark btn-lg" onClick={() => navigate('/career-bridge')}>
            Get Started <span aria-hidden="true">↗</span>
          </button>
          <button type="button" className="btn btn-ghost btn-lg">
            Watch Demo
          </button>
        </div>
      </div>

      <div className="roadmap-visual">
        <div className="rm-glow" aria-hidden="true" />
        <article className="rm-card" ref={cardRef}>
          <header className="rm-top">
            <span className="rm-flag">
              <span /> Career roadmap
            </span>
            <strong className="rm-role">Data Analyst</strong>
          </header>

          <div className="rm-flow">
            <div className="rm-node">
              <Ico d="M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 9c.6-3.4 3-5.5 6-5.5s5.4 2.1 6 5.5" />
              <div>
                <small>Your profile</small>
                <b>Resume + interests</b>
              </div>
            </div>
            <span className="rm-flow-arr" aria-hidden="true">
              →
            </span>
            <div className="rm-node">
              <Ico d="M4 21 13 21 M4 17 17 17 M4 13 11 13 M8 5 C10 9 20 6 20 16 M17 10 C19 12 19 16 17 18" />
              <div>
                <small>Target role</small>
                <b>Data Analyst</b>
              </div>
            </div>
          </div>

          <div className="rm-block">
            <div className="rm-label">Skill gaps</div>
            <div className="rm-bars">
              {GAPS.map((g, i) => (
                <div key={g.name} className="rm-bar">
                  <div className="rm-bar-head">
                    <span>{g.name}</span>
                    <b>{g.pct}%</b>
                  </div>
                  <div className="rm-track">
                    <i
                      className="rm-fill"
                      ref={(el) => {
                        if (el) {
                          el.dataset.w = `${g.pct}%`
                          barRefs.current[i] = el
                        }
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rm-block">
            <div className="rm-label">Prioritized plan</div>
            <ol className="rm-prio">
              {PRIO.map((p) => (
                <li key={p.name} className="rm-pri">
                  <span className="rm-rank">{p.rank}</span>
                  <span className="rm-pname">{p.name}</span>
                  <span className="rm-ptag">{p.tag}</span>
                </li>
              ))}
            </ol>
          </div>

          <footer className="rm-road">
            <div className="rm-road-steps">
              {ROAD.map((s, i) => (
                <span key={s} className="rm-mil">
                  <i className={`rm-dot ${i === 0 ? 'is-on' : ''}`} />
                  {s}
                </span>
              ))}
            </div>
            <RmGauge />
          </footer>
        </article>

        <div className="rm-marks" aria-hidden="true">
          <svg className="rm-mark rm-m1" viewBox="0 0 24 24">
            <path d="M10 3h4M12 1v4M8 12h8M4 12v4M20 12v4M6 6l2 2M18 6l-2 2M6 18l2-2M18 18l-2-2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <svg className="rm-mark rm-m2" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <circle cx="12" cy="12" r="1.6" fill="currentColor" />
          </svg>
          <svg className="rm-mark rm-m3" viewBox="0 0 24 24">
            <path d="M12 3v18M3 12h18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
        </div>
      </div>
    </section>
  )
}
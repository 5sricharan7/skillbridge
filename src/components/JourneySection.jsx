import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

const STEPS = [
  {
    n: '01',
    title: 'Explore Roles',
    body: 'Discover roles based on your interests and current foundation.',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" className="jstep-illustration">
        <rect x="8" y="10" width="22" height="28" rx="4" fill="#e9e7fb" stroke="#4b33a5" strokeWidth="1.5" />
        <rect x="13" y="17" width="12" height="2" rx="1" fill="#4b33a5" opacity="0.5" />
        <rect x="13" y="22" width="9" height="2" rx="1" fill="#4b33a5" opacity="0.35" />
        <rect x="13" y="27" width="11" height="2" rx="1" fill="#4b33a5" opacity="0.25" />
        <circle cx="34" cy="32" r="8" fill="#4b33a5" opacity="0.12" />
        <circle cx="34" cy="32" r="5.5" fill="none" stroke="#4b33a5" strokeWidth="1.8" />
        <line x1="38" y1="36" x2="42" y2="40" stroke="#4b33a5" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  },
  {
    n: '02',
    title: 'See Skill Gaps',
    body: 'Compare your verified skills with real-time job posting demands.',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" className="jstep-illustration">
        <rect x="6" y="6" width="36" height="36" rx="6" fill="#e9e7fb" />
        <rect x="12" y="28" width="5" height="12" rx="2" fill="#b3a1fd" />
        <rect x="21" y="20" width="5" height="20" rx="2" fill="#4b33a5" />
        <rect x="30" y="14" width="5" height="26" rx="2" fill="#4b33a5" opacity="0.6" />
        <line x1="8" y1="42" x2="40" y2="42" stroke="#4b33a5" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    )
  },
  {
    n: '03',
    title: 'Get Timed Plan',
    body: 'Our optimization engine generates a time-aware learning roadmap.',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" className="jstep-illustration">
        <rect x="6" y="10" width="36" height="32" rx="6" fill="#e9e7fb" stroke="#4b33a5" strokeWidth="1.2" />
        <line x1="6" y1="18" x2="42" y2="18" stroke="#4b33a5" strokeWidth="1.2" />
        <line x1="16" y1="6" x2="16" y2="14" stroke="#4b33a5" strokeWidth="2" strokeLinecap="round" />
        <line x1="32" y1="6" x2="32" y2="14" stroke="#4b33a5" strokeWidth="2" strokeLinecap="round" />
        <circle cx="24" cy="30" r="7" fill="#4b33a5" opacity="0.15" />
        <circle cx="24" cy="30" r="5" fill="none" stroke="#4b33a5" strokeWidth="1.6" />
        <line x1="24" y1="26" x2="24" y2="30" stroke="#4b33a5" strokeWidth="1.8" strokeLinecap="round" />
        <line x1="24" y1="30" x2="27" y2="32" stroke="#4b33a5" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    )
  },
  {
    n: '04',
    title: 'Track & Grow',
    body: 'Monitor progress, complete milestones, and stay ahead of changes.',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" className="jstep-illustration">
        <rect x="6" y="6" width="36" height="36" rx="6" fill="#e9e7fb" />
        <polyline points="10,34 20,24 28,30 38,14" stroke="#4b33a5" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points="32,14 38,14 38,20" fill="none" stroke="#4b33a5" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="20" cy="24" r="2.5" fill="#4b33a5" opacity="0.4" />
        <circle cx="28" cy="30" r="2.5" fill="#4b33a5" opacity="0.4" />
      </svg>
    )
  }
]

// Arrow connector between cards — large and clearly visible
function StepArrow() {
  return (
    <div className="jstep-connector" aria-hidden="true">
      <svg viewBox="0 0 56 24" className="jstep-connector-svg" fill="none">
        <line x1="4" y1="12" x2="44" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 3" />
        <polyline points="36 4 48 12 36 20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

export default function JourneySection() {
  const rootRef = useRef(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Heading reveal
      gsap.fromTo(
        '.journey-head',
        { autoAlpha: 0, y: 22 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.85,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: rootRef.current,
            start: 'top 83%',
            once: true
          }
        }
      )

      // Cards stagger
      gsap.fromTo(
        '.jstep-card',
        { autoAlpha: 0, y: 28 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.7,
          stagger: 0.13,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: '.journey-flow-row',
            start: 'top 84%',
            once: true
          }
        }
      )

      // Connectors draw in with scale + fade
      gsap.fromTo(
        '.jstep-connector',
        { autoAlpha: 0, scaleX: 0.4 },
        {
          autoAlpha: 1,
          scaleX: 1,
          duration: 0.55,
          stagger: 0.13,
          delay: 0.4,
          ease: 'power2.out',
          transformOrigin: 'left center',
          scrollTrigger: {
            trigger: '.journey-flow-row',
            start: 'top 84%',
            once: true
          }
        }
      )

      // Hover lift on cards
      const cards = document.querySelectorAll('.jstep-card')
      cards.forEach((card) => {
        card.addEventListener('mouseenter', () => {
          gsap.to(card, { y: -6, duration: 0.22, ease: 'power2.out' })
          gsap.to(card.querySelector('.jstep-illustration'), { scale: 1.06, duration: 0.22, ease: 'power2.out' })
        })
        card.addEventListener('mouseleave', () => {
          gsap.to(card, { y: 0, duration: 0.22, ease: 'power2.out' })
          gsap.to(card.querySelector('.jstep-illustration'), { scale: 1, duration: 0.22, ease: 'power2.out' })
        })
      })
    }, rootRef)

    return () => ctx.revert()
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
        <p className="section-lead">
          A simple 4-step journey to discover, plan, and grow your career with data and AI.
        </p>
      </div>

      <div className="journey-flow-row" role="list">
        {STEPS.map((s, i) => (
          <div key={s.n} className="journey-step-wrapper">
            <article className="jstep-card" role="listitem">
              <div className="jstep-card-top">
                <span className="jstep-badge">{s.n}</span>
                <div className="jstep-icon-bubble" aria-hidden="true">
                  {s.icon}
                </div>
              </div>
              <h3 className="jstep-title">{s.title}</h3>
              <p className="jstep-body">{s.body}</p>
            </article>
            {i < STEPS.length - 1 && <StepArrow />}
          </div>
        ))}
      </div>
    </section>
  )
}
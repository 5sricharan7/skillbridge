import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

const STATS = [
  {
    value: '2.8M+',
    label: 'Job postings analyzed',
    icon: (
      <svg viewBox="0 0 24 24" className="si" aria-hidden="true">
        <path d="M7 3h7l4 4v14H7z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="M14 3v4h4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="M10 9h5M10 12.5h5M10 16h2" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    )
  },
  {
    value: '50,000+',
    label: 'Skills mapped (ESCO + O*NET)',
    icon: (
      <svg viewBox="0 0 24 24" className="si" aria-hidden="true">
        <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.7" />
        <circle cx="12" cy="12" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
        <circle cx="12" cy="12" r="1.2" fill="currentColor" />
        <path d="M18.5 4.8 20.5 6.8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    )
  },
  {
    value: '100+',
    label: 'Institutions supported (pilot)',
    icon: (
      <svg viewBox="0 0 24 24" className="si" aria-hidden="true">
        <path d="M4 21V10m8 11V10m8 11V6M4 10l8-6 8 6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    )
  }
]

export default function ImpactSection() {
  const rootRef = useRef(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Left copy reveal
      gsap.fromTo(
        '.impact-copy',
        { autoAlpha: 0, y: 28 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.9,
          ease: 'power2.out',
          scrollTrigger: { trigger: '#impact', start: 'top 80%', once: true }
        }
      )

      // Stat items stagger
      gsap.fromTo(
        '.stat',
        { autoAlpha: 0, y: 16 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.65,
          stagger: 0.1,
          ease: 'power2.out',
          scrollTrigger: { trigger: '.stats', start: 'top 85%', once: true }
        }
      )

      // Art frame reveal + subtle parallax
      gsap.fromTo(
        '.impact-art-frame',
        { autoAlpha: 0, scale: 0.98, y: 20 },
        {
          autoAlpha: 1,
          scale: 1,
          y: 0,
          duration: 1,
          ease: 'power2.out',
          scrollTrigger: { trigger: '#impact', start: 'top 78%', once: true }
        }
      )

      gsap.fromTo(
        '.impact-art-img',
        { y: 18 },
        {
          y: -18,
          ease: 'none',
          scrollTrigger: { trigger: '#impact', start: 'top bottom', end: 'bottom top', scrub: 0.5 }
        }
      )
    }, rootRef)

    return () => ctx.revert()
  }, [])

  return (
    <section id="impact" className="impact" ref={rootRef}>
      <div className="impact-copy">
        <div className="section-kicker">Real impact</div>
        <h2 className="section-title">
          Building clearer paths
          <br />
          <em>for Bharat&rsquo;s next generation.</em>
        </h2>
        <p className="section-lead">
          We turn real job-market signals into practical learning paths, so every student can build
          a career with clarity, confidence, and opportunity.
        </p>
        <dl className="stats">
          {STATS.map((s) => (
            <div key={s.label} className="stat">
              {s.icon}
              <dt>{s.value}</dt>
              <dd>{s.label}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Right side: high-res clean illustration from homepg.png with soft atmospheric framing */}
      <div className="impact-art-wrap">
        <div className="impact-art-frame">
          <img
            src="/references/homepg.png"
            alt="Students walking toward campus at sunrise — Bharat career intelligence"
            className="impact-art-img"
          />
          <div className="impact-art-gradient-overlay" aria-hidden="true" />
          <div className="impact-note-pill impact-note-top" aria-hidden="true">
            More learners. Stronger careers.
          </div>
          <div className="impact-note-pill impact-note-bottom" aria-hidden="true">
            A brighter Bharat.
          </div>
        </div>
      </div>
    </section>
  )
}
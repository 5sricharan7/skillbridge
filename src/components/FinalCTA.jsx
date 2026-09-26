import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { navigate } from '../router'

gsap.registerPlugin(ScrollTrigger)

export default function FinalCTA() {
  const rootRef = useRef(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.cta-unified-content',
        { autoAlpha: 0, y: 24 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.85,
          ease: 'power2.out',
          scrollTrigger: { trigger: '#cta', start: 'top 80%', once: true }
        }
      )

      // Subtle parallax on the background artwork layer
      gsap.fromTo(
        '.cta-unified-bg-img',
        { y: -18, scale: 1.03 },
        {
          y: 18,
          scale: 1,
          ease: 'none',
          scrollTrigger: {
            trigger: '#cta',
            start: 'top bottom',
            end: 'bottom top',
            scrub: 0.6
          }
        }
      )
    }, rootRef)

    return () => ctx.revert()
  }, [])

  return (
    <section id="cta" className="cta-unified-section" ref={rootRef}>
      {/* Background artwork layer — full bleed single unified scene */}
      <div className="cta-unified-backdrop" aria-hidden="true">
        <img
          src="/references/bgbottom.png"
          alt=""
          className="cta-unified-bg-img"
        />
        <div className="cta-unified-mask" />
      </div>

      {/* Centered content overlay directly over sunrise sky */}
      <div className="cta-unified-content">
        <div className="section-kicker">Be part of a brighter tomorrow</div>
        <h2 className="cta-unified-title">
          Start Building Your
          <br />
          <em>Future Today.</em>
        </h2>
        <div className="cta-unified-action">
          <button
            type="button"
            className="btn btn-dark btn-lg"
            onClick={() => navigate('/career-bridge')}
          >
            Get Started
            <svg viewBox="0 0 12 12" className="nav-arrow" aria-hidden="true">
              <path d="M2.5 9.5l7-7M3.5 2.5h6v6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  )
}
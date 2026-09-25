import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { navigate } from '../router'

gsap.registerPlugin(ScrollTrigger)

function CtaScene() {
  return (
    <svg
      viewBox="0 0 1440 420"
      className="cta-scene"
      role="img"
      aria-label="Illustration of a road leading toward a domed landmark on the horizon"
      preserveAspectRatio="xMidYMax slice"
    >
      <defs>
        <linearGradient id="csky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f7f7f3" />
          <stop offset="1" stopColor="#f4f1e9" />
        </linearGradient>
        <radialGradient id="cglow" cx="0.5" cy="0.6" r="0.55">
          <stop offset="0" stopColor="#f6e8d8" stopOpacity="0.9" />
          <stop offset="0.55" stopColor="#f3e6da" stopOpacity="0.35" />
          <stop offset="1" stopColor="#f2efe7" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g className="c-sky-l">
        <rect width="1440" height="420" fill="url(#csky)" />
        <rect width="1440" height="420" fill="url(#cglow)" className="c-sky" />
      </g>

      <g className="c-skyline">
        <circle cx="720" cy="158" r="44" fill="#f5e6d2" opacity="0.85" />
        <rect x="90" y="240" width="26" height="52" fill="#d9d4cb" />
        <rect x="126" y="220" width="34" height="72" fill="#d9d4cb" />
        <rect x="168" y="248" width="22" height="44" fill="#d9d4cb" />
        <rect x="200" y="226" width="30" height="66" fill="#d9d4cb" />
        <rect x="242" y="252" width="20" height="40" fill="#d9d4cb" />
        <rect x="1170" y="242" width="26" height="52" fill="#d9d4cb" />
        <rect x="1208" y="222" width="36" height="72" fill="#d9d4cb" />
        <rect x="1254" y="252" width="24" height="42" fill="#d9d4cb" />
        <rect x="1290" y="232" width="34" height="62" fill="#d9d4cb" />
        <rect x="1334" y="258" width="24" height="36" fill="#d9d4cb" />
        <rect x="640" y="286" width="160" height="46" fill="#d2cdc2" />
        <rect x="660" y="254" width="120" height="34" fill="#cbc6ba" />
        <path d="M660 254 a60 40 0 0 1 120 0 Z" fill="#c3bdb0" />
        <line x1="720" y1="208" x2="720" y2="182" stroke="#8f88a0" strokeWidth="3.5" strokeLinecap="round" />
        <line x1="716" y1="196" x2="724" y2="196" stroke="#8f88a0" strokeWidth="3" strokeLinecap="round" />
      </g>

      <g className="c-trees" fill="#dbd7cc">
        <ellipse cx="30" cy="306" rx="44" ry="20" />
        <ellipse cx="104" cy="298" rx="40" ry="26" />
        <ellipse cx="176" cy="308" rx="44" ry="18" />
        <ellipse cx="252" cy="296" rx="40" ry="26" />
        <ellipse cx="324" cy="304" rx="42" ry="22" />
        <ellipse cx="396" cy="310" rx="40" ry="16" />
        <ellipse cx="1036" cy="306" rx="44" ry="20" />
        <ellipse cx="1106" cy="298" rx="38" ry="25" />
        <ellipse cx="1176" cy="308" rx="44" ry="18" />
        <ellipse cx="1250" cy="298" rx="40" ry="24" />
        <ellipse cx="1320" cy="306" rx="42" ry="20" />
        <ellipse cx="1392" cy="312" rx="44" ry="16" />
        <ellipse cx="520" cy="312" rx="46" ry="16" />
        <ellipse cx="920" cy="312" rx="46" ry="16" />
      </g>

      <g className="c-fore">
        <g>
          <path d="M402 420 q3 -8 1 -20" fill="none" stroke="#a79fb6" strokeWidth="3" strokeLinecap="round" />
          <ellipse cx="398" cy="390" rx="24" ry="21" fill="#eae6ef" stroke="#a79fb6" strokeWidth="2" />
          <ellipse cx="382" cy="398" rx="15" ry="12" fill="#eae6ef" stroke="#a79fb6" strokeWidth="2" />
          <ellipse cx="416" cy="398" rx="13" ry="10" fill="#eae6ef" stroke="#a79fb6" strokeWidth="2" />
        </g>
        <g>
          <path d="M1010 420 q3 -8 1 -22" fill="none" stroke="#a79fb6" strokeWidth="3" strokeLinecap="round" />
          <ellipse cx="1006" cy="386" rx="28" ry="24" fill="#eae6ef" stroke="#a79fb6" strokeWidth="2" />
          <ellipse cx="988" cy="395" rx="17" ry="13" fill="#eae6ef" stroke="#a79fb6" strokeWidth="2" />
          <ellipse cx="1026" cy="395" rx="15" ry="11" fill="#eae6ef" stroke="#a79fb6" strokeWidth="2" />
        </g>
      </g>

      <g className="c-road">
        <path d="M500 420 v-88" fill="none" stroke="#8f8a9d" strokeWidth="3" strokeLinecap="round" />
        <circle cx="500" cy="326" r="7" fill="#f2d7ab" stroke="#b7a57f" strokeWidth="1.5" />
        <ellipse cx="500" cy="420" rx="15" ry="3" fill="#dcd7e2" />
        <path d="M940 420 v-88" fill="none" stroke="#8f8a9d" strokeWidth="3" strokeLinecap="round" />
        <circle cx="940" cy="326" r="7" fill="#f2d7ab" stroke="#b7a57f" strokeWidth="1.5" />
        <ellipse cx="940" cy="420" rx="15" ry="3" fill="#dcd7e2" />
        <rect x="0" y="348" width="1440" height="74" fill="#f0ede6" />
        <path d="M560 422 L880 422 L804 362 L636 362 Z" fill="#eae6de" />
        <line x1="720" y1="422" x2="720" y2="362" stroke="#d8d4c9" strokeWidth="3" />
        <line x1="636" y1="362" x2="560" y2="422" stroke="#dcd7cd" strokeWidth="2" />
        <line x1="804" y1="362" x2="880" y2="422" stroke="#dcd7cd" strokeWidth="2" />
        <line x1="614" y1="392" x2="826" y2="392" stroke="#e0dbd2" strokeWidth="2" />
        <line x1="596" y1="408" x2="844" y2="408" stroke="#e0dbd2" strokeWidth="2" />
      </g>
    </svg>
  )
}

export default function FinalCTA() {
  const rootRef = useRef(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.cta-landscape',
        { autoAlpha: 0.7, y: 10 },
        {
          autoAlpha: 1,
          y: 0,
          ease: 'power1.out',
          duration: 1.1,
          scrollTrigger: { trigger: '.cta-landscape', start: 'top 88%', once: true }
        }
      )

      const layers = [
        { el: '.cta-scene .c-skyline', d: -10 },
        { el: '.cta-scene .c-trees', d: -22 },
        { el: '.cta-scene .c-fore', d: -30 },
        { el: '.cta-scene .c-road', d: -36 }
      ]
      layers.forEach(({ el, d }) => {
        gsap.fromTo(
          el,
          { y: 0 },
          {
            y: d,
            ease: 'none',
            scrollTrigger: { trigger: rootRef.current, start: 'top bottom', end: 'bottom bottom', scrub: 0.4 }
          }
        )
      })
    }, rootRef)

    return () => ctx.revert()
  }, [])

  return (
    <section id="cta" className="cta" ref={rootRef}>
      <div className="cta-copy">
        <div className="section-kicker">Be part of a brighter tomorrow</div>
        <h2 className="cta-title">
          Start Building Your
          <br />
          <em>Future Today.</em>
        </h2>
        <div className="cta-actions">
          <button type="button" className="btn btn-dark btn-lg" onClick={() => navigate('/career-bridge')}>
            Get Started
          </button>
          <button type="button" className="btn btn-ghost btn-lg">
            Learn More
          </button>
        </div>
      </div>

      <div className="cta-landscape">
        <CtaScene />
      </div>
    </section>
  )
}
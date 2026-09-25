import { useEffect } from 'react'
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

function ImpactArt() {
  return (
    <svg
      viewBox="0 0 640 560"
      className="impact-scene"
      role="img"
      aria-label="Illustration of a student walking toward an India Gate-like monument on a wide open path"
      preserveAspectRatio="xMidYMid meet"
    >
      <rect x="0" y="0" width="640" height="560" fill="#f3f1eb" />
      <circle cx="546" cy="118" r="66" fill="#efede7" />
      <ellipse cx="168" cy="128" rx="52" ry="16" fill="#efede7" />
      <ellipse cx="138" cy="132" rx="30" ry="11" fill="#f1efe8" />
      <ellipse cx="622" cy="40" rx="42" ry="10" fill="#ebe9e2" />

      <g className="l-sky">
        <path d="M0 290 v44 h640 v-44 Z" fill="#e5e2da" />
        <rect x="40" y="240" width="34" height="50" fill="#e8e5de" />
        <rect x="82" y="256" width="26" height="34" fill="#e8e5de" />
        <rect x="116" y="244" width="20" height="46" fill="#e8e5de" />
        <rect x="148" y="262" width="16" height="28" fill="#e8e5de" />
        <rect x="498" y="250" width="28" height="40" fill="#e8e5de" />
        <rect x="534" y="236" width="22" height="54" fill="#e8e5de" />
        <rect x="566" y="258" width="36" height="32" fill="#e8e5de" />
        <rect x="606" y="246" width="18" height="44" fill="#e8e5de" />
        <line x1="60" y1="260" x2="160" y2="260" stroke="#efede7" strokeWidth="2" />
        <line x1="70" y1="272" x2="150" y2="272" stroke="#efede7" strokeWidth="2" />
        <line x1="520" y1="282" x2="600" y2="282" stroke="#efede7" strokeWidth="2" />
      </g>

      <g className="l-trees">
        <g className="tree">
          <ellipse cx="128" cy="400" rx="30" ry="26" fill="#efeaf4" stroke="#aca7ba" strokeWidth="2" />
          <ellipse cx="106" cy="410" rx="19" ry="16" fill="#efeaf4" stroke="#aca7ba" strokeWidth="2" />
          <ellipse cx="152" cy="412" rx="17" ry="14" fill="#efeaf4" stroke="#aca7ba" strokeWidth="2" />
          <path d="M132 434 q2 -6 1 -20" stroke="#a39eb2" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </g>
        <g className="tree">
          <ellipse cx="208" cy="372" rx="26" ry="24" fill="#f0ecf5" stroke="#b2adbe" strokeWidth="2" />
          <ellipse cx="192" cy="380" rx="16" ry="13" fill="#f0ecf5" stroke="#b2adbe" strokeWidth="2" />
          <ellipse cx="228" cy="380" rx="13" ry="11" fill="#f0ecf5" stroke="#b2adbe" strokeWidth="2" />
          <path d="M210 400 q2 -6 1 -17" stroke="#a39eb2" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </g>
        <g className="tree">
          <ellipse cx="486" cy="368" rx="30" ry="26" fill="#efeaf4" stroke="#aca7ba" strokeWidth="2" />
          <ellipse cx="463" cy="378" rx="19" ry="15" fill="#efeaf4" stroke="#aca7ba" strokeWidth="2" />
          <ellipse cx="510" cy="379" rx="17" ry="13" fill="#efeaf4" stroke="#aca7ba" strokeWidth="2" />
          <path d="M488 398 q2 -6 1 -20" stroke="#a39eb2" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </g>
        <g className="tree">
          <ellipse cx="572" cy="380" rx="24" ry="21" fill="#f0ecf5" stroke="#aea9bb" strokeWidth="2" />
          <ellipse cx="554" cy="387" rx="14" ry="11" fill="#f0ecf5" stroke="#aea9bb" strokeWidth="2" />
          <ellipse cx="590" cy="388" rx="11" ry="9" fill="#f0ecf5" stroke="#aea9bb" strokeWidth="2" />
          <path d="M574 400 q2 -5 1 -13" stroke="#a39eb2" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </g>
      </g>

      <g className="l-monument">
        <path d="M282 470 L358 470 L356 344 L284 344 Z" fill="#3f3b47" />
        <line x1="295" y1="348" x2="295" y2="462" stroke="#6b6578" strokeWidth="2.5" />
        <line x1="345" y1="348" x2="345" y2="462" stroke="#6b6578" strokeWidth="2.5" />
        <path d="M306 470 v-32 a14 14 0 0 1 28 0 v32 Z" fill="#f2f0f6" />
        <path d="M270 344 h100 v-10 h-100 Z" fill="#37333f" />
        <path d="M286 322 h68 v-10 h-68 Z" fill="#443f4c" />
        <path d="M273 312 h94 l2 10 h-98 Z" fill="#37333f" />
        <circle cx="320" cy="298" r="13" fill="#37333f" />
        <path d="M320 285 v-9 M316 285 h8" fill="none" stroke="#37333f" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M272 470 h96 v8 h-96 Z" fill="#3f3b47" />
        <path d="M264 478 h112 v8 h-112 Z" fill="#33303b" />
        <line x1="288" y1="316" x2="352" y2="316" stroke="#6b6578" strokeWidth="1.5" />
      </g>

      <g className="l-mid">
        <g className="lamp">
          <path d="M196 470 v-104" fill="none" stroke="#8f8a9d" strokeWidth="3" strokeLinecap="round" />
          <path d="M196 370 h12" fill="none" stroke="#8f8a9d" strokeWidth="3" strokeLinecap="round" />
          <circle cx="210" cy="368" r="6.5" fill="none" stroke="#8f8a9d" strokeWidth="2.5" />
          <ellipse cx="196" cy="470" rx="16" ry="3.5" fill="#d8d4de" />
        </g>
        <g className="lamp">
          <path d="M454 470 v-100" fill="none" stroke="#8f8a9d" strokeWidth="3" strokeLinecap="round" />
          <path d="M454 372 h-13" fill="none" stroke="#8f8a9d" strokeWidth="3" strokeLinecap="round" />
          <circle cx="439" cy="370" r="6.5" fill="none" stroke="#8f8a9d" strokeWidth="2.5" />
          <ellipse cx="454" cy="470" rx="16" ry="3.5" fill="#d8d4de" />
        </g>
        <g className="people" fill="#c6c1cf" stroke="#c6c1cf" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="248" cy="452" r="4.5" />
          <path d="M248 459 v17 M244 468 l-5 6 M252 468 l5 6" fill="none" />
          <circle cx="414" cy="459" r="4.5" />
          <path d="M414 466 v15 M410 474 l-4 5 M418 474 l4 5" fill="none" />
          <circle cx="522" cy="466" r="4" />
          <path d="M522 472 v12 M519 479 l-3 4 M525 479 l3 4" fill="none" />
        </g>
      </g>

      <g className="l-path">
        <rect x="0" y="470" width="640" height="90" fill="#f0eee7" />
        <polygon points="205,560 435,560 362,490 278,490" fill="#e9e5dd" />
        <line x1="278" y1="490" x2="205" y2="560" stroke="#d9d5cb" strokeWidth="1.5" />
        <line x1="362" y1="490" x2="435" y2="560" stroke="#d9d5cb" strokeWidth="1.5" />
        <line x1="320" y1="492" x2="320" y2="560" stroke="#d6d2c6" strokeWidth="2" />
        <line x1="254" y1="528" x2="386" y2="528" stroke="#e0dcd3" strokeWidth="1.5" />
        <line x1="230" y1="550" x2="410" y2="550" stroke="#e0dcd3" strokeWidth="1.5" />
        <line x1="0" y1="470" x2="640" y2="470" stroke="#dbd7cd" strokeWidth="2" />
        <path d="M40 540 q14 -8 30 0 M548 532 q14 -9 30 0" fill="none" stroke="#d6d2c6" strokeWidth="2" strokeLinecap="round" />
      </g>

      <g className="l-student">
        <ellipse cx="362" cy="480" rx="23" ry="5.5" fill="#d9d5cc" />
        <image
          href="/references/skillbridge-student-back.png"
          x="338"
          y="382"
          width="48"
          height="98"
          preserveAspectRatio="xMidYMid slice"
        />
      </g>

      <g className="note-a" transform="rotate(-4 596 92)">
        <path className="note-curve" d="M452 86 C 420 90, 392 98, 370 110" />
        <path className="note-head" d="M370 110 l-9 -2 l6 7" fill="none" />
        <text className="note-ln" textAnchor="end">
          <tspan x="596" y="48">More learners. Stronger careers.</tspan>
          <tspan x="596" dy="22">A brighter Bharat.</tspan>
        </text>
      </g>

      <g className="note-b" transform="rotate(3 420 512)">
        <path className="note-curve" d="M252 496 C 278 492, 304 486, 322 482" />
        <path className="note-head" d="M322 482 l-8 -4 l3 8" fill="none" />
        <text className="note-ln" textAnchor="end">
          <tspan x="596" y="498">Different paths.</tspan>
          <tspan x="596" dy="22">A shared tomorrow.</tspan>
        </text>
      </g>
    </svg>
  )
}

export default function ImpactSection() {
  useEffect(() => {
    const ctx = gsap.context(() => {
      const layers = [
        { el: '.l-sky', d: -6, op: 0.9 },
        { el: '.l-monument', d: -14 },
        { el: '.l-trees', d: -20, op: 0.94 },
        { el: '.l-mid', d: -30 },
        { el: '.l-path', d: -40 },
        { el: '.l-student', d: -46 }
      ]

      layers.forEach(({ el, d, op }) => {
        gsap.fromTo(
          el,
          { y: 0 },
          {
            y: d,
            opacity: op ?? 1,
            ease: 'none',
            scrollTrigger: { trigger: '#impact', start: 'top bottom', end: 'bottom top', scrub: 0.4 }
          }
        )
      })

      gsap.fromTo(
        '.note-a, .note-b',
        { y: 4 },
        {
          y: 10,
          ease: 'none',
          scrollTrigger: { trigger: '#impact', start: 'top bottom', end: 'bottom top', scrub: 0.5 }
        }
      )

      gsap.utils.toArray('.note-curve').forEach((p) => {
        const len = p.getTotalLength()
        gsap.set(p, { strokeDasharray: len, strokeDashoffset: len })
        gsap.to(p, {
          strokeDashoffset: 0,
          duration: 1.1,
          ease: 'power2.inOut',
          scrollTrigger: { trigger: '#impact', start: 'top 68%', once: true }
        })
      })

      const bridgeProgress = document.querySelector('.impact-bridge .bridge-progress')
      const blen = bridgeProgress.getTotalLength()
      gsap.set('.impact-bridge .bridge-progress, .impact-bridge .bridge-head', {
        strokeDasharray: blen,
        strokeDashoffset: blen
      })
      gsap.to('.impact-bridge .bridge-progress, .impact-bridge .bridge-head', {
        strokeDashoffset: 0,
        ease: 'none',
        scrollTrigger: {
          trigger: '#roadmap',
          start: 'top 96%',
          end: 'top 34%',
          scrub: 0.6
        }
      })

      gsap.set('.l-student', { transformOrigin: '50% 100%' })
      gsap.to('.l-student', {
        rotate: '+=1.6',
        ease: 'sine.inOut',
        duration: 1.1,
        yoyo: true,
        repeat: -1,
        delay: 1.4
      })

      const wrap = document.querySelector('.impact-scene-wrap')
      const onMove = (e) => {
        const r = wrap.getBoundingClientRect()
        const x = (e.clientX - r.left) / r.width - 0.5
        const y = (e.clientY - r.top) / r.height - 0.5
        gsap.to('.impact-scene', {
          x: x * 4,
          y: y * 2.5,
          duration: 0.6,
          ease: 'power2.out',
          overwrite: 'auto'
        })
        gsap.to('.note-a, .note-b', {
          x: x * -2.5,
          y: y * -2,
          duration: 0.6,
          ease: 'power2.out',
          overwrite: 'auto'
        })
      }
      const onLeave = () => {
        gsap.to('.impact-scene', { x: 0, y: 0, duration: 0.7, ease: 'power2.out', overwrite: 'auto' })
        gsap.to('.note-a, .note-b', { x: 0, y: 0, duration: 0.7, ease: 'power2.out', overwrite: 'auto' })
      }
      wrap.addEventListener('pointermove', onMove)
      wrap.addEventListener('pointerleave', onLeave)

      return () => {
        wrap.removeEventListener('pointermove', onMove)
        wrap.removeEventListener('pointerleave', onLeave)
      }
    }, '#impact')

    return () => ctx.revert()
  }, [])

  return (
    <section id="impact" className="impact">
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
      <div className="impact-scene-wrap">
        <ImpactArt />
        <div className="impact-bridge" aria-hidden="true">
          <svg viewBox="0 0 148 82" width="148" height="82">
            <path className="bridge-base" d="M10 16 C 42 12, 74 26, 120 58" />
            <circle className="bridge-base" cx="122" cy="60" r="4" />
            <path className="bridge-progress" d="M10 16 C 42 12, 74 26, 120 58" />
            <path className="bridge-head" d="M112 54 l 13 4 l-9 9" />
          </svg>
        </div>
      </div>
    </section>
  )
}
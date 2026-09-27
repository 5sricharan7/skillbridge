import { useEffect } from 'react'
import { gsap } from 'gsap'
import HeroCardField from './HeroCardField'

// ---------------------------------------------------------------------------
// introActive — the hard gate for the ORIGINAL homepage entrance.
//
// It is a prop, not a body-class read, and that matters: App.jsx adds
// `body.co-intro-active` inside a useEffect, and React runs child effects
// BEFORE parent effects. A child that polls for the class on mount therefore
// always sees it absent and starts immediately — which is exactly how the
// whole hero entrance ended up playing from page load underneath the cinematic
// overlay. A prop is already true on the first render, so "is the intro
// running?" is answered correctly from the very first commit.
//
// Contract, per effect below:
//   introActive === true  → set the ORIGINAL initial state and start nothing.
//                            The homepage is mounted and correct, frozen at
//                            frame zero: no timeline, no RAF, no listeners.
//   introActive === false → run the pre-existing entrance, unchanged, from the
//                            beginning. Nothing is resumed, because nothing ran.
// The defaults err toward frozen, so a missing prop can never animate early.
// ---------------------------------------------------------------------------
export default function HeroOverlay({ introActive = true }) {
  // ── Headline clip-path reveal ──────────────────────────────────────────
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const lines = document.querySelectorAll('.hero-headline .hl')
    if (!lines.length || lines.length < 2) return

    const maskClosed = 'inset(0 100% 0 0)'
    const maskOpen   = 'inset(0 0% 0 0)'

    // Set initial hidden state immediately regardless of intro timing
    if (reduced) {
      gsap.set(lines, { opacity: 1, clipPath: maskOpen })
      return
    }
    gsap.set(lines, { opacity: 0, clipPath: maskClosed })

    if (introActive) {
      return () => gsap.set(lines, { clearProps: 'all' })
    }

    const tl = gsap.timeline({ delay: 0.12 })
    tl.to(lines[0], { opacity: 1, clipPath: maskOpen, duration: 0.55, ease: 'power2.inOut' })
      .to({}, { duration: 0.12 })
      .to(lines[1], { opacity: 1, clipPath: maskOpen, duration: 0.55, ease: 'power2.inOut' })

    return () => {
      tl.kill()
      gsap.set(lines, { clearProps: 'all' })
    }
  }, [introActive])

  // ── Annotation arrow draw-reveal ──────────────────────────────────────
  useEffect(() => {
    const hero = document.querySelector('.hero')
    if (!hero) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const arrowPaths = Array.from(hero.querySelectorAll('.hero-note path'))
    if (!arrowPaths.length) return

    if (reduced) {
      gsap.set(arrowPaths, { strokeDasharray: 0, strokeDashoffset: 0 })
      return () => gsap.set(arrowPaths, { clearProps: 'strokeDasharray, strokeDashoffset' })
    }

    // Pre-measure lengths before defer so layout is already done
    arrowPaths.forEach((p) => {
      const L = p.getTotalLength()
      p.style.strokeDasharray = `${L}`
      p.style.strokeDashoffset = `${L}`
    })

    if (introActive) {
      // Frozen at the arrow's un-drawn initial state for the whole intro.
      return () => gsap.set(arrowPaths, { clearProps: 'strokeDasharray, strokeDashoffset' })
    }

    const tl = gsap.timeline({ delay: 0.88 })
    tl.to(arrowPaths, {
      strokeDashoffset: 0,
      duration: 0.55,
      ease: 'power2.inOut',
      stagger: { each: 0.18, from: 0 },
    }, 0.4)

    return () => {
      tl.kill()
      gsap.set(arrowPaths, { clearProps: 'strokeDasharray, strokeDashoffset' })
    }
  }, [introActive])

  // ── Student parallax + idle breathing + settle ────────────────────────
  // The RAF loop does not exist while the intro is running: no raf, no pointer
  // listener, no elapsed-time clock. styles.css holds the hero vars at their
  // resting values under co-intro-active, so the student stays hidden and
  // stationary — the original first frame, not a paused mid-animation.
  useEffect(() => {
    const hero = document.querySelector('.hero')
    if (!hero) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return

    // `raf` MUST stay a mutable binding: tick() re-arms itself with
    // `raf = requestAnimationFrame(tick)`. Declaring it `const` (or reading it
    // as a `const` from the scheduling line below) makes that assignment a
    // TypeError in module strict mode, which kills the loop on its very first
    // frame — `--al` is then never written, and `.hero-student img` is left on
    // its `var(--al, 0)` fallback, i.e. permanently invisible.
    let tx = 0, ty = 0, ttx = 0, tty = 0, raf = 0

    const smooth = (t) => {
      const x = Math.max(0, Math.min(1, t))
      return x * x * (3 - 2 * x)
    }

    function onMove(e) {
      const r = hero.getBoundingClientRect()
      const nx = (e.clientX - r.left) / r.width - 0.5
      const ny = (e.clientY - r.top) / r.height - 0.5
      ttx = nx * 6
      tty = ny * 7
      hero.style.setProperty('--hx', `${(nx * 4).toFixed(2)}px`)
      hero.style.setProperty('--hy', `${(ny * 3).toFixed(2)}px`)
      hero.style.setProperty('--fx', `${(nx * 4).toFixed(2)}px`)
      hero.style.setProperty('--gx', `${(nx * 7).toFixed(2)}px`)
      hero.style.setProperty('--gy', `${(ny * 5).toFixed(2)}px`)
    }

    function tick(now) {
      raf = requestAnimationFrame(tick)
      const el = (now - rafStart) / 1000
      const appear = smooth((el - 0.8) / 0.7)
      const settleY = (1 - smooth((el - 0.85) / 0.5)) * 26
      const breath = Math.sin(el * 1.25) * 2
      tx += (ttx - tx) * 0.06
      ty += (tty - ty) * 0.06
      hero.style.setProperty('--px', `${tx.toFixed(2)}px`)
      hero.style.setProperty('--py', `${(ty + settleY + breath).toFixed(2)}px`)
      hero.style.setProperty('--al', appear.toFixed(3))
    }

    if (introActive) return

    const rafStart = performance.now()
    hero.addEventListener('pointermove', onMove)
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      hero.removeEventListener('pointermove', onMove)
    }
  }, [introActive])

  // ── Scroll-based depth parallax ───────────────────────────────────────
  useEffect(() => {
    const hero = document.querySelector('.hero')
    if (!hero) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let ticking = false
    const update = () => {
      ticking = false
      const r = hero.getBoundingClientRect()
      const vh = window.innerHeight
      if (r.bottom <= 0 || r.top >= vh) return
      const climb = (t) => Math.max(0, Math.min(1, t))
      const p = climb(-r.top / r.height)
      hero.style.setProperty('--sp-field',   `${(-p * 30).toFixed(2)}px`)
      hero.style.setProperty('--sp-st',      `${(-p * 9).toFixed(2)}px`)
      hero.style.setProperty('--sp-hl',      `${(-p * 3).toFixed(2)}px`)
      hero.style.setProperty('--sp-note',    `${(-p * 9).toFixed(2)}px`)
      hero.style.setProperty('--sp-floor-y', `${(-p * 8).toFixed(2)}px`)
    }
    const onScroll = () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update) }
    }

    // No scroll listener, no initial update, while the intro is running.
    if (introActive) return

    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)

    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [introActive])

  return (
    <div className="hero-inner">
      {/* layer 1 — depth/floor curves */}
      <svg className="hero-floor" viewBox="0 0 1672 941" preserveAspectRatio="none" aria-hidden="true">
        <path d="M800 790 C 560 720, 300 672, -20 632" fill="none" strokeLinecap="round" />
        <path d="M800 790 C 1040 720, 1300 672, 1692 632" fill="none" strokeLinecap="round" />
        <path d="M-20 720 C 360 764, 1200 764, 1692 720" fill="none" strokeLinecap="round" />
      </svg>

      {/* layer 3 — headline */}
      <h1 className="hero-headline">
        <span className="hl l1">SKILLS TODAY.</span>
        <span className="hl l2">
          BETTER TOMORROWS.
          <svg className="hl-underline" viewBox="0 0 220 14" aria-hidden="true">
            <path d="M10 9 C 72 3, 148 3, 210 8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </h1>

      {/* layer 2 — moving skill-card wall */}
      <HeroCardField introActive={introActive} />

      {/* layer 4 — student */}
      <div className="hero-student" aria-hidden="true">
        <img
          src="/references/skillbridge-student-front.png"
          alt=""
          draggable="false"
          loading="eager"
          decoding="async"
        />
      </div>

      {/* layer 6 — handwritten annotations */}
      <div className="hero-note note-equal" aria-hidden="true">
        <span>not all skills<br />are equal.</span>
        <svg viewBox="0 0 76 88" className="note-arrow" width="76" height="88" aria-hidden="true">
          <path d="M58 8 C46 30, 32 56, 14 80 L15.5 71.7 L21.5 76.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <div className="hero-note note-start" aria-hidden="true">
        <span>so many skills&hellip;<br />where do I start?</span>
        <svg viewBox="0 0 92 46" className="note-underline" width="92" height="46" aria-hidden="true">
          <path d="M8 40 C36 39, 62 28, 76 8 L74.8 16.3 L68.6 12" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <div className="hero-note note-time" aria-hidden="true">
        <span>I have limited time.<br />what actually matters?</span>
        <svg viewBox="0 0 84 50" className="note-time-arrow" width="84" height="50" aria-hidden="true">
          <path d="M72 42 C50 42, 26 30, 6 10 L14 12.6 L8.6 18" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  )
}

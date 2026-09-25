import { useEffect } from 'react'
import { gsap } from 'gsap'
import HeroCardField from './HeroCardField'

export default function HeroOverlay() {
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const lines = document.querySelectorAll('.hero-headline .hl')
    if (!lines.length) return
    if (lines.length < 2) return

    const maskClosed = 'inset(0 100% 0 0)' // fully masked from the right
    const maskOpen = 'inset(0 0% 0 0)'

    if (reduced) {
      gsap.set(lines, { opacity: 1, clipPath: maskOpen })
      return
    }

    // Editorial "projection" reveal — once, in sequence: L1 draws in
    // left→right, then L2. Text is spatially locked (y / x / scale never
    // change); only the left→right clip sweep and opacity animate so it
    // reads as a quiet projection rather than a bouncy entrance.
    // 200-500ms L1 · 450-800ms L2 (see art-direction pass).
    gsap.set(lines, { opacity: 0, clipPath: maskClosed })
    const tl = gsap.timeline({ delay: 0.12 })
    tl.to(lines[0], { opacity: 1, clipPath: maskOpen, duration: 0.55, ease: 'power2.inOut' })
      .to({}, { duration: 0.12 })
      .to(lines[1], { opacity: 1, clipPath: maskOpen, duration: 0.55, ease: 'power2.inOut' })
    return () => {
      tl.kill()
      gsap.set(lines, { clearProps: 'all' })
    }
  }, [])

  // Annotation draw-reveal.
  // Each short annotation arrow is measured, masked with dasharray/dashoffset,
  // then drawn exactly once (0.55s each, staggered 0.18s). No looping, pulsing
  // or floating: once drawn, the arrows stay completely still.
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

    arrowPaths.forEach((p) => {
      const L = p.getTotalLength()
      p.style.strokeDasharray = `${L}`
      p.style.strokeDashoffset = `${L}`
    })

    const tl = gsap.timeline({ delay: 0.88 })
    tl.to(arrowPaths, { strokeDashoffset: 0, duration: 0.55, ease: 'power2.inOut', stagger: { each: 0.18, from: 0 } }, 0.4)

    return () => {
      tl.kill()
      gsap.set(arrowPaths, { clearProps: 'strokeDasharray, strokeDashoffset' })
    }
  }, [])

  // Student: soft settle-into-place + subtle pointer parallax (2-4px) +
  // idle breathing, plus the layered scene parallax (headline / floor /
  // cards) driven through CSS vars on .hero so few animations fight.
  useEffect(() => {
    const hero = document.querySelector('.hero')
    if (!hero) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return

    let tx = 0
    let ty = 0
    let ttx = 0
    let tty = 0
    let raf = 0
    const start = performance.now()
    const smooth = (t) => {
      const x = Math.max(0, Math.min(1, t))
      return x * x * (3 - 2 * x)
    }

    function onMove(e) {
      const r = hero.getBoundingClientRect()
      const nx = (e.clientX - r.left) / r.width - 0.5
      const ny = (e.clientY - r.top) / r.height - 0.5
      ttx = nx * 6 // character max displacement stays ≈ 3px
      tty = ny * 7
      hero.style.setProperty('--hx', `${(nx * 4).toFixed(2)}px`) // headline 2px
      hero.style.setProperty('--hy', `${(ny * 3).toFixed(2)}px`)
      hero.style.setProperty('--fx', `${(nx * 4).toFixed(2)}px`) // floor 2px
      hero.style.setProperty('--gx', `${(nx * 7).toFixed(2)}px`) // guide notes ≈3.5px
      hero.style.setProperty('--gy', `${(ny * 5).toFixed(2)}px`)
    }

    function tick(now) {
      raf = requestAnimationFrame(tick)
      const el = (now - start) / 1000
      const appear = smooth((el - 0.8) / 0.7)
      const settleY = (1 - smooth((el - 0.85) / 0.5)) * 26
      const breath = Math.sin(el * 1.25) * 2 // idle sway ≈ 5s period
      tx += (ttx - tx) * 0.06
      ty += (tty - ty) * 0.06
      hero.style.setProperty('--px', `${tx.toFixed(2)}px`)
      hero.style.setProperty('--py', `${(ty + settleY + breath).toFixed(2)}px`)
      hero.style.setProperty('--al', appear.toFixed(3))
    }

    hero.addEventListener('pointermove', onMove)
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      hero.removeEventListener('pointermove', onMove)
    }
  }, [])

  // Scroll-based depth: the hero is taller than the viewport, so each layer
  // translates at its own rate as the section scrolls through — a layered
  // poster, not a pinned animation. Rates are small and reverse smoothly.
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
      hero.style.setProperty('--sp-field', `${(-p * 30).toFixed(2)}px`)
      hero.style.setProperty('--sp-st', `${(-p * 9).toFixed(2)}px`)
      hero.style.setProperty('--sp-hl', `${(-p * 3).toFixed(2)}px`)
      hero.style.setProperty('--sp-note', `${(-p * 9).toFixed(2)}px`)
      hero.style.setProperty('--sp-floor-y', `${(-p * 8).toFixed(2)}px`)
    }
    const onScroll = () => {
      if (!ticking) {
        ticking = true
        requestAnimationFrame(update)
      }
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  return (
    <div className="hero-inner">
      {/* layer 1 — depth/floor curves (three very long lines converging
          under the character ~x800, just behind their feet) */}
      <svg className="hero-floor" viewBox="0 0 1672 941" preserveAspectRatio="none" aria-hidden="true">
        <path d="M800 790 C 560 720, 300 672, -20 632" fill="none" strokeLinecap="round" />
        <path d="M800 790 C 1040 720, 1300 672, 1692 632" fill="none" strokeLinecap="round" />
        <path d="M-20 720 C 360 764, 1200 764, 1692 720" fill="none" strokeLinecap="round" />
      </svg>

      {/* layer 3 — headline: two editorial lines, behind student */}
      <h1 className="hero-headline">
        <span className="hl l1">SKILLS TODAY.</span>
        <span className="hl l2">
          BETTER TOMORROWS.
          <svg className="hl-underline" viewBox="0 0 220 14" aria-hidden="true">
            <path d="M10 9 C 72 3, 148 3, 210 8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </h1>

      {/* layer 2 — moving skill-card wall (behind headline) */}
      <HeroCardField />

      {/* layer 4 — student, foreground */}
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
        <span>
          not all skills
          <br />
          are equal.
        </span>
        <svg viewBox="0 0 76 88" className="note-arrow" width="76" height="88" aria-hidden="true">
          <path d="M58 8 C46 30, 32 56, 14 80 L15.5 71.7 L21.5 76.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <div className="hero-note note-start" aria-hidden="true">
        <span>
          so many skills&hellip;
          <br />
          where do I start?
        </span>
        <svg viewBox="0 0 92 46" className="note-underline" width="92" height="46" aria-hidden="true">
          <path d="M8 40 C36 39, 62 28, 76 8 L74.8 16.3 L68.6 12" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <div className="hero-note note-time" aria-hidden="true">
        <span>
          I have limited time.
          <br />
          what actually matters?
        </span>
        <svg viewBox="0 0 84 50" className="note-time-arrow" width="84" height="50" aria-hidden="true">
          <path d="M72 42 C50 42, 26 30, 6 10 L14 12.6 L8.6 18" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  )
}
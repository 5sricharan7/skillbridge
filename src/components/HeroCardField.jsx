import { useEffect, useRef } from 'react'

// ------------------------------------------------------------------
// CONTINUOUS MOVING CURVED CARD GALLERY (a shallow 3D carousel).
//
// INFINITE TRACK, not a movable array:
// The 8 unique card designs (Java, SQL, Cloud, Python, ML, Embedded,
// VLSI, Web) are rendered as 3 repetitions = 24 fixed slot instances.
// Every slot has a fixed pitch; ONE shared progress value (flowPx)
// advances all 24 positions at once. A slot's screen position is:
//
//   wrappedX = fold(baseX[i] + flowPx + parallax, halfTrack)
//
// where fold() applies modulo arithmetic so a card crossing the left
// boundary is instantly mapped to its equivalent slot on the right —
// BEFORE it can ever become visible. The fold sits at ±halfTrack
// (≈3.5× the viewport half), so no card ever appears, pops, or gaps.
//
// Cards sit on a pitch of ~0.95 × card width, so projected neighbours
// overlap the centre card by ~5% (within the hand art-range) and the wall
// reads as one dense continuous shallow panel with a visible centre card.
// Spacing is identical before and after wrapping by construction.
//
// Curve (mirror-symmetric, pure function of one value t):
//   t    = (normalized distance from screen center, 0..1)
//   yaw     = t * 13°        (center 0, edges ±10°, NEVER sideways)
//   scale   = 1 - 0.32*t     (center ≈1, far edge ≈ 0.68)
//   opacity = 1 - 0.62*t     (center ≈1, far edge ≈ 0.38 — distance-based)
//   blur    = 5.4 * (t-0.12)/0.88  (the 2 centre cards stay OCR-sharp at 0px,
//             far edge ≤ 5px — depth reads, UI stays legible)
//   y       = band + t²·36   (outer cards dip lower — shallow wall arc)
// Per-card parallax leans OUTER cards more than inner ones (inner ≈6px,
// outer ≈12px). Mid cards recede, the centre is the focal point.
// LEFT and RIGHT are exact mirrors. No independent card animation.
// ------------------------------------------------------------------

const CARDS = [
  { name: 'Java', status: 'Rising', trend: 'up', accent: '#67739b', icon: 'java' },
  { name: 'SQL', status: 'Slightly Declining', trend: 'down', accent: '#67739b', icon: 'sql' },
  { name: 'Cloud Computing', status: 'Rising', trend: 'up', accent: '#67739b', icon: 'cloud' },
  { name: 'Python', status: 'High Demand', trend: 'up', accent: '#6E4CF5', icon: 'python', featured: true },
  { name: 'Machine Learning', status: 'Rising', trend: 'up', accent: '#67739b', icon: 'ml' },
  { name: 'Embedded Systems', status: 'High Demand', trend: 'up', accent: '#E8634A', icon: 'chip', featured: true },
  { name: 'VLSI', status: 'Stable', trend: 'stable', accent: '#67739b', icon: 'vlsi' },
  { name: 'Web Development', status: 'Rising', trend: 'up', accent: '#67739b', icon: 'web' }
]

// 24 DOM nodes = the 8 unique designs × 3 repetitions on an infinite
// track. Card identity is fixed per node; only the shared progress value
// changes, so the sequence ... Web → Java → SQL → Cloud → Python → ML →
// Embedded → VLSI → Web ... never breaks and recycling stays invisible.
const REPEAT = 3
const POOL = Array.from({ length: REPEAT }, (_, r) =>
  CARDS.map((c) => ({ ...c, _rep: r }))
).flat()

const SLOTS = POOL.length // 24
const TREND_BARS = {
  up: [5, 9, 13, 19, 26],
  down: [26, 20, 14, 9, 5],
  stable: [13, 13, 15, 13, 13]
}

const STAT_GLYPH = {
  Rising: 'up',
  'High Demand': 'up',
  'Slightly Declining': 'down',
  Stable: 'flat'
}

// --- layout knobs (all computed in screen px per viewport) ----------
const CARD_W_FRAC = 0.156 // nominal central card width fraction of viewport
const CARD_W_MIN = 180 // smallest desktop card width (px)
const CARD_W_MAX = 205 // largest desktop card width (px)
const COM_SCALE = 0.92 // round 11: cards compacted ≈−8% so they read as an accessory wall behind the student
const CARD_H_RATIO = 1.7 // portrait: height = width × 1.7 (round 11: 1.64 → 1.7)
const SPACE_F = 0.95 // slot pitch as a fraction of card width → ~5% overlapped projection (round 11: gaps removed)
const FIELD_CX_OFF = 30 // round 11: gallery centre sits behind the student, −30px left of viewport centre
const BAND_Y_FRAC = 0.448 // vertical centre-line of the gallery band (≈0.448 × hero)
const BAND_Y_EXTRA = 0.07 // additional downward bias on hero heights below 941px
const BAND_DROP = 14 // round 9: band centre aligns with the student's torso centre → central card top ≈279 behind the student
const BAND_EDGE_LIFT = 36 // outer cards dip lower than centre (shallow wall arc)
const SPEED_F = 0.11 // screen px/s per card width → ~22 px/s on desktop
const PARALLAX_F = 0.015 // per-card mouse lean (inner ≈6px, outer ≈10px per full-width cursor)
const YAW_MAX = 10 // edges turn to ±10° only — never sideways
const FADE_F = 0.62 // opacity falloff, linear: center ≈1 → inner 0.85-0.95 → mid 0.65-0.80 → outer 0.40-0.60 → far edge ≈0.38
const DEPTH_F = 0.32 // scale falloff (center ≈1 → far edge ≈ 0.68)
const TREND_W = 2.6 // micro-graph wave speed (rad/s → ≈2.4s loop), phase offset per card
const GRAY_F = 0.6 // grayscale falloff (far cards desaturated)
const PROTECT_X0 = 0.24 // headline safe-zone x-range (fractions of width)
const PROTECT_X1 = 0.76
const PROTECT_Y1 = 0.23 // headline safe-zone bottom (fraction of height)

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const smooth01 = (t) => {
  const x = clamp(t, 0, 1)
  return x * x * (3 - 2 * x)
}
const fold = (v, half) => {
  let r = (v + half) % (2 * half)
  if (r < 0) r += 2 * half
  return r - half
}

function SkillIcon({ name }) {
  const common = { viewBox: '0 0 24 24', className: 'sc-icon' }
  switch (name) {
    case 'java':
      return (
        <svg {...common}>
          <path d="M8 4h8M8 4v1M16 4v1" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M7 6h10v3.5a5 5 0 0 1-5 5 5 5 0 0 1-5-5V6Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M9 6a3 3 0 0 1 .3 1.4M12 6a3 3 0 0 1 .3 1.4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      )
    case 'sql':
      return (
        <svg {...common}>
          <ellipse cx="12" cy="6" rx="7" ry="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" fill="none" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      )
    case 'cloud':
      return (
        <svg {...common}>
          <path
            d="M6.5 18.5a4 4 0 0 1-.4-8 5.5 5.5 0 0 1 10.6-1.6A4.6 4.6 0 0 1 18 18.5Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 'python':
      return (
        <svg {...common}>
          <path
            d="M8 13c-2.2-1.4-4.4-.6-4.4 1.4 0 2.4 2.6 3.2 4.9 2 2.3-1.2 2.2-4.6 4.6-5.6 2.4-1 4.9.4 4.9 2.6s-2.5 3-4.2 2.2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="6" cy="8.4" r="1.1" fill="currentColor" />
          <path d="M4.4 9.8c-.2-2.7 2.6-4 4.9-3.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      )
    case 'ml':
      return (
        <svg {...common}>
          <path d="M6.5 12h3M10.5 6l3.6 3.6M10.5 18l3.6-3.6M14 12h3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="6" cy="12" r="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="15" cy="6" r="1.7" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="15" cy="18" r="1.7" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="19" cy="12" r="1.7" fill="none" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      )
    case 'chip':
      return (
        <svg {...common}>
          <rect x="7.5" y="7.5" width="9" height="9" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M12 7.5V4M12 20v-3.5M7.5 12H4M20 12h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M10 10h.01M14 10h.01M10 14h.01M14 14h.01" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      )
    case 'vlsi':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M12 3.5v2.2M12 18.3v2.2M6.8 6.8l1.5 1.5M15.7 15.7l1.5 1.5M3.5 12h2.2M18.3 12h2.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      )
    case 'web':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <ellipse cx="12" cy="12" rx="3.2" ry="7" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path d="M5 12h14M5 8.5h14M5 15.5h14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      )
    default:
      return null
  }
}

export default function HeroCardField() {
  const fieldRef = useRef(null)

  useEffect(() => {
    const field = fieldRef.current
    if (!field) return
    const hero = field.closest('.hero')
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const cfg = {
      W: 0,
      H: 0,
      cx: 0,
      edge: 0,
      cardW: 0,
      cardH: 0,
      space: 0,
      half: 0,
      bandY: 0,
      speed: 0,
      protectX0: 0,
      protectX1: 0,
      protectY1: 0
    }
    const basePx = new Array(SLOTS).fill(0)

    function measure() {
      const r = hero?.getBoundingClientRect()
      const W = (cfg.W = r ? r.width : window.innerWidth)
      const H = (cfg.H = r ? r.height : window.innerHeight)
      cfg.cx = W / 2 - FIELD_CX_OFF
      const vScale = clamp(H / 941, 0.6, 1)
      cfg.cardW = clamp(W * CARD_W_FRAC, CARD_W_MIN, CARD_W_MAX) * vScale * COM_SCALE
      cfg.cardH = cfg.cardW * CARD_H_RATIO
      cfg.space = cfg.cardW * SPACE_F
      cfg.half = (SLOTS / 2) * cfg.space
      cfg.bandY = Math.min(H, 1000) * (BAND_Y_FRAC + (1 - clamp(Math.min(H, 1000) / 941, 0, 1)) * BAND_Y_EXTRA) + BAND_DROP
      cfg.speed = cfg.cardW * SPEED_F
      cfg.edge = cfg.cx - cfg.cardW / 2 // distance to viewport edge; there t reaches 1 → deepest falloff
      cfg.protectX0 = W * PROTECT_X0
      cfg.protectX1 = W * PROTECT_X1
      cfg.protectY1 = H * PROTECT_Y1
      for (let i = 0; i < SLOTS; i++) basePx[i] = (i + 0.5 - SLOTS / 2) * cfg.space
      field.style.perspective = `${Math.round(W * 0.95)}px`
    }
    measure()
    window.addEventListener('resize', measure)

    const nodes = Array.from(field.querySelectorAll('.skill-card'))

    let hoverIdx = -1
    let selIdx = -1
    let settleY = 0

    // smoothed hover / neighbour / selected state (0..1), lerped every frame
    const hoverProg = new Array(SLOTS).fill(0)
    const nearProg = new Array(SLOTS).fill(0)
    const selProg = new Array(SLOTS).fill(0)

    // per-card parallax: OUTER cards lean more than the centre ones, so the
    // field reads as one physical wall shifting under the cursor.
    const slotX = (i, flowPx, paraPx) => {
      const pBase = clamp(Math.abs(fold(basePx[i] + flowPx, cfg.half)) / cfg.edge, 0, 1)
      return cfg.cx + fold(basePx[i] + flowPx + paraPx * (0.6 + 0.4 * pBase), cfg.half)
    }

    function styleCard(el, i, flowPx, paraPx, h, nb, selp, gvals, ep, settleY) {
      const pBase = clamp(Math.abs(fold(basePx[i] + flowPx, cfg.half)) / cfg.edge, 0, 1)
      const tx = fold(basePx[i] + flowPx + paraPx * (0.6 + 0.4 * pBase), cfg.half)
      const p = clamp(Math.abs(tx) / cfg.edge, 0, 1)
      const x = cfg.cx + tx
      const yaw = (tx < 0 ? -1 : 1) * (YAW_MAX * p)
      const sc = (1 - DEPTH_F * p) + 0.09 * h + 0.03 * selp
      const y = cfg.bandY + p * p * BAND_EDGE_LIFT + settleY

      // headline safe-zone: cards that reach into the type area get extra
      // dimming so the headline always dominates.
      const projH = cfg.cardH * sc
      const topY = y - projH / 2
      const inZone =
        x + cfg.cardW / 2 > cfg.protectX0 &&
        x - cfg.cardW / 2 < cfg.protectX1 &&
        topY < cfg.protectY1
      const prot = inZone ? clamp((cfg.protectY1 - topY) / (projH * 0.5), 0, 1) : 0

      const base = 1 - FADE_F * p
      const act = Math.max(h, selp) // hovered OR selected → fully engaged
      const op = base + (1 - base) * act
      // distance-based blur ONLY: the gallery centre stays OCR-sharp, depth
      // accumulates toward the edges (far ≈5px). No centre guardband, no
      // headline-zone penalty — the wall is crisp around the student.
      const blur = Math.min(5.4 * clamp((p - 0.12) / 0.88, 0, 1) + nb * 2, 5) * (1 - act)
      const gray = Math.min(
        (POOL[i].featured ? 0 : GRAY_F * Math.pow(p, 0.8)) * (1 - act) + prot * 0.5,
        1
      )

      el.style.left = `${x.toFixed(1)}px`
      el.style.top = `${y.toFixed(1)}px`
      el.style.width = `${cfg.cardW.toFixed(1)}px`
      el.style.height = `${cfg.cardH.toFixed(1)}px`
      el.style.marginLeft = `${(-cfg.cardW / 2).toFixed(1)}px`
      el.style.marginTop = `${(-cfg.cardH / 2).toFixed(1)}px`
      el.style.transform = `translateZ(${((h > 0.5 ? 20 : 0) + 40 * selp).toFixed(1)}px) rotateY(${yaw.toFixed(1)}deg) scale(${(sc * (1 - 0.03 * nb)).toFixed(3)})`
      el.style.opacity = String((op * (1 - 0.4 * prot) * (1 - 0.22 * nb)).toFixed(3))
      el.style.filter = `blur(${blur.toFixed(2)}px) contrast(${act > 0.5 ? 1.08 : 1}) grayscale(${Math.min(gray, 1).toFixed(2)})`
      el.style.zIndex = String(selp > 0.5 ? 45 : h > 0.5 ? 30 : 20 - Math.round(p * 14))
      el.style.outlineColor = h > 0.5 || selp > 0.5 ? POOL[i].accent : 'transparent'
      el.classList.toggle('is-selected', selp > 0.5)

      // graph micro-animation: per-bar CSS vars + endpoint pulse on hover/selected
      for (let j = 0; j < 5; j++) el.style.setProperty(`--gb${j}`, gvals[j].toFixed(3))
      el.style.setProperty('--ep', ep.toFixed(3))
    }

    function paint(flowPx, paraPx, gvals, ep) {
      const xs = nodes.map((el, i) => slotX(i, flowPx, paraPx))
      const hx = hoverIdx === -1 ? null : xs[hoverIdx]
      nodes.forEach((el, i) => {
        let nb = 0
        if (hx !== null && i !== hoverIdx) {
          const dx = Math.abs(xs[i] - hx)
          nb = dx < cfg.cardW * 1.6 ? clamp(1 - dx / (cfg.cardW * 1.6), 0, 1) : 0
        }
        nearProg[i] += (nb - nearProg[i]) * (1 - Math.exp(-0.006))
        styleCard(el, i, flowPx, paraPx, hoverProg[i], nearProg[i], selProg[i], gvals, ep, settleY)
      })
    }

    const GBAR_STEADY = [1, 1, 1, 1, 1]

    if (reduced) {
      field.style.opacity = '1'
      paint(0, 0, GBAR_STEADY, 1)
      return () => window.removeEventListener('resize', measure)
    }

    const st = {
      flow: 0,
      vel: 0,
      para: 0,
      paraTarget: 0,
      dragging: false,
      pointerId: null,
      lastT: 0
    }

    let downIdx = -1
    let downMoved = 0

    // A pointer-down ANYWHERE in the hero (cards included) starts dragging the
    // whole track — the original interaction. A quick click (almost no move)
    // on a card toggles focus-select instead, so both behaviours coexist.
    function onPointerDown(e) {
      if (e.target.closest('a, .hero-headline, .hero-note, .hero-student')) return
      const cardEl = e.target.closest('.skill-card')
      downIdx = cardEl ? nodes.indexOf(cardEl) : -1
      downMoved = 0
      st.dragging = true
      st.pointerId = e.pointerId
      st.vel = 0
      st.lastT = performance.now()
    }

    function onPointerMoveDrag(e) {
      st.paraTarget = (e.clientX - cfg.cx) * PARALLAX_F
      if (!st.dragging || e.pointerId !== st.pointerId) return
      const nowMs = performance.now()
      const dT = Math.max(nowMs - st.lastT, 4)
      const dx = e.movementX || 0
      downMoved += Math.abs(dx)
      st.flow += dx // drag the gallery itself: cards follow the pointer
      st.vel = dx / (dT / 1000)
      st.lastT = nowMs
    }

    function onPointerUp(e) {
      if (e.pointerId !== st.pointerId) return
      st.dragging = false
      st.pointerId = null
      // click (not drag) on a card → toggle focus-select; no permanent blur
      if (downIdx !== -1 && downMoved < 6) selIdx = selIdx === downIdx ? -1 : downIdx
      downIdx = -1
    }

    const hoverHandlers = nodes.map((el, i) => ({
      enter: () => (hoverIdx = i),
      leave: () => (hoverIdx = -1)
    }))
    nodes.forEach((el, i) => {
      el.addEventListener('mouseenter', hoverHandlers[i].enter)
      el.addEventListener('mouseleave', hoverHandlers[i].leave)
    })

    let rafHandle = 0
    let lastFrame = 0
    let startT = 0

    // entrance: cards stay hidden while the headline composes, then the band
    // fades in, settles into its rest position and eases up to full speed so
    // the first frame is already clean. (1000-1600ms cards · arrows follow.)
    field.style.opacity = '0'

    function frame(now) {
      rafHandle = requestAnimationFrame(frame)
      const dt = Math.min((now - lastFrame) / 1000, 0.05)
      lastFrame = now
      if (!startT) startT = now
      const tSec = (now - startT) / 1000

      const fadeIn = smooth01((tSec - 1.0) / 1.0)
      const speedRamp = smooth01((tSec - 1.55) / 1.4)
      settleY = (1 - fadeIn) * 26
      field.style.opacity = String(fadeIn.toFixed(3))

      if (!st.dragging) {
        st.flow += cfg.speed * speedRamp * dt // continuous LEFT → CENTER → RIGHT travel
        if (Math.abs(st.vel) > 0.1) {
          st.flow += st.vel * dt
          st.vel *= Math.exp(-2.2 * dt)
          if (Math.abs(st.vel) < 0.1) st.vel = 0
        }
      }
      st.para += (st.paraTarget - st.para) * (1 - Math.exp(-3 * dt))

      const xs = nodes.map((el, i) => slotX(i, st.flow, st.para))
      const hx = hoverIdx === -1 ? null : xs[hoverIdx]
      const lerp = 1 - Math.exp(-dt * 3) // hover/neighbour easing ≈ 330ms — smooth sharpen, not a snap
      nodes.forEach((el, i) => {
        const tgt = i === hoverIdx ? 1 : 0
        hoverProg[i] += (tgt - hoverProg[i]) * lerp
        const selTgt = i === selIdx ? 1 : 0
        selProg[i] += (selTgt - selProg[i]) * lerp
        let nb = 0
        if (hx !== null && i !== hoverIdx) {
          const dx = Math.abs(xs[i] - hx)
          nb = dx < cfg.cardW * 1.6 ? clamp(1 - dx / (cfg.cardW * 1.6), 0, 1) : 0
        }
        nearProg[i] += (nb - nearProg[i]) * lerp
        const act = Math.max(hoverProg[i], selProg[i])

        // LIVE data inside the card (not the card itself):
        // a slow per-card travelling wave nudges each bar's scaleY so the
        // trend reads as moving data; phase is offset per card so cards
        // never pulse in sync. Amplitude follows the direction:
        //   up (Rising/High Demand) breathes upward strongest,
        //   down (Declining) sways gently lower,
        //   stable barely moves (tiny pulse).
        const tw = tSec * TREND_W + i * 0.85
        const kind = POOL[i].trend
        const amp = (kind === 'up' ? 0.075 : kind === 'down' ? 0.055 : 0.035) * (1 + 0.6 * act)
        const gvals = [0, 1, 2, 3, 4].map((j) => {
          const entry = smooth01((tSec - 1.15 - j * 0.1) / 0.55)
          const wave = 1 + amp * Math.sin(tw + j * 0.9)
          return clamp(entry * wave, 0, 1.1)
        })
        // endpoint pulse: High Demand emphasises its accent bar once per
        // loop (≈2.4s); Rising cards get a gentler bump; Declining/Stable none.
        const pulse = POOL[i].trend === 'up'
          ? Math.pow(Math.max(0, Math.sin(tw)), POOL[i].featured ? 1.2 : 2) * (POOL[i].featured ? 0.4 : 0.14)
          : 0
        const ep = (1 + pulse) * (1 + 0.5 * act)

        styleCard(el, i, st.flow, st.para, hoverProg[i], nearProg[i], selProg[i], gvals, ep, settleY)
      })
    }

    hero?.addEventListener('pointerdown', onPointerDown)
    hero?.addEventListener('pointerleave', () => (selIdx = -1))
    window.addEventListener('pointermove', onPointerMoveDrag)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
    rafHandle = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(rafHandle)
      window.removeEventListener('resize', measure)
      hero?.removeEventListener('pointerdown', onPointerDown)
      hero?.removeEventListener('pointerleave', () => (selIdx = -1))
      window.removeEventListener('pointermove', onPointerMoveDrag)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
      nodes.forEach((el, i) => {
        el.removeEventListener('mouseenter', hoverHandlers[i].enter)
        el.removeEventListener('mouseleave', hoverHandlers[i].leave)
      })
    }
  }, [])

  return (
    <div className="hero-field" ref={fieldRef} aria-hidden="true">
      {POOL.map((c, i) => (
        <div key={`${c.name}-${i}`} className={`skill-card${c.featured ? ' is-featured' : ''}`} style={{ '--accent': c.accent }}>
          <div className="sc-top">
            <SkillIcon name={c.icon} />
          </div>
          <span className="sc-name">{c.name}</span>
          <span className="sc-status">
            {c.featured && <i className="sc-dot" style={{ animationDelay: `${((i % CARDS.length) * 0.23).toFixed(2)}s` }} />}
            <svg viewBox="0 0 10 8" className="sc-arr" aria-hidden="true" style={{ animationDelay: `${((i % CARDS.length) * -0.31).toFixed(2)}s` }}>
              {STAT_GLYPH[c.status] === 'up' && <path d="M2 6.5 5 2l3 4.5Z" fill="currentColor" />}
              {STAT_GLYPH[c.status] === 'down' && <path d="M2 1.5 5 6l3-4.5Z" fill="currentColor" />}
              {STAT_GLYPH[c.status] === 'flat' && <path d="M2 4h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
            </svg>
            {c.status}
          </span>
          <span className="sc-split" aria-hidden="true" />
          <svg viewBox="0 0 100 30" className="sc-graph" aria-hidden="true">
            {TREND_BARS[c.trend].map((h, j) => {
              const last = j === TREND_BARS[c.trend].length - 1
              return (
                <rect
                  key={j}
                  x={4 + j * 19}
                  y={30 - h}
                  width="11"
                  height={h}
                  rx="2.2"
                  fill={last ? 'var(--accent)' : 'currentColor'}
                  opacity={last ? 1 : 0.55}
                  style={{
                    transformBox: 'view-box',
                    transformOrigin: `${4 + j * 19}px 30px`,
                    transform: last
                      ? 'scaleY(calc(var(--gb4, 1) * var(--ep, 1)))'
                      : `scaleY(var(--gb${j}, 1))`
                  }}
                />
              )
            })}
          </svg>
          <span className="sc-ui" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </div>
      ))}
    </div>
  )
}
import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import './cinematic-opening.css'

// ---------------------------------------------------------------------------
// ASSET PATHS — source of truth.
// composition-reference.png is NEVER rendered. It is the positioning
// reference only — inspected by the developer, not the browser.
// ---------------------------------------------------------------------------
const IMG = {
  bg:      '/references/cinematic-opening/cinematic-bg-reference.png',
  ruins:   '/references/cinematic-opening/ruins-frame.png',
  student: '/references/cinematic-opening/student-reference.png',
  hand:    '/references/cinematic-opening/hand-reference.png',
  // NEVER RENDER: '/references/cinematic-opening/composition-reference.png'
}
const PRELOAD_SRCS = [IMG.bg, IMG.ruins, IMG.student, IMG.hand]

// The transition canvas colour is owned by cinematic-opening.css, which paints
// `.co-root`'s backdrop and `.co-vwipe`'s base layer with the single literal
// `#F7F3EA`. There is no second white, no grey and no dark anywhere in the
// transition, and nothing in this file needs to name the value.

// ---------------------------------------------------------------------------
// loadWithProgress — resolves once all assets are decoded, reports 0→100
// ---------------------------------------------------------------------------
function loadWithProgress(srcs, onProgress) {
  let done = 0
  const total = srcs.length
  return Promise.all(
    srcs.map((src) =>
      new Promise((resolve) => {
        const img = new Image()
        img.onload = img.onerror = () => {
          done++
          onProgress(Math.round((done / total) * 100))
          resolve()
        }
        img.src = src
      })
    )
  )
}

// ---------------------------------------------------------------------------
// computeSparkPosition
//
// After characters are at their final rendered positions, we measure their
// actual bounding boxes to place the spark exactly between the fingertips.
//
// From composition-reference.png:
//   student-reference.png: raised right arm tip is at approx. bbox
//     → 84% of asset width from left, 11% from top
//   hand-reference.png: index/middle fingertip cluster at
//     → 4% of asset width from left, 73% from top
//
// Returns { pctX, pctY } as percent of root element dimensions.
// That point is the origin of the entire transition: violet energy escapes
// from it, the cream blooms from it, and the violet signal is born there.
// ---------------------------------------------------------------------------
function computeSparkPosition(studentEl, handEl, rootEl) {
  if (!studentEl || !handEl || !rootEl) return null
  const rootR    = rootEl.getBoundingClientRect()
  const studentR = studentEl.getBoundingClientRect()
  const handR    = handEl.getBoundingClientRect()

  const sTipX = studentR.left + studentR.width  * 0.84
  const sTipY = studentR.top  + studentR.height * 0.11
  const hTipX = handR.left   + handR.width      * 0.04
  const hTipY = handR.top    + handR.height      * 0.73

  const midX = (sTipX + hTipX) / 2
  const midY = (sTipY + hTipY) / 2

  return {
    pctX: ((midX - rootR.left) / rootR.width)  * 100,
    pctY: ((midY - rootR.top)  / rootR.height) * 100,
  }
}

// ---------------------------------------------------------------------------
// PHASE 1 — CONTAINED GOLDEN ELECTRICAL GEOMETRY
//
// Hand-authored, irregular lightning. Eight primary filaments of different
// lengths (37–47 user units) leaving the core at eight different angles. Each
// primary carries two or three short secondary branches that peel off
// mid-filament and die out, at uneven branch angles. Four hotter near-source
// segments brighten the strongest detail, and three small secondary sparks sit
// in their own layer so they can flicker independently.
//
// The whole event is 96 units across a ~111px box: visibly contained, roughly
// ±55px around the spark on any viewport. The same eight primary filaments are
// drawn three times at three weights (halo / hot / core) — that is what turns
// a hairline into visible electrical energy with no blur and no giant glow.
// ---------------------------------------------------------------------------
const BOLT_PRIMARY = [
  'M-2,1 L-7,-8 L-4,-15 L-13,-23 L-9,-30 L-17,-38 L-14,-45',
  'M2,-2 L9,-6 L7,-15 L16,-20 L13,-28 L21,-33 L19,-41',
  'M2,1 L12,-2 L18,0 L25,-5 L33,-2 L36,-9 L45,-12',
  'M-1,2 L6,9 L4,16 L12,21 L9,29 L17,34 L16,43',
  'M-2,0 L-10,5 L-8,12 L-16,18 L-13,26 L-20,32 L-18,39',
  'M-3,0 L-11,3 L-18,1 L-25,6 L-33,4 L-37,11 L-45,14',
  'M0,-1 L-3,-9 L1,-17 L-5,-24 L0,-32 L-4,-40 L1,-47',
  'M1,1 L5,-6 L11,-9 L9,-17 L17,-21 L20,-28 L28,-31',
]
const BOLT_HOT = [
  'M-2,1 L-7,-8 L-4,-15',
  'M2,1 L12,-2 L18,0',
  'M-1,2 L6,9 L4,16',
  'M1,1 L5,-6 L11,-9',
]
// Two or three short branches per region of the primary set, at deliberately
// uneven angles and lengths.
const BOLT_SECONDARY = [
  'M-7,-8 L-15,-11 L-20,-9 L-27,-14',
  'M9,-6 L16,-12 L22,-10 L27,-16',
  'M18,0 L21,6 L27,9 L29,16',
  'M6,9 L10,14 L15,16 L18,23',
  'M-10,5 L-15,10 L-19,12 L-22,19',
  'M-18,1 L-21,-5 L-27,-8 L-30,-15',
  'M-3,-9 L1,-13 L-1,-19 L4,-23',
  'M-4,-15 L-11,-19 L-14,-25 L-21,-28',
  'M20,-28 L25,-33 L31,-33 L34,-39',
  'M17,34 L21,40 L27,42 L29,47',
  'M-13,-23 L-20,-21 L-25,-25 L-32,-24',
]
// Small hot sparks — very short, very bright, flickering twice at the peak.
// They read as extra discharges caught mid-arc, not as more branches.
const BOLT_SPARKS = [
  'M-13,-23 L-19,-26 L-22,-33',
  'M13,-28 L18,-34 L25,-36',
  'M9,29 L14,34 L22,36',
]

// ---------------------------------------------------------------------------
// PHASE 2 — GOLD → VIOLET ELECTRICAL CONVERSION
//
// Four contiguous stops applied to `color` on the filament group, the spark
// group, the motes and the storm core — so the exact same branches change
// colour rather than being replaced. Each stop begins where the previous one
// ends, so gold slides through warm amber, then warm mauve, then muted
// lavender, then into SkillBridge violet with no frame in between where the
// old colour has gone and the new one has not arrived.
// ---------------------------------------------------------------------------
const VIOLET_RAMP = [
  { color: '#f0b83f', at: 0.25, duration: 0.10 }, // gold    → warm amber
  { color: '#cfa98d', at: 0.35, duration: 0.09 }, // amber   → warm mauve
  { color: '#9b86e2', at: 0.44, duration: 0.10 }, // mauve   → muted lavender
  { color: '#7a63ec', at: 0.54, duration: 0.11 }, // lavender → SkillBridge violet
]

// ---------------------------------------------------------------------------
// PHASE 4 — THE VIOLET GUIDANCE PATH
//
// The gold discharge leaves the spark and has to become a ROUTE, not a scribble:
// something with an origin, waypoints, side information and a destination. So
// the geometry is authored as a journey with four legible beats, all offsets in
// percent from the measured spark, and every point hand-placed — no straight
// segment, no symmetry, no self-crossing, and no closed loop:
//
//   1  DEPART      leaves the spark upward, steep and short
//   2  SHOULDER    flattens, hooks back to the left over the ruins
//   3  SWEEP       a long shallow rightward run — the "searching" leg
//   4  DESCENT     turns down, curves back left and arrives centre-low
//
// The arrival point matters: the cream erodes FROM the end of this path (P7), so
// the terminus is placed centre-low, exactly where the homepage hero resolves.
// The route therefore ends by pointing at the place the page is about to appear
// — it leads somewhere instead of decorating the frame.
//
//      spark
//        ●
//        │╲                       ╭───────────  3 sweep
//        │ ╰──╮                   │
//        ╰────╯╲                  │
//              ╰──╮      ╭────────╯
//                 ╰──────╯
//                   ╲
//                    ╰──────▶  destination (homepage reveal centre)
//
// The Catmull-Rom tension is tight (0.125) so direction changes read as crisp
// turns rather than a smooth ribbon. Everything is measured in real pixels off
// the live path, so the composition adapts to the viewport instead of being
// pinned to one breakpoint.
const SIGNAL_OFFSETS = [
  [  0.0,   0.0], [  1.2,  -1.8], [  2.8,  -3.4], [  5.2,  -3.6],
  [  4.6,  -5.6], [  1.4,  -6.8], [ -2.4,  -6.2], [ -5.4,  -4.4],
  [ -6.6,  -1.4], [ -4.8,   1.2], [ -1.2,   2.0], [  3.2,   1.8],
  [  8.0,   2.4], [ 12.2,   4.0], [ 13.8,   6.8], [ 13.0,  10.2],
  [ 10.4,  12.6], [  6.8,  14.2], [  2.8,  15.0], [ -1.0,  15.8],
  [ -3.8,  17.4], [ -4.4,  20.4],
]

// Curve tension. 0.125 keeps the turns crisp; the standard 0.167 would round
// the corners into a generic ribbon.
const CURVE_TENSION = 0.125

// The travelling light's pixel size, centred on each cached path coordinate.
const TRAVEL_SIZE = 8
const TRAVEL_SEGMENTS = 48

// ---------------------------------------------------------------------------
// THE ROUTE'S STRUCTURE — the parts that make it read as a system.
//
// Everything below is a fraction along the LIVE path, so the whole network is
// derived from the same measured curve. The draw and the travelling light share
// one linear clock (DRAW_T0 / DRAW_T1), which is what makes the story exact:
// `at(t)` is the moment the light touches a given point of the route, and every
// node, branch, filament and pulse is scheduled from it. Nothing is on a
// hand-waved delay, so the sequence can never drift out of order.
// ---------------------------------------------------------------------------
const DRAW_T0 = 0.98   // the wavefront and the light leave the spark
const DRAW_T1 = 1.44   // the route is complete

// Five waypoints: the origin (on the spark), three mid-route decision points,
// and the destination the homepage arrives through.
const NODE_F     = [0, 0.185, 0.425, 0.645, 1]
// Node 0 is the ignition point, node 4 the destination — the only two that are
// allowed a ring.
const ORBIT_NODE = [0, 4]
// Non-adjacent waypoint pairs, drawn as faint chords. They are what turn a
// single route into a NETWORK: links between stops the light has already
// passed, as if the route were one path through a larger graph.
const CHORD_PAIRS = [[0, 2], [1, 3], [2, 4]]
// Secondary paths peeling off the route, each with its own hand-set angle.
const BRANCH_F   = [0.27, 0.50, 0.715, 0.885]
const BRANCH_ROT = [-118, -46, -126, -64]
// Micro-filaments shed behind the wavefront, perpendicular to the local tangent.
const MICRO_F    = [0.09, 0.205, 0.325, 0.455, 0.60, 0.79]
const MICRO_SIDE = [1, -1, 1, -1, 1, -1]
const MICRO_LEN  = [24, 16, 28, 19, 26, 18]

// The one clock the whole signal is scheduled from.
const at = (f) => DRAW_T0 + (DRAW_T1 - DRAW_T0) * f

function signalPoints(sxPct, syPct, W, H) {
  const minX = 0.035 * W, maxX = 0.965 * W
  const minY = 0.05 * H,  maxY = 0.93 * H
  return SIGNAL_OFFSETS.map(([dx, dy]) => {
    const x = ((sxPct + dx) / 100) * W
    const y = ((syPct + dy) / 100) * H
    return [
      Math.min(maxX, Math.max(minX, x)),
      Math.min(maxY, Math.max(minY, y)),
    ]
  })
}

// Catmull-Rom → cubic Bézier at a controlled tension. Curved where the path
// should curve, crisp where it should turn.
function smoothPath(pts, ox = 0, oy = 0) {
  const p = pts.map(([x, y]) => [x + ox, y + oy])
  const k = CURVE_TENSION
  const f = (n) => n.toFixed(2)
  let d = `M${f(p[0][0])},${f(p[0][1])}`
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] || p[i]
    const p1 = p[i]
    const p2 = p[i + 1]
    const p3 = p[i + 2] || p2
    const c1x = p1[0] + (p2[0] - p0[0]) * k
    const c1y = p1[1] + (p2[1] - p0[1]) * k
    const c2x = p2[0] - (p3[0] - p1[0]) * k
    const c2y = p2[1] - (p3[1] - p1[1]) * k
    d += ` C${f(c1x)},${f(c1y)} ${f(c2x)},${f(c2y)} ${f(p2[0])},${f(p2[1])}`
  }
  return d
}

// ---------------------------------------------------------------------------
// Particles — tiny warm motes, purely atmospheric
// ---------------------------------------------------------------------------
function Particles({ active }) {
  const canvasRef = useRef(null)
  const rafRef    = useRef(0)

  useEffect(() => {
    if (!active) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let W = canvas.offsetWidth
    let H = canvas.offsetHeight
    canvas.width  = W
    canvas.height = H

    const COUNT = Math.min(38, Math.round((W * H) / 20000))
    const pts = Array.from({ length: COUNT }, () => ({
      x:   Math.random() * W,
      y:   Math.random() * H,
      r:   0.5 + Math.random() * 1.1,
      vx: (Math.random() - 0.5) * 0.13,
      vy: -0.04 - Math.random() * 0.10,
      a:   0.08 + Math.random() * 0.32,
      pa:  Math.random() * Math.PI * 2,
      ps:  0.003 + Math.random() * 0.006,
    }))

    let running = true
    function draw() {
      if (!running) return
      rafRef.current = requestAnimationFrame(draw)
      ctx.clearRect(0, 0, W, H)
      for (const p of pts) {
        p.pa += p.ps
        const alpha = p.a * (0.5 + 0.5 * Math.sin(p.pa))
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,214,110,${alpha.toFixed(3)})`
        ctx.fill()
        p.x += p.vx; p.y += p.vy
        if (p.y < -4)  { p.y = H + 4; p.x = Math.random() * W }
        if (p.x < -4)  p.x = W + 4
        if (p.x > W+4) p.x = -4
      }
    }
    const onResize = () => {
      W = canvas.offsetWidth; H = canvas.offsetHeight
      canvas.width = W; canvas.height = H
    }
    window.addEventListener('resize', onResize)
    draw()
    return () => {
      running = false
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', onResize)
    }
  }, [active])

  return <canvas ref={canvasRef} className="co-particles" aria-hidden="true" />
}

// ---------------------------------------------------------------------------
// CinematicOpening
//
// LAYER ORDER (back → front):
//   .co-canvas          z:0   deep blue sky gradient
//   .co-layer-bg        z:1   cinematic-bg-reference.png  (cloud city)
//   .co-layer-ruins     z:2   ruins-frame.png             (foreground frame)
//   .co-layer-student   z:3   student-reference.png       (ONE student, ±2px parallax)
//   .co-layer-hand      z:4   hand-reference.png          (ONE hand, ±2px parallax)
//   .co-spark           z:5   golden spark + contained electrical filaments
//   .co-fx              z:6   atmospheric motes canvas
//   .co-copy            z:7   HTML typography (above every decorative layer)
//   .co-transition      z:8   energy event: cream surface + violet signal
//   .co-loading         z:9   loading screen
//
// NO COLOUR GAP. `.co-root`'s own backdrop is the exact transition cream, and
// `.co-canvas` is an opaque navy layer that covers it for the whole cinematic
// phase. The artwork and the sky layer are removed in ONE synchronous step
// that also drops the root backdrop to transparent — and that step only runs
// once the cream surface is already opaque and full-frame, so it cannot be
// seen. The visible chain is therefore
//     navy artwork → cream → cream (transparent root) → real homepage
// with no dark, grey, black, navy or second-white frame anywhere, and no
// uncovered strip at the reveal edge, because the reveal is a clip on a
// surface whose own base colour is the cream itself.
//
// HOMEPAGE FREEZE (owned by App.jsx / styles.css — NOT reimplemented here):
//   `body.co-intro-active` locks document scroll, pins the hero's CSS custom
//   properties to their resting values, strips pointer events from the page
//   and gates HeroOverlay's RAF loop behind waitForIntroEnd(). App.jsx removes
//   that class in the same commit that unmounts this overlay, and that only
//   happens when onDismiss fires — which is exclusively the exit timeline's
//   onComplete. The homepage therefore cannot animate at any point while this
//   overlay is on screen, and resumes on exactly the frame it disappears.
//
// TRANSITION CONTRACT — one continuous energy event, ~1.94s, eight overlapping
// phases and no dead pause between any of them:
//   P1  0.00 → 0.35  strong golden thunder: 8 irregular primary filaments at
//                    three weights, 4 hot near-source segments, 11 secondary
//                    filaments, 3 flickering secondary sparks, 7 motes — all
//                    contained within ~55px of the spark
//   P2  0.25 → 0.65  the SAME branches are converted gold → amber → mauve →
//                    lavender → violet; the gold core contracts as a violet
//                    core forms inside and around it, so both are visible
//                    together for the whole overlap
//   P3  0.55 → 0.92  violet energy ESCAPES the spark: the violet core blooms
//                    outward and the violet filaments reach further
//   P4  0.55 → 0.92  the clean cream canvas expands from that same point as
//                    an expanding circle — a full, clearly perceptible phase
//   P5  0.98 → 1.44  the violet signal draws itself across the finished cream:
//                    main trace, travelling aura, travelling light,
//                    micro-filaments, nodes and branches
//   P6  1.16         one synchronous, entirely hidden step removes the
//                    cinematic artwork and hands the frame to the real page
//   P7  1.20 → 1.80  the SAME reveal circle erodes back to zero, centred on the
//                    signal's endpoint, so the real homepage pours in through a
//                    growing aperture — a shape change, not an opacity crossfade
//   P8  1.50 → 1.92  the signal dissolves into the arriving page: the endpoint
//                    swells, branches and micro-filaments go, nodes soften, the
//                    light runs out, the trace thins and the last violet pixels
//                    are gone
//   A 3.4s failsafe in runExit guarantees the overlay always unmounts.
//   DO NOT add a second full-viewport element: .co-vwipe is the only one.
// ---------------------------------------------------------------------------
export default function CinematicOpening({ onDismiss }) {
  const rootRef      = useRef(null)
  const canvasRef    = useRef(null)
  const bgRef        = useRef(null)
  const ruinsRef     = useRef(null)
  const studentRef   = useRef(null)
  const handRef      = useRef(null)
  const fxRef        = useRef(null)
  const sparkRef      = useRef(null)
  const sparkGlowRef  = useRef(null)
  const sparkStormRef = useRef(null)
  const sparkCoreRef  = useRef(null)
  const sparkVioletRef = useRef(null)
  const sparkMotesRef  = useRef(null)
  const sparkStreaksRef = useRef(null)
  const sparkSparksRef  = useRef(null)
  const copyRefs     = [useRef(null), useRef(null), useRef(null), useRef(null), useRef(null)]
  // The .co-copy CONTAINER. Its ::before legibility wash is a pseudo-element, so
  // it is invisible to the five line refs and to any querySelectorAll sweep —
  // only hiding the container itself removes it.
  const copyRootRef  = useRef(null)
  // Transition elements
  const transRef      = useRef(null)
  const vwipeRef      = useRef(null)
  const sbSignalRef   = useRef(null)
  const sbTraceRef    = useRef(null)
  const sbTracePathRef = useRef(null)
  const sbWashPathRef  = useRef(null)
  const sbMicroRef    = useRef(null)
  const sbBranchRef   = useRef(null)
  const sbNodeRef     = useRef(null)
  const sbParticlesRef = useRef(null)
  const sbTravelRef   = useRef(null)
  const sbWebRef      = useRef(null)
  const sbOrbitRef    = useRef(null)
  // Loading
  const loadingRef   = useRef(null)
  const loadBarRef   = useRef(null)
  const loadTextRef  = useRef(null)

  // Layered parallax. `raf` is the single loop handle, `detach` the listener
  // pair it started, `els` the resolved per-layer transform targets, and tx/ty
  // the raw pointer target with cx/cy the eased value actually written out.
  const parallaxRef  = useRef({ raf: 0, detach: null, els: null, tx: 0, ty: 0, cx: 0, cy: 0, on: false })
  const doneRef      = useRef(false)
  // Spark position, measured after asset render. Drives the violet origin, the
  // cream bloom origin and the whole signal geometry.
  const sparkPctX    = useRef(60)  // default from CSS
  const sparkPctY    = useRef(37)  // default from CSS
  // Hard guarantee that the overlay always unmounts — and therefore that the
  // homepage freeze always lifts. Cleared only on a normal completion.
  const failsafeRef  = useRef(0)

  const [assetsReady, setAssetsReady] = useState(false)
  const [particlesOn, setParticlesOn] = useState(false)

  const reduced = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false

  // -------------------------------------------------------------------------
  // Asset loading
  // -------------------------------------------------------------------------
  useEffect(() => {
    loadWithProgress(PRELOAD_SRCS, (pct) => {
      if (loadBarRef.current)  loadBarRef.current.style.width = `${pct}%`
      if (loadTextRef.current) loadTextRef.current.textContent = `LOADING ${pct}%`
    }).then(() => {
      if (loadBarRef.current)  loadBarRef.current.style.width = '100%'
      if (loadTextRef.current) loadTextRef.current.textContent = 'LOADING 100%'
      setTimeout(() => setAssetsReady(true), 280)
    })
  }, [])

  // -------------------------------------------------------------------------
  // Main cinematic sequence
  //
  // TIMING (seconds after assetsReady):
  //   0.00  loading screen fades out
  //   0.30  background fades in (opacity only)
  //   0.55  ruins foreground fades in
  //   0.75  student fades in — NO movement
  //   0.90  hand fades in   — NO movement
  //   1.10  ambient particles begin + layered pointer parallax arms
  //   1.25  spark position computed from DOM; spark ignites (small)
  //   1.58  text formation begins — total ~800ms, ends 2.38
  //   3.05  hold ends → the energy event fires (runExit)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!assetsReady) return
    const root = rootRef.current
    if (!root) return

    // Reduced motion: instant reveal, then fast dismiss
    if (reduced) {
      gsap.set(loadingRef.current, { opacity: 0, pointerEvents: 'none' })
      gsap.set([bgRef.current, ruinsRef.current, studentRef.current, handRef.current], { opacity: 1 })
      gsap.set(copyRefs.map((r) => r.current), { opacity: 1, xPercent: 0 })
      gsap.set(sparkRef.current, { opacity: 0.8 })
      gsap.set(sparkGlowRef.current, { opacity: 0.5 })
      setParticlesOn(true)
      setTimeout(() => runExit(true), 800)
      return
    }

    // ── Set initial hidden state — NO scale, NO y/x, just opacity ──
    gsap.set([bgRef.current, ruinsRef.current, studentRef.current, handRef.current], { opacity: 0 })
    gsap.set(sparkRef.current,      { opacity: 0 })
    gsap.set(sparkGlowRef.current,  { opacity: 0 })
    gsap.set(sparkStreaksRef.current, { opacity: 0 })
    gsap.set(sparkSparksRef.current,  { opacity: 0, scale: 0.5 })
    gsap.set(sparkStormRef.current, { opacity: 0, color: '#f5cc70' })
    gsap.set(copyRefs.map((r) => r.current), { opacity: 0, xPercent: -104 })
    // The transition layer is not merely transparent during the cinematic
    // scene — it is not painted at all. `visibility: hidden` means no cream,
    // no violet aura, no signal and no glow can reach the screen before
    // runExit opens it, regardless of what any tween or inline style does.
    gsap.set(transRef.current, { opacity: 0, visibility: 'hidden' })
    // The cream surface and the signal are both revealed by a clip-path circle
    // grown from the violet core. Parked at radius 0 and opacity 0, so they
    // cannot be seen unless the exit timeline explicitly opens them.
    gsap.set([vwipeRef.current, sbSignalRef.current], { opacity: 0 })
    gsap.set(sbTraceRef.current, { opacity: 0 })
    gsap.set([
      sbBranchRef.current,
      sbNodeRef.current,
      sbParticlesRef.current,
      sbWebRef.current,
      sbOrbitRef.current,
      sbTravelRef.current,
    ], { opacity: 0 })

    const tl = gsap.timeline({ defaults: { ease: 'power2.out' } })

    // 0.00 — loading out
    tl.to(loadingRef.current, {
      opacity: 0, duration: 0.45, ease: 'power2.inOut',
      onComplete: () => { if (loadingRef.current) loadingRef.current.style.pointerEvents = 'none' }
    }, 0)

    // 0.30 — bg fades in (opacity only — no scale animation)
    tl.to(bgRef.current, { opacity: 1, duration: 0.75, ease: 'power1.inOut' }, 0.30)

    // 0.55 — ruins foreground
    tl.to(ruinsRef.current, { opacity: 1, duration: 0.65, ease: 'power1.inOut' }, 0.55)

    // 0.75 — student enters — OPACITY ONLY, no y/x/scale
    tl.to(studentRef.current, { opacity: 1, duration: 0.60, ease: 'power1.inOut' }, 0.75)

    // 0.90 — hand enters — OPACITY ONLY
    tl.to(handRef.current, { opacity: 1, duration: 0.60, ease: 'power1.inOut' }, 0.90)

    // 1.10 — atmosphere begins
    tl.call(() => {
      setParticlesOn(true)
      startParallax()  // environment-only depth response; frozen in runExit
    }, [], 1.10)

    // 1.25 — measure the spark from the real rendered DOM, then ignite
    tl.call(() => {
      const pos = computeSparkPosition(studentRef.current, handRef.current, rootRef.current)
      if (pos) {
        sparkPctX.current = pos.pctX
        sparkPctY.current = pos.pctY
        if (rootRef.current) {
          rootRef.current.style.setProperty('--co-sx', `${pos.pctX.toFixed(2)}%`)
          rootRef.current.style.setProperty('--co-sy', `${pos.pctY.toFixed(2)}%`)
        }
      }
    }, [], 1.25)

    // Spark: tiny warm point → soft glow — SMALL, not expansive
    tl.to(sparkRef.current, { opacity: 1, duration: 0.22, ease: 'power2.out' }, 1.27)
    tl.to(sparkGlowRef.current, { opacity: 0.70, duration: 0.38, ease: 'power2.out' }, 1.30)
    tl.to(sparkGlowRef.current, { opacity: 0.50, duration: 0.30, ease: 'power1.inOut' }, 1.72)

    // ── Text formation — 1.58 → 2.38 ──
    // Each line is revealed by a short horizontal travel out of its mask.
    // No typing, no per-character stagger, no blur, no bounce. Once the last
    // line lands, every glyph is static for the rest of the intro.
    tl.to(copyRefs[0].current, { opacity: 1, xPercent: 0, duration: 0.32, ease: 'power3.out' }, 1.58)
    tl.to(copyRefs[1].current, { opacity: 1, xPercent: 0, duration: 0.32, ease: 'power3.out' }, 1.70)
    tl.to(copyRefs[2].current, { opacity: 1, xPercent: 0, duration: 0.36, ease: 'power3.out' }, 1.86)
    tl.to(copyRefs[3].current, { opacity: 1, xPercent: 0, duration: 0.32, ease: 'power3.out' }, 2.08)
    tl.to(copyRefs[4].current, { opacity: 1, xPercent: 0, duration: 0.32, ease: 'power3.out' }, 2.20)

    // 3.05 — transition begins
    tl.call(() => runExit(false), [], 3.05)

    return () => {
      tl.kill()
      stopParallax()
      clearTimeout(failsafeRef.current)
    }
  }, [assetsReady, reduced]) // eslint-disable-line react-hooks/exhaustive-deps

  // -------------------------------------------------------------------------
  // POINTER PARALLAX — depth only, environment first.
  //
  // Existing scene layers respond at different amplitudes:
  //
  //   .co-canvas       ±4px   atmosphere
  //   .co-layer-bg     ±7px   cloud city / distant architecture
  //   .co-layer-ruins  ±20px  foreground architecture
  //   student + hand   ±2px   character layers
  //
  // Text and spark remain completely still. The environment moves more than
  // the characters, and the amplitude differences supply the depth cue.
  //
  // There is no oscillation, no sine, no bob and no autonomous drift: the
  // target is a pure function of pointer position, and the written value is an
  // exponential ease toward that target, so a stationary pointer settles and
  // the loop then stops scheduling frames entirely. It is armed at the same
  // 1.10s mark the old ambient drift used, runs only while the cinematic scene
  // is on screen, and stopParallax(false) freezes its current pose the instant the
  // transition begins — so the energy event is untouched.
  //
  // Fine-pointer only: a coarse pointer (touch) never arms it, and a
  // non-mouse pointerType is ignored. No gyroscope, no device-motion.
  // -------------------------------------------------------------------------
  const PARALLAX_EASE  = 0.06   // per-frame exponential approach
  const PARALLAX_EPS   = 0.0004 // below this the value is snapped and idle

  function applyParallax(cx, cy) {
    const layers = parallaxRef.current.els || []
    for (const { el, amount, character } of layers) {
      if (!el) continue
      const x = `${(cx * amount).toFixed(2)}px`
      const y = `${(cy * amount).toFixed(2)}px`
      if (character) {
        el.style.setProperty('--co-parallax-x', x)
        el.style.setProperty('--co-parallax-y', y)
      } else {
        el.style.transform = `translate3d(${x}, ${y}, 0)`
      }
    }
  }

  function startParallax() {
    const st = parallaxRef.current
    if (st.on || reduced) return
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    st.els = [
      { el: canvasRef.current, amount: 4 },
      { el: bgRef.current, amount: 7 },
      { el: ruinsRef.current, amount: 20 },
      { el: studentRef.current, amount: 2, character: true },
      { el: handRef.current, amount: 2, character: true },
    ]
    st.on = true

    function frame() {
      st.raf = 0
      st.cx += (st.tx - st.cx) * PARALLAX_EASE
      st.cy += (st.ty - st.cy) * PARALLAX_EASE
      const dx = st.tx - st.cx
      const dy = st.ty - st.cy
      if (Math.abs(dx) < PARALLAX_EPS && Math.abs(dy) < PARALLAX_EPS) {
        st.cx = st.tx
        st.cy = st.ty
        applyParallax(st.cx, st.cy)
        return // settled — idle until the next pointermove
      }
      applyParallax(st.cx, st.cy)
      st.raf = requestAnimationFrame(frame)
    }

    function onMove(e) {
      if (e.pointerType && e.pointerType !== 'mouse') return
      st.tx = (e.clientX / window.innerWidth) * 2 - 1
      st.ty = (e.clientY / window.innerHeight) * 2 - 1
      if (!st.raf) st.raf = requestAnimationFrame(frame)
    }
    // Pointer out of the window → ease back to the neutral pose, never a jump.
    function onLeave() {
      st.tx = 0
      st.ty = 0
      if (!st.raf) st.raf = requestAnimationFrame(frame)
    }

    st.detach = () => {
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerleave', onLeave)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('pointerleave', onLeave)
  }

  // Idempotent: safe from the effect cleanup, from runExit's transition lock and
  // from the reduced-motion / early-return paths. Cancels the loop and drops
  // both listeners. Cleanup restores the base pose; transition lock retains it.
  function stopParallax(restore = true) {
    const st = parallaxRef.current
    if (st.raf) cancelAnimationFrame(st.raf)
    st.raf = 0
    st.on = false
    if (st.detach) st.detach()
    st.detach = null
    if (restore) {
      st.tx = 0; st.ty = 0; st.cx = 0; st.cy = 0
      for (const { el, character } of st.els || []) {
        if (!el) continue
        if (character) {
          el.style.removeProperty('--co-parallax-x')
          el.style.removeProperty('--co-parallax-y')
        } else {
          el.style.transform = ''
        }
      }
      st.els = null
    }
  }

  // -------------------------------------------------------------------------
  // TRANSITION — one continuous energy event, ~1940ms.
  //
  //   P1 gold thunder     0.00 → 0.35
  //   P2 gold → violet    0.25 → 0.65   (overlaps P1)
  //   P3 violet escapes   0.55 → 0.92   (overlaps P2)
  //   P4 cream canvas     0.55 → 0.92   (rides with P3, no dead pause)
  //   P5 signal draws     0.98 → 1.44
  //   P6 artwork handoff  1.16           (one hidden, synchronous step)
  //   P7 homepage arrives 1.20 → 1.80   (the cream clip erodes, no crossfade)
  //   P8 signal dissolves 1.50 → 1.92   (overlaps P7; nothing violet survives)
  //
  // THE SIGNAL IS THE BRIDGE. P7 is the same clip-path circle as P4, continued
  // in reverse: it grew from the violet origin to cover the frame, and it now
  // erodes back to zero centred on the signal's endpoint. So the real homepage
  // arrives through a growing aperture while the violet trace is still drawing
  // and is still disintegrating, and the cream survives longest exactly where
  // the signal terminates. Nothing waits for the signal to disappear first, and
  // the last frame contains no floating purple drawing.
  //
  // MOTION LOCK: inside the transition nothing is translated, scaled, rotated,
  // or parallaxed. The environment parallax is frozen in place before a single
  // tween starts; the student, hand, sky and text never move at all, and the
  // whole scene is removed in one
  // synchronous step at 1.16s while the cream is still opaque and full-frame.
  // -------------------------------------------------------------------------
  function runExit(skipAnimation) {
    if (doneRef.current) return
    doneRef.current = true

    // TRANSITION LOCK — freeze the current parallax pose before anything
    // animates. The RAF and listeners stop, but the scene stays in place.
    // Nothing moves during thunder, the colour conversion, the cream reveal,
    // the signal or the handoff.
    stopParallax(false)

    // ── TEARDOWN ────────────────────────────────────────────────────────────
    // Hard, idempotent, and order-independent: it walks the live DOM through
    // the refs rather than closing over locals, so it is safe to call from any
    // exit path — normal completion, the failsafe, or an early return. It
    // guarantees the invariant that matters: no transition pixel can survive
    // the overlay, whatever the timeline happened to be doing at that instant.
    //
    // It sweeps EVERY direct child of the root, not a hand-picked subset: the
    // five .co-line spans are not the whole copy block, and .co-copy's own
    // ::before legibility wash is a pseudo-element that querySelectorAll can
    // never reach. Only `visibility: hidden` on the container removes that
    // wash, and .co-copy sits at z-index 7 — BELOW the transition at z-index 8 —
    // so while the cream is opaque it is hidden, and the instant the cream clip
    // erodes away the wash is left painted over the arriving homepage. That
    // dark radial haze over the real page is the grey residue; this is where it
    // dies.
    const teardown = () => {
      const neutralise = (host) => {
        if (!host) return
        host.style.opacity = '0'
        host.style.visibility = 'hidden'
        host.style.pointerEvents = 'none'
        host.style.background = 'none'
        host.style.filter = 'none'
        host.style.boxShadow = 'none'
        host.style.clipPath = 'none'
        for (const el of host.querySelectorAll('*')) {
          el.style.opacity = '0'
          el.style.visibility = 'hidden'
          el.style.pointerEvents = 'none'
          el.style.clipPath = 'none'
          el.style.filter = 'none'
          el.style.background = 'none'
          el.style.boxShadow = 'none'
          el.style.strokeDasharray = 'none'
          el.style.strokeDashoffset = '0'
        }
      }
      const root = rootRef.current
      if (root) {
        for (const el of root.children) neutralise(el)
        neutralise(transRef.current)
        neutralise(sparkRef.current)
        neutralise(loadingRef.current)
        // The root's own cream backdrop and the whole overlay go last, so the
        // frame this runs in cannot composite a single transition pixel.
        root.style.background = 'none'
        root.style.opacity = '0'
        root.style.visibility = 'hidden'
        root.style.pointerEvents = 'none'
      }
    }

    const finish = () => {
      clearTimeout(failsafeRef.current)
      // Cleanup FIRST, dismiss SECOND. The homepage must never become visible
      // while any part of the transition is still mounted.
      teardown()
      onDismiss?.()
    }

    // Failsafe: the overlay MUST unmount — and therefore the homepage freeze
    // MUST lift. Cleared only if the timeline completes normally. It calls
    // finish(), not onDismiss directly, so the teardown also runs on this path.
    clearTimeout(failsafeRef.current)
    failsafeRef.current = setTimeout(finish, 3400)

    if (skipAnimation) { finish(); return }

    const root = rootRef.current
    if (!root) { finish(); return }

    // ── Violet origin, measured from the rendered spark ──
    const sx = Math.min(84, Math.max(16, sparkPctX.current))
    const sy = Math.min(80, Math.max(20, sparkPctY.current))
    root.style.setProperty('--co-sx', `${sx.toFixed(2)}%`)
    root.style.setProperty('--co-sy', `${sy.toFixed(2)}%`)

    // ── Signal geometry, in real pixels, born on the violet origin ──
    const W = root.clientWidth || window.innerWidth
    const H = root.clientHeight || window.innerHeight
    const pts = signalPoints(sx, sy, W, H)
    const traceD = smoothPath(pts)

    const tracePath = sbTracePathRef.current
    const washPath  = sbWashPathRef.current
    if (tracePath) tracePath.setAttribute('d', traceD)
    if (washPath)  washPath.setAttribute('d', traceD)

    let traceLen = 0
    if (tracePath) {
      traceLen = tracePath.getTotalLength()
      tracePath.style.strokeDasharray = `${traceLen}`
      tracePath.style.strokeDashoffset = `${traceLen}`
    }
    // The wash is a faint copy of the same curve. Its dash window
    // is a short segment that rides the travelling light, so the violet aura
    // only ever exists immediately around the active part of the signal.
    const WASH_WIN = 70
    let washLen = 0
    if (washPath) {
      washLen = tracePath ? traceLen : washPath.getTotalLength()
      washPath.style.strokeDasharray = `${WASH_WIN} ${washLen}`
      washPath.style.strokeDashoffset = `${WASH_WIN / 2}`
    }

    // Cache a fixed path sample for the travelling signal before building the
    // timeline. All route details are derived from this same immutable sample.
    const travelPoints = Array.from({ length: TRAVEL_SEGMENTS + 1 }, (_, i) => {
      const p = tracePath && traceLen
        ? tracePath.getPointAtLength(traceLen * (i / TRAVEL_SEGMENTS))
        : { x: 0, y: 0 }
      return { x: p.x, y: p.y }
    })
    const travelPointAt = (fraction) => {
      const position = Math.max(0, Math.min(1, fraction)) * TRAVEL_SEGMENTS
      const index = Math.min(TRAVEL_SEGMENTS - 1, Math.floor(position))
      const progress = position - index
      const start = travelPoints[index]
      const end = travelPoints[index + 1]
      return {
        x: start.x + (end.x - start.x) * progress,
        y: start.y + (end.y - start.y) * progress,
      }
    }
    const onTrace = (fraction) => {
      const p = travelPointAt(fraction)
      const a = travelPointAt(Math.max(0, fraction - 0.006))
      const b = travelPointAt(Math.min(1, fraction + 0.006))
      return { x: p.x, y: p.y, x0: a.x, y0: a.y, x1: b.x, y1: b.y }
    }

    // Nodes — small pinpoints at selected intersections on the trace. Each one
    // also carries a soft expanding pulse ring, parked at zero scale, which the
    // timeline fires at the exact moment the travelling light touches it.
    const nodeEls = sbNodeRef.current
      ? sbNodeRef.current.querySelectorAll('.co-sb-node')
      : []
    const pulseEls = sbNodeRef.current
      ? sbNodeRef.current.querySelectorAll('.co-sb-pulse')
      : []
    const nodePts = []
    nodeEls.forEach((el, i) => {
      const p = onTrace(NODE_F[i])
      nodePts.push(p)
      el.style.left = `${p.x.toFixed(1)}px`
      el.style.top  = `${p.y.toFixed(1)}px`
      gsap.set(el, { opacity: 0, scale: 0.72 })
    })
    pulseEls.forEach((el) => gsap.set(el, { opacity: 0, scale: 0.35 }))
    pulseEls.forEach((el, i) => {
      const p = nodePts[i] || { x: 0, y: 0 }
      el.style.left = `${p.x.toFixed(1)}px`
      el.style.top  = `${p.y.toFixed(1)}px`
    })

    // Network chords — faint straight links between NON-adjacent waypoints. The
    // route alone is a line; these are what make it read as one path through a
    // larger graph, and they arrive after the light has passed both ends, like
    // the system remembering the stops it just made.
    const chordEls = sbWebRef.current
      ? sbWebRef.current.querySelectorAll('.co-sb-chord')
      : []
    const chordPaths = []
    chordEls.forEach((el, i) => {
      const pair = CHORD_PAIRS[i]
      if (!pair) return
      const a = nodePts[pair[0]]
      const b = nodePts[pair[1]]
      if (!a || !b) return
      el.setAttribute('d', `M${a.x.toFixed(1)},${a.y.toFixed(1)} L${b.x.toFixed(1)},${b.y.toFixed(1)}`)
      const cl = el.getTotalLength()
      el.style.strokeDasharray = `${cl}`
      el.style.strokeDashoffset = `${cl}`
      chordPaths.push(el)
    })

    // Orbit rings — two very quiet arcs, one around the origin waypoint and one
    // around the destination. No other node is allowed a ring, so they read as
    // "this is where it started" and "this is where it ends", not as decoration.
    const orbitEls = sbOrbitRef.current
      ? sbOrbitRef.current.querySelectorAll('.co-sb-orbit')
      : []
    const orbitRings = []
    orbitEls.forEach((el, i) => {
      const p = nodePts[ORBIT_NODE[i]]
      if (!p) return
      el.style.left = `${p.x.toFixed(1)}px`
      el.style.top  = `${p.y.toFixed(1)}px`
      const ring = el.querySelector('.co-sb-orbit-ring')
      if (!ring) return
      const rl = ring.getTotalLength() || Math.PI * 2 * 26
      ring.style.strokeDasharray = `${rl}`
      ring.style.strokeDashoffset = `${rl}`
      orbitRings.push(ring)
    })

    // Branches — secondary filaments growing outward from the main path.
    const branchEls = sbBranchRef.current
      ? sbBranchRef.current.querySelectorAll('.co-sb-branch')
      : []
    const branchPaths = []
    branchEls.forEach((el, i) => {
      const p = onTrace(BRANCH_F[i])
      el.style.left = `${p.x.toFixed(1)}px`
      el.style.top  = `${p.y.toFixed(1)}px`
      el.style.transform = `rotate(${BRANCH_ROT[i]}deg)`
      const bp = el.querySelector('path')
      if (!bp) return
      const bl = bp.getTotalLength()
      bp.style.strokeDasharray = `${bl}`
      bp.style.strokeDashoffset = `${bl}`
      branchPaths.push(bp)
    })

    // Micro-filaments — tiny strokes that peel off the envelope, jitter, and
    // are gone again. Each is built perpendicular to the local tangent so it
    // always reads as shed BY the main path.
    const microEls = sbMicroRef.current
      ? sbMicroRef.current.querySelectorAll('.co-sb-micro')
      : []
    microEls.forEach((m, i) => {
      const p = onTrace(MICRO_F[i])
      let tx = p.x1 - p.x0
      let ty = p.y1 - p.y0
      const mag = Math.hypot(tx, ty) || 1
      tx /= mag; ty /= mag
      const nx = -ty
      const ny = tx
      const s = MICRO_SIDE[i]
      const L = MICRO_LEN[i]
      const d0 = L * 0.30 * s, d1 = L * 0.80 * s, d2 = L * 1.10 * s, d3 = L * 1.28 * s
      const a = [p.x + nx * d0,           p.y + ny * d0]
      const b = [p.x + nx * d1 + tx * 4,  p.y + ny * d1 + ty * 4]
      const c = [p.x + nx * d2 - tx * 5,  p.y + ny * d2 - ty * 5]
      const e = [p.x + nx * d3 + tx * 3,  p.y + ny * d3 + ty * 3]
      m.setAttribute('d', `M${a[0].toFixed(1)},${a[1].toFixed(1)} L${b[0].toFixed(1)},${b[1].toFixed(1)} L${c[0].toFixed(1)},${c[1].toFixed(1)} L${e[0].toFixed(1)},${e[1].toFixed(1)}`)
      const ml = m.getTotalLength()
      m.style.strokeDasharray = `${ml}`
      m.style.strokeDashoffset = `${ml}`
    })

    // Travelling light and short-lived particles use the precomputed samples.
    const travelEl = sbTravelRef.current
    if (travelEl) {
      const origin = travelPointAt(0)
      gsap.set(travelEl, { x: origin.x - TRAVEL_SIZE / 2, y: origin.y - TRAVEL_SIZE / 2 })
    }
    const particleEls = sbParticlesRef.current
      ? sbParticlesRef.current.querySelectorAll('.co-sb-particle')
      : []
    const particleFractions = [0.13, 0.32, 0.51, 0.70, 0.87]
    particleEls.forEach((el, i) => {
      const start = travelPointAt(particleFractions[i] || 0)
      gsap.set(el, { x: start.x - 1.5, y: start.y - 1.5, opacity: 0 })
    })

    const tl = gsap.timeline({ onComplete: finish })

    // ── P1 · STRONG GOLDEN THUNDER (0.00 → 0.35) ──
    // Eight irregular primary filaments (three weights deep), four hot
    // near-source segments, eleven secondary filaments, three small secondary
    // sparks that flicker twice, and seven motes. Every branch leaves the core
    // at a different angle and every filament is a different length, so this
    // never reads as a starburst or a straight ray. The strongest detail is
    // always closest to the core.
    const motes = sparkMotesRef.current ? sparkMotesRef.current.children : []

    const FLICKER = [
      [0.95, 1.00], [0.40, 0.92], [0.90, 1.06], [0.32, 0.89],
      [0.86, 1.05], [0.46, 0.94], [0.94, 1.01],
    ]
    let ft = 0
    for (const [o, s] of FLICKER) {
      ft += 0.026
      tl.to(sparkStreaksRef.current, { opacity: o, scale: s, duration: 0.026, ease: 'none' }, ft)
    }

    // Small secondary sparks: two short flickers, then they hold.
    tl.to(sparkSparksRef.current, { opacity: 1, scale: 1, duration: 0.04, ease: 'none' }, 0.06)
    tl.to(sparkSparksRef.current, { opacity: 0.22, duration: 0.035, ease: 'none' }, 0.10)
    tl.to(sparkSparksRef.current, { opacity: 1, scale: 1.07, duration: 0.04, ease: 'none' }, 0.135)
    tl.to(sparkSparksRef.current, { opacity: 0.30, duration: 0.03, ease: 'none' }, 0.175)
    tl.to(sparkSparksRef.current, { opacity: 0.92, duration: 0.05, ease: 'none' }, 0.205)

    tl.to(sparkMotesRef.current, { opacity: 1, duration: 0.05, ease: 'none' }, 0.03)
    tl.fromTo(motes, { scale: 0 },
      { scale: 1, duration: 0.16, ease: 'power2.out', stagger: 0.020 }, 0.04)
    tl.to(sparkMotesRef.current, { opacity: 0, duration: 0.13, ease: 'power1.in' }, 0.20)
    tl.to(sparkGlowRef.current, { opacity: 0.95, scale: 1.32, duration: 0.28, ease: 'power2.out' }, 0)
    tl.to(sparkStormRef.current, { opacity: 0.95, scale: 1.16, duration: 0.26, ease: 'power2.out' }, 0.01)
    tl.to(sparkCoreRef.current, { scale: 1.45, duration: 0.24, ease: 'power2.out' }, 0)
    // Gold reaches its peak at 0.35.
    tl.to(sparkStreaksRef.current, { opacity: 1, scale: 1.16, duration: 0.20, ease: 'power2.out' }, 0.15)

    // ── P2 · GOLD → VIOLET ELECTRICAL CONVERSION (0.25 → 0.65) ──
    // The very same branches change colour. Nothing is removed and nothing new
    // is added. A violet core forms INSIDE the gold core, then closes inward
    // around it, so for the whole overlap both colours are on screen at once
    // and the viewer sees gold electricity being converted rather than gold
    // being switched off and violet being switched on.
    for (const stop of VIOLET_RAMP) {
      tl.to(sparkStreaksRef.current, { color: stop.color, duration: stop.duration, ease: 'none' }, stop.at)
      tl.to(sparkSparksRef.current,  { color: stop.color, duration: stop.duration, ease: 'none' }, stop.at)
      tl.to(sparkMotesRef.current,   { color: stop.color, duration: stop.duration, ease: 'none' }, stop.at)
      tl.to(sparkStormRef.current,   { color: stop.color, duration: stop.duration, ease: 'none' }, stop.at)
    }
    // Violet forms at the centre first, then wraps inward over the gold.
    tl.fromTo(sparkVioletRef.current,
      { opacity: 0, scale: 0.95 },
      { opacity: 0.9, scale: 1.30, duration: 0.18, ease: 'power2.out' }, 0.27)
    tl.to(sparkVioletRef.current, { scale: 0.62, duration: 0.26, ease: 'power2.inOut' }, 0.45)
    // The gold core contracts INTO the violet core.
    tl.to(sparkCoreRef.current, { scale: 0.52, duration: 0.22, ease: 'power2.in' }, 0.43)
    tl.to(sparkCoreRef.current, { opacity: 0, duration: 0.09, ease: 'power1.in' }, 0.55)
    tl.to(sparkSparksRef.current, { opacity: 0, duration: 0.12, ease: 'power1.in' }, 0.46)
    tl.to(sparkGlowRef.current, { scale: 1.0, duration: 0.30, ease: 'power1.inOut' }, 0.27)

    // ── P3 · VIOLET ENERGY ESCAPES THE SPARK (0.55 → 0.92) ──
    // The violet core blooms outward and the violet filaments reach further,
    // so the energy is visibly leaving the point where the gold used to be.
    tl.fromTo(sparkVioletRef.current,
      { opacity: 0.9, scale: 0.62 },
      { opacity: 0, scale: 2.05, duration: 0.34, ease: 'power2.out' }, 0.58)
    tl.to(sparkStreaksRef.current, { scale: 1.92, opacity: 0.5, duration: 0.34, ease: 'power2.out' }, 0.58)
    tl.to(sparkStormRef.current, { scale: 1.85, opacity: 0, duration: 0.34, ease: 'power2.out' }, 0.58)
    tl.to(sparkGlowRef.current, { scale: 1.55, opacity: 0, duration: 0.36, ease: 'power2.out' }, 0.58)
    tl.to(sparkRef.current, { opacity: 0, duration: 0.20, ease: 'power1.in' }, 0.86)

    // ── P4 · THE CREAM WORLD TAKES OVER (0.55 → 0.92) ──
    // A circle grows from the violet energy, in the cream surface AND in the
    // signal layer, so the signal is clipped to exactly the same boundary as
    // the cream it rides on and can never render over the artwork. The surface's
    // own base colour IS the cream, so no uncovered strip can ever appear at
    // the reveal edge. The cream is complete by 0.92 and holds on its own
    // until 0.98 — a real, perceptible phase, not a flash.
    const revealEls = [vwipeRef.current, sbSignalRef.current].filter(Boolean)
    const applyClip = (r) => {
      const c = `circle(${r.toFixed(2)}% at ${sx.toFixed(2)}% ${sy.toFixed(2)}%)`
      for (const el of revealEls) el.style.clipPath = c
    }
    applyClip(0)
    const reveal = { r: 0 }
    // The transition container itself is parked at opacity 0, so it has to be
    // opened before its children can be seen at all. It is opened on exactly
    // the same frame the cream starts blooming, and it is the LAST thing to
    // close — nothing about it ever crossfades, so there is no frame in which
    // an empty, unpainted container is on screen over the artwork.
    tl.to(transRef.current, { opacity: 1, duration: 0.10, ease: 'none' }, 0.55)
    // Painted for the first time on the same frame the reveal starts at radius
    // 0, so the flip itself is invisible.
    tl.set(transRef.current, { visibility: 'visible' }, 0.55)
    tl.to(reveal, {
      r: 172, duration: 0.37, ease: 'power2.inOut', onUpdate: () => applyClip(reveal.r),
    }, 0.55)
    tl.to(vwipeRef.current, { opacity: 1, duration: 0.10, ease: 'none' }, 0.55)

    // ── P5 · THE VIOLET SIGNAL DRAWS ITSELF ACROSS THE CREAM (0.98 → 1.44) ──
    // The signal is the BRIDGE, not a drawing that sits on the cream and then
    // gets removed. It draws, the homepage starts pouring in underneath it at
    // 1.20 — while the draw is still running — and the signal then dissolves
    // into the revealed page. There is no "finished purple drawing on empty
    // cream" holding phase.
    tl.to(sbSignalRef.current, { opacity: 1, duration: 0.10, ease: 'none' }, 0.90)
    tl.to(sbTraceRef.current,  { opacity: 1, duration: 0.10, ease: 'none' }, 0.98)
    tl.to(sbNodeRef.current,   { opacity: 1, duration: 0.18, ease: 'power1.out' }, 1.00)
    tl.to(travelEl,            { opacity: 1, duration: 0.08, ease: 'none' }, 1.00)
    tl.set(sbParticlesRef.current, { opacity: 1 }, 0.98)
    tl.to(sbWebRef.current,    { opacity: 0.62, duration: 0.18, ease: 'power1.out' }, 1.02)
    tl.to(sbOrbitRef.current,  { opacity: 0.72, duration: 0.16, ease: 'power1.out' }, 1.02)
    tl.to(sbBranchRef.current, { opacity: 1, duration: 0.16, ease: 'power1.out' }, 1.04)
    // The main trace draws itself from the violet origin outward along its
    // real measured length — the path progressively appears, it does not fade.
    tl.to(tracePath, { strokeDashoffset: 0, duration: 0.46, ease: 'none' }, 0.98)
    nodeEls.forEach((el, i) => {
      const nodeAt = at(NODE_F[i])
      tl.to(el, { opacity: 1, scale: 1, duration: 0.12, ease: 'power2.out' }, nodeAt)
      if (pulseEls[i]) {
        tl.set(pulseEls[i], { opacity: 0.74, scale: 0.35 }, nodeAt)
        tl.to(pulseEls[i], { opacity: 0, scale: 3.1, duration: 0.34, ease: 'power1.out' }, nodeAt)
      }
    })
    chordPaths.forEach((path, i) => {
      const pair = CHORD_PAIRS[i]
      if (!pair) return
      const chordAt = at(Math.max(NODE_F[pair[0]], NODE_F[pair[1]])) + 0.035
      tl.to(path, { strokeDashoffset: 0, duration: 0.20, ease: 'power1.out' }, chordAt)
    })
    orbitRings.forEach((ring, i) => {
      tl.to(ring, {
        strokeDashoffset: 0,
        duration: 0.34,
        ease: 'power1.out',
      }, at(ORBIT_NODE[i]))
    })
    // The light, aura and particles share the same linear clock as the main
    // path. All path reads were completed before the timeline began.
    travelPoints.slice(1).forEach((point, i) => {
      tl.to(travelEl, {
        x: point.x - TRAVEL_SIZE / 2,
        y: point.y - TRAVEL_SIZE / 2,
        duration: 0.44 / TRAVEL_SEGMENTS,
        ease: 'none',
      }, 1.00 + (0.44 * i) / TRAVEL_SEGMENTS)
    })
    if (washPath) {
      tl.to(washPath, {
        strokeDashoffset: WASH_WIN / 2 - washLen,
        duration: 0.44,
        ease: 'none',
      }, 1.00)
    }
    particleEls.forEach((el, i) => {
      const startFraction = particleFractions[i]
      if (startFraction === undefined) return
      const endFraction = Math.min(1, startFraction + 0.085)
      const particleSegments = Math.max(2, Math.ceil((endFraction - startFraction) * TRAVEL_SEGMENTS))
      const particleAt = at(startFraction)
      tl.to(el, { opacity: 0.82, duration: 0.025, ease: 'none' }, particleAt)
      for (let segment = 1; segment <= particleSegments; segment += 1) {
        const fraction = startFraction + (endFraction - startFraction) * (segment / particleSegments)
        const point = travelPointAt(fraction)
        tl.to(el, {
          x: point.x - 1.5,
          y: point.y - 1.5,
          opacity: segment === particleSegments ? 0 : 0.82,
          duration: 0.10 / particleSegments,
          ease: 'none',
        }, particleAt + 0.025 + (0.10 * (segment - 1)) / particleSegments)
      }
    })
    // Micro-filaments are shed behind the wavefront, not drawn independently.
    microEls.forEach((path, i) => {
      tl.to(path, {
        strokeDashoffset: 0,
        duration: 0.16,
        ease: 'power2.out',
      }, at(MICRO_F[i]) + 0.035)
    })
    branchPaths.forEach((path, i) => {
      tl.to(path, {
        strokeDashoffset: 0,
        duration: 0.19,
        ease: 'power2.out',
      }, at(BRANCH_F[i]))
    })

    // ── P6 · THE ARTWORK IS HANDED OVER (1.16) ──
    // ONE synchronous step. No animation, no opacity crossfade, no fade of the
    // cinematic scene. The cream is already opaque and full-frame, so this is
    // mathematically invisible — it exists only so that what the cream recedes
    // into is the real, already mounted SkillBridge homepage, never the
    // cinematic sky. It must run BEFORE the cream starts receding.
    //
    // The whole .co-copy CONTAINER goes here, not just its five line spans: the
    // container carries the ::before legibility wash, and that wash is what
    // would otherwise be left sitting over the arriving homepage once the cream
    // clip erodes past it.
    tl.call(() => {
      for (const el of [canvasRef.current, bgRef.current, ruinsRef.current, studentRef.current,
        handRef.current, fxRef.current, sparkRef.current, loadingRef.current, copyRootRef.current,
        ...copyRefs.map((r) => r.current)]) {
        if (el) el.style.display = 'none'
      }
      root.style.background = 'transparent'
    }, [], 1.16)

    // ── P7 · THE CREAM RECEDES AND THE HOMEPAGE ARRIVES (1.20 → 1.80) ──
    // This is the existing reveal mechanism, inverted and continued — NOT a
    // cream opacity 1→0 / homepage opacity 0→1 crossfade. The same clip-path
    // circle that grew to cover the frame now erodes back down to zero, centred
    // on the signal's own endpoint, so the real homepage pours in as a growing
    // aperture while the last of the cream survives exactly where the signal
    // terminates. The travelling light has already arrived there, so the two
    // states are joined by the signal at the boundary the whole way through.
    const endPt = pts[pts.length - 1]
    const ex = ((endPt[0] / W) * 100).toFixed(2)
    const ey = ((endPt[1] / H) * 100).toFixed(2)
    tl.call(() => {
      // The signal is now larger than any remaining cream, so it stops being
      // clipped and becomes free to span the boundary it is bridging.
      if (sbSignalRef.current) sbSignalRef.current.style.clipPath = 'none'
    }, [], 1.20)
    const recede = { r: 172 }
    tl.to(recede, {
      r: 0, duration: 0.60, ease: 'power2.inOut',
      onUpdate: () => {
        if (vwipeRef.current) {
          vwipeRef.current.style.clipPath =
            `circle(${Math.max(0, recede.r).toFixed(2)}% at ${ex}% ${ey}%)`
        }
      },
    }, 1.20)

    // ── P8 · THE SIGNAL DISSOLVES INTO THE HOMEPAGE (1.50 → 1.92) ──
    // Runs WHILE the cream is still eroding, so the violet is always
    // disintegrating against a mix of cream and page instead of sitting alone.
    // The endpoint — the point the signal was carrying the viewer toward, and
    // the last place the cream survives — swells once, then goes.
    if (nodeEls[4]) {
      tl.to(nodeEls[4], { scale: 2.6, duration: 0.26, ease: 'power2.out' }, 1.54)
    }
    tl.to(sbBranchRef.current, { opacity: 0, duration: 0.18, ease: 'power1.in' }, 1.50)
    tl.to(microEls, { opacity: 0, duration: 0.20, ease: 'power1.in' }, 1.54)
    tl.to(sbParticlesRef.current, { opacity: 0, duration: 0.16, ease: 'power1.in' }, 1.54)
    tl.to(sbNodeRef.current, { opacity: 0.26, duration: 0.20, ease: 'power1.inOut' }, 1.58)
    tl.to([sbWebRef.current, sbOrbitRef.current, sbBranchRef.current], {
      opacity: 0,
      duration: 0.20,
      ease: 'power1.in',
    }, 1.58)
    tl.to(tracePath, { strokeOpacity: 0.28, duration: 0.32, ease: 'power1.inOut' }, 1.54)
    if (washPath) tl.to(washPath, { opacity: 0, duration: 0.22, ease: 'power1.in' }, 1.52)
    tl.to(sbTravelRef.current, { opacity: 0, duration: 0.14, ease: 'power1.in' }, 1.62)
    // Nothing violet survives this: the last trace pixels are gone by 1.92, so
    // the final frame of the transition contains no floating purple drawing.
    tl.to([sbTraceRef.current, sbNodeRef.current], { opacity: 0, duration: 0.20, ease: 'power1.in' }, 1.72)
    // onComplete → onDismiss → App removes co-intro-active in the same commit
    // that unmounts this overlay, so homepage animation starts on exactly the
    // frame the last trace pixel disappears.
    tl.set(root, { opacity: 0 }, 1.94)
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div
      ref={rootRef}
      className="co-root"
      aria-label="SkillBridge cinematic introduction"
      role="region"
    >
      {/* 0 — Deep blue sky. Opaque, and removed in the same synchronous step
             that drops the root backdrop to transparent, so it can never be
             seen through the receding cream. */}
      <div ref={canvasRef} className="co-canvas" aria-hidden="true" />

      {/* 1 — BACKGROUND: cloud city (cinematic-bg-reference.png) */}
      <div ref={bgRef} className="co-layer co-layer-bg" aria-hidden="true" style={{ opacity: 0 }}>
        <img src={IMG.bg} alt="" draggable="false" loading="eager" decoding="async" />
      </div>

      {/* 2 — FOREGROUND FRAME: ruins columns/stairs */}
      <div ref={ruinsRef} className="co-layer co-layer-ruins" aria-hidden="true" style={{ opacity: 0 }}>
        <img src={IMG.ruins} alt="" draggable="false" loading="eager" decoding="async" />
      </div>

      {/* 3 — CHARACTER: ONE student — composed with only ±2px parallax */}
      <div ref={studentRef} className="co-layer co-layer-student" aria-hidden="true" style={{ opacity: 0 }}>
        <img src={IMG.student} alt="" draggable="false" loading="eager" decoding="async" />
      </div>

      {/* 4 — CHARACTER: ONE hand — composed with only ±2px parallax */}
      <div ref={handRef} className="co-layer co-layer-hand" aria-hidden="true" style={{ opacity: 0 }}>
        <img src={IMG.hand} alt="" draggable="false" loading="eager" decoding="async" />
      </div>

      {/* 5 — SPARK: a small golden point, JS-repositioned between the
             fingertips. It is the origin of the whole transition: violet
             energy escapes from it, the cream blooms from it, and the violet
             signal is born there. Only opacity / scale / colour change here —
             the spark never translates, so the discharge stays contained. */}
      <div
        ref={sparkRef}
        className="co-spark"
        aria-hidden="true"
        style={{ opacity: 0 }}
      >
        <div ref={sparkGlowRef} className="co-spark-glow" style={{ opacity: 0 }} />
        <div ref={sparkStormRef} className="co-spark-storm" style={{ opacity: 0 }} />
        <div ref={sparkMotesRef} className="co-spark-motes" style={{ opacity: 0 }}>
          <span className="co-spark-mote co-spark-mote-1" />
          <span className="co-spark-mote co-spark-mote-2" />
          <span className="co-spark-mote co-spark-mote-3" />
          <span className="co-spark-mote co-spark-mote-4" />
          <span className="co-spark-mote co-spark-mote-5" />
          <span className="co-spark-mote co-spark-mote-6" />
          <span className="co-spark-mote co-spark-mote-7" />
        </div>
        <div ref={sparkCoreRef} className="co-spark-core" />
        <div ref={sparkVioletRef} className="co-spark-violet" style={{ opacity: 0 }} />
        {/* The same eight primary filaments are drawn three times at three
            weights (halo / hot / core) so the discharge reads as bright at its
            source without a blur, a filter or a giant glow. */}
        <svg
          ref={sparkStreaksRef}
          className="co-spark-streaks"
          viewBox="-48 -48 96 96"
          aria-hidden="true"
        >
          <g className="co-bolt-halo">
            {BOLT_PRIMARY.map((d, i) => <path key={`h${i}`} d={d} />)}
          </g>
          <g className="co-bolt-hot">
            {BOLT_HOT.map((d, i) => <path key={`o${i}`} d={d} />)}
          </g>
          <g className="co-bolt-core">
            {BOLT_PRIMARY.map((d, i) => <path key={`c${i}`} d={d} />)}
          </g>
          <g className="co-bolt-sec">
            {BOLT_SECONDARY.map((d, i) => <path key={`s${i}`} d={d} />)}
          </g>
        </svg>
        {/* Small hot sparks — separate SVG so JS can flicker them
            independently, but the same geometry and colour ramp, so they
            convert to violet with everything else. */}
        <svg className="co-spark-sparks" viewBox="-48 -48 96 96" aria-hidden="true">
          <g ref={sparkSparksRef}>
            {BOLT_SPARKS.map((d, i) => <path key={`p${i}`} d={d} />)}
          </g>
        </svg>
      </div>

      {/* 6 — PARTICLES */}
      <div ref={fxRef} className="co-fx" aria-hidden="true">
        <Particles active={particlesOn} />
      </div>

      {/* 7 — TYPOGRAPHY. Anchored from the left/top, never centred, at
             22.25vw / 10.0vh with a 32vw (max 570px) measure. Every line is
             its own .co-mask > .co-line pair, so all five lines are
             individually positioned elements: the white headline is two
             deliberate lines, the gold sentence is exactly one, the
             supporting copy is exactly two. Nothing relies on the browser
             wrapping. The block sits at z-index 7 — above the background, the
             ruins, both characters, the spark and the motes. */}
      <div className="co-copy" ref={copyRootRef}>
        <p className="co-copy-h1">
          <span className="co-mask">
            <span ref={copyRefs[0]} className="co-line">You don&rsquo;t lack</span>
          </span>
          <span className="co-mask">
            <span ref={copyRefs[1]} className="co-line">potential.</span>
          </span>
        </p>
        <p className="co-copy-h2">
          <span className="co-mask">
            <span ref={copyRefs[2]} className="co-line">You lack guidance.</span>
          </span>
        </p>
        <p className="co-copy-support">
          <span className="co-mask">
            <span ref={copyRefs[3]} className="co-line">The right skills. The right path. The right opportunities.</span>
          </span>
          <span className="co-mask">
            <span ref={copyRefs[4]} className="co-line">You&rsquo;re just one step away.</span>
          </span>
        </p>
      </div>

      {/* 8 — TRANSITION: one continuous energy event.

             .co-vwipe      the clean cream surface, exactly #F7F3EA. The ONLY
                            full-viewport opaque element, and it always
                            unmounts.
             .co-sb-signal  the violet signal, clipped to the SAME circle: the
                             wash aura, main trace, micro-filaments, branches,
                             nodes, brief particles and one travelling light. Separate from the
                             surface so it can outlive it and resolve over the
                             homepage. */}
      <div ref={transRef} className="co-transition" aria-hidden="true" style={{ opacity: 0, visibility: 'hidden' }}>
        <div ref={vwipeRef} className="co-vwipe" style={{ opacity: 0 }}>
        </div>

        <div ref={sbSignalRef} className="co-sb-signal" style={{ opacity: 0 }}>
          <div ref={sbParticlesRef} className="co-sb-particles">
            <span className="co-sb-particle" />
            <span className="co-sb-particle" />
            <span className="co-sb-particle" />
            <span className="co-sb-particle" />
            <span className="co-sb-particle" />
          </div>

          <svg ref={sbWebRef} className="co-sb-web" aria-hidden="true">
            <path className="co-sb-chord" />
            <path className="co-sb-chord" />
            <path className="co-sb-chord" />
          </svg>

          <div ref={sbOrbitRef} className="co-sb-orbits" aria-hidden="true">
            <span className="co-sb-orbit co-sb-orbit-origin">
              <svg viewBox="0 0 48 48" aria-hidden="true">
                <path className="co-sb-orbit-ring" d="M24 4 A20 20 0 1 1 9.1 10.7" />
              </svg>
            </span>
            <span className="co-sb-orbit co-sb-orbit-destination">
              <svg viewBox="0 0 48 48" aria-hidden="true">
                <path className="co-sb-orbit-ring" d="M24 5 A19 19 0 1 1 10.2 11.2" />
              </svg>
            </span>
          </div>

          <svg ref={sbTraceRef} className="co-sb-trace" aria-hidden="true">
            <path ref={sbWashPathRef} className="co-sb-trace-wash" vectorEffect="non-scaling-stroke" />
            <path ref={sbTracePathRef} className="co-sb-trace-main" vectorEffect="non-scaling-stroke" />
            <g ref={sbMicroRef} className="co-sb-micros">
              <path className="co-sb-micro" vectorEffect="non-scaling-stroke" />
              <path className="co-sb-micro" vectorEffect="non-scaling-stroke" />
              <path className="co-sb-micro" vectorEffect="non-scaling-stroke" />
              <path className="co-sb-micro" vectorEffect="non-scaling-stroke" />
              <path className="co-sb-micro" vectorEffect="non-scaling-stroke" />
              <path className="co-sb-micro" vectorEffect="non-scaling-stroke" />
            </g>
          </svg>

          <div ref={sbBranchRef} className="co-sb-branches" style={{ opacity: 0 }}>
            <svg className="co-sb-branch" viewBox="0 0 30 24" aria-hidden="true">
              <path vectorEffect="non-scaling-stroke" d="M2,4 L8,10 L4,15 L9,20" />
            </svg>
            <svg className="co-sb-branch" viewBox="0 0 30 24" aria-hidden="true">
              <path vectorEffect="non-scaling-stroke" d="M2,4 L9,9 L12,16" />
            </svg>
            <svg className="co-sb-branch" viewBox="0 0 30 24" aria-hidden="true">
              <path vectorEffect="non-scaling-stroke" d="M2,4 L7,11 L3,16 L8,21" />
            </svg>
            <svg className="co-sb-branch" viewBox="0 0 30 24" aria-hidden="true">
              <path vectorEffect="non-scaling-stroke" d="M2,4 L8,8 L13,8 L17,13" />
            </svg>
          </div>

          <div ref={sbNodeRef} className="co-sb-nodes" style={{ opacity: 0 }}>
            <span className="co-sb-pulse" />
            <span className="co-sb-pulse" />
            <span className="co-sb-pulse" />
            <span className="co-sb-pulse" />
            <span className="co-sb-pulse" />
            <span className="co-sb-node co-sb-node-origin" />
            <span className="co-sb-node" />
            <span className="co-sb-node" />
            <span className="co-sb-node" />
            <span className="co-sb-node" />
          </div>

          <span ref={sbTravelRef} className="co-sb-travel" style={{ opacity: 0 }} />
        </div>
      </div>

      {/* 9 — LOADING SCREEN. Keeps the navy sky until the artwork is in, so
             the cream backdrop is never the first thing on screen. */}
      <div ref={loadingRef} className="co-loading" aria-label="Loading cinematic intro">
        <div className="co-loading-sky" aria-hidden="true" />
        <div className="co-loading-indicator">
          <div className="co-loading-bar-track">
            <div ref={loadBarRef} className="co-loading-bar-fill" />
          </div>
          <span ref={loadTextRef} className="co-loading-text">LOADING 0%</span>
        </div>
      </div>
    </div>
  )
}

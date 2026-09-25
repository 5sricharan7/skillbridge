import * as THREE from 'three'
import { gsap } from 'gsap'
import { buildStudentSprite } from './buildStudentSprite'
import { buildSkillCards, placeCards, updateCardDraw, ANGLE_SWEEP } from './buildSkillCards'

const { MathUtils, Vector2 } = THREE

// The 3D student is a STATIC hero visual only:
//  - a single front-facing sprite (from skillbridge-student-front.png)
//  - no rotation, no walking, no scroll-driven motion
//  - small pointer-distance parallax only (subtle)
//  - the page itself scrolls normally (no pins)

// static hero pose targets (fractions of the viewport the figure should occupy)
// reference composition: character centre screen, headline overlapping its left edge
const POSE = { xFrac: 0.5, feetFrac: 0.82 }
const CAM_POS = { x: 0, y: 2.5, z: 8.2 }

const state = { cardsOut: 0 }

export function createSkillBridgeScene({ canvas, dom }) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setClearColor(0xf7f7f7, 1)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 120)
  camera.position.set(CAM_POS.x, CAM_POS.y, CAM_POS.z)

  // ---- student (front-facing sprite, fully stable) ----
  let student = null
  let studentReady = false

  // ---- skill cards (subtle background layer) ----
  const carousel = buildSkillCards()
  const ring = carousel.ring
  const cards = carousel.cards
  scene.add(carousel.group)

  // ---- foreground parallax layer (faint hand-drawn accents) ----
  const fg = new THREE.Group()
  function addFgLine(pts, color, opacity) {
    const geo = new THREE.BufferGeometry().setFromPoints(pts)
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity })
    mat.userData.baseOp = opacity
    const line = new THREE.Line(geo, mat)
    fg.add(line)
    return line
  }
  function circlePoints(r, n, phase = 0) {
    const pts = []
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + phase
      pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0))
    }
    return pts
  }
  {
    const c1 = circlePoints(2.9, 96).map((v) => v.set(v.x + 6.4, v.y + 3.6, 0))
    addFgLine(c1, 0xb9b6ae, 0.16)
    const c2 = circlePoints(1.7, 48).slice(0, 30).map((v) => v.set(v.x - 7.3, v.y - 2.1, 0))
    addFgLine(c2, 0xc6c2b8, 0.14)
    fg.position.z = 6.4
    scene.add(fg)
  }

  // ---- interaction state ----
  const pointer = new Vector2(0, 0)
  let hoverIndex = -1
  let dragging = false
  let angleOffset = 0
  let angleVelocity = 0
  let front = 0
  const raycaster = new THREE.Raycaster()
  const cardPlanes = []
  cards.forEach((c) => {
    cardPlanes.push(c.grayMesh, c.colorMesh)
    c.grayMesh.userData.index = c.index
    c.colorMesh.userData.index = c.index
  })

  const damp = (cur, tgt, lambda, dt) => MathUtils.damp(cur, tgt, lambda, dt)

  // project a screen-fraction position into world space for the student's static pose
  function studentPose() {
    const tanHalf = Math.tan(MathUtils.degToRad(camera.fov / 2))
    const d = CAM_POS.z
    const centerX = (POSE.xFrac - 0.5) * 2 * tanHalf * d * camera.aspect
    const feetY = CAM_POS.y + (1 - POSE.feetFrac * 2) * tanHalf * d
    return { x: centerX, y: feetY, z: 0 }
  }

  function applyCardStates(dt, time) {
    placeCards(cards, ring, angleOffset, time)
    front = 0
    let frontZ = -Infinity
    for (const c of cards) {
      if (c.group.position.z > frontZ) {
        frontZ = c.group.position.z
        front = c.index
      }
    }

    const hiddenTail = window.innerWidth < 720
    for (const c of cards) {
      const depth = MathUtils.clamp((c.group.position.z + ring.rz) / (2 * ring.rz), 0, 1)
      let scale = 0.74 + 0.34 * depth
      let op = 0.32 + 0.5 * depth
      const isFront = c.index === front
      const isHover = c.index === hoverIndex

      if (isFront) {
        scale *= 1.12
        op = 0.9
      }
      if (isHover) {
        scale *= 1.14
        op = Math.max(op, 0.96)
      }
      if (hiddenTail && !isFront && depth * 8 < 5) {
        scale *= MathUtils.clamp(depth * 7, 0, 1) * 0.9 + 0.05
        op = Math.min(op, MathUtils.clamp(depth * 9, 0, 1))
      }

      c.curScale = damp(c.curScale, scale, 5.5, dt)
      c.curOpacity = damp(c.curOpacity, op, 5.5, dt)
      c.hoverZ = damp(c.hoverZ, isHover ? 0.35 : 0, 6, dt)

      const g = c.group.scale
      const tgtScale = c.curScale * (1 - 0.72 * state.cardsOut)
      const ds = damp(g.x, tgtScale, 6, dt)
      g.set(ds, ds, ds)
      c.grayMesh.material.opacity = c.curOpacity * (1 - 0.88 * state.cardsOut)
      c.colorMesh.material.opacity = Math.max(0, c.curOpacity * c.colorProgress * (1 - 0.88 * state.cardsOut))
      c.group.position.z += c.hoverZ
    }

    for (const c of cards) {
      const wantColor = c.index === front || c.index === hoverIndex
      const targetP = wantColor ? 1 : 0
      const prev = c.colorProgress
      c.colorProgress = damp(c.colorProgress, targetP, 6, dt)
      if (Math.abs(c.colorProgress - prev) > 0.0004) {
        updateCardDraw(c)
      }
    }
  }

  // ---- input ----
  const el = canvas

  function onPointerMove(e) {
    const rect = el.getBoundingClientRect()
    pointer.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    )
  }

  function onPointerDown(e) {
    if (e.target !== el) return
    dragging = true
    try {
      el.setPointerCapture(e.pointerId)
    } catch {
      /* synthetic pointers may not support capture */
    }
  }

  function onPointerMoveDrag(e) {
    if (!dragging) return
    const dx = e.movementX || 0
    angleOffset -= dx * 0.0048
  }

  function onPointerUp() {
    dragging = false
  }

  function onKey(e) {
    const step = ANGLE_SWEEP / 8
    if (e.key === 'ArrowLeft') {
      angleVelocity = step * 6
      e.preventDefault()
    } else if (e.key === 'ArrowRight') {
      angleVelocity = -step * 6
      e.preventDefault()
    }
  }

  function raycastHover() {
    if (window.innerWidth < 720 || reduced || dragging) {
      hoverIndex = -1
      return
    }
    raycaster.setFromCamera(pointer, camera)
    const hits = raycaster.intersectObjects(cardPlanes, false)
    hoverIndex = hits.length ? (hits[0].object.userData.index ?? -1) : -1
  }

  // ---- render loop ----
  let last = performance.now()
  let time = 0
  let rafId = 0
  let active = false
  let fps = 60
  let fpsFrames = 0
  let fpsTime = 0

  function tick(now) {
    if (!active) return
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now
    time += dt

    // gentle carousel motion only (manual inertia first, then slow auto once settled)
    if (!dragging) {
      angleOffset += angleVelocity * dt
      angleVelocity *= Math.exp(-4.2 * dt)
      if (Math.abs(angleVelocity) < 0.001) angleVelocity = 0
    }
    if (!dragging && Math.abs(angleVelocity) < 0.001 && !reduced) {
      angleOffset += 0.04 * dt
    }

    raycastHover()
    applyCardStates(dt, time)

    // very subtle pointer parallax (no scroll terms — the page scrolls normally)
    const px = pointer.x * 0.9
    const py = pointer.y * 0.6
    camera.position.x = damp(camera.position.x, CAM_POS.x + px * 0.12, 4.5, dt)
    camera.position.y = damp(camera.position.y, CAM_POS.y + py * 0.1, 4.5, dt)
    camera.rotation.y = damp(camera.rotation.y, px * 0.012, 4.5, dt)

    if (studentReady && student) {
      const pose = studentPose()
      const g = student.group
      g.position.x = damp(g.position.x, pose.x + px * 0.25, 5, dt)
      g.position.y = damp(g.position.y, pose.y + py * 0.15, 5, dt)
      // animation is intentionally absent: yaw stays pinned to the safe orientation
    }

    // cards sway more than the environment
    carousel.group.position.x = damp(carousel.group.position.x, px * 0.35, 5, dt)
    carousel.group.position.y = damp(carousel.group.position.y, py * 0.2, 5, dt)

    fg.position.x = damp(fg.position.x, px * 0.7, 6, dt)
    fg.position.y = damp(fg.position.y, py * 0.45, 6, dt)

    fpsFrames++
    fpsTime += dt
    if (fpsTime >= 1) {
      fps = Math.round(fpsFrames / fpsTime)
      fpsFrames = 0
      fpsTime = 0
    }

    renderer.render(scene, camera)
    rafId = requestAnimationFrame(tick)
  }

  // ---- sizing ----
  function setSize() {
    const w = window.innerWidth
    const h = window.innerHeight
    const m = w < 720
    ring.rx = m ? 3.9 : 5.4
    ring.rz = m ? 1.7 : 2.1
    camera.fov = m ? 58 : 46
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h, false)
  }

  window.addEventListener('pointermove', onPointerMove)
  el.addEventListener('pointerdown', onPointerDown)
  el.addEventListener('pointermove', onPointerMoveDrag)
  el.addEventListener('pointerup', onPointerUp)
  el.addEventListener('pointercancel', onPointerUp)
  window.addEventListener('keydown', onKey)
  window.addEventListener('resize', setSize)
  setSize()

  buildStudentSprite().then((s) => {
    student = s
    const pose = studentPose()
    s.group.position.set(pose.x, pose.y, pose.z)
    s.group.scale.setScalar(1)
    scene.add(s.group)
    studentReady = true
  }).catch((err) => {
    console.error('[skillbridge] student sprite failed to load', err)
  })

  function start() {
    gsap.set(dom.headline, { autoAlpha: 1 })
    active = true
    last = performance.now()
    rafId = requestAnimationFrame(tick)
  }

  function destroy() {
    active = false
    cancelAnimationFrame(rafId)
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('resize', setSize)
    el.removeEventListener('pointerdown', onPointerDown)
    el.removeEventListener('pointermove', onPointerMoveDrag)
    el.removeEventListener('pointerup', onPointerUp)
    el.removeEventListener('pointercancel', onPointerUp)
    window.removeEventListener('keydown', onKey)
    ScrollTriggerCleanup()
    renderer.dispose()
  }

  function ScrollTriggerCleanup() {
    // no pins created in this scene
  }

  return {
    start,
    destroy,
    getState: () => ({
      camX: Math.round(camera.position.x * 100) / 100,
      camY: Math.round(camera.position.y * 100) / 100,
      camZ: Math.round(camera.position.z * 100) / 100,
      studentX: student ? Math.round(student.group.position.x * 100) / 100 : 0,
      studentY: student ? Math.round(student.group.position.y * 100) / 100 : 0,
      studentZ: student ? Math.round(student.group.position.z * 100) / 100 : 0,
      cardsOut: 0,
      walk: 0,
      align: 0,
      frozen: true,
      scrollActive: false,
      scrollT: 0,
      front,
      angleOffset,
      hover: hoverIndex,
      dragging,
      fps,
      studentReady
    })
  }
}
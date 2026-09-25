import * as THREE from 'three'
import { SKILLS, createCardCanvas, makeCardTexture, redrawCardCanvas } from './cardTexture'

const CARD_W = 1.44
const CARD_H = 1.86

export const ANGLE_START = Math.PI * 1.12
export const ANGLE_SWEEP = Math.PI * 2.24

export function buildSkillCards() {
  const group = new THREE.Group()
  const cards = []

  // ring grows outward + arcs upward around the student
  const rx = 5.4
  const rz = 2.1

  SKILLS.forEach((skill, i) => {
    const grayCanvas = createCardCanvas(skill, { gray: true, progress: 0 })
    const grayTex = makeCardTexture(grayCanvas)

    const colorCanvas = createCardCanvas(skill, { gray: false, progress: 0 })
    const colorTex = makeCardTexture(colorCanvas)

    const grayMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(CARD_W, CARD_H),
      new THREE.MeshBasicMaterial({ map: grayTex, transparent: true })
    )
    const colorMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(CARD_W, CARD_H),
      new THREE.MeshBasicMaterial({ map: colorTex, transparent: true, opacity: 0 })
    )

    const card = new THREE.Group()
    card.add(grayMesh, colorMesh)
    group.add(card)

    const angle = ANGLE_START + (i / SKILLS.length) * ANGLE_SWEEP
    cards.push({
      skill,
      index: i,
      angle,
      group: card,
      grayMesh,
      colorMesh,
      colorCanvas,
      // per-card motion personality (different depths/speeds, feels physical)
      speed: 0.55 + (i % 4) * 0.16,
      driftPhase: i * 1.9,
      // animation state
      colorProgress: 0,
      curScale: 0.82,
      curOpacity: 0.82,
      hoverZ: 0,
      colorWanted: 0
    })
  })

  placeCards(cards, { rx, rz }, 0)

  return { group, cards, ring: { rx, rz } }
}

export function placeCards(cards, ring, angleOffset, time = 0) {
  cards.forEach((c) => {
    // each card breathes on its own cadence around the shared slow orbit
    const a = c.angle + angleOffset + Math.sin(time * c.speed + c.driftPhase) * 0.06
    const x = Math.cos(a) * ring.rx
    const z = Math.sin(a) * ring.rz
    const y = 0.16 + (Math.sin(a * 0.55) + 1) * 0.26
    c.group.position.set(x, y, z)
    c.group.rotation.y = -a * 0.42 + Math.PI * 0.5
    c.group.rotation.x = -0.08
    c.baseY = y
    c.liveAngle = a
  })
}

export function updateCardDraw(card) {
  const p = card.colorProgress
  redrawCardCanvas(card.colorCanvas, card.skill, false, p)
  card.colorMesh.material.map.needsUpdate = true
}

// returns the front-most card index given current offset
export function frontCardIndex(cards, s) {
  let best = 0
  let bestZ = -Infinity
  for (let i = 0; i < cards.length; i++) {
    const z = cards[i].group.position.z
    if (z > bestZ) {
      bestZ = z
      best = i
    }
  }
  return best
}
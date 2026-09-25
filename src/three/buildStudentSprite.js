import * as THREE from 'three'

const { CanvasTexture, SRGBColorSpace } = THREE

const FRONT_URL = '/references/skillbridge-student-front.png'

// target on-screen height in world units (keeps the student dominant)
const STUDENT_H = 3.45

function cropUV(geometry, x0, y0, x1, y1, w, h) {
  const u0 = x0 / w
  const u1 = x1 / w
  const v0 = 1 - y1 / h
  const v1 = 1 - y0 / h
  const uvs = geometry.attributes.uv
  for (let i = 0; i < uvs.count; i++) {
    const u = uvs.getX(i)
    const v = uvs.getY(i)
    uvs.setXY(i, u0 + u * (u1 - u0), v0 + v * (v1 - v0))
  }
  uvs.needsUpdate = true
}

function computeBBox(image) {
  const c = document.createElement('canvas')
  c.width = image.naturalWidth || image.width
  c.height = image.naturalHeight || image.height
  const ctx = c.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(image, 0, 0)
  const { width: w, height: h } = c
  const data = ctx.getImageData(0, 0, w, h).data
  let x0 = w
  let y0 = h
  let x1 = 0
  let y1 = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
  }
  if (x1 <= x0 || y1 <= y0) {
    x0 = 0
    y0 = 0
    x1 = w
    y1 = h
  }
  return { x0, y0, x1, y1, w, h }
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load ' + url))
    img.src = url
  })
}

// Front-facing sprite from the reference PNG. Stable: no walk, no flip,
// no motion of its own — the character stands still while the cards orbit.
export async function buildStudentSprite() {
  const img = await loadImage(FRONT_URL)

  const group = new THREE.Group()
  const holder = new THREE.Group()
  group.add(holder)

  const tex = new CanvasTexture(img)
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 8

  const box = computeBBox(img)
  const aspect = (box.x1 - box.x0) / (box.y1 - box.y0) // content width / height
  const geo = new THREE.PlaneGeometry(1, 1)
  cropUV(geo, box.x0, box.y0, box.x1, box.y1, box.w, box.h)
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.scale.set(STUDENT_H * aspect, STUDENT_H, 1)
  holder.add(mesh)

  // soft grounding shadow (not a character)
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.5, 28),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.07, depthWrite: false })
  )
  shadow.rotation.x = -Math.PI / 2
  shadow.scale.set(1, 0.45, 1)
  shadow.position.y = 0.02
  group.add(shadow)

  const FEET_Y = 0.62
  holder.position.y = FEET_Y + STUDENT_H / 2

  return { group, height: STUDENT_H }
}
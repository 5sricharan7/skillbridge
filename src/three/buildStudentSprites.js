import * as THREE from 'three'

const { CanvasTexture, SRGBColorSpace, MathUtils } = THREE

const FRONT_URL = '/assets/student-front.png'
const BACK_URL = '/assets/student-back.png'

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

// A flip-rig: front + back sprite glued back-to-back inside a pivot.
// Rotating the pivot ~180° turns the character from facing the viewer to facing away.
export async function buildStudentSprites() {
  const [frontImg, backImg] = await Promise.all([loadImage(FRONT_URL), loadImage(BACK_URL)])

  const group = new THREE.Group()
  const holder = new THREE.Group()
  group.add(holder)

  const frontTex = new CanvasTexture(frontImg)
  frontTex.colorSpace = SRGBColorSpace
  frontTex.anisotropy = 8

  const backTex = new CanvasTexture(backImg)
  backTex.colorSpace = SRGBColorSpace
  backTex.anisotropy = 8

  function makeSprite(tex, img) {
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
    const H = STUDENT_H
    mesh.scale.set(H * aspect, H, 1)
    return mesh
  }

  const front = makeSprite(frontTex, frontImg)
  const back = makeSprite(backTex, backImg)
  back.rotation.y = Math.PI
  // keep feet in the same place for both views; back sprite is narrower
  back.position.y = (front.scale.y - back.scale.y) / 2

  holder.add(back, front)

  // soft grounding shadow (not a character)
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.55, 28),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.07, depthWrite: false })
  )
  shadow.rotation.x = -Math.PI / 2
  shadow.scale.set(1, 0.45, 1)
  shadow.position.y = 0.02
  group.add(shadow)

  const FEET_Y = 0.62
  holder.position.y = FEET_Y + STUDENT_H / 2

  let flip = 0
  let walkPhase = 0

  const setFlip = (target, dt) => {
    flip = MathUtils.damp(flip, target, 4.5, dt)
    const t = MathUtils.clamp(flip, 0, 1)
    holder.rotation.y = t * Math.PI
    // squash while edge-on to read as a genuine turn
    const squash = 1 - Math.sin(t * Math.PI) * 0.5
    holder.scale.x = squash
    front.material.opacity = MathUtils.clamp((0.5 - t) * 4.2, 0, 1)
    back.material.opacity = MathUtils.clamp((t - 0.5) * 4.2, 0, 1)
  }

  const setWalk = (phase, amp) => {
    walkPhase = phase
    const bob = amp > 0.01 ? Math.sin(phase * 2) * 0.05 * amp : Math.sin(performance.now() / 950) * 0.01
    const sway = amp > 0.01 ? Math.sin(phase) * 0.03 * amp : 0
    holder.position.y = FEET_Y + STUDENT_H / 2 + bob
    holder.rotation.z = sway
    holder.rotation.x = amp > 0.01 ? amp * 0.045 : 0
  }

  return { group, setFlip, setWalk, getFlip: () => flip }
}
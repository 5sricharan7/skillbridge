import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const { MathUtils } = THREE

const GLB_URL = '/references/student.glb'

// target on-screen height in world units (keeps the student dominant, matches stage-1)
const HERO_HEIGHT = 3.45

// yaw is the CCW turn progress 0..1 -> rotation.y 0..PI (front -> back, NEVER negative)
export async function buildStudentGlb() {
  const gltf = await new GLTFLoader().loadAsync(GLB_URL)
  const model = gltf.scene

  // canonicalize: feet at y=0, world height HERO_HEIGHT, centered on x/z
  const box = new THREE.Box3().setFromObject(model)
  const size = box.getSize(new THREE.Vector3())
  if (size.y > 0) model.scale.setScalar(HERO_HEIGHT / size.y)
  const box2 = new THREE.Box3().setFromObject(model)
  const center = box2.getCenter(new THREE.Vector3())
  model.position.set(-center.x, -box2.min.y, -center.z)

  // no env map in this scene -> metallic surfaces would render black; flatten them
  model.traverse((o) => {
    if (!o.isMesh) return
    o.frustumCulled = false
    const mats = Array.isArray(o.material) ? o.material : [o.material]
    for (const m of mats) {
      if (!m) continue
      if (m.isMeshStandardMaterial || m.isMeshPhysicalMaterial) {
        m.metalness = 0
        if (m.metalnessMap) {
          const t = m.metalnessMap
          m.metalnessMap = null
          t.dispose()
        }
        m.needsUpdate = true
      }
    }
  })

  const root = new THREE.Group() // hero position / walk path position / target scale
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(1.0, 40),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.08, depthWrite: false })
  )
  shadow.rotation.x = -Math.PI / 2
  shadow.scale.set(1, 0.6, 1)
  shadow.position.y = 0.02
  root.add(shadow)

  const bob = new THREE.Group() // subtle walk bob / sway (transform-only, no rig in GLB)
  const yawRig = new THREE.Group() // CCW spin, clamped to [0, PI] — bad side is only on the other arc
  yawRig.add(model)
  bob.add(yawRig)
  root.add(bob)

  let flip = 0

  const setFlip = (target, dt) => {
    flip = MathUtils.damp(flip, MathUtils.clamp(target, 0, 1), 4.5, dt)
    yawRig.rotation.y = flip * Math.PI
  }

  const setWalk = (phase, amp) => {
    const a = Math.max(0, Math.min(1, amp))
    if (a < 0.01) {
      bob.position.y = 0
      bob.rotation.z = 0
      bob.rotation.x = 0
      return
    }
    bob.position.y = Math.sin(phase * 2) * 0.05 * a
    bob.rotation.z = Math.sin(phase) * 0.03 * a
    bob.rotation.x = a * 0.045
  }

  return {
    group: root,
    model,
    setFlip,
    setWalk,
    getFlip: () => flip
  }
}
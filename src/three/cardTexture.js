import * as THREE from 'three'

// Skills + demand tags from hero-reference.png (indigo family accents)
export const SKILLS = [
  { name: 'Data Analysis', accent: '#4b33a5', demand: 'High Demand' },
  { name: 'Python', accent: '#5a44f0', demand: 'High Demand' },
  { name: 'SQL', accent: '#6a55e8', demand: 'Rising' },
  { name: 'Cloud Computing', accent: '#8547e0', demand: 'Rising' },
  { name: 'Machine Learning', accent: '#9d62e8', demand: 'Rising' },
  { name: 'Embedded Systems', accent: '#7a5fd0', demand: 'High Demand' }
]

const W = 420
const H = 540
const BARS = [0.46, 0.68, 0.38, 0.92, 0.6, 0.8]

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function spring(t) {
  const u = Math.min(Math.max(t, 0), 1)
  return 1 - Math.pow(1 - u, 3)
}

export function createCardCanvas(skill, opts = {}) {
  const { gray = false, progress = 1 } = opts
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  drawCard(canvas, skill, gray, progress)
  return canvas
}

function drawCard(canvas, skill, gray, progress) {
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, W, H)

  const ink = gray ? '#4a4658' : '#17151f'
  const soft = gray ? '#b6b2c0' : '#8c8796'
  const faint = gray ? '#e8e6ee' : '#e9e7fb'
  const accent = gray ? '#97909f' : skill.accent
  const cardBg = gray ? '#f6f5f2' : '#ffffff'
  const chipBg = gray ? '#e4e2ea' : '#e9e7fb'
  const chipInk = gray ? '#55525f' : '#4b33a5'

  // card frame
  rr(ctx, 10, 10, W - 20, H - 20, 26)
  ctx.fillStyle = cardBg
  ctx.fill()
  ctx.lineWidth = 3
  ctx.strokeStyle = ink
  ctx.stroke()

  // faint inner hairline
  rr(ctx, 20, 20, W - 40, H - 40, 18)
  ctx.lineWidth = 1
  ctx.strokeStyle = faint
  ctx.stroke()

  // tag pill — "Career Bridge"
  const tagW = 182
  rr(ctx, 36, 44, tagW, 40, 10)
  ctx.fillStyle = chipBg
  ctx.fill()
  ctx.strokeStyle = chipInk
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.fillStyle = chipInk
  ctx.font = '700 17px "Space Grotesk", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('CAREER BRIDGE', 36 + tagW / 2, 66)

  // skill name
  ctx.fillStyle = ink
  ctx.font = '700 42px "Space Grotesk", "Public Sans", sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  let name = skill.name
  let y0 = 100
  // wrap long names to two lines
  if (name.length > 11) {
    const words = name.split(' ')
    let l1 = ''
    let l2 = ''
    for (const w of words) {
      if ((l1 + ' ' + w).trim().length <= 11) l1 = (l1 + ' ' + w).trim()
      else l2 = (l2 + ' ' + w).trim()
    }
    ctx.fillText(l1, 40, 128)
    ctx.fillText(l2, 40, 176)
    y0 = 200
  } else {
    ctx.fillText(name, 40, 150)
    y0 = 172
  }

  // rule + dot
  const ry = y0 + 26
  ctx.strokeStyle = soft
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(40, ry)
  ctx.lineTo(W - 40, ry)
  ctx.stroke()
  ctx.fillStyle = accent
  ctx.beginPath()
  ctx.arc(40, ry, 4, 0, Math.PI * 2)
  ctx.fill()

  // graph region
  const gx = 40
  const gy = ry + 46
  const gw = W - 80
  const gh = 150
  const bars = BARS.length

  // demand tag — "▲ High Demand" / "▲ Rising"
  const p = spring(progress)
  if (p > 0) {
    ctx.globalAlpha = Math.min(1, Math.max(0, (p - 0.4) * 3))
    ctx.fillStyle = accent
    ctx.font = '700 22px "Space Grotesk", sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('▲ ' + skill.demand, gx + 4, gy - 12)
    ctx.font = '500 19px "Public Sans", sans-serif'
    ctx.fillText('market velocity', gx + 4, gy + gh + 30)
    ctx.globalAlpha = 1
  }

  // spy sparkline fill
  const spark = [8, 20, 14, 30, 42, 38, 58]
  const spx = gx
  const spy = gy + gh - 6
  if (p > 0) {
    ctx.strokeStyle = soft
    ctx.lineWidth = 2
    ctx.beginPath()
    for (let i = 0; i < spark.length; i++) {
      const lx = spx + (i / (spark.length - 1)) * gw
      const ly = spy - spark[i] * p
      if (i === 0) ctx.moveTo(lx, ly)
      else ctx.lineTo(lx, ly)
    }
    ctx.stroke()
  }

  // bars
  const bw = (gw - (bars - 1) * 10) / bars
  ctx.fillStyle = gray ? ink : accent
  for (let i = 0; i < bars; i++) {
    const h = BARS[i] * gh * p
    ctx.globalAlpha = gray ? 0.85 : 1
    ctx.fillRect(gx + i * (bw + 10), gy + gh - h, bw, h)
  }
  ctx.globalAlpha = 1

  // axis line
  ctx.strokeStyle = faint
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(gx, gy + gh)
  ctx.lineTo(gx + gw, gy + gh)
  ctx.stroke()

  // min/max ticks
  ctx.fillStyle = soft
  ctx.font = '500 16px "Public Sans", sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('0', gx, gy + gh + 26)
  ctx.textAlign = 'right'
  ctx.fillText('jobs', gx + gw, gy + gh + 26)

  // footer tag
  ctx.fillStyle = faint
  rr(ctx, 40, H - 78, 150, 42, 12)
  ctx.fill()
  ctx.fillStyle = ink
  ctx.font = '600 18px "Public Sans", sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(gray ? 'catalog' : 'in your field', 58, H - 50)
}

export function redrawCardCanvas(canvas, skill, gray, progress) {
  drawCard(canvas, skill, gray, progress)
}

export function makeCardTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}
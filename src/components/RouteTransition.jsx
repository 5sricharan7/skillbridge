import { useEffect, useState } from 'react'
import { navigate } from '../router'

export default function RouteTransition({ active, destination, onComplete }) {
  const [phase, setPhase] = useState('entering')

  useEffect(() => {
    if (!active || !destination) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      setPhase('reduced-entering')
      const routeTimer = setTimeout(() => {
        navigate(destination)
        setPhase('reduced-exiting')
      }, 100)
      const doneTimer = setTimeout(onComplete, 200)
      return () => {
        clearTimeout(routeTimer)
        clearTimeout(doneTimer)
      }
    }

    setPhase('entering')
    const routeTimer = setTimeout(() => {
      setPhase('covered')
      navigate(destination)
    }, 300)
    const revealTimer = setTimeout(() => setPhase('exiting'), 450)
    const doneTimer = setTimeout(onComplete, 750)

    return () => {
      clearTimeout(routeTimer)
      clearTimeout(revealTimer)
      clearTimeout(doneTimer)
    }
  }, [active, destination, onComplete])

  if (!active || !destination) return null

  const isCareerBridge = destination === '/career-bridge'
  const kicker = isCareerBridge
    ? 'Personalized Career Intelligence'
    : 'Strategic Intelligence System'
  const wordmark = isCareerBridge ? 'CAREER BRIDGE' : 'MULTIPLIER EFFECT'

  return (
    <div className={`me-transition-overlay phase-${phase}`} aria-hidden="true">
      <div className="me-transition-curtain">
        <div className="me-transition-signal-track">
          <div className="me-transition-signal-beam" />
          <div className="me-transition-signal-node" />
        </div>
        <div className="me-transition-centerpiece">
          <div className="me-transition-spark">✦</div>
          <div className="me-transition-kicker">{kicker}</div>
          <div className="me-transition-wordmark">{wordmark}</div>
          <div className="me-transition-pulse-line" />
        </div>
      </div>
    </div>
  )
}

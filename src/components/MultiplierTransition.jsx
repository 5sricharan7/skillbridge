import { useEffect, useState } from 'react'

export default function MultiplierTransition({ active, onComplete }) {
  const [phase, setPhase] = useState('entering') // 'entering' -> 'covered' -> 'exiting'

  useEffect(() => {
    if (!active) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      const timer = setTimeout(() => {
        onComplete()
      }, 250)
      return () => clearTimeout(timer)
    }

    setPhase('entering')

    const coverTimer = setTimeout(() => {
      setPhase('covered')
    }, 250)

    const exitTimer = setTimeout(() => {
      setPhase('exiting')
    }, 500)

    const doneTimer = setTimeout(() => {
      onComplete()
    }, 750)

    return () => {
      clearTimeout(coverTimer)
      clearTimeout(exitTimer)
      clearTimeout(doneTimer)
    }
  }, [active, onComplete])

  if (!active) return null

  return (
    <div className={`me-transition-overlay phase-${phase}`} aria-hidden="true">
      {/* Full-screen cream curtain layer */}
      <div className="me-transition-curtain">
        {/* Animated violet traveling signal node & beam */}
        <div className="me-transition-signal-track">
          <div className="me-transition-signal-beam" />
          <div className="me-transition-signal-node" />
        </div>

        {/* Short centered editorial wordmark & signal pulse */}
        <div className="me-transition-centerpiece">
          <div className="me-transition-spark">✦</div>
          <div className="me-transition-kicker">Strategic Intelligence System</div>
          <div className="me-transition-wordmark">MULTIPLIER EFFECT</div>
          <div className="me-transition-pulse-line" />
        </div>
      </div>
    </div>
  )
}

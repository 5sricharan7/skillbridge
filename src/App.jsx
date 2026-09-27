import { useCallback, useEffect, useRef, useState } from 'react'
import Navbar from './components/Navbar'
import HeroOverlay from './components/HeroOverlay'
import ImpactSection from './components/ImpactSection'
import CareerRoadmap from './components/CareerRoadmap'
import JourneySection from './components/JourneySection'
import FinalCTA from './components/FinalCTA'
import CareerBridge from './components/CareerBridge'
import CurriculumTimeMachine from './components/CurriculumTimeMachine'
import Evidence from './components/Evidence'
import MultiplierEffect from './components/MultiplierEffect'
import RouteTransition from './components/RouteTransition'
import CinematicOpening from './components/CinematicOpening'
import { useRoute } from './router'

const TITLES = {
  '/': 'SkillBridge',
  '/career-bridge': 'Career Bridge — SkillBridge',
  '/curriculum-time-machine': 'Curriculum Time Machine — SkillBridge',
  '/evidence': 'Evidence — SkillBridge',
  '/multiplier-effect': 'Multiplier Effect — SkillBridge',
}

export default function App() {
  const heroRef = useRef(null)
  const navRef = useRef(null)
  const path = useRoute()
  const [transitionTarget, setTransitionTarget] = useState(null)
  // Cinematic intro: shown once on first load, auto-transitions after ~7s.
  // The homepage renders underneath the overlay at all times — no flash,
  // no reload, no scroll reset when the overlay dissolves.
  const [cinematicDone, setCinematicDone] = useState(false)

  // Scroll lock + homepage freeze while the intro overlay is active.
  // co-intro-active on <body>:
  //   • locks document scroll (overflow: hidden on html + body)
  //   • pins the hero's CSS custom properties to their resting / frame-zero
  //     values, which is what keeps the homepage frozen at the exact initial
  //     state its existing entrance animation expects
  //   • removes pointer events from the homepage so the intro owns all input
  const releaseHomepageFreeze = useCallback(() => {
    document.documentElement.style.overflow = ''
    document.body.style.overflow = ''
    document.body.classList.remove('co-intro-active')
  }, [])

  const handleCinematicDismiss = useCallback(() => {
    // Called by CinematicOpening AFTER its teardown has removed every
    // transition visual, and BEFORE React re-renders. Lifting the freeze here
    // rather than in the effect below matters: React runs child effects before
    // parent effects, so HeroOverlay's entrance would otherwise begin one
    // effect-window before `co-intro-active` came off. This ordering is the
    // handoff: transition gone → overlay unmounts → freeze released → the
    // EXISTING homepage entrance starts from frame zero.
    releaseHomepageFreeze()
    setCinematicDone(true)
  }, [releaseHomepageFreeze])

  useEffect(() => {
    if (!cinematicDone) {
      document.documentElement.style.overflow = 'hidden'
      document.body.style.overflow = 'hidden'
      document.body.classList.add('co-intro-active')
    } else {
      releaseHomepageFreeze()
    }
    return releaseHomepageFreeze
  }, [cinematicDone, releaseHomepageFreeze])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [path])

  useEffect(() => {
    document.title = TITLES[path] ?? 'SkillBridge'
  }, [path])

  const triggerCinematicTransition = (targetRoute) => {
    if (path === targetRoute || transitionTarget) return
    setTransitionTarget(targetRoute)
  }

  const completeTransition = useCallback(() => {
    setTransitionTarget(null)
  }, [])

  let page = null
  if (path === '/career-bridge') page = <CareerBridge />
  else if (path === '/curriculum-time-machine') page = <CurriculumTimeMachine />
  else if (path === '/evidence') page = <Evidence />
  else if (path === '/multiplier-effect') page = <MultiplierEffect />

  return (
    <>
      <div className={`page${transitionTarget ? ' is-transitioning-multiplier' : ''}`}>
        <div className="content">
          <Navbar
            navRef={navRef}
            path={path}
            onCinematicNav={triggerCinematicTransition}
          />
          {page ? (
            <main>{page}</main>
          ) : (
            <>
              <section ref={heroRef} id="hero" className="hero">
                <HeroOverlay introActive={!cinematicDone} />
              </section>
              <ImpactSection />
              <CareerRoadmap />
              <JourneySection />
              <FinalCTA />
            </>
          )}
        </div>
      </div>

      <RouteTransition
        active={!!transitionTarget}
        destination={transitionTarget}
        onComplete={completeTransition}
      />

      {/* Cinematic opening overlay — fixed, z-index 1000, sits above the
          entire page. The homepage is already mounted and visible beneath
          it. Auto-transitions after ~7s; onDismiss unmounts the overlay. */}
      {!cinematicDone && (
        <CinematicOpening onDismiss={handleCinematicDismiss} />
      )}
    </>
  )
}
import { useEffect, useRef } from 'react'
import Navbar from './components/Navbar'
import HeroOverlay from './components/HeroOverlay'
import ImpactSection from './components/ImpactSection'
import CareerRoadmap from './components/CareerRoadmap'
import JourneySection from './components/JourneySection'
import FinalCTA from './components/FinalCTA'
import CareerBridge from './components/CareerBridge'
import CurriculumTimeMachine from './components/CurriculumTimeMachine'
import Evidence from './components/Evidence'
import { useRoute } from './router'

const TITLES = {
  '/': 'SkillBridge',
  '/career-bridge': 'Career Bridge — SkillBridge',
  '/curriculum-time-machine': 'Curriculum Time Machine — SkillBridge',
  '/evidence': 'Evidence — SkillBridge',
}

export default function App() {
  const heroRef = useRef(null)
  const navRef = useRef(null)
  const path = useRoute()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [path])

  useEffect(() => {
    document.title = TITLES[path] ?? 'SkillBridge'
  }, [path])

  let page = null
  if (path === '/career-bridge') page = <CareerBridge />
  else if (path === '/curriculum-time-machine') page = <CurriculumTimeMachine />
  else if (path === '/evidence') page = <Evidence />

  return (
    <div className="page">
      <div className="content">
        <Navbar navRef={navRef} path={path} />
        {page ? (
          <main>{page}</main>
        ) : (
          <>
            <section ref={heroRef} id="hero" className="hero">
              <HeroOverlay />
            </section>
            <ImpactSection />
            <CareerRoadmap />
            <JourneySection />
            <FinalCTA />
          </>
        )}
      </div>
    </div>
  )
}
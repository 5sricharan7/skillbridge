import { useEffect, useRef } from 'react'
import { navigate } from '../router'

const LINKS = [
  { label: 'Home', to: '/' },
  { label: 'Career Bridge', to: '/career-bridge' },
  { label: 'Curriculum Time Machine', to: '/curriculum-time-machine' },
  { label: 'Evidence', to: '/evidence' },
]

export default function Navbar({ navRef, path }) {
  const ref = useRef(null)

  useEffect(() => {
    const onScroll = () => {
      const el = ref.current || navRef?.current
      if (!el) return
      el.classList.toggle('is-scrolled', window.scrollY > 8)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [navRef])

  const handleNav = (event, to) => {
    if (
      event.defaultPrevented ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0
    ) {
      return
    }
    event.preventDefault()
    navigate(to)
  }

  return (
    <header
      ref={(el) => {
        ref.current = el
        if (navRef) navRef.current = el
      }}
      className="nav"
    >
      <a className="nav-logo" href="/" aria-label="SkillBridge home" onClick={(e) => handleNav(e, '/')}>
        <svg viewBox="0 0 32 32" className="nav-logo-mark" aria-hidden="true">
          <path
            d="M4 16h7l3-8 4 14 3-6h7"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span>SkillBridge</span>
      </a>
      <nav className="nav-center" aria-label="Primary">
        {LINKS.map((link) => (
          <a
            key={link.to}
            href={link.to}
            className={`nav-link${path === link.to ? ' is-active' : ''}`}
            onClick={(e) => handleNav(e, link.to)}
          >
            {link.label}
            <i className="nav-dot" aria-hidden="true" />
          </a>
        ))}
      </nav>
      <a className="nav-cta" href="/career-bridge" onClick={(e) => handleNav(e, '/career-bridge')}>
        Get Started
        <svg viewBox="0 0 12 12" className="nav-arrow" aria-hidden="true">
          <path d="M2.5 9.5l7-7M3.5 2.5h6v6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </a>
    </header>
  )
}
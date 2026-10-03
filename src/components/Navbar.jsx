import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { navigate } from '../router'

/**
 * The primary navigation.
 *
 * Five top-level items, all peers on one baseline: Home, Career Bridge,
 * Institutional Intelligence, Evidence, Multiplier Effect. The Institutional
 * group exists because Curriculum Time Machine and Cohort Dashboard are the two
 * ends of one loop and would otherwise take two slots on the same line as
 * everything else; its popover states that relationship rather than just listing
 * links.
 *
 * Multiplier Effect is a normal peer again. It kept its route and its cinematic
 * transition throughout; what changed was that it was missing from this bar, and
 * a route with no entry point is a route nobody finds.
 */
const LINKS = [
  { label: 'Home', to: '/' },
  { label: 'Career Bridge', to: '/career-bridge' },
]

/** The two ends of the institutional loop, in the order they are worked. */
const INSTITUTIONAL = [
  {
    id: 'cohort',
    label: 'Cohort Dashboard',
    to: '/cohort-dashboard',
    note: 'See where a cohort stands',
  },
  {
    id: 'ctm',
    label: 'Curriculum Time Machine',
    to: '/curriculum-time-machine',
    note: 'Turn industry + cohort gaps into curriculum insight',
  },
]

/** The label on the popover's own trigger, and the paths that count as inside it. */
const INSTITUTIONAL_ROUTES = INSTITUTIONAL.map((entry) => entry.to)

/** Peer links that sit after the group. Declared once so their order is explicit. */
const TRAILING_LINKS = [
  { label: 'Evidence', to: '/evidence' },
  { label: 'Multiplier Effect', to: '/multiplier-effect' },
]

export default function Navbar({ navRef, path, onCinematicNav }) {
  const ref = useRef(null)
  const menuRef = useRef(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuId = useId()

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

  /* Navigating anywhere closes the popover, so it is never left hanging over
     the page it was opened from. */
  useEffect(() => {
    setMenuOpen(false)
  }, [path])

  const closeMenu = useCallback(() => setMenuOpen(false), [])

  /* Open and closed by click, and closed by Escape or by a pointer press
     anywhere outside the trigger-plus-popover wrapper. It is deliberately NOT a
     hover menu: a hover menu closes the instant the pointer leaves the trigger
     to travel downward, which is exactly the motion a reader makes to reach a
     dropdown underneath it. Click-to-open has no such dead zone. */
  useEffect(() => {
    if (!menuOpen) return undefined

    const onKeyDown = (event) => {
      if (event.key === 'Escape') closeMenu()
    }
    const onPointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) closeMenu()
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [menuOpen, closeMenu])

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
    /* Multiplier Effect keeps its cinematic route transition: the overlay plays
       first, then it navigates. Every other destination navigates immediately.
       This is the pre-existing behaviour, restored — not a new effect. */
    if (to === '/multiplier-effect' && onCinematicNav) {
      onCinematicNav(to)
      return
    }
    navigate(to)
  }

  const inInstitutional = INSTITUTIONAL_ROUTES.includes(path)

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
        {LINKS.map((link) => {
          const isActive = path === link.to

          return (
            <a
              key={link.to}
              href={link.to}
              className={`nav-link${isActive ? ' is-active' : ''}`}
              onClick={(e) => handleNav(e, link.to)}
            >
              <span className="nav-label-wrap">{link.label}</span>
              <i className="nav-dot" aria-hidden="true" />
            </a>
          )
        })}

        {/* The one expandable control. It is a real button with real
            aria-expanded/aria-controls, so it is operable by keyboard and
            announced correctly; the destination it opens is a list of two
            links, which is what a popover is.

            The wrapper is the interactive region: trigger and popover are both
            descendants, so travelling from the trigger down into the popover
            never leaves it. It carries no pointer handlers — the close signal is
            the document-level check above, which only fires on a real press
            outside. */}
        <div className="nav-group" ref={menuRef}>
          <button
            type="button"
            className={`nav-link nav-group-btn${inInstitutional ? ' is-active' : ''}`}
            aria-expanded={menuOpen}
            aria-controls={menuId}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="nav-label-wrap">
              Institutional Intelligence
              <svg viewBox="0 0 12 12" className="nav-caret" aria-hidden="true">
                <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <i className="nav-dot" aria-hidden="true" />
          </button>

          {menuOpen ? (
            <div className="nav-pop" id={menuId}>
              <p className="nav-pop-eyebrow">Institutional Intelligence</p>

              <ul className="nav-pop-list">
                {INSTITUTIONAL.map((entry) => {
                  const isActive = path === entry.to
                  return (
                    <li key={entry.id}>
                      <a
                        href={entry.to}
                        className={`nav-pop-item${isActive ? ' is-active' : ''}`}
                        aria-current={isActive ? 'page' : undefined}
                        onClick={(e) => handleNav(e, entry.to)}
                      >
                        <span className="nav-pop-item-label">{entry.label}</span>
                        <span className="nav-pop-item-note">{entry.note}</span>
                      </a>
                    </li>
                  )
                })}
              </ul>

              {/* The relationship the popover exists to express. Decorative:
                  both routes are already named as links directly above, so
                  repeating them here would be noise for a screen reader. */}
              <p className="nav-pop-loop" aria-hidden="true">
                <span className="nav-pop-loop-step">Cohort Dashboard</span>
                <span className="nav-pop-loop-link">identified gaps</span>
                <span className="nav-pop-loop-step">Curriculum Time Machine</span>
              </p>
            </div>
          ) : null}
        </div>

        {TRAILING_LINKS.map((link) => {
          const isActive = path === link.to
          /* The signal line under Multiplier Effect: a travelling node on a short
             indigo track, the one moving element in the bar. Restored as it was,
             `aria-hidden` because it carries no information the label does not. */
          const isMe = link.to === '/multiplier-effect'

          return (
            <a
              key={link.to}
              href={link.to}
              className={`nav-link${isMe ? ' nav-link-multiplier' : ''}${isActive ? ' is-active' : ''}`}
              onClick={(e) => handleNav(e, link.to)}
            >
              <span className="nav-label-wrap">
                {link.label}
                {isMe ? (
                  <span className="nav-signal-line" aria-hidden="true">
                    <span className="nav-signal-node" />
                  </span>
                ) : null}
              </span>
              <i className="nav-dot" aria-hidden="true" />
            </a>
          )
        })}
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

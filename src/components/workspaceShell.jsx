/**
 * The SkillBridge application shell.
 *
 * Every workspace route renders inside `WorkspaceShell` and navigates through
 * `WorkspaceRail`. This is the one frame that makes Career Bridge, Cohort
 * Dashboard, Curriculum Time Machine and Evidence read as four rooms in one
 * building rather than four separate sites sharing a navbar.
 *
 * The component owns geometry and nothing else. It has no data fetching, no
 * route awareness, and no knowledge of what any workspace is measuring — a
 * workspace passes its own items and gets back its own `onSelect(id)`. That
 * boundary is the point: the shell can be restyled without touching a single
 * feature, and a workspace's logic can change without touching the shell.
 *
 * Styling lives in `workspaceShell.css`. It reads `--ws-*`, which each page
 * scope aliases onto its own documented palette (`--cb-*`, `--cohort-*`,
 * `--ctm-*`, `--ev-*`), so the shell never hardcodes a colour and never drifts
 * from a page that re-tunes its own surface.
 */

import './workspaceShell.css'

/**
 * The page frame: a rail column and a content column.
 *
 * `rail` is rendered as-is so a workspace keeps ownership of its own `<aside>`
 * semantics and any page-specific rail content it needs.
 */
export function WorkspaceShell({ rail, children }) {
  return (
    <div className="ws-shell">
      {rail}
      <main className="ws-main">{children}</main>
    </div>
  )
}

/**
 * The left navigation rail.
 *
 * `groups` is one or more sections; anything after the first is separated by a
 * hairline. An item is `{ id, label, note, icon, num?, tag?, locked? }`:
 *
 * - `note` is the one-line descriptor under the label. It is part of the
 *   shared item, so no workspace ships a text-only row beside an icon row.
 * - `num` is set only where the sequence is genuinely numbered (the Cohort
 *   workflow). It shares the title's line, so a numbered rail is no taller.
 * - `locked` marks a destination that exists but has nothing behind it yet.
 *   Locked rows stay legible and focusable and report themselves through
 *   `onLocked`; they are never hidden, because a sequence a reader cannot see
 *   is a sequence they cannot anticipate.
 * - `tag` is an optional inline state note, used by Career Bridge.
 */
export function WorkspaceRail({ label, navLabel, groups, activeId, onSelect, onLocked, context }) {
  return (
    <aside className="ws-rail" aria-label={label}>
      {label ? <p className="ws-rail-label">{label}</p> : null}

      <nav className="ws-railnav" aria-label={navLabel ?? label}>
        {groups.map((group, groupIndex) => (
          <div
            className={`ws-rail-group${groupIndex > 0 ? ' is-separated' : ''}`}
            key={group.label ?? groupIndex}
          >
            {group.items.map((item) => {
              const isActive = item.id === activeId
              const state = isActive ? 'is-active' : item.locked ? 'is-locked' : ''

              return (
                <button
                  key={item.id}
                  type="button"
                  className={`ws-item ${state}`.trim()}
                  aria-current={isActive ? 'page' : undefined}
                  aria-disabled={item.locked ? 'true' : undefined}
                  onClick={() => (item.locked && onLocked ? onLocked(item) : onSelect(item.id))}
                >
                  {/* Every rail item carries an icon. The tile is decorative;
                      the label and note beside it carry the meaning. */}
                  <span className="ws-item-ic" aria-hidden="true">
                    {item.icon}
                  </span>
                  <span className="ws-item-copy">
                    <span className="ws-item-head">
                      {item.num ? <span className="ws-item-num">{item.num}</span> : null}
                      <span className="ws-item-label">{item.label}</span>
                    </span>
                    {item.note ? <span className="ws-item-note">{item.note}</span> : null}
                  </span>
                  {item.tag ? <span className="ws-item-tag">{item.tag}</span> : null}
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      {context}
    </aside>
  )
}

/**
 * The rail's bottom contextual card.
 *
 * It explains where the workspace is and what it is currently reading. It is
 * presentational: it is not a link and not a button, so it is announced as
 * text rather than as a fourth thing to click.
 */
export function RailContext({ label, chips, meta, empty }) {
  const hasChips = Array.isArray(chips) && chips.length > 0

  return (
    <div className="ws-railcontext">
      {label ? <span className="ws-railcontext-label">{label}</span> : null}
      {hasChips ? (
        <ul className="ws-railcontext-list">
          {chips.map((chip) => (
            <li key={chip}>{chip}</li>
          ))}
        </ul>
      ) : null}
      {meta ? <span className="ws-railcontext-meta">{meta}</span> : null}
      {!hasChips && !meta && empty ? <span className="ws-railcontext-empty">{empty}</span> : null}
    </div>
  )
}
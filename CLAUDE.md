# Open Bracket

Static one-page site: `index.html`, `styles.css`, `app.js`, `data/event.json`. No build step. GitHub Pages serves `main`.

- All copy lives in `data/event.json`. Don't hardcode copy in `app.js` or `index.html`.
- Times are ISO 8601 with an offset (`-04:00` for New York in October). Times inside copy use `{{t:ISO}}`.
- Bump the `?v=` on `styles.css` and `app.js` in `index.html` whenever either file changes.
- Real-world facts (ferry routes, times, fares, bag policy) come from the user. Don't invent or change them.

## Motion tiers

Every effect on the page belongs to one tier. If you add, remove or change an effect, update this list.

- **Tier 1: plays once, under 5 seconds.** No reduced version needed beyond the global `prefers-reduced-motion` rule, which turns it off.
- **Tier 2: has a reduced version.** Under `prefers-reduced-motion: reduce` it is replaced by something that doesn't move (usually a color change), or by an instant change.
- **Tier 3: sustained, with a toggle.** Anything that keeps moving must have a visible control to pause or stop it.

Global rule (`styles.css`, top): under `prefers-reduced-motion: reduce`, all animations and transitions are off and smooth scrolling is off.

### Current effects

| Effect | Where | Tier | Reduced version |
|---|---|---|---|
| Hero title "stamp" (scale and rotate in, 620 ms, second line 160 ms later) | `@keyframes stamp`, `.hero h1 span` | 1 | Off; the title shows in place |
| Smooth scroll to an anchor (nav, creator card to heat row) | `html { scroll-behavior: smooth }` | 1 | Jumps instantly |
| Button lift on hover or focus (moves 3px up-left, 6px hard offset block) | `.btn:hover`, `.btn:focus-visible` | 2 | No movement; colors invert |
| Button arrow nudge (4px right on hover or focus) | `.btn .arrow` | 2 | No movement |
| Route card lift on hover or focus inside | `.route:hover`, `.route:focus-within` | 2 | No movement, no offset block |
| Split-flap digit flip (260 ms, only on digits that change) | `@keyframes flap`, `.flap.is-flipping` | 2 | No flip; the digit changes in place |
| Color and underline transitions (120 ms) on links, tabs, calendar buttons, FAQ toggles, form options | various `transition:` rules | 2 | Instant change |

Static, not motion: the yellow highlight on a heat row reached from a creator card, the selected Compete or Spectate column.

### Doesn't fit a tier (flagged, not changed)

- **Countdown.** The countdown updates every second until the event starts (`setInterval(tick, 1000)` in `renderCountdown`), and the seconds digits flip every second. That is sustained motion with no pause or stop control, so it doesn't meet tier 3. Under reduced motion the flip is off but the numbers still change every second. To fit tier 3 it needs a toggle (for example a pause button that stops the interval).
- **`?motion=full`.** Not supported. There is no way to preview full motion when the OS asks for reduced motion.

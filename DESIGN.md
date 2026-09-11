# Design System Audit

This documents the design tokens, components, and styling patterns that
already exist in this codebase, as found by auditing the current CSS/HTML/JS.
It is a snapshot of **what is**, not a proposal for what should change.
No UI files were modified to produce this document.

## 1. Frontend stack

Plain HTML + vanilla CSS + vanilla JS. No framework (React/Vue/etc.), no
Tailwind, no CSS modules, no CSS-in-JS, no build step / bundler, no
component library. Styling is done via hand-written class-based CSS files
loaded with a plain `<link rel="stylesheet">`, and pages are static `.html`
files with inline `<script>` tags for PHP-backed dynamic data.

There is **no single shared stylesheet** — the codebase runs two parallel,
independently-maintained design systems side by side:

| Stylesheet | Used by | Purpose |
|---|---|---|
| `site.css` (+ `site.js`, `i18n.js`) | `index.html`, `contact.html`, `faq.html`, `how-it-works.html`, `privacy.html`, `terms.html`, `404.html` | Public marketing site (multilingual: EN/TH/KM) |
| `app.css` (+ `app.js`, `login.js`, `register.js`, `admin.js`) | `login.html`, `register.html`, `dashboard.html`, `admin.html` | Authenticated app shell (user dashboard + admin panel share this one file) |

### Dead / orphaned files

Removed. This audit originally flagged `style.css`, `script.js`,
`admin-style.css`, `admin-script.js`, `legacy-admin-style.css`,
`legacy-admin-script.js`, `legacy-admin.html`, `legacy-dashboard.html`,
`legacy-admin_api.php`, `api.php`, plus the "45 processing scripts"
backend cluster (`auto_update.php`, `generate_usdt.php`,
`request_withdrawal.php`, `request_instant_withdrawal.php`,
`update_script.php`, `update_database.sql`) as unreferenced by any live
page. Confirmed unneeded and deleted in a later pass, along with rewriting
`database.sql` (it only defined that legacy schema — the current app's
tables weren't defined anywhere in the repo) and updating `README.md` /
`QUICKSTART.md` / `CRON_SETUP.md` to describe the current app instead.

## 2. Color tokens

Both stylesheets define their own `:root` custom properties. **They are not
identical** — same intent, different variable names, and in one case a
different value. This is the single biggest inconsistency in the system.

### `site.css` (`:root`, lines 1–23)

| Token | Value | Use |
|---|---|---|
| `--bg` | `#f4f6fb` | Page background |
| `--surface` | `#ffffff` | Card/panel background |
| `--surface-2` | `#f8fafc` | Secondary surface (rarely used) |
| `--border` | `#e7ebf3` | Default border |
| `--border-strong` | `#d7ddea` | Input borders |
| `--text` | `#0f172a` | Primary text |
| `--text-secondary` | `#475569` | Secondary text |
| `--text-muted` | `#94a3b8` | Muted/placeholder text |
| `--primary` | `#2563eb` | Brand blue |
| `--primary-dark` | `#1d4ed8` | Primary hover state |
| `--primary-soft` | `#eef4ff` | Primary tint (icon backgrounds) |
| `--emerald` | `#059669` | Accent green (success, CTAs) |
| `--emerald-soft` | `#ecfdf5` | Emerald tint |
| `--amber` | `#d97706` | Warning |
| `--danger` | `#dc2626` | Error/destructive |
| `--radius` | `18px` | Card radius |
| `--radius-sm` | `12px` | Small element radius |
| `--shadow-sm` | `0 1px 2px rgba(16,24,40,.05)` | Subtle elevation |
| `--shadow` | `0 10px 30px rgba(16,24,40,.08)` | Card elevation |
| `--shadow-lg` | `0 24px 60px rgba(16,24,40,.18)` | Modal/high elevation |
| `--transition` | `0.2s ease` | Default transition |

### `app.css` (`:root`, line 1)

| Token | Value | Equivalent in `site.css` | Note |
|---|---|---|---|
| `--bg` | `#f4f6fb` | `--bg` | identical |
| `--surface` | `#fff` | `--surface` | identical |
| `--border` | `#e7ebf3` | `--border` | identical |
| `--border-strong` | `#d7ddea` | `--border-strong` | identical |
| `--text` | `#0f172a` | `--text` | identical |
| `--text2` | `#475569` | `--text-secondary` | **different name, same value** |
| `--muted` | `#94a3b8` | `--text-muted` | **different name, same value** |
| `--primary` | `#2563eb` | `--primary` | identical |
| `--primary-dark` | `#1d4ed8` | `--primary-dark` | identical |
| `--emerald` | `#059669` | `--emerald` | identical |
| `--emerald-soft` | `#ecfdf5` | `--emerald-soft` | identical |
| `--danger` | `#dc2626` | `--danger` | identical |
| `--danger-soft` | `#fef2f2` | *(none)* | **not defined in site.css** |
| `--amber` | `#d97706` | `--amber` | identical |
| `--radius` | `16px` | `18px` | **different value** |
| `--shadow` | `0 8px 24px rgba(16,24,40,.07)` | `0 10px 30px rgba(16,24,40,.08)` | **different value, one tier only** (no `--shadow-sm`/`--shadow-lg`) |

Not present in `app.css` at all: `--surface-2`, `--primary-soft`,
`--radius-sm`, `--transition` (transitions are hardcoded as `.15s` or `.2s`
inline per-rule instead of via a variable).

## 3. Typography

- **Font**: [Inter](https://fonts.google.com/specimen/Inter) (weights
  400/500/600/700/800), loaded from Google Fonts on every page.
  `site.css` additionally loads **Noto Sans Thai** and **Noto Sans Khmer**
  for the `th`/`km` locales (`html[lang="th"] body` / `html[lang="km"] body`
  font-family overrides in `site.css` lines 27–28). `app.css` pages
  (dashboard/admin/login/register) only ever load Inter — there is no
  Thai/Khmer fallback in the authenticated app shell.
- **Fallback stack**: `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
  (site.css) vs. just `-apple-system, sans-serif` (app.css) — inconsistent.
- **Body line-height**: `1.6` (site.css) vs. `1.55` (app.css).
- **Monospace**: used ad hoc (no variable) for wallet addresses, tx hashes,
  and referral codes — `font-family: monospace` inline on `.net-addr`,
  `.dinput`, `.referral-link input`.

### Observed type scale (font-size / weight), largest to smallest

| Context | Size | Weight | File |
|---|---|---|---|
| Hero H1 | `clamp(34px, 5vw, 54px)` | 800 | site.css |
| 404 code | `96px` | 800 | site.css |
| Page-hero H1 | `36px` | 800 | site.css |
| Section H2 / CTA H2 | `30px` (→`24–26px` at ≤768px) | 800 | site.css |
| Auth card / stat-card value | `22–24px` | 800 | app.css |
| Prose H2 | `22px` | 800 | site.css |
| Plan APR value | `22px` | 800 | app.css |
| App topbar H1 | `20px` | 800 | app.css |
| Contact info H2 | `20px` | 800 | site.css |
| Step / feature-card H3 | `17–18px` | 700–800 | both |
| Panel H3 | `17px` | 800 | app.css |
| FAQ question | `16px` | 700 | site.css |
| Body / section copy | `14–16px` | 400 | both |
| Small/meta text | `12–13px` | 600–700 | both |
| Badge / label text | `11–12px` | 700, uppercase | app.css |

There is no explicit named scale (no `--font-size-xs/sm/md/lg` tokens) —
every rule hardcodes its own `px` value. Letter-spacing of `-0.02em` to
`-0.03em` is used ad hoc on large headings only.

## 4. Spacing & radius

No spacing scale variables exist; padding/margin/gap values are hardcoded
per rule (commonly seen: `8px`, `10px`, `12px`, `14px`, `16px`, `20px`,
`22px`, `24px` — roughly a 2px-step ad hoc scale, not a formal system).

Border-radius values in use (no single scale, `--radius`/`--radius-sm`
cover only cards):

| Radius | Used for |
|---|---|
| `7–9px` | small buttons, badges' inner elements, language switcher buttons |
| `10–11px` | buttons, inputs, nav items |
| `12–14px` | network cards, FAQ items, deposit info boxes |
| `16–18px` (`--radius`) | panels, cards, auth card |
| `20px` | auth card (app.css override) |
| `24px` | CTA block (site.css) |
| `50%` | avatar/icon circles (step numbers, summary icon) |
| `999px` | pills — badges, hero badge, lang switcher, plan badge |

## 5. Shadows

- `site.css`: three-tier scale — `--shadow-sm` / `--shadow` / `--shadow-lg`.
- `app.css`: single `--shadow` only, different value than site.css's
  `--shadow`, plus several one-off inline shadows
  (e.g. `.panel { box-shadow: 0 1px 2px rgba(16,24,40,.05) }`,
  `.network-card:hover { box-shadow: 0 4px 14px rgba(37,99,235,.1) }`)
  that duplicate `--shadow-sm`'s intent without using the variable.

## 6. Buttons

Both stylesheets define a base `.btn` plus variant modifier classes, but
the variant sets and their visual treatment **differ between the two
systems**:

| Variant | `site.css` (marketing) | `app.css` (app/admin) |
|---|---|---|
| `.btn` base | `min-height:46px`, `padding:12px 22px`, `radius:11px` | `min-height:42px`, `padding:10px 16px`, `radius:10px` |
| `.btn-primary` | solid `--primary`, hover → `--primary-dark` + lift + shadow | solid `--primary`, hover → `--primary-dark` only (no lift/shadow) |
| `.btn-accent` | **gradient** `linear-gradient(135deg,#10b981,#059669)`, hover lift+shadow | **solid** `var(--emerald)`, no hover lift |
| `.btn-outline-light` | translucent white outline (dark-background CTA) | *(not defined)* |
| `.btn-ghost` | *(not defined — `site.css` has no ghost variant)* | transparent, `rgba(255,255,255,.7)` text, subtle border |
| `.btn-danger` | *(not defined)* | solid `var(--danger)` |
| `.btn-sm` | *(not defined — no size variant in site.css)* | `min-height:34px`, `padding:7px 13px`, `font-size:12.5px` |

All buttons: `display:inline-flex`, centered content, `font-weight:700`,
`cursor:pointer`, `font-family:inherit`. Focus state (`:focus-visible`
outline ring) is only defined in `site.css` (line 35) — `app.css` buttons
have no visible focus ring at all.

## 7. Status badges (`app.css` only — `.badge`)

Pill-shaped, `11px` uppercase, `font-weight:700`, `padding:4px 10px`,
`border-radius:999px`. Color pairs by status:

| Status class | Background | Text |
|---|---|---|
| `.pending`, `.unverified` | `#eef4ff` | `#1e40af` |
| `.approved`, `.completed`, `.active`, `.matured`, `.verified` | `var(--emerald-soft)` | `#065f46` |
| `.rejected`, `.suspended` | `var(--danger-soft)` | `#b91c1c` |
| `.withdrawal`, `.investment`, `.daily_profit`, `.referral`, `.end_profit` | `#f5f3ff` | `#5b21b6` |
| `.deposit` | `var(--emerald-soft)` | `#065f46` |

Note: several of these background/text colors (`#eef4ff`/`#1e40af`,
`#f5f3ff`/`#5b21b6`) are hardcoded hex, not tokens — there's no
`--info`/`--purple` variable backing them.

## 8. Form elements

Inputs/textareas/selects (both stylesheets, near-identical pattern):
`padding: 12–14px`, `border: 1.5px solid var(--border-strong)`,
`border-radius: 9–10px`, `font-size: 14px`. Focus state: `border-color:
var(--primary)` + `box-shadow: 0 0 0 3px rgba(37,99,235,.12)`.

Feedback text pattern: a `<p>` with class `form-error` (site.css) is red
by default (`color: var(--danger)`), with a `.success` modifier class
(green, `var(--emerald)`) added via JS when the message is a success
message rather than an error — this modifier convention was introduced
during this session's bug-fix work and is now used consistently across
`app.js`'s Withdraw, Profile, KYC, Security, and Invest flows, plus
`site.js`'s contact form (`.form-note.error`, the inverse pairing).

## 9. Breakpoints

No shared breakpoint variables (can't be, in plain CSS without custom
media-query mixins). Values in use:

| Breakpoint | site.css | app.css |
|---|---|---|
| `900px` | grid columns 3→2 | sidebar/grid adjustments |
| `768px` | mobile nav, hero/section padding, grid 2→1 | *(not used)* |
| `560px` | *(not used)* | stat grid → 1 col, stepper labels hidden, tighter padding |

`site.css` and `app.css` do not share a mobile breakpoint — site.css's nav
collapses at `768px`, app.css's sidebar collapses at `900px`.

## 10. Known inconsistencies (flagged, not fixed)

1. Two independent token sets with the same intent but different names
   (`--text2` vs `--text-secondary`) and one differing value (`--radius`:
   16px vs 18px, `--shadow` differs).
2. `.btn-accent` renders as a gradient in the marketing site and a flat
   color in the app — same brand action, two different looks.
3. No focus-visible ring on `app.css` buttons (accessibility gap).
4. Six dead CSS/JS files still in the repo root, not imported by any live
   page.
5. No shared spacing/type scale — everything is a hand-picked pixel value.

## Scope note

Per instruction, nothing else in the repo was modified while producing
this document. Next step, once this is reviewed, would be deciding whether
to (a) formally unify the two token sets into one shared stylesheet, or
(b) keep them separate but document/enforce parity — that decision is not
made here.

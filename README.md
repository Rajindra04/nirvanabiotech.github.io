# Nirvana Biotech — Multipage Site

A from-scratch multipage rebuild of the original single-page `nirvanabiotech.github.io`,
restructured so each nav item is its own real page (like fiftyfive5.com/work), while keeping
all the original content and functionality.

## ⚠️ Before you redeploy: three real bugs, all fixed in this package

**1. Login did nothing — CORS mismatch.** Your site is served at the custom domain
`https://nirvanabiotech.org`, but the Worker's `wrangler.toml` had
`ALLOWED_ORIGIN = "https://rajindra04.github.io"`. The browser blocks the Worker's response
when the origin doesn't match — looks exactly like "clicking Login does nothing."
**Fix**: `wrangler.toml` now has `ALLOWED_ORIGIN = "https://nirvanabiotech.org"`.

**2. Edit mode was active without logging in (server-side cause) — unverified stored
token.** The site only ever checked "is there a token sitting in this browser's storage,"
never "is this token actually still valid." A token from any earlier login attempt (even a
broken one) would silently keep granting edit access on every later page load, forever,
with no real authentication happening. **Fix**: the Worker now has a `/verify` route, and
the site calls it on every page load — if the server doesn't actively confirm the token,
edit mode never turns on.

**3. Edit pencils were visible to everyone, even with bug #2 fixed — a pure CSS bug.**
This is the one in your latest screenshot, and it's separate from #2. Every edit pencil
sits inside a wrapper `<div>` with two classes: `editable-controls` (lays the buttons out
in a row) and `edit-only` (supposed to hide them when logged out). Both classes set a
`display` value with identical specificity, and `editable-controls` happened to be written
later in the stylesheet — in CSS, when two rules have equal specificity, **whichever is
declared later in the file wins**, regardless of what makes logical sense. So the "lay out
in a row" rule was silently beating the "hide this" rule on every page, independent of
login state entirely. **Fix**: the hide/show rules now use `!important`, which makes them
win deterministically by design rather than by accidental file order. Pure CSS fix, already
in `styles.css` — no Worker changes needed for this one, just redeploy the website files.

**Because of fix #2, you must redeploy the actual `worker.js` file, not just
`wrangler.toml`.** See `WRANGLER_GUIDE.md` for exact commands.

Your `ADMIN_API_BASE` in `site.js` (`https://nirvana-biotech-admin.rajindra04.workers.dev`)
was already correct and needs no change.

## What was actually missing before

The previous zip you deployed only ever had the old single-page files live — the new
multipage HTML/CSS/JS was never pushed to the repo, which is also why the left-hand rail
nav and missing "Add" buttons showed up: you were looking at the old build. This package's
`data.json` has been updated to carry over the **real content you already added** through
the old admin (your actual uploaded image filenames, team bios, research writeup) instead
of placeholder text, so redeploying this won't lose anything you've already entered.

## Structure

```
index.html           Home
about.html            About
innovations.html      Innovations (click a card → detail modal)
team.html             Team
collaborators.html    Collaborators (partner people & institutions)
projects.html         Projects (status board + grant metadata)
research.html         Research (click a row → detail modal)
contact.html          Contact form
styles.css            Shared design system (one file, all pages)
site.js               Shared behavior: data loading, nav, modal, signature "trace" graphic
data.json             All editable content — edit this, not the HTML, to change copy
worker.js             Cloudflare Worker — handles admin /login, /verify, and /save
wrangler.toml         Worker config — ALLOWED_ORIGIN fixed to your real domain (see above)
WRANGLER_GUIDE.md     Step-by-step: deploying the Worker with the Wrangler CLI
images/               Your real photos go here
```

Every page is plain HTML/CSS/JS — no build step. Works as-is on GitHub Pages, exactly like the
original repo.

## Design

- **Palette**: ink-black background, lab-paper cream for relief sections, deep teal +
  rust-red accents (swap the generic blue/cream-serif look for something specific to a
  biotech identity).
- **Type**: Fraunces (serif display) for headlines, Inter for body copy, IBM Plex Mono for
  labels/eyebrows/dates — a nod to lab data labeling conventions.
- **Signature motif**: the wavy line under each hero headline is a generated
  "chromatogram trace" (`traceSVG()` in `site.js`) — evokes the antibody/assay curves this
  company actually produces, instead of a generic decorative squiggle.
- **Navigation**: a responsive top bar that collapses into a full-screen mobile menu on
  small screens. (An earlier draft also had a fixed left-hand page-index rail; it's been
  removed per request, so navigation is top-bar only now.)

## Editing content — two ways

**1. Edit `data.json` directly** (no admin needed). Everything text-based lives there: hero
copy, about-page focus areas, innovations, team members, research entries, contact copy.
Edit the file, commit, push — no HTML editing required.

**2. Edit live, in the browser, as an admin** — this is the rebuilt version of the original
site's password-protected edit mode, wired to your Cloudflare Worker (`worker.js`).

### How admin mode works

1. Click **Admin** in the top-right of any page and enter the admin password (the same
   `ADMIN_PASSWORD` secret your Worker is configured with).
2. Once logged in, every editable field on every page shows a small **edit pencil** button
   next to it. That now includes:
   - Site brand name and logo (every page's top nav)
   - Every page's hero label/title/subtitle/heading text **and background image**
     (Home, About, Innovations, Team, Research, Contact all have their own background
     image pencil now — upload any photo and it becomes that page's hero backdrop)
   - Home page's "What we do" intro and its 3 pillar cards (add/remove/edit each)
   - Home page's "Featured innovation" callout text
   - About page's intro/description, plus both card-grid section headers
     ("Core focus areas" / "The Nirvana Advantage") and every card in each grid
   - Innovations: add new, edit title/description/image, edit full pop-up details/link,
     remove
   - Team: add new member, edit name/role/photo, remove
   - Collaborators: add new (person or organization), edit name/type/affiliation/
     description/photo-or-logo/link, remove. "Type" uses a fixed picker
     (Individual / Institution / Sponsor) instead of free text, so it stays consistent.
   - Projects: add new, edit title/description/image/full details/link, remove. **Status**
     (Ongoing / Completed / Planned) uses the same fixed picker — click it, choose the
     value, done. The page above the list also has filter buttons to view by status, with
     live counts.
   - Research: add new entry, edit date/title/description/image/full details/link, remove
   - Contact: title, description, email, label text, background
3. Edits happen in your browser's memory first — nothing is written anywhere yet. A **save
   bar** appears at the bottom of the screen showing unsaved-changes status.
4. Edits **persist across pages** for the session: if you edit something on the Team page,
   then click over to Research, your Team edit is still pending and still shows in the
   save bar — you don't have to save before navigating. This is new versus the original
   single-page site (which only ever had one page to lose track of).
5. Click **Save changes (permanent)** to POST everything to your Worker's `/save` endpoint,
   which commits the updated `data.json` (and any newly uploaded images, as base64) straight
   to your GitHub repo. **Discard** clears all pending edits and reloads the live version.
6. **Log out** ends your session but does *not* discard unsaved edits — you can log back in
   and pick up where you left off, as long as you're still in the same browser tab/session.

### Required setup before admin mode will work

Open `site.js` and find this line near the top:

```js
const ADMIN_API_BASE = "https://nirvana-biotech-admin.rajindra04.workers.dev";
```

Replace it with **your own deployed Worker's URL** if it's different from this default
(yours already matches, so no change needed for you specifically).

The Worker itself needs these secrets/variables set in Cloudflare — see `WRANGLER_GUIDE.md`
for exact commands:

- `ADMIN_PASSWORD` — the password admins type into the login box
- `GITHUB_TOKEN` — a GitHub personal access token with `contents:write` on this repo
- `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_BRANCH` — which repo/branch to commit to
- `SESSION_SECRET` — any random string, used to sign login session tokens
- `ALLOWED_ORIGIN` — your site's real origin (`https://nirvanabiotech.org`), not `*`,
  not the GitHub Pages URL

**This `worker.js` adds a `/verify` route** that didn't exist in the version you deployed
before — the client now confirms a stored login token is still valid with the server on
every page load, instead of just trusting whatever's sitting in browser storage. You must
redeploy this exact `worker.js`, not only the config file, for that fix to take effect.

### A note on multi-page vs. the original single page

The original admin system lived entirely on one page, so "unsaved changes" only ever meant
"things I changed on this page, right now." Across eight pages, that same mental model
would silently lose edits the moment you navigated away — so this version stores pending
edits (and pending image uploads) in the browser's `sessionStorage` and re-applies them on
every page load until you Save or Discard. Closing the tab or browser clears anything
unsaved, same as before.

## The two new pages

**Collaborators** (`collaborators.html`) — a mixed list of people and organizations:
partner researchers, advisors, sponsoring institutions. Each card shows a circular
photo-or-logo, name, affiliation/role, a short description, and an optional "Visit" link.
The "Type" field is a fixed picker so the data stays clean for future filtering if you ever
want it.

**Projects** (`projects.html`) — grant/initiative tracking, separate from Research (which
is for write-ups of completed experiments). Each project has a status
(Ongoing / Completed / Planned, shown as a colored pill), plus optional funder, amount, and
duration fields for grant-style record-keeping. The filter bar above the list lets you (or
any visitor) narrow to one status, with live counts per status. Click a row for the same
full-detail popup pattern as Research/Innovations.

## Adding your real images

The original repo's `data.json` pointed at files inside `images/`:

- `images/logo.png`
- `images/home-bg.jpg`
- `images/team-0...jpg`, `images/team-1...webp` (and so on for each team member)
- `images/innovations-1...png`, `images/innovations-2...png`

Copy your actual files from the old repo's `images/` folder into this project's `images/`
folder, then update the matching `imageUrl` / `logoUrl` fields in `data.json` to point at
the exact filenames. Until you do, pages fall back automatically to placeholder images so
nothing breaks or shows a broken-image icon. Once admin mode is set up, you can also just
upload new images directly through the edit pencils instead of doing this by hand.

## Deploying

Push this folder's contents to the root of your `nirvanabiotech.github.io` repo (replacing
`index.html`, `data.json`, and `worker.js`'s deployment target if changed; adding the new
`.html` files, `styles.css`, and `site.js`). GitHub Pages will serve it as-is. Deploy
`worker.js` to Cloudflare Workers separately (it's backend infrastructure, not a static
site file) and point `ADMIN_API_BASE` in `site.js` at it as described above.

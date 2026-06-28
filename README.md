# Nirvana Biotech — Multipage Site

A from-scratch multipage rebuild of the original single-page `nirvanabiotech.github.io`,
restructured so each nav item is its own real page (like fiftyfive5.com/work), while keeping
all the original content and functionality.

## Structure

```
index.html         Home
about.html          About
innovations.html    Innovations (click a card → detail modal)
team.html           Team
research.html       Research (click a row → detail modal)
contact.html        Contact form
styles.css          Shared design system (one file, all pages)
site.js             Shared behavior: data loading, nav, modal, signature "trace" graphic
data.json           All editable content — edit this, not the HTML, to change copy
images/             Drop your real photos here (see below)
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
   next to it — text fields, images, and whole card/row entries (add or remove items in
   Innovations, Team, Research, and the two About-page card grids).
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

Replace it with **your own deployed Worker's URL**. The Worker itself (the script you
shared) needs three environment variables/secrets set in Cloudflare:

- `ADMIN_PASSWORD` — the password admins type into the login box
- `GITHUB_TOKEN` — a GitHub personal access token with `contents:write` on this repo
- `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_BRANCH` — which repo/branch to commit to
- `SESSION_SECRET` — any random string, used to sign login session tokens
- `ALLOWED_ORIGIN` (optional) — restrict CORS to your site's origin instead of `*`

If you deploy the Worker with `wrangler` and these are already set from before, you likely
only need to update the URL in `site.js` — the Worker code itself doesn't need to change,
since this rebuild uses the exact same `/login` and `/save` request/response shape as the
original site did.

### A note on multi-page vs. the original single page

The original admin system lived entirely on one page, so "unsaved changes" only ever meant
"things I changed on this page, right now." Across six pages, that same mental model would
silently lose edits the moment you navigated away — so this version stores pending edits
(and pending image uploads) in the browser's `sessionStorage` and re-applies them on every
page load until you Save or Discard. Closing the tab or browser clears anything unsaved,
same as before.

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

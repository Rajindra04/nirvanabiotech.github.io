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
- **Navigation**: top bar (responsive, collapses to a full-screen mobile menu) plus a fixed
  left-hand page index rail on wide screens — same wayfinding idea as fiftyfive5's site,
  adapted to 6 pages instead of 3 capability pillars.

## Editing content

Open `data.json`. Everything text-based lives there: hero copy, about-page focus areas,
innovations, team members, research entries, contact copy. No HTML editing required for
routine updates.

To add a new innovation or research entry, copy the shape of an existing object in that
array — the pages render whatever is in the array automatically.

## Adding your real images

The original repo's `data.json` pointed at files inside `images/`:

- `images/logo.png`
- `images/home-bg.jpg`
- `images/team-0...jpg`, `images/team-1...webp` (and so on for each team member)
- `images/innovations-1...png`, `images/innovations-2...png`

Copy your actual files from the old repo's `images/` folder into this project's `images/`
folder, then update the matching `imageUrl` / `logoUrl` fields in `data.json` to point at
the exact filenames. Until you do, pages fall back automatically to placeholder images so
nothing breaks or shows a broken-image icon.

## What was intentionally left out

The original site had a password-protected "admin edit mode" wired to a Cloudflare Worker
(`worker.js`) that committed changes back to GitHub. That live-editing-and-auto-commit
system is specific infrastructure (a deployed Worker + GitHub token) rather than a frontend
design choice, so it wasn't rebuilt here. If you want that back, the original `worker.js` /
`wrangler.toml` from your repo should still work against this new multipage front end with
light adaptation — ask if you'd like help wiring it back in.

## Deploying

Same as before: push this folder's contents to the root of your `nirvanabiotech.github.io`
repo (replacing `index.html` and `data.json`, adding the new `.html` files, `styles.css`,
and `site.js`). GitHub Pages will serve it as-is.

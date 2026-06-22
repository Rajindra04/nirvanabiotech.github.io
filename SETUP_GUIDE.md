# Nirvana Biotech — Permanent Admin Editing Setup

This adds a working admin login + live editing system to your site. Unlike before,
saved changes are committed directly to your GitHub repo, so they're permanent and
visible to everyone — not just stored in your browser.

## How it works

- `index.html` — the site itself. Now has an ADMIN button, edit pencils on every
  text field and image once logged in, and a Save bar.
- `worker.js` — a small backend (Cloudflare Worker) that holds your GitHub token and
  admin password as secrets. The website calls this Worker; the Worker calls GitHub.
  Your token never touches the browser, so it can't be stolen via "view source."
- `wrangler.toml` — config for deploying the Worker.

```
Browser (index.html) → Cloudflare Worker (worker.js) → GitHub API → your repo
                         (holds secrets)                  (commits data.json /images)
```

---

## Step 1 — Install the Cloudflare CLI (Wrangler)

You need Node.js installed first (https://nodejs.org). Then:

```bash
npm install -g wrangler
wrangler login
```

This opens a browser window to log into (or create) a free Cloudflare account.

## Step 2 — Set up the Worker project

Put `worker.js` and `wrangler.toml` in their own folder, e.g.:

```
admin-backend/
  worker.js
  wrangler.toml
```

Open `wrangler.toml` and edit the `[vars]` section to match your repo:

```toml
[vars]
GITHUB_OWNER = "Rajindra04"
GITHUB_REPO = "nirvanabiotech.github.io"
GITHUB_BRANCH = "main"
ALLOWED_ORIGIN = "https://rajindra04.github.io"
```

`ALLOWED_ORIGIN` should be the exact URL your site is served from (no trailing slash).
If you're using a custom domain, put that instead.

## Step 3 — Add your secrets (never written to any file)

From inside the `admin-backend` folder, run each of these. You'll be prompted to
paste the value — it will not be echoed or saved in any file:

```bash
wrangler secret put ADMIN_PASSWORD
# paste the password you want to use to log into the admin panel

wrangler secret put GITHUB_TOKEN
# paste your GitHub Personal Access Token (needs "repo" / contents write access)

wrangler secret put SESSION_SECRET
# paste any long random string — this just signs login sessions, e.g.
# run: openssl rand -hex 32   (then paste the output)
```

**About your GitHub token:** make sure it's a **fine-grained token** scoped only to
this one repo with **Contents: Read and write** permission — not a token with
broad access to all your repos. If you ever suspect it's exposed, revoke it
immediately from GitHub → Settings → Developer settings → Personal access tokens.

## Step 4 — Deploy the Worker

```bash
wrangler deploy
```

This prints a URL like:

```
https://nirvana-biotech-admin.<your-subdomain>.workers.dev
```

Copy that exact URL.

## Step 5 — Point index.html at your Worker

Open `index.html`, find this line near the admin JS section (search for `ADMIN_API_BASE`):

```js
const ADMIN_API_BASE = "https://nirvana-biotech-admin.YOUR-SUBDOMAIN.workers.dev";
```

Replace it with the real URL from Step 4. Save the file.

## Step 6 — Commit and push

Replace your repo's `index.html` with this new version (commit it normally, the
regular way you already push to GitHub — this one file doesn't need the Worker to
update itself, only to save future *content* edits).

```bash
git add index.html
git commit -m "Add permanent admin editing"
git push
```

Wait ~30–60 seconds for GitHub Pages to rebuild, then visit your live site.

---

## Using it

1. Click **ADMIN** (top right) → enter your password.
2. Pencil icons and "Change" buttons appear next to every text field and image.
3. Edit anything — it updates instantly in your browser as a preview.
4. Click **Save Changes (Permanent)** in the bottom bar.
5. Wait ~30–60 seconds — GitHub Pages rebuilds, and the change is now live for
   everyone, permanently, committed to your repo's history.
6. Click **Discard** any time before saving to throw away unsaved edits.
7. Click **LOGOUT** when done.

Every save creates a real git commit, so you always have full history and can revert
any change from GitHub if needed.

## Notes & limits

- Image uploads are sent as base64 and committed as real files in `/images/`, so
  there's no separate storage service to manage.
- Very large images will slow down saves — consider compressing images before
  upload (under ~1–2MB each is comfortable).
- The admin session lasts 4 hours, then you'll need to log in again.
- If "Save" ever returns "Unauthorized," just log in again — your session expired.

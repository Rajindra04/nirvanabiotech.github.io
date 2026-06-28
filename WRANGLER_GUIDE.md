# Deploying the Worker with Wrangler — step by step

This walks through getting `worker.js` actually live on Cloudflare, with the corrected
`wrangler.toml` (the file that fixes the CORS bug causing "Login does nothing").

## 0. What you need first

- Node.js installed (check with `node -v` in a terminal — anything reasonably recent works)
- The `worker.js` and `wrangler.toml` files from this package, in their own folder
  (e.g. a folder called `nirvana-admin-worker/`)
- A GitHub **personal access token** with permission to write to your repo
  (`Settings → Developer settings → Personal access tokens → Fine-grained tokens`,
  grant it `Contents: Read and write` on the `nirvanabiotech.github.io` repo)

## 1. Put the two files in their own folder

```
nirvana-admin-worker/
  worker.js
  wrangler.toml
```

Open a terminal, `cd` into that folder.

## 2. Log in to Cloudflare via Wrangler

```bash
npx wrangler login
```

This opens a browser tab asking you to authorize Wrangler against your Cloudflare account.
Click **Allow**. (`npx` runs the latest Wrangler without installing anything globally —
simplest path if you don't already have it installed.)

Verify it worked:

```bash
npx wrangler whoami
```

## 3. Set your secrets (passwords/tokens — never go in `wrangler.toml`)

Each of these will prompt you to type/paste the value — it won't be echoed back or stored
in any file:

```bash
npx wrangler secret put ADMIN_PASSWORD
```
→ type the password you want to use to log into the site's admin mode, press Enter.

```bash
npx wrangler secret put GITHUB_TOKEN
```
→ paste the GitHub personal access token from step 0.

```bash
npx wrangler secret put SESSION_SECRET
```
→ type any random string (e.g. mash the keyboard for 30+ characters) — this just signs
login session tokens, you'll never need to type it again anywhere.

## 4. Deploy

```bash
npx wrangler deploy
```

You should see output ending in something like:

```
Uploaded nirvana-biotech-admin (x.xx sec)
Deployed nirvana-biotech-admin triggers (x.xx sec)
  https://nirvana-biotech-admin.rajindra04.workers.dev
```

That URL should match what's already set as `ADMIN_API_BASE` in `site.js`
(`https://nirvana-biotech-admin.rajindra04.workers.dev`) — if Wrangler prints a
**different** URL, copy it and update `ADMIN_API_BASE` in `site.js` to match exactly,
then redeploy the website files too.

## 5. Confirm the fix actually took

```bash
npx wrangler secret list
```

should list `ADMIN_PASSWORD`, `GITHUB_TOKEN`, `SESSION_SECRET` (names only, values stay
hidden — that's expected).

Then check the non-secret config actually deployed:

```bash
npx wrangler deployments list
```

If you want to be extra sure CORS is fixed, run this from a terminal (replace the password):

```bash
curl -i -X POST https://nirvana-biotech-admin.rajindra04.workers.dev/login \
  -H "Content-Type: application/json" \
  -H "Origin: https://nirvanabiotech.org" \
  -d '{"password":"your-admin-password"}'
```

Look for `access-control-allow-origin: https://nirvanabiotech.org` in the response
headers, and a JSON body containing a `token`. If you see that, the Worker side is fixed
and any remaining login issue is on the website side (stale cached files — hard refresh,
or the new HTML/CSS/JS genuinely wasn't pushed yet).

## 6. Re-test from the actual site

Go to `https://nirvanabiotech.org`, hard-refresh (Ctrl+Shift+R / Cmd+Shift+R to bypass
cache), click **Admin**, enter the password from step 3. You should see a "Log in"
network request succeed and edit pencils appear.

## If something still doesn't work

Open DevTools (F12) → **Console** tab → click Login again → read the red error text.
The three most likely messages and what they mean:

- `CORS policy: No 'Access-Control-Allow-Origin'...` → the Worker hasn't redeployed yet
  with the fixed `wrangler.toml`, or you're testing from a URL that doesn't exactly match
  `ALLOWED_ORIGIN` (e.g. `www.nirvanabiotech.org` vs `nirvanabiotech.org` — these count as
  different origins)
- `Failed to fetch` / network error → `ADMIN_API_BASE` in `site.js` doesn't match your
  real Worker URL, or the Worker isn't deployed at all yet
- `401` / "Invalid password" → wrong password, or `ADMIN_PASSWORD` secret wasn't actually
  set before deploying

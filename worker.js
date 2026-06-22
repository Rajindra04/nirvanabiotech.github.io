/**
 * Nirvana Biotech — Admin Backend (Cloudflare Worker)
 * ----------------------------------------------------
 * This Worker is the ONLY place that holds your GitHub token and admin
 * password. The website itself (index.html) never sees these secrets —
 * it just calls this Worker over HTTPS.
 *
 * Responsibilities:
 *   1. POST /login  -> checks the admin password, returns a short-lived session token
 *   2. POST /save   -> verifies the session token, then commits an updated
 *                      data.json (and/or new images) to the GitHub repo
 *                      using the GitHub REST API.
 *
 * SECRETS (set these with `wrangler secret put <NAME>`, never hard-code them):
 *   ADMIN_PASSWORD   - the shared admin password
 *   GITHUB_TOKEN     - a GitHub Personal Access Token with repo write access
 *   SESSION_SECRET   - any long random string, used to sign session tokens
 *
 * VARIABLES (set in wrangler.toml, not secret, just config):
 *   GITHUB_OWNER     - e.g. "Rajindra04"
 *   GITHUB_REPO      - e.g. "nirvanabiotech.github.io"
 *   GITHUB_BRANCH    - e.g. "main"
 *   ALLOWED_ORIGIN   - e.g. "https://rajindra04.github.io"
 */

const SESSION_TTL_SECONDS = 60 * 60 * 4; // 4 hours

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === "OPTIONS") {
      return corsResponse(env, new Response(null, { status: 204 }));
    }

    try {
      if (url.pathname === "/login" && request.method === "POST") {
        return corsResponse(env, await handleLogin(request, env));
      }
      if (url.pathname === "/save" && request.method === "POST") {
        return corsResponse(env, await handleSave(request, env));
      }
      return corsResponse(env, jsonResponse({ error: "Not found" }, 404));
    } catch (err) {
      console.error(err);
      return corsResponse(env, jsonResponse({ error: "Server error", detail: String(err) }, 500));
    }
  },
};

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------
async function handleLogin(request, env) {
  const body = await safeJson(request);
  const password = body?.password ?? "";

  if (!env.ADMIN_PASSWORD) {
    return jsonResponse({ error: "Server not configured (ADMIN_PASSWORD missing)" }, 500);
  }

  if (password !== env.ADMIN_PASSWORD) {
    return jsonResponse({ error: "Invalid password" }, 401);
  }

  const token = await createSessionToken(env);
  return jsonResponse({ token, expiresIn: SESSION_TTL_SECONDS });
}

// ---------------------------------------------------------------------------
// Save (commits to GitHub)
// ---------------------------------------------------------------------------
async function handleSave(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

  const valid = await verifySessionToken(token, env);
  if (!valid) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const body = await safeJson(request);
  if (!body) return jsonResponse({ error: "Invalid request body" }, 400);

  const { dataJson, images, commitMessage } = body;
  // dataJson: the full updated data.json object (optional if only uploading images)
  // images: optional array of { path: "images/foo.jpg", base64: "...." }
  // commitMessage: optional custom commit message

  if (!dataJson && !(Array.isArray(images) && images.length)) {
    return jsonResponse({ error: "Nothing to save" }, 400);
  }

  const results = {};

  // 1. Upload any new/changed images first, so we can reference their final paths.
  if (Array.isArray(images)) {
    for (const img of images) {
      if (!img.path || !img.base64) continue;
      await putFileOnGitHub(env, img.path, img.base64, true /* isBase64 */,
        commitMessage || `Admin: update image ${img.path}`);
      results[img.path] = "uploaded";
    }
  }

  // 2. Commit the updated data.json
  if (dataJson) {
    const content = btoa(unescape(encodeURIComponent(JSON.stringify(dataJson, null, 2))));
    await putFileOnGitHub(env, "data.json", content, false /* already base64 */,
      commitMessage || "Admin: update site content");
    results["data.json"] = "updated";
  }

  return jsonResponse({ ok: true, results });
}

/**
 * Create or update a file in the GitHub repo via the Contents API.
 * path:        repo-relative path, e.g. "data.json" or "images/team1.jpg"
 * content:     either raw base64 (if isBase64Already) or will be base64-encoded
 * isBase64Already: true if `content` param is already base64 (images sent from
 *                   the browser as base64 already)
 */
async function putFileOnGitHub(env, path, content, isBase64Already, message) {
  const apiUrl = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}`;

  // Get current file SHA if it exists (required by GitHub API to update a file)
  let sha;
  const getResp = await fetch(`${apiUrl}?ref=${env.GITHUB_BRANCH}`, {
    headers: githubHeaders(env),
  });
  if (getResp.ok) {
    const existing = await getResp.json();
    sha = existing.sha;
  }

  const contentBase64 = isBase64Already ? stripDataUrlPrefix(content) : content;

  const putResp = await fetch(apiUrl, {
    method: "PUT",
    headers: githubHeaders(env),
    body: JSON.stringify({
      message,
      content: contentBase64,
      branch: env.GITHUB_BRANCH,
      ...(sha ? { sha } : {}),
    }),
  });

  if (!putResp.ok) {
    const errText = await putResp.text();
    throw new Error(`GitHub API error for ${path}: ${putResp.status} ${errText}`);
  }

  return putResp.json();
}

function stripDataUrlPrefix(base64) {
  // Browser FileReader.readAsDataURL gives "data:image/png;base64,XXXX"
  const commaIdx = base64.indexOf(",");
  if (base64.startsWith("data:") && commaIdx !== -1) {
    return base64.slice(commaIdx + 1);
  }
  return base64;
}

function githubHeaders(env) {
  return {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    "User-Agent": "nirvana-biotech-admin-worker",
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  };
}

// ---------------------------------------------------------------------------
// Lightweight signed session tokens (HMAC), no external deps
// ---------------------------------------------------------------------------
async function createSessionToken(env) {
  const expires = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = `${expires}`;
  const sig = await hmacSign(payload, env.SESSION_SECRET);
  return `${payload}.${sig}`;
}

async function verifySessionToken(token, env) {
  if (!token || !token.includes(".")) return false;
  const [payload, sig] = token.split(".");
  const expectedSig = await hmacSign(payload, env.SESSION_SECRET);
  if (sig !== expectedSig) return false;
  const expires = parseInt(payload, 10);
  if (Number.isNaN(expires)) return false;
  return Math.floor(Date.now() / 1000) < expires;
}

async function hmacSign(message, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuffer = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function safeJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function corsResponse(env, response) {
  const allowOrigin = env.ALLOWED_ORIGIN || "*";
  response.headers.set("Access-Control-Allow-Origin", allowOrigin);
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return response;
}

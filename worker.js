var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

var SESSION_TTL_SECONDS = 60 * 60 * 4;
var worker_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // This fixes double slashes (//login -> /login) AND trailing slashes (/login/ -> /login)
    const path = url.pathname.replace(/\/+/g, "/").replace(/\/$/, "");

    if (request.method === "OPTIONS") {
      return corsResponse(env, new Response(null, { status: 204 }));
    }

    try {
      if (path === "/login" && request.method === "POST") {
        return corsResponse(env, await handleLogin(request, env));
      }
      if (path === "/save" && request.method === "POST") {
        return corsResponse(env, await handleSave(request, env));
      }
      
      return corsResponse(env, jsonResponse({ error: `Path [${path}] not found.` }, 404));
    } catch (err) {
      console.error(err);
      return corsResponse(env, jsonResponse({ error: "Server error", detail: String(err) }, 500));
    }
  }
};

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
__name(handleLogin, "handleLogin");

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
  if (!dataJson && !(Array.isArray(images) && images.length)) {
    return jsonResponse({ error: "Nothing to save" }, 400);
  }
  const results = {};
  if (Array.isArray(images)) {
    for (const img of images) {
      if (!img.path || !img.base64) continue;
      await putFileOnGitHub(
        env,
        img.path,
        img.base64,
        true,
        commitMessage || `Admin: update image ${img.path}`
      );
      results[img.path] = "uploaded";
    }
  }
  if (dataJson) {
    const content = btoa(unescape(encodeURIComponent(JSON.stringify(dataJson, null, 2))));
    await putFileOnGitHub(
      env,
      "data.json",
      content,
      false,
      commitMessage || "Admin: update site content"
    );
    results["data.json"] = "updated";
  }
  return jsonResponse({ ok: true, results });
}
__name(handleSave, "handleSave");

async function putFileOnGitHub(env, path, content, isBase64Already, message) {
  const apiUrl = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}`;
  let sha;
  
  // FIXED: Explicitly pass githubHeaders down here so GitHub doesn't drop the verification step or hand over a generic unauthenticated 404/old cache
  const getResp = await fetch(`${apiUrl}?ref=${env.GITHUB_BRANCH}`, {
    method: "GET",
    headers: githubHeaders(env)
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
      ...sha ? { sha } : {}
    })
  });
  if (!putResp.ok) {
    const errText = await putResp.text();
    throw new Error(`GitHub API error for ${path}: ${putResp.status} ${errText}`);
  }
  return putResp.json();
}
__name(putFileOnGitHub, "putFileOnGitHub");

function stripDataUrlPrefix(base64) {
  const commaIdx = base64.indexOf(",");
  if (base64.startsWith("data:") && commaIdx !== -1) {
    return base64.slice(commaIdx + 1);
  }
  return base64;
}
__name(stripDataUrlPrefix, "stripDataUrlPrefix");

function githubHeaders(env) {
  return {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    "User-Agent": "nirvana-biotech-admin-worker",
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json"
  };
}
__name(githubHeaders, "githubHeaders");

async function createSessionToken(env) {
  const expires = Math.floor(Date.now() / 1e3) + SESSION_TTL_SECONDS;
  const payload = `${expires}`;
  const sig = await hmacSign(payload, env.SESSION_SECRET);
  return `${payload}.${sig}`;
}
__name(createSessionToken, "createSessionToken");

async function verifySessionToken(token, env) {
  if (!token || !token.includes(".")) return false;
  const [payload, sig] = token.split(".");
  const expectedSig = await hmacSign(payload, env.SESSION_SECRET);
  if (sig !== expectedSig) return false;
  const expires = parseInt(payload, 10);
  if (Number.isNaN(expires)) return false;
  return Math.floor(Date.now() / 1e3) < expires;
}
__name(verifySessionToken, "verifySessionToken");

async function hmacSign(message, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuffer = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sigBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(hmacSign, "hmacSign");

async function safeJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
__name(safeJson, "safeJson");

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
__name(jsonResponse, "jsonResponse");

function corsResponse(env, response) {
  const allowOrigin = env.ALLOWED_ORIGIN || "*";
  response.headers.set("Access-Control-Allow-Origin", allowOrigin);
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return response;
}
__name(corsResponse, "corsResponse");

export {
  worker_default as default
};
//# sourceMappingURL=worker.js.map

import { defineMiddleware } from "astro:middleware";
import { env } from "cloudflare:workers";
import { createRemoteJWKSet, jwtVerify } from "jose";

/**
 * Defense in depth: Cloudflare Access already blocks unauthenticated traffic at
 * the edge, but every request is verified again here using the
 * `Cf-Access-Jwt-Assertion` header, so the Worker never trusts a request that
 * bypassed Access (e.g. a misconfigured route). Fails closed if Access is not
 * configured. Set AUTH_MODE=dev in .dev.vars to skip it locally.
 */
type Vars = { ACCESS_TEAM_DOMAIN?: string; ACCESS_AUD?: string; AUTH_MODE?: string; ALLOWED_EMAILS?: string };

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

async function verifyAccess(request: Request, vars: Vars): Promise<string | null> {
  const token = request.headers.get("cf-access-jwt-assertion");
  if (!token || !vars.ACCESS_TEAM_DOMAIN || !vars.ACCESS_AUD) return null;
  const issuer = `https://${vars.ACCESS_TEAM_DOMAIN}`;
  jwks ??= createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
  try {
    const { payload } = await jwtVerify(token, jwks, { issuer, audience: vars.ACCESS_AUD });
    const email = typeof payload.email === "string" ? payload.email.toLowerCase() : null;
    if (!email) return null;
    const allow = (vars.ALLOWED_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
    if (allow.length && !allow.includes(email)) return null;
    return email;
  } catch {
    return null;
  }
}

const UNSAFE = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export const onRequest = defineMiddleware(async (ctx, next) => {
  const vars = env as unknown as Vars;
  const { request, url } = ctx;

  if (vars.AUTH_MODE === "dev") {
    ctx.locals.user = "dev@localhost";
  } else {
    const user = await verifyAccess(request, vars);
    if (!user) return new Response("Forbidden", { status: 403 });
    ctx.locals.user = user;
  }

  // CSRF: state-changing API calls must come from this origin with a JSON body.
  if (url.pathname.startsWith("/api/") && UNSAFE.has(request.method)) {
    const origin = request.headers.get("origin");
    if (origin && origin !== url.origin) return new Response("Bad origin", { status: 403 });
    const type = request.headers.get("content-type") ?? "";
    if (request.method !== "DELETE" && !type.startsWith("application/json")) {
      return new Response("Content-Type must be application/json", { status: 415 });
    }
  }

  const res = await next();
  res.headers.set("x-content-type-options", "nosniff");
  res.headers.set("referrer-policy", "same-origin");
  res.headers.set("x-frame-options", "DENY");
  res.headers.set("x-robots-tag", "noindex, nofollow");
  return res;
});

// Cloudflare Worker entry point.
//
// Two jobs:
//   /api/*  -> forwarded to the FastAPI backend on Render, with the /api prefix removed.
//   everything else -> the built React app from ./dist
//
// The forwarding happens here, on Cloudflare's servers, not in the browser, so the browser
// only ever talks to this Worker over HTTPS: no mixed content and no CORS.
//
// This mirrors the Vite dev proxy in vite.config.ts, so the frontend code is identical
// in development and in production: it always calls /api/...
//
// The backend address is the BACKEND_ORIGIN setting in wrangler.jsonc.
// A hostname is needed, not an IP: Cloudflare Workers cannot fetch a raw IP address (error 1003).

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      const target = new URL(env.BACKEND_ORIGIN);
      target.pathname = url.pathname.replace(/^\/api/, "") || "/";
      target.search = url.search;

      // Copies the method, headers (Authorization included) and body as they are.
      const forwarded = new Request(target.toString(), request);
      // The backend sees Cloudflare, not the employee. Pass the real address on: the attendance
      // office-network check needs it (the backend must have TRUST_PROXY_HEADERS=true).
      // It replaces any X-Forwarded-For sent by the browser, so it cannot be faked.
      const clientIp = request.headers.get("CF-Connecting-IP");
      if (clientIp) {
        forwarded.headers.set("X-Forwarded-For", clientIp);
      }

      try {
        return await fetch(forwarded);
      } catch (error) {
        return new Response(
          JSON.stringify({ detail: "The API could not be reached.", code: "upstream_unreachable" }),
          { status: 502, headers: { "Content-Type": "application/json" } },
        );
      }
    }

    return env.ASSETS.fetch(request);
  },
};

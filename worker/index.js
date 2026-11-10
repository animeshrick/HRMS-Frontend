// Cloudflare Worker entry point.
//
// Two jobs:
//   /api/*  -> forwarded to the FastAPI backend on AWS, with the /api prefix removed.
//   everything else -> the built React app from ./dist
//
// The forwarding happens here, on Cloudflare's servers, not in the browser. That is
// what makes an HTTPS page able to use an HTTP backend: the browser only ever talks
// to this Worker over HTTPS, so there is no mixed content and no CORS.
//
// This mirrors the Vite dev proxy in vite.config.ts, so the frontend code is identical
// in development and in production: it always calls /api/...

const BACKEND_ORIGIN = "http://13.239.26.128";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      const target = new URL(BACKEND_ORIGIN);
      target.pathname = url.pathname.replace(/^\/api/, "") || "/";
      target.search = url.search;

      // Copies the method, headers (Authorization included) and body as they are.
      const forwarded = new Request(target.toString(), request);

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

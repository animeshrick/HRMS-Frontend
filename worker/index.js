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

// A hostname, not an IP: Cloudflare Workers cannot fetch a raw IP address.
// Doing so returns Cloudflare error 1003 ("direct IP access not allowed"),
// because the request gets routed back into Cloudflare's own edge.
// AWS gives every instance this public DNS name for free, and it resolves to
// the same 13.239.26.128. If the instance is ever stopped and started, the IP
// changes and this hostname changes with it.
const BACKEND_ORIGIN = "http://ec2-13-239-26-128.ap-southeast-2.compute.amazonaws.com";

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

// Serves dist-demo/ the way the demo is meant to be deployed.
//
//   node scripts/serve-demo.mjs [--port 4173] [--dir dist-demo] [--base /factory-command-center/]
//
// Dependency-free (node:http only), because the point of the demo build is that
// it is a static artifact — proving that should not require installing a server.
//
// This doubles as the DEPLOYMENT SPEC. Any static host will do, but it has to
// get three things right, and each one fails in a different, confusing way:
//
//  1. BASE PATH. The bundle is built with base '/factory-command-center/', so
//     every asset URL is absolute under that prefix. Serving the directory at
//     '/' makes the page load and then 404 every script.
//
//  2. SPA FALLBACK. The app uses createBrowserRouter, so /alerts/ack and
//     /quality/defect/XYZ are client-side routes with no file behind them. A
//     host without a fallback returns 404 on a deep link or a refresh. The
//     fallback must serve index.html with a 200 and must NOT apply to
//     /demo-data/ or /assets/ — a missing fixture has to 404 honestly, or the
//     loader receives index.html and fails parsing it as JSON.
//
//  3. CORRECT MIME TYPES, in particular application/json for the fixtures and
//     application/javascript for the modules.
//
// Equivalent nginx:
//
//   location /factory-command-center/ {
//     alias /srv/demo/;
//     try_files $uri $uri/ /factory-command-center/index.html;
//   }
//   location ~ ^/factory-command-center/(demo-data|assets)/ {
//     alias /srv/demo/;
//     try_files $uri =404;            # never fall back for data or assets
//   }

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const argOf = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const PORT = Number(argOf("port", "4173"));
const DIR = path.resolve(argOf("dir", "dist-demo"));
const BASE = argOf("base", "/factory-command-center/");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".map": "application/json; charset=utf-8",
};

/** Paths that must never fall back to index.html. */
const NO_FALLBACK = /^\/(demo-data|assets)\//;

const send = (res, status, body, type, extra = {}) => {
  res.writeHead(status, { "Content-Type": type, ...extra });
  res.end(body);
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  let pathname = decodeURIComponent(url.pathname);

  // Anything outside the base path is not ours.
  if (!pathname.startsWith(BASE)) {
    if (pathname === "/" || pathname === BASE.replace(/\/$/, "")) {
      return send(res, 302, "", "text/plain", { Location: BASE });
    }
    return send(res, 404, "Not found (outside base path)", "text/plain");
  }

  const rel = pathname.slice(BASE.length) || "index.html";

  // Reject traversal before touching the filesystem.
  const abs = path.resolve(DIR, rel);
  if (!abs.startsWith(DIR)) {
    return send(res, 403, "Forbidden", "text/plain");
  }

  try {
    const info = await stat(abs);
    if (info.isDirectory()) throw new Error("dir");
    const body = await readFile(abs);
    const type = TYPES[path.extname(abs).toLowerCase()] ?? "application/octet-stream";
    return send(res, 200, body, type, { "Content-Length": info.size });
  } catch {
    // Data and assets 404 honestly — see note 2 at the top.
    if (NO_FALLBACK.test(`/${rel}`)) {
      return send(res, 404, JSON.stringify({ error: "not found", path: rel }), TYPES[".json"]);
    }
    // Everything else is a client-side route: serve the shell.
    try {
      const shell = await readFile(path.join(DIR, "index.html"));
      return send(res, 200, shell, TYPES[".html"]);
    } catch {
      return send(res, 500, `No index.html in ${DIR}. Run: npm run build:demo`, "text/plain");
    }
  }
});

server.listen(PORT, () => {
  console.log(`serving ${path.relative(process.cwd(), DIR)} at http://localhost:${PORT}${BASE}`);
  console.log(`  SPA fallback on, except /demo-data/ and /assets/ (they 404)`);
});

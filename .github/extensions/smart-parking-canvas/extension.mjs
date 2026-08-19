/**
 * Smart Parking Navigator – Copilot canvas extension entry point.
 *
 * The renderer spawns a loopback HTTP server on an ephemeral port and
 * tears it down when the canvas closes, as required by the canvas SDK.
 */

import http from "node:http";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Sample parking data (runs without the Aspire back-end)
// ---------------------------------------------------------------------------
const SAMPLE_DATA = {
  updatedAt: new Date().toISOString(),
  source: "HDB Data.gov.sg (sample)",
  carparks: [
    {
      id: "ACB",
      address: "BLK 270/271 ALBERT CENTRE BASEMENT CAR PARK",
      lots: { available: 189, total: 360, type: "C" },
      distance: 0.3,
    },
    {
      id: "ACM",
      address: "BLK 98A ALJUNIED CRESCENT",
      lots: { available: 42, total: 120, type: "C" },
      distance: 0.7,
    },
    {
      id: "BJ1",
      address: "BLK 50/51 BRAS BASAH COMPLEX",
      lots: { available: 0, total: 88, type: "C" },
      distance: 1.1,
    },
    {
      id: "AM48",
      address: "BLK 501/502 ANG MO KIO AVENUE 8",
      lots: { available: 310, total: 450, type: "C" },
      distance: 1.4,
    },
    {
      id: "C12",
      address: "BLK 120 CLEMENTI ROAD",
      lots: { available: 5, total: 200, type: "C" },
      distance: 2.1,
    },
    {
      id: "MC1",
      address: "MARINA CENTRE SHOPPING MALL",
      lots: { available: 78, total: 150, type: "Y" },
      distance: 0.9,
    },
  ],
};

// ---------------------------------------------------------------------------
// State shared across requests within a single canvas instance
// ---------------------------------------------------------------------------
const state = {
  destination: "City Hall, Singapore",
  filter: "all",
  data: SAMPLE_DATA,
};

// ---------------------------------------------------------------------------
// HTML escaping – prevents XSS if sample data is ever replaced with live data
// ---------------------------------------------------------------------------
function esc(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---------------------------------------------------------------------------
// HTML renderer
// ---------------------------------------------------------------------------
function buildHtml(currentState) {
  const { destination, filter, data } = currentState;

  const filtered = data.carparks.filter((cp) => {
    if (filter === "available") return cp.lots.available > 0;
    if (filter === "cars") return cp.lots.type === "C";
    if (filter === "motorcycles") return cp.lots.type === "Y";
    if (filter === "heavy") return cp.lots.type === "H";
    return true;
  });

  const rows = filtered
    .map((cp) => {
      const pct = Math.round((cp.lots.available / cp.lots.total) * 100);
      const statusClass =
        cp.lots.available === 0
          ? "status-full"
          : pct < 20
          ? "status-low"
          : "status-ok";
      const label =
        cp.lots.available === 0 ? "Full" : `${cp.lots.available} / ${cp.lots.total}`;
      const typeLabel =
        cp.lots.type === "C"
          ? "Cars"
          : cp.lots.type === "Y"
          ? "Motorcycles"
          : cp.lots.type === "H"
          ? "Heavy"
          : cp.lots.type;

      return `
      <tr>
        <td class="cp-id">${esc(cp.id)}</td>
        <td class="cp-addr">${esc(cp.address)}</td>
        <td class="cp-type">${esc(typeLabel)}</td>
        <td class="cp-lots ${statusClass}" aria-label="${esc(label)} lots available">${esc(label)}</td>
        <td class="cp-dist">${cp.distance.toFixed(1)} km</td>
      </tr>`;
    })
    .join("");

  const filterOptions = ["all", "available", "cars", "motorcycles", "heavy"]
    .map(
      (f) =>
        `<option value="${f}"${f === filter ? " selected" : ""}>${
          f.charAt(0).toUpperCase() + f.slice(1)
        }</option>`
    )
    .join("");

  const freshness = new Date(data.updatedAt).toLocaleTimeString("en-SG", {
    timeZone: "Asia/Singapore",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Smart Parking Navigator</title>
<style>
  /* ---- Copilot canvas semantic theme tokens ---- */
  :root {
    color-scheme: light dark;
  }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: var(--vscode-font-family, system-ui, sans-serif);
    font-size: var(--vscode-font-size, 13px);
    background: var(--vscode-editor-background, #1e1e1e);
    color: var(--vscode-editor-foreground, #d4d4d4);
    padding: 12px 16px;
    min-height: 100vh;
  }

  h1 {
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--vscode-titleBar-activeForeground, #cccccc);
    margin-bottom: 8px;
  }

  .destination {
    font-size: 0.85rem;
    color: var(--vscode-descriptionForeground, #9d9d9d);
    margin-bottom: 12px;
  }

  .controls {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
    margin-bottom: 12px;
  }

  .controls label {
    font-size: 0.8rem;
    color: var(--vscode-descriptionForeground, #9d9d9d);
  }

  select {
    background: var(--vscode-dropdown-background, #3c3c3c);
    color: var(--vscode-dropdown-foreground, #f0f0f0);
    border: 1px solid var(--vscode-dropdown-border, #3c3c3c);
    border-radius: 3px;
    padding: 3px 6px;
    font-size: 0.8rem;
    cursor: pointer;
  }
  select:focus {
    outline: 2px solid var(--vscode-focusBorder, #007fd4);
    outline-offset: 1px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8rem;
  }
  thead th {
    text-align: left;
    padding: 4px 6px;
    color: var(--vscode-descriptionForeground, #9d9d9d);
    border-bottom: 1px solid var(--vscode-panel-border, #2b2b2b);
    font-weight: 600;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  tbody tr {
    border-bottom: 1px solid var(--vscode-panel-border, #2b2b2b);
  }
  tbody tr:hover {
    background: var(--vscode-list-hoverBackground, #2a2d2e);
  }
  tbody tr:focus-within {
    outline: 2px solid var(--vscode-focusBorder, #007fd4);
    outline-offset: -2px;
  }
  td {
    padding: 5px 6px;
    vertical-align: middle;
  }
  .cp-id {
    font-weight: 600;
    color: var(--vscode-textLink-foreground, #3794ff);
    white-space: nowrap;
  }
  .cp-addr {
    max-width: 260px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .cp-type {
    white-space: nowrap;
    color: var(--vscode-descriptionForeground, #9d9d9d);
  }
  .cp-lots {
    white-space: nowrap;
    font-weight: 600;
  }
  .status-ok  { color: var(--vscode-testing-iconPassed, #73c991); }
  .status-low { color: var(--vscode-problemsWarningIcon-foreground, #cca700); }
  .status-full { color: var(--vscode-testing-iconFailed, #f14c4c); }
  .cp-dist {
    white-space: nowrap;
    color: var(--vscode-descriptionForeground, #9d9d9d);
    text-align: right;
  }

  .empty {
    padding: 16px;
    text-align: center;
    color: var(--vscode-descriptionForeground, #9d9d9d);
  }

  footer {
    margin-top: 10px;
    font-size: 0.75rem;
    color: var(--vscode-descriptionForeground, #9d9d9d);
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 4px;
  }
</style>
</head>
<body>
  <h1>Smart Parking Navigator</h1>
  <p class="destination" aria-label="Selected destination">📍 ${esc(destination)}</p>

  <form class="controls" method="GET" action="/filter" aria-label="Filter car parks">
    <label for="filter-select">Filter:</label>
    <select id="filter-select" name="filter" aria-label="Vehicle or availability filter"
            onchange="this.form.submit()">
      ${filterOptions}
    </select>
  </form>

  ${
    rows
      ? `<table role="grid" aria-label="Car park availability near ${esc(destination)}">
    <thead>
      <tr>
        <th scope="col">ID</th>
        <th scope="col">Address</th>
        <th scope="col">Type</th>
        <th scope="col">Lots</th>
        <th scope="col">Distance</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`
      : `<p class="empty" role="status">No car parks match the current filter.</p>`
  }

  <footer>
    <span>Source: ${esc(data.source)}</span>
    <span aria-label="Data freshness">Updated: ${esc(freshness)} SGT</span>
  </footer>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// HTTP server (loopback only, ephemeral port)
// ---------------------------------------------------------------------------
let server = null;

function createServer() {
  server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://127.0.0.1`);

    // Restrict CORS to same loopback origin; the canvas iframe is served from
    // this same server so no cross-origin requests are expected from untrusted origins.
    const origin = req.headers["origin"];
    if (origin) {
      try {
        const originUrl = new URL(origin);
        if (originUrl.hostname === "127.0.0.1" || originUrl.hostname === "localhost") {
          res.setHeader("Access-Control-Allow-Origin", origin);
          res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
          res.setHeader("Access-Control-Allow-Headers", "Content-Type");
          res.setHeader("Vary", "Origin");
        }
      } catch {
        // Invalid origin header – omit CORS headers
      }
    }

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // Filter change
    if (url.pathname === "/filter" && req.method === "GET") {
      const f = url.searchParams.get("filter");
      if (["all", "available", "cars", "motorcycles", "heavy"].includes(f)) {
        state.filter = f;
      }
      res.writeHead(302, { Location: "/" });
      res.end();
      return;
    }

    // State JSON (used by canvas actions)
    if (url.pathname === "/state" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ destination: state.destination, filter: state.filter }));
      return;
    }

    // Action endpoint: setDestination
    if (url.pathname === "/action/setDestination" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        try {
          const { destination } = JSON.parse(body);
          if (typeof destination !== "string" || destination.trim().length === 0) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "destination must be a non-empty string" }));
            return;
          }
          state.destination = destination.trim();
          state.data = { ...SAMPLE_DATA, updatedAt: new Date().toISOString() };
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true, destination: state.destination }));
        } catch {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid JSON" }));
        }
      });
      return;
    }

    // Action endpoint: setFilter
    if (url.pathname === "/action/setFilter" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        try {
          const { filter } = JSON.parse(body);
          const valid = ["all", "available", "cars", "motorcycles", "heavy"];
          if (!valid.includes(filter)) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                error: `filter must be one of: ${valid.join(", ")}`,
              })
            );
            return;
          }
          state.filter = filter;
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true, filter: state.filter }));
        } catch {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid JSON" }));
        }
      });
      return;
    }

    // Default: serve canvas HTML
    if (url.pathname === "/" || url.pathname === "") {
      const html = buildHtml(state);
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  });

  // Bind to loopback only
  server.listen(0, "127.0.0.1");
  return server;
}

// ---------------------------------------------------------------------------
// Canvas SDK lifecycle hooks
// ---------------------------------------------------------------------------

/** Called when the canvas is opened. Returns the renderer URL. */
export async function onOpen(context) {
  if (!server) {
    createServer();
  }
  await new Promise((resolve) => {
    if (server.listening) return resolve();
    server.once("listening", resolve);
  });
  const { port } = server.address();
  return { url: `http://127.0.0.1:${port}/` };
}

/** Called when the canvas is closed. Shuts down the HTTP server. */
export async function onClose(context) {
  if (server) {
    await new Promise((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve()))
    );
    server = null;
  }
}

/** Called when a declared canvas action is invoked. */
export async function onAction(context, actionName, input) {
  if (actionName === "setDestination") {
    const { destination } = input;
    if (typeof destination !== "string" || destination.trim().length === 0) {
      throw new Error("destination must be a non-empty string");
    }
    state.destination = destination.trim();
    state.data = { ...SAMPLE_DATA, updatedAt: new Date().toISOString() };
    return { ok: true, destination: state.destination };
  }

  if (actionName === "setFilter") {
    const valid = ["all", "available", "cars", "motorcycles", "heavy"];
    if (!valid.includes(input.filter)) {
      throw new Error(`filter must be one of: ${valid.join(", ")}`);
    }
    state.filter = input.filter;
    return { ok: true, filter: state.filter };
  }

  throw new Error(`Unknown action: ${actionName}`);
}

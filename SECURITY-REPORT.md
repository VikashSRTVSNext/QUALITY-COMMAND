# Security Report — Factory Command Center

**Date:** 2026-07-16
**Reviewer:** Automated security review (Claude Code)
**Scope:** `d:\Projects\Nokia` (React 19 + Vite dashboard)

---

## Finding: Cross-Site Scripting (XSS) via vulnerable `echarts` dependency

| Field | Value |
|-------|-------|
| **Severity** | Moderate (CVSS 3.1: 6.1 — `AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N`) |
| **Category** | CWE-79 — Improper Neutralization of Input During Web Page Generation |
| **Advisory** | [GHSA-fgmj-fm8m-jvvx](https://github.com/advisories/GHSA-fgmj-fm8m-jvvx) |
| **Component** | `echarts` (direct production dependency) |
| **Installed** | `^5.5.1` (vulnerable) |
| **Fixed in** | `6.1.0` |
| **Status** | Ships to production (used in bundle) |

### What it is

Apache ECharts versions `< 6.1.0` contain a stored/reflected XSS vulnerability. ECharts
renders certain option fields (labels, tooltips, rich-text formatters) into the DOM. When
attacker-controlled strings reach those fields, script can execute in the victim's browser.
Because `echarts` is a **direct `dependencies` entry** (not dev-only), the vulnerable code
is bundled and shipped to every user of the dashboard.

### Why this app is exposed

The vulnerability becomes exploitable when **untrusted data** flows into an ECharts chart
option. This project has exactly such a data path:

1. `src/core/websocket/SocketManager.ts` receives server messages and forwards the raw
   `payload` to subscriber callbacks **without any validation or sanitization**:

   ```ts
   // SocketManager.ts:33-44
   const parsed = JSON.parse(event.data);
   const callbacks = this.subscriptionRegistry.get(parsed.channel);
   if (callbacks) {
     callbacks.forEach(callback => callback(parsed.payload));  // raw, untrusted
   }
   ```

2. Charts are initialized in `src/modules/bottomPanels/components/BottomPanels.tsx`
   (`echarts.init` / `chart.setOption` at lines ~575, ~753, ~873). Today these panels
   are fed **static/local data**, so the flaw is *latent* rather than actively exploitable.
   The moment any WebSocket/API-sourced string (a line name, alert label, material ID,
   tooltip value, etc.) is passed into a chart's `series.name`, `axis.data`, `tooltip`,
   or a `formatter`, the vulnerability is directly reachable.

A compromised or malicious upstream service — or anyone able to inject a crafted WebSocket
message — could deliver a payload that runs JavaScript in the operator's browser session
on the factory dashboard.

### Impact

- Execution of arbitrary JavaScript in the dashboard operator's browser.
- Session/UI hijacking, exfiltration of anything the page can read, pivoting to internal
  factory/OT network endpoints the browser can reach.
- Scope-changed (`S:C`) — script escapes the chart component into the whole page context.

### Remediation

**Primary — upgrade the dependency (fixes the CVE):**

```bash
npm install echarts@^6.1.0
```

> Note: `6.x` is a **major** version bump. Review the ECharts 5→6 migration notes and
> smoke-test the three chart panels in `BottomPanels.tsx` after upgrading.

**Defense in depth (do these regardless of the upgrade):**

1. **Validate WebSocket payloads** in `SocketManager.ts` before dispatching — enforce an
   expected schema/shape and reject/strip unexpected fields, rather than forwarding
   `parsed.payload` verbatim.
2. **Never place untrusted strings** into ECharts `formatter`, `tooltip.formatter`, or
   rich-text fields. Prefer callback formatters that return plain text; avoid HTML strings.
3. **Add a Content-Security-Policy** (e.g. a `<meta http-equiv="Content-Security-Policy">`
   in `index.html`, or a server header) that disallows inline script, to blunt XSS impact.

---

## Additional vulnerabilities (from `npm audit`)

These are **dev-tooling only** (not shipped to production), but should still be patched:

| Package | Severity | Advisory | Notes |
|---------|----------|----------|-------|
| `vite` (`<=6.4.2`) | **High** | GHSA-fx2h-pf6j-xcff | `server.fs.deny` bypass on Windows alternate paths; also path-traversal (GHSA-4w7w-66w2-5vf9) and NTLMv2 hash disclosure via UNC paths (GHSA-v6wh-96g9-6wx3). Dev server only. |
| `esbuild` (`<=0.24.2`) | Moderate | GHSA-67mh-4wv8-2f99 | Any website can send requests to the dev server and read responses. Dev server only. |

**Fix:** `npm install vite@latest` (major bump — pulls a patched esbuild transitively).
Until upgraded, do **not** run `vite dev` on an untrusted network and keep the dev server
bound to localhost.

---

## Summary

| # | Finding | Severity | Ships to prod? | Fix | Status |
|---|---------|----------|----------------|-----|--------|
| 1 | `echarts` XSS (CWE-79) | Moderate | **Yes** | `echarts@^6.1.0` + validate socket data | ✅ **Fixed** |
| 2 | `vite` fs.deny bypass / path traversal | High | No (dev) | `vite@latest` | ⬜ Open (dev-only) |
| 3 | `esbuild` dev-server request exposure | Moderate | No (dev) | via `vite@latest` | ⬜ Open (dev-only) |

**Recommended priority:** Finding #1 first — it is the only one that reaches end users,
and the app already has an unsanitized untrusted-data path (`SocketManager`) that can feed it.

---

## Remediation applied (2026-07-16)

- **Finding #1 — Fixed.** Upgraded `echarts` `^5.5.1 → ^6.1.0` (patched, no longer flagged
  by `npm audit`). Production build verified (`npm run build` succeeds, all 3 chart panels
  compile). Added defense-in-depth payload validation to
  `src/core/websocket/SocketManager.ts`: non-string frames are ignored, malformed JSON is
  dropped, and frames are structurally validated (`isValidFrame`) before dispatch, so
  untrusted/malformed data never reaches subscribers.
- **Findings #2 & #3 — Open.** `vite`/`esbuild` are dev-tooling only and the fix is a major
  version bump (`vite@latest`); deferred to avoid destabilizing the build toolchain. Until
  then, run the dev server bound to localhost only and not on untrusted networks.

**Still recommended (not yet done):** add a Content-Security-Policy to `index.html`, and
keep untrusted strings out of any ECharts `formatter`/`tooltip`/rich-text fields.

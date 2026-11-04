# Xtra DevPilot — AI-Compatibility & Control Roadmap

Goal: make the extension + MCP a **rock-solid, local, secure bridge** between a browser and an external LLM — no LLM embedded in the tool itself. Everything below is transport/observation/control; the intelligence stays in the client.

Status legend: ✅ done · 🔨 in progress · ⬜ planned

---

## The big lever — CDP transport (chrome.debugger)

Today input is synthetic DOM events and page-world eval, which fails on canvas/maps/drag apps and is blocked by strict CSP. Routing input + eval + capture through the Chrome DevTools Protocol fixes a whole class of issues at once.

- ⬜ **Input via `Input.dispatchMouseEvent` / `dispatchKeyEvent` / `dispatchTouchEvent`** — real trusted input; works on canvas, maps, drag-libraries, iframes, shadow DOM.
- ✅ **CSP-proof eval fallback via `Runtime.evaluate`** (lands on CSP error today; make it the primary path next).
- ⬜ **Screenshots via `Page.captureScreenshot`** — true compositor output, element/rect + full-page capture, background tab without activating or stealing focus. Kills the stale/wrong-surface/focus-steal/150ms issues together.
- ⬜ Keep the current synthetic path as a no-permission fallback.

---

## Tier 1 — Reliability

- ✅ Pointer-event sequences in `mouse_action` (DOM path) — `pointerover/enter/down/move/up` + mouse, so canvas apps register clicks/drags.
- ✅ `capture_screenshot` no longer steals focus / sleeps 150ms when tab is already active.
- ✅ **`wait_for` primitive** — selector/state, JS predicate, URL-includes, network-idle; per-condition timeouts. (MCP tool + content handler.)
- ✅ **Atomic `batch_execute`** — runs every step, waits for each element, per-step `{index,action,ok,error}` results, `stopOnError`, per-step `waitMs`; supports click/type/select/check/scroll/wait. (Was silently skipping not-yet-present elements.)
- ⬜ **Bridge resilience** — heartbeat + auto-reconnect + in-flight request queue; `get_bridge_status` tool.
- ✅ **Structured errors** — `{code, message, hint}` (BRIDGE_DISCONNECTED / NO_ACTIVE_TAB / TAB_NOT_FOUND / TIMEOUT / RESTRICTED_PAGE / CSP_BLOCKED) instead of raw stacks.
- ✅ **`durationMs` on every object tool result** — observability / latency measurement.

## Tier 2 — AI-ergonomics

- ⬜ **Ref-based targeting** — every read returns stable `ref` ids; `click`/`type`/`assert` accept `ref`; resolver by role+name+text with self-healing across re-renders.
- ⬜ **Fused perception tool** — one call: screenshot + trimmed AX tree + interactive-element list (coords + refs), optional diff-since-last-snapshot, token-budgeted.
- ⬜ **`get_app_context` framework adapter** — auto-detect React/Vue fiber, Redux/Zustand/Pinia, tldraw/canvas engines; return a **stable handle + state snapshot** (replaces per-call fiber-walking, which is brittle and orphans on remounts).
- ✅ **`tabId` on `get_network_logs` / `get_console_logs` / `get_web_vitals`** (were active-tab only).

## Tier 3 — Power features

- ⬜ **Observe/subscribe streams** — watch console/network/DOM-mutations/JS-condition; return deltas (generalize `trace_action`).
- ⬜ **Record → replay → assert** — turn `record_user_flow` into parameterized replayable macros + generated assertions.
- ⬜ **Checkpoint/restore app state** (via adapter) + surface uncaught page errors as a tool signal (so the agent knows the page died vs. a blank screenshot).
- ⬜ **Full `Fetch`-domain interception** — modify req/res, inject headers, throttle, block, fault-inject (extends `mock_network_response`).
- ⬜ **Visual grounding** — screenshot + coordinate grid + CDP click-by-pixel for canvas/game/map UIs.

## Tier 4 — Safety / guardrails

- ⬜ Confirmation layer for destructive/outward actions (submit/purchase/send/delete), domain allowlist, readable action audit log. (Formalize the Stop badge into policy.)

---

## Reverse-engineering suite (from The Verge test — see `re-theverge/REPORT.md`)

- ✅ **`extract_api_endpoints`**: summary-only MCP output + full spec/catalog persisted to disk; static-asset filtering (js/map/css/img/font/media); host grouping (`servers`); first/third-party tagging; method counts. *(Verified: Verge HAR 179→95 endpoints, 8 first-party vs 87 third-party, 66 hosts.)*
- ✅ **`reconstruct_source_tree`**: broadened tech-stack detection (Webpack/Turbopack/npm/Angular/jQuery/…), added `topPackages`, renamed the confusing `extractedModulesCount` to `fallbackExtractedModulesCount`, added `sourceMapsFound`/`reconstructedFileCount` + a human `note`. *(Verified on Verge: now reports ["Webpack","npm packages"] + core-js/@voxmedia/identity-library, note explains recovery.)*
- ⬜ **`export_rea_evidence`**: make cookie/storage capture opt-in or redacted (sensitive on authenticated targets); populate `limitations`.
- ⬜ Add `durationMs` to all RE tools.

---

## Done so far (committed)
- `perf(extension)`: pointer events, screenshot speed, CSP eval fallback, 50ms element poll.
- `fix(rea)`: `extract_api_endpoints` filtering + summary + host grouping.
- `feat`: `wait_for` tool, atomic `batch_execute`, structured errors + `durationMs`, `tabId` on logs/vitals, `reconstruct_source_tree` reporting. manifest v1.2.0.

## Testing note
New **extension** code (anything touching `extension/*`) only takes effect after the unpacked extension is **reloaded in Chrome** (and the new `debugger` permission accepted) and the **MCP server restarted**. Node-side changes (`mcp-server/*`, `src/*`) are testable immediately.

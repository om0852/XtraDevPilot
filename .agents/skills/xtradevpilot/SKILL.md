---
name: xtradevpilot
description: >-
  Definitive expert runbook for controlling, automating, inspecting, debugging, and reverse engineering
  web applications using Xtra DevPilot in real authenticated Google Chrome. Covers both MCP Tool calling
  and Universal CLI execution. Use this skill whenever the user or task involves browser interaction,
  form automation, DOM inspection, CSS debugging, deterministic QA, Playwright test generation,
  network mocking, cookie/storage control, web scraping, or full-stack reverse engineering.
---

# Xtra DevPilot — Real-Browser AI Automation, Inspection & Engineering Runbook

**Xtra DevPilot** connects AI coding agents (Antigravity, Claude, Cursor, Copilot) directly to your **real, authenticated Google Chrome browser** via the Model Context Protocol (MCP) and a local sub-12ms WebSocket bridge (`ws://127.0.0.1:42819`).

Because Xtra DevPilot operates inside your live Chrome session where your actual logins, cookies, sessions, corporate SSO, and extensions reside, it completely bypasses Cloudflare bot protection, CAPTCHAs, and headless detection.

---

## 🚀 Dual Interaction Modes: MCP Tools vs Universal CLI

Agents can drive Xtra DevPilot using either **Direct MCP Tool Calls** or the **Universal Terminal CLI**:

```
[ AI Coding Agent / IDE ]
    │
    ├── 1. MCP Protocol: call_mcp_tool (Server: xtradevpilot, Tool: ...)
    └── 2. Shell Command: run_command ("npx xtradevpilot <cmd> [flags] --json")
            │
            ▼
[ Local WebSocket Bridge: ws://127.0.0.1:42819 ]
            │
            ▼
[ Real Google Chrome (MV3 Extension) — Authenticated Session ]
```

- **In Antigravity / Cursor / Claude Desktop**: Call native MCP tools directly (e.g. `get_clean_dom_snapshot`, `batch_fill_form`, `assert_element_state`).
- **In Shell / CI / Terminal / Subagents**: Run `npx xtradevpilot <command> [args] [--json]`.

---

## 🛠️ Adding This Skill to Any IDE

### 1. Google Antigravity
Place this file in either:
- **Workspace-scoped**: `<project-root>/.agents/skills/xtradevpilot/SKILL.md`
- **Global-scoped**: `~/.gemini/config/skills/xtradevpilot/SKILL.md` (Active across all your projects)

Or run the 1-click CLI initializer:
```bash
npx xtradevpilot init-skill
```

### 2. Cursor IDE
Create `.cursor/rules/xtradevpilot.mdc` or add to `.cursorrules`:
```markdown
---
description: Real-Browser automation, inspection, and reverse engineering with Xtra DevPilot
globs: *
---
Always leverage Xtra DevPilot for browser automation, DOM inspection, form filling, and QA.
- Run CLI: `npx xtradevpilot <command> --json`
- Prioritize `get_clean_dom_snapshot` or `npx xtradevpilot dom --clean` for token efficiency.
- For form automation, use `batch_fill_form` or `npx xtradevpilot fill`.
- For state inspection, evaluate in MAIN world via `execute_script` or `npx xtradevpilot eval`.
```
Or run:
```bash
npx xtradevpilot init-skill --target cursor
```

### 3. Claude Desktop
Add to `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "xtradevpilot": {
      "command": "npx",
      "args": ["-y", "xtradevpilot-mcp"]
    }
  }
}
```

---

## 🌟 The 10 Core Superpowers of Xtra DevPilot

Xtra DevPilot is a **comprehensive developer & agent cockpit**. It is purpose-built for 10 distinct operational domains:

---

### Domain 1: Multi-Tab & Window Control
Drive multiple open tabs simultaneously without closing the user's active session.
- **MCP Tools**: `list_tabs`, `open_tab`, `navigate`, `get_tab_info`, `set_viewport_size`
- **CLI Commands**: `npx xtradevpilot tabs`, `open <url>`, `goto <url>`, `tab-info`, `status`
- **Best Practice**: Always check `list_tabs` first to locate the tab ID of the application you want to inspect or test.

---

### Domain 2: Token-Optimized DOM Inspection (-94% Tokens)
Never dump the full raw DOM into an LLM context. Modern web apps produce hundreds of thousands of tokens of SVG paths and stylesheets.
- **MCP Tools**: `get_clean_dom_snapshot`, `highlight_element`, `wait_for_user_click`, `capture_screenshot`
- **CLI Commands**: `npx xtradevpilot dom --clean [--selector <sel>]`, `screenshot -o <path>`
- **Golden Rule**: **ALWAYS** use `get_clean_dom_snapshot` with a `rootSelector` (e.g. `'main'`, `'form'`, `'#checkout'`). It strips bloated inline SVGs, style tags, and noisy attributes, slashing context size from 60,000+ tokens down to ~1,200 tokens.
- **Visual Pencil Mode**: `wait_for_user_click` pauses execution until the developer clicks an element in Chrome, returning its computed CSS styles, tag tree, and classnames.

---

### Domain 3: High-Speed Batch Form Automation (<200ms)
Sequential input typing is slow and fragile. Xtra DevPilot batch-fills complex multi-step forms in a single sub-200ms roundtrip.
- **MCP Tools**: `batch_fill_form`, `smart_select_combobox`, `upload_file`, `click_element`, `type_text`, `scroll_page`, `wait_for_element`
- **CLI Commands**: `npx xtradevpilot fill <jsonFile|jsonString>`, `combobox <sel> <option>`, `upload <filePath>`, `click <sel>`, `type <sel> <text>`
- **Synthetic Event Engine**: `batch_fill_form` uses native `HTMLInputElement.prototype` property setters to ensure React (React Hook Form, Formik), Vue, and Svelte component state managers detect changes instantly.
```json
// Example: batch_fill_form actions array
[
  { "selector": "#fullName", "value": "Jane Doe", "action": "type" },
  { "selector": "#email", "value": "jane@company.com", "action": "type" },
  { "selector": "#planTier", "value": "enterprise", "action": "select" },
  { "selector": "#agreeTerms", "action": "check" },
  { "selector": "#submitBtn", "action": "click", "waitMs": 200 }
]
```

---

### Domain 4: Modern Searchable Comboboxes & ARIA Dropdowns
Enterprise portals (Workday, Greenhouse, Phenom, Salesforce) avoid native `<select>` tags in favor of custom ARIA popovers.
- **MCP Tool**: `smart_select_combobox`
- **CLI Command**: `npx xtradevpilot combobox <triggerSelector> <optionText> [--search <query>]`
- **Workflow**: Automatically clicks the combobox trigger, waits for the popover menu, types the search query into the search filter, and clicks the matching item.

---

### Domain 5: Direct File Uploads & Drag-and-Drop
Attach resumes, documents, and assets without interacting with operating system file dialogues.
- **MCP Tool**: `upload_file`
- **CLI Command**: `npx xtradevpilot upload <filePath> [--selector <sel>]`
- **Workflow**: Reads the local file, converts it into a synthetic `File` blob, constructs a synthetic `DataTransfer` object, and dispatches `change`, `input`, and `drop` events directly on the target element.

---

### Domain 6: Live State & Runtime JS Evaluation (MAIN World)
Standard extensions run in an `ISOLATED` world and cannot touch page variables. Xtra DevPilot bridges into the page's **`MAIN` execution context**.
- **MCP Tool**: `execute_script`
- **CLI Command**: `npx xtradevpilot eval <javascript>`
- **Store Access**: Inspect live state directly:
  ```javascript
  // Access Redux store
  return window.__REDUX_STORE__?.getState();

  // Access Zustand store
  return window.__ZUSTAND_STORE__?.getState();

  // Check auth tokens in memory
  return window.sessionStorage.getItem("auth_jwt");
  ```
- **Auto-IIFE**: Any return statement is automatically wrapped into an async Immediately Invoked Function Expression.

---

### Domain 7: Visual Styling & CSS Hot-Patching
Diagnose layout flaws and preview style fixes live in the browser without reloading.
- **MCP Tools**: `inject_css`, `toggle_layout_debug_mode`
- **CLI Commands**: `npx xtradevpilot inject-css <cssString>`, `npx xtradevpilot debug-layout`
- **Layout Debug Mode**: Instantly injects high-contrast red outline boxes around all block containers to uncover margin collapse, flexbox alignment flaws, and horizontal scrollbar leaks.
- **CSS Injection**: Preview visual fixes dynamically before modifying code in your workspace:
  ```bash
  npx xtradevpilot inject-css ".hero-badge { display: none !important; }"
  ```

---

### Domain 8: Deterministic QA & 1-Click Playwright Test Synthesis
Verify UI states deterministically and synthesize ready-to-commit end-to-end test suites.
- **MCP Tools**: `assert_element_state`, `record_user_flow`, `run_security_audit`, `run_accessibility_audit`
- **CLI Commands**: `npx xtradevpilot assert <sel> <cond> [exp]`, `record <start|stop|status>`, `audit <security|a11y>`
- **Deterministic Assertions**: Supports conditions:
  - `is_visible`, `is_hidden`
  - `is_enabled`, `is_disabled`
  - `contains_text <expected>`
  - `has_value <expected>`
  - `has_attribute <attrName>`
- **Playwright Test Synthesis**: Run `record start`, click around in Chrome, then run `record stop` — Xtra DevPilot compiles the session into a clean `.spec.ts` test script with accurate selectors and assertions.

---

### Domain 9: Network Interception & Storage / Persona Switching
Intercept network traffic, mock backends, and switch user accounts instantly.
- **MCP Tools**: `mock_network_response`, `clear_network_mocks`, `get_network_logs`, `get_console_logs`, `get_web_vitals`, `manage_storage_and_cookies`
- **CLI Commands**: `npx xtradevpilot network [--limit <n>]`, `console`, `storage <local|session|cookie> <op>`
- **Network Mocking**: Mock API endpoints without spin-up of backends:
  ```javascript
  mock_network_response({
    urlPattern: "*/api/v1/user/profile",
    status: 200,
    responseBody: { id: "usr_123", role: "admin", name: "Mocked Admin" }
  });
  ```
- **Persona Switching**: Seamlessly get, set, or clear cookies and storage to toggle between Admin, User, and Unauthenticated states.

---

### Domain 10: Universal Web Scraping & Structured Extraction
Scrape structured datasets from dynamic, JavaScript-rendered web pages.
- **MCP Tools**: `extract_structured_data`, `extract_job_details`
- **CLI Commands**: Available via CLI `dom` and `eval`
- **Table & Card Scraper**: Automatically identifies tables (`<table>`), grids, and cards, extracting row headers, column values, and pagination data into typed JSON.
- **ATS Job Parser**: Special heuristic parser extracting title, company, location, requirements, salary, and application URLs from Workday, Greenhouse, Lever, and LinkedIn.

---

### Domain 11: Autonomous Reverse Engineering & Code Recovery (REA)
Disassemble frontend applications, recover unminified source code, and generate OpenAPI specifications.
- **MCP Tools**: `download_sources`, `reconstruct_source_tree`, `extract_api_endpoints`, `export_rea_evidence`, `download_page_html`, `export_har`, `trace_action_network`
- **CLI Commands**: `npx xtradevpilot download-sources`, `reconstruct`, `extract-endpoints`, `export-rea`, `trace-action`, `download-html`, `export-har`

#### The 4-Step Reverse Engineering Sequence:
```bash
# 1. Download client JS bundles, CSS & sourcemaps
npx xtradevpilot download-sources -o ./sources

# 2. Reconstruct original React/TypeScript source files from sourcemaps
npx xtradevpilot reconstruct ./sources -o ./src

# 3. Discover REST endpoints and generate OpenAPI 3.0 specification
npx xtradevpilot extract-endpoints ./sources -o openapi.json

# 4. Export complete authenticated forensic evidence bundle
npx xtradevpilot export-rea -o session-evidence.json
```

---

## 📖 Dual Command Rosetta Stone (MCP Tool vs CLI)

| Capability / Action | Native MCP Tool Call | Universal Terminal CLI Command |
| :--- | :--- | :--- |
| **Check Connection** | `get_tab_info` | `npx xtradevpilot status` |
| **List Open Tabs** | `list_tabs` | `npx xtradevpilot tabs [--json]` |
| **Open New Tab** | `open_tab({ url })` | `npx xtradevpilot open <url>` |
| **Navigate Tab** | `navigate({ url, tabId })` | `npx xtradevpilot goto <url>` |
| **Inspect Clean DOM** | `get_clean_dom_snapshot({ rootSelector })` | `npx xtradevpilot dom --clean [-s <sel>]` |
| **Capture Screenshot** | `capture_screenshot({ tabId })` | `npx xtradevpilot screenshot [-o <path>]` |
| **Click Element** | `click_element({ selector })` | `npx xtradevpilot click <selector>` |
| **Type Text** | `type_text({ selector, text })` | `npx xtradevpilot type <selector> <text>` |
| **Batch Form Fill** | `batch_fill_form({ actions })` | `npx xtradevpilot fill <jsonFile\|jsonStr>` |
| **Select Combobox** | `smart_select_combobox({ triggerSelector, optionText })` | `npx xtradevpilot combobox <trigger> <opt>` |
| **Upload Local File** | `upload_file({ filePath, selector })` | `npx xtradevpilot upload <filePath>` |
| **Run QA Assertion** | `assert_element_state({ selector, condition, expected })` | `npx xtradevpilot assert <sel> <cond> [exp]` |
| **Evaluate Main JS** | `execute_script({ script })` | `npx xtradevpilot eval <javascript>` |
| **Record Playwright** | `record_user_flow({ action: 'start'\|'stop' })` | `npx xtradevpilot record <start\|stop>` |
| **Security/A11y Audit**| `run_security_audit` / `run_accessibility_audit` | `npx xtradevpilot audit <security\|a11y>` |
| **Network Logs** | `get_network_logs` | `npx xtradevpilot network [--limit <n>]` |
| **Console Logs** | `get_console_logs` | `npx xtradevpilot console [--limit <n>]` |
| **Cookies & Storage** | `manage_storage_and_cookies({ type, operation })` | `npx xtradevpilot storage <type> <op>` |
| **Inject Live CSS** | `inject_css({ cssString })` | `npx xtradevpilot inject-css <cssString>` |
| **Toggle Red Outlines**| `toggle_layout_debug_mode` | `npx xtradevpilot debug-layout` |
| **Harvest Sources** | `download_sources({ outputDir })` | `npx xtradevpilot download-sources -o <dir>` |
| **Reconstruct Code** | `reconstruct_source_tree({ inputDir, outputDir })` | `npx xtradevpilot reconstruct <in> -o <out>`|
| **Extract OpenAPI** | `extract_api_endpoints({ inputPath, outputPath })` | `npx xtradevpilot extract-endpoints <in> -o <out>` |
| **Export REA Evidence**| `export_rea_evidence({ outputPath })` | `npx xtradevpilot export-rea -o <path.json>` |
| **Trace UI Mutation** | `trace_action_network({ selector, action })` | `npx xtradevpilot trace-action <selector>` |
| **Download HTML** | `download_page_html({ outputPath, clean })` | `npx xtradevpilot download-html -o <path>` |
| **Export HAR 1.2** | `export_har({ outputPath })` | `npx xtradevpilot export-har -o <path>` |
| **Launch MCP Server** | Native MCP Stdio Handler | `npx xtradevpilot mcp` |

---

## 💡 Troubleshooting & FAQs

- **"Chrome extension is not currently connected to the bridge"**:
  1. Open Chrome and verify extension is loaded at `chrome://extensions/`.
  2. Click the Xtra DevPilot extension icon in the toolbar and click **Reconnect**.
  3. Verify the MCP server / CLI is running on port `42819`.
- **"Selector not found"**:
  - Run `get_clean_dom_snapshot` or `npx xtradevpilot dom --clean` to inspect the updated DOM tree.
  - Modern web apps frequently re-render dynamic IDs or class hashes; target ARIA roles (`[role="button"]`), names (`[name="email"]`), or semantic labels instead.

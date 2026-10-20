# Xtra DevPilot — Complete Tool Reference Catalog (37 Live Tools)

This document is the definitive technical reference for all tools exposed by the **Xtra DevPilot MCP Server** (`xtradevpilot-mcp` / `devpilot-bridge`).

---

## 1. 🗂️ Tabs & Window Management

### `list_tabs`
- **Description**: Returns a list of all open Chrome tabs with their unique tab IDs, window IDs, titles, URLs, and active/focused statuses.
- **Parameters**: None.
- **Returns**: Array of tab objects: `[{ id: 12345, title: "Google", url: "https://google.com", active: true, windowId: 1 }]`.
- **Usage**: Use first when connecting to locate the target tab ID or find an active web application.

### `open_tab`
- **Description**: Opens a new browser tab in Chrome and navigates immediately to the specified URL.
- **Parameters**:
  - `url` *(string, required)*: The URL to open (e.g. `"http://localhost:3000"` or `"https://github.com"`).
- **Returns**: Result object containing the new tab's ID and URL.

### `navigate`
- **Description**: Navigates an existing tab (or the active tab) to a new URL and waits for DOM readiness.
- **Parameters**:
  - `url` *(string, required)*: Target destination URL.
  - `tabId` *(number, optional)*: Specific Chrome tab ID. Omit to target the active tab.
- **Returns**: Success confirmation with updated tab URL and status.

### `get_tab_info`
- **Description**: Retrieves comprehensive metadata for the active or specified Chrome tab.
- **Parameters**:
  - `tabId` *(number, optional)*: Specific Chrome tab ID.
- **Returns**: Metadata including title, URL, viewport dimensions (`width`, `height`), favicon URL, and loading status (`complete`/`loading`).

### `set_viewport_size`
- **Description**: Resizes the Chrome window to test responsive design breakpoints.
- **Parameters**:
  - `width` *(number, required)*: Target width in pixels (e.g. `375` for mobile, `768` for tablet, `1440` for desktop).
  - `height` *(number, required)*: Target height in pixels (e.g. `812`, `1024`, `900`).
- **Returns**: Confirmation of the updated window dimensions.

---

## 2. 🔍 DOM & Visual Inspection

### `get_clean_dom_snapshot` *(Recommended for LLMs)*
- **Description**: Extracts an LLM-optimized representation of the DOM tree. Strips noisy SVG paths, inline styles, script tags, and comments to reduce context token usage by up to **94%**.
- **Parameters**:
  - `rootSelector` *(string, optional)*: Scopes the snapshot to a specific CSS subtree (e.g. `"form#application"`, `"main"`, `"#user-table"`).
  - `tabId` *(number, optional)*: Target Chrome tab ID.
- **Returns**: Clean, readable HTML string containing semantic tags, IDs, form inputs, ARIA attributes, and text content.
- **Best Practice**: Always use this instead of `get_dom_snapshot` to conserve context tokens and prevent context overflow.

### `get_dom_snapshot`
- **Description**: Returns the full, raw outerHTML of the webpage.
- **Parameters**:
  - `tabId` *(number, optional)*: Target Chrome tab ID.
- **Returns**: Complete unadulterated HTML string.
- **Caution**: Can exceed 100k+ tokens on heavy websites. Use only when low-level SVG or raw stylesheet tags are strictly required.

### `highlight_element`
- **Description**: Visually pulses a neon border around the target element on the user's screen and smoothly scrolls it into view.
- **Parameters**:
  - `selector` *(string, required)*: CSS selector of the element to highlight (e.g. `"#submit-btn"`, `"[data-testid='login']"`).
  - `tabId` *(number, optional)*: Target Chrome tab ID.
- **Returns**: Confirmation that the element was scrolled into view and highlighted.

### `wait_for_user_click`
- **Description**: Activates "Select Mode" (Pencil Tool). Pauses execution until the user visually clicks an element in the browser.
- **Parameters**: None.
- **Returns**: Detailed JSON containing:
  - `html`: Outer HTML of the clicked element.
  - `classes`: Array of CSS classes.
  - `computedStyles`: Key computed CSS properties (font, color, box-sizing, display, padding, margin).
  - `events`: Array of attached event listeners (e.g. `click`, `change`).

### `capture_screenshot`
- **Description**: Captures a visible viewport screenshot of the active browser tab.
- **Parameters**:
  - `tabId` *(number, optional)*: Target Chrome tab ID.
- **Returns**: String confirmation containing the absolute local path to the saved PNG image: `"Screenshot saved to: <workspace>/.devpilot-screenshot.png"`.

---

## 3. ⚡ High-Speed Form Automation & Interaction

### `batch_fill_form` *(Recommended for Forms)*
- **Description**: Fills multiple form fields in a single rapid roundtrip (<200ms). Dispatches React and Vue synthetic input events using native prototype property descriptors.
- **Parameters**:
  - `actions` *(array of objects, required)*:
    - `selector` *(string, required)*: CSS selector or element ID (e.g. `"#firstName"`, `"[name='email']"`).
    - `value` *(string, optional)*: Text value to type or select option.
    - `action` *(string, optional, enum: `'type' | 'select' | 'click' | 'check' | 'uncheck'`)*: Default is `'type'`.
    - `waitMs` *(number, optional)*: Optional delay before executing this specific action.
  - `tabId` *(number, optional)*: Target Chrome tab ID.
- **Returns**: Summary of completed actions and execution duration.

### `smart_select_combobox`
- **Description**: Intelligently handles custom searchable dropdowns (Workday, Greenhouse, ARIA comboboxes, headless UI, Tailwind comboboxes).
- **Parameters**:
  - `triggerSelector` *(string, required)*: CSS selector for the dropdown trigger button or container.
  - `optionText` *(string, required)*: Text label of the option to select (case-insensitive).
  - `searchQuery` *(string, optional)*: Text to type into the search filter input if needed.
  - `tabId` *(number, optional)*: Target Chrome tab ID.
- **Returns**: Confirmation of selection.

### `click_element`
- **Description**: Dispatches a simulated user click on an element with automatic polling wait and Tailwind-escaped selector resilience.
- **Parameters**:
  - `selector` *(string, required)*: CSS selector of the target element.
  - `timeoutMs` *(number, optional)*: Maximum time to wait for the element to be rendered and clickable (default: `3000`).
  - `tabId` *(number, optional)*: Target Chrome tab ID.

### `type_text`
- **Description**: Types text into an input or textarea using React-compatible state setters.
- **Parameters**:
  - `selector` *(string, required)*: CSS selector of the target input.
  - `text` *(string, required)*: Text to type.
  - `timeoutMs` *(number, optional)*: Maximum wait time in milliseconds (default: `3000`).
  - `tabId` *(number, optional)*: Target Chrome tab ID.

### `upload_file`
- **Description**: Attaches a local file (PDF, DOCX, image, text) directly to a file input or drag-and-drop zone.
- **Parameters**:
  - `filePath` *(string, required)*: Absolute or workspace-relative path to the local file (e.g. `"./resumes/Om_Salunke_Resume.pdf"`).
  - `selector` *(string, optional)*: CSS selector of the file input (defaults to `'input[type="file"]'`).
  - `tabId` *(number, optional)*: Target Chrome tab ID.
- **Returns**: File upload status with filename, size, and MIME type.

### `scroll_page`
- **Description**: Scrolls the page or an internal scrollable container.
- **Parameters**:
  - `direction` *(string, optional, enum: `'down' | 'up' | 'top' | 'bottom'`)*: Default is `'down'`.
  - `amount` *(number, optional)*: Scroll distance in pixels (default: `500`).
  - `scrollToSelector` *(string, optional)*: CSS selector of a specific element to scroll into view.
  - `containerSelector` *(string, optional)*: Selector of an inner scrollable container (defaults to window).
  - `smooth` *(boolean, optional)*: Enable smooth scrolling animation (default: `true`).
  - `tabId` *(number, optional)*: Target Chrome tab ID.

### `wait_for_element`
- **Description**: Observes DOM mutations until a selector satisfies the expected condition.
- **Parameters**:
  - `selector` *(string, required)*: CSS selector of the element.
  - `state` *(string, optional, enum: `'visible' | 'attached' | 'detached'`)*: Default is `'visible'`.
  - `timeoutMs` *(number, optional)*: Maximum wait time (default: `5000`).
  - `tabId` *(number, optional)*: Target Chrome tab ID.

---

## 4. 🛠️ Dev & QA Engineering

### `execute_script`
- **Description**: Evaluates arbitrary JavaScript in the page's **MAIN execution context**. Supports async functions and promises.
- **Parameters**:
  - `script` *(string, required)*: JavaScript code to evaluate. Statements starting with `return` are automatically wrapped in an IIFE.
    - Example: `"window.__REDUX_STORE__?.getState()"`
    - Example: `"return Array.from(document.querySelectorAll('a')).map(a => a.href)"`
  - `tabId` *(number, optional)*: Target Chrome tab ID.
- **Returns**: JSON-serialized return value of the evaluated script.

### `assert_element_state`
- **Description**: Deterministic QA assertion tool with structured pass/fail reporting.
- **Parameters**:
  - `selector` *(string, required)*: CSS selector to assert.
  - `condition` *(string, required, enum: `'is_visible' | 'is_hidden' | 'is_enabled' | 'is_disabled' | 'contains_text' | 'has_value' | 'has_attribute'`)*.
  - `expected` *(string, optional)*: Expected string for `contains_text`, `has_value`, or attribute name for `has_attribute`.
  - `tabId` *(number, optional)*: Target Chrome tab ID.
- **Returns**: Assertion result object: `{ passed: true/false, selector: "...", condition: "...", actual: "...", error: null }`.

### `record_user_flow`
- **Description**: Records live user actions (clicks, typing, navigations) and compiles them into a ready-to-run Playwright test script (`.spec.ts`).
- **Parameters**:
  - `action` *(string, required, enum: `'start' | 'stop' | 'status'`)*.
  - `tabId` *(number, optional)*: Target Chrome tab ID.
- **Returns**:
  - `'start'`: Recording active confirmation.
  - `'stop'`: Complete Playwright test script formatted in TypeScript.

### `inject_css`
- **Description**: Injects raw CSS rules into the active tab without page reload.
- **Parameters**:
  - `cssString` *(string, required)*: Raw CSS string (e.g. `".sidebar { display: none !important; }"`).
- **Returns**: Confirmation with injected style element ID.

### `toggle_layout_debug_mode`
- **Description**: Toggles high-contrast red outlines (`outline: 1px solid rgba(255, 0, 0, 0.7)`) on all DOM elements to instantly diagnose flexbox, grid, and overflow issues.
- **Parameters**: None.
- **Returns**: Status message (`"Layout debug mode enabled"` or `"disabled"`).

---

## 5. 🕷️ Web Scraping & Data Extraction

### `extract_structured_data`
- **Description**: Extracts structured data from HTML `<table>` elements, lists, or repeated card grids into clean JSON.
- **Parameters**:
  - `targetSelector` *(string, optional)*: CSS selector of the table, list, or container element.
  - `type` *(string, optional, enum: `'auto' | 'table' | 'cards' | 'list'`)*: Extraction mode (default: `'auto'`).
  - `itemSelector` *(string, optional)*: Selector for cards in a grid (e.g. `".product-card"`, `"[data-testid='item']"`).
  - `tabId` *(number, optional)*: Target Chrome tab ID.
- **Returns**: Clean JSON array of objects representing rows or card data.

### `extract_job_details`
- **Description**: Intelligently parses ATS job postings across Workday, Phenom, Greenhouse, Lever, and LinkedIn.
- **Parameters**:
  - `tabId` *(number, optional)*: Target Chrome tab ID.
- **Returns**: Structured JSON:
  - `title`: Job title.
  - `company`: Company name.
  - `location`: Job location.
  - `reqId`: Requisition / Job ID.
  - `platform`: Detected ATS system.
  - `descriptionSummary`: Parsed requirements & qualifications.
  - `applyUrl`: Direct application URL.

---

## 6. 🩺 Diagnostics, Security & State

### `get_console_logs`
- **Description**: Retrieves recent console logs (`error`, `warn`, `info`, `log`) from the active browser tab.
- **Parameters**: None.
- **Returns**: Array of timestamped log entries with message, level, and stack traces.

### `get_network_logs`
- **Description**: Retrieves recent HTTP network requests made by the active browser tab.
- **Parameters**: None.
- **Returns**: Array of request objects with URL, HTTP method, status code, response time, and content type.

### `get_web_vitals`
- **Description**: Extracts Core Web Vitals and performance timings from the Chrome Performance API.
- **Parameters**: None.
- **Returns**: Metrics including LCP (Largest Contentful Paint), CLS (Cumulative Layout Shift), FCP (First Contentful Paint), and DOM load timings.

### `run_security_audit`
- **Description**: Audits the active page for client-side security vulnerabilities.
- **Parameters**: None.
- **Returns**: Audit report checking:
  - Insecure HTTP connections / mixed content.
  - Forms submitting to insecure endpoints.
  - Plain-text JWT tokens, API keys, or secrets leaked into `localStorage` or `sessionStorage`.

### `run_accessibility_audit`
- **Description**: Scans the page for WCAG accessibility (a11y) violations.
- **Parameters**: None.
- **Returns**: List of violations including missing `alt` attributes, unlabelled buttons/links, and skipped heading levels (`<h1>` -> `<h3>`).

### `get_storage`
- **Description**: Returns a complete snapshot of `localStorage`, `sessionStorage`, and readable cookies for the current domain.
- **Parameters**: None.
- **Returns**: JSON object with storage keys and values.

### `manage_storage_and_cookies`
- **Description**: Performs CRUD operations on browser cookies, `localStorage`, and `sessionStorage`.
- **Parameters**:
  - `type` *(string, required, enum: `'cookie' | 'local_storage' | 'session_storage'`)*.
  - `operation` *(string, required, enum: `'get' | 'get_all' | 'set' | 'remove' | 'clear'`)*.
  - `name` *(string, optional)*: Cookie name or storage key.
  - `value` *(string, optional)*: Value to store.
  - `url` *(string, optional)*: URL for cookie operations.
  - `domain` *(string, optional)*: Domain for cookie operations.
  - `tabId` *(number, optional)*: Target Chrome tab ID.

### `mock_network_response`
- **Description**: Intercepts `window.fetch` requests matching a URL pattern and returns a mock JSON response without reaching the backend.
- **Parameters**:
  - `urlPattern` *(string, required)*: Substring or regex to match against fetch URLs (e.g. `"/api/v1/user"`).
  - `responseBody` *(string, required)*: JSON string of mock response.
  - `status` *(number, optional)*: HTTP status code (default: `200`).

### `clear_network_mocks`
- **Description**: Removes all active network mocks and restores default network behavior.
- **Parameters**: None.

### `reload_extension`
- **Description**: Reloads the Xtra DevPilot Chrome extension background service worker and re-establishes the bridge connection.
- **Parameters**: None.

---

## 7. 📦 Asset, Source & Traffic Archiving

### `download_page_html`
- **Description**: Downloads the live hydrated DOM or an isolated feature subtree to a local HTML file in your workspace.
- **Parameters**:
  - `outputPath` *(string, optional)*: Local target file path (default: `'./downloaded-page.html'` or `'./downloaded-feature.html'`).
  - `selector` *(string, optional)*: CSS selector to isolate and export only a specific feature/component subtree (e.g. `'#pricing-table'`, `'main'`).
  - `clean` *(boolean, optional)*: Strip noisy SVGs, comments, and empty scripts for clean markup (default: `false`).
  - `tabId` *(number, optional)*: Target Chrome tab ID.
- **Returns**: Confirmation object with `filePath`, `fileSizeKB`, `title`, `url`, `scopedSelector`, and `characterCount`.

### `export_har`
- **Description**: Compiles captured network traffic for the tab into a standard **HAR 1.2** JSON specification file and writes it to disk.
- **Parameters**:
  - `outputPath` *(string, optional)*: Local target file path (default: `'./network-traffic.har'`).
  - `clearAfterExport` *(boolean, optional)*: Whether to clear captured network entries after exporting (default: `false`).
  - `tabId` *(number, optional)*: Target Chrome tab ID.
- **Returns**: Confirmation object with `filePath`, `totalEntries`, `fileSizeKB`, and `harVersion`.
- **Compatibility**: Standard HAR 1.2 format opens natively in Chrome DevTools Network panel, Charles, Postman, and Insomnia.

### `download_sources`
- **Description**: Scans the active page for all referenced source assets (JavaScript bundles, CSS stylesheets, Source Maps, images/SVGs, fonts) and downloads them into an organized directory structure.
- **Parameters**:
  - `outputDir` *(string, optional)*: Target local directory path (default: `'./downloaded-sources'`).
  - `types` *(array of strings, optional)*: Asset categories to include (`['scripts', 'styles', 'sourcemaps', 'images', 'fonts']`).
  - `selector` *(string, optional)*: Scopes source extraction to elements within a specific feature/component.
  - `includeSourceMaps` *(boolean, optional)*: Automatically detect `sourceMappingURL` and download `.map` files (default: `true`).
  - `tabId` *(number, optional)*: Target Chrome tab ID.
- **Returns**: Summary object with `outputDir`, `totalFiles`, `totalSizeKB`, `manifestPath`, and categorized `breakdown`.

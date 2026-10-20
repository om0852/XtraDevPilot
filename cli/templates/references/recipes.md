# Xtra DevPilot — Workflows & Recipes

This guide contains production-tested patterns and recipes for automating web tasks with Xtra DevPilot.

---

## Recipe 1: Token-Efficient DOM Inspection

Never request the full raw DOM if you can avoid it. Modern single-page applications (Next.js, Vite, Tailwind) produce massive DOM trees filled with SVG paths and stylesheet tokens.

### Pattern:
```javascript
// Step 1: Scope to the active section/form to extract only relevant elements
get_clean_dom_snapshot({
  rootSelector: "form#checkout-form" // or "main", "#app", ".modal"
});
```

### Why it matters:
- Reduces token payload from ~65,000 tokens down to ~1,200 tokens (a 94%+ saving).
- Strips out irrelevant SVG graphics and script tags while preserving semantic IDs, labels, input names, and ARIA roles.

---

## Recipe 2: Rapid Multi-Field Form Completion

Instead of making 10-20 separate MCP tool calls to type into inputs one by one, send all field updates in a single roundtrip.

### Pattern:
```javascript
batch_fill_form({
  actions: [
    { selector: "#firstName", value: "Om", action: "type" },
    { selector: "#lastName", value: "Salunke", action: "type" },
    { selector: "#email", value: "om@example.com", action: "type" },
    { selector: "#role", value: "Full Stack Engineer", action: "type" },
    { selector: "#country", value: "IN", action: "select" },
    { selector: "#termsCheckbox", action: "check" },
    { selector: "#submitBtn", action: "click", waitMs: 150 }
  ]
});
```

### Why it matters:
- Completes in <200ms vs 15-30 seconds of tool turnaround.
- Invokes native HTMLInputElement prototype setters so React, Vue, Angular, and Svelte form state managers (React Hook Form, Formik) detect change events immediately.

---

## Recipe 3: Modern Combobox & Searchable Dropdown Selection

Modern enterprise web apps (Workday, Greenhouse, Phenom, Tailwind Combobox) don't use standard `<select>` elements; they use custom `role="combobox"` wrappers with popover menus.

### Pattern:
```javascript
// Automatically clicks trigger, types query in search filter, and selects option
smart_select_combobox({
  triggerSelector: "button[aria-haspopup='listbox']", // or "#source-select-btn"
  searchQuery: "LinkedIn",
  optionText: "LinkedIn Job Board"
});
```

---

## Recipe 4: Attaching Files & Resumes

Upload files directly into file inputs or dropzones without manual file picker dialogs.

### Pattern:
```javascript
upload_file({
  filePath: "Om_Salunke_Resume_AI_SDE.pdf", // relative to workspace or absolute
  selector: "input[type='file']"
});
```

### Supported formats:
`.pdf`, `.doc`, `.docx`, `.txt`, `.rtf`, `.png`, `.jpg`, `.jpeg`.

---

## Recipe 5: Inspecting Frontend State via `execute_script`

Since Xtra DevPilot executes in Chrome's **MAIN execution context**, you have direct access to `window` and framework stores.

### Patterns:
```javascript
// Access Redux Store state
execute_script({
  script: "return window.__REDUX_STORE__?.getState()"
});

// Access Zustand Store
execute_script({
  script: "return window.useAuthStore?.getState()"
});

// Inspect Current Route or Globals
execute_script({
  script: "return { pathname: window.location.pathname, title: document.title, token: localStorage.getItem('token') }"
});
```

---

## Recipe 6: Synthesizing Playwright Tests (`record_user_flow`)

Create production-ready Playwright end-to-end test suites from live user interactions.

### Pattern:
```javascript
// 1. Start recording
record_user_flow({ action: "start" });

// 2. Perform actions (or ask the user to interact in Chrome)
// ... user clicks, navigates, submits forms ...

// 3. Stop recording and compile test
const result = record_user_flow({ action: "stop" });
// result contains a clean, typed Playwright script (e.g. test('user flow', async ({ page }) => { ... }))
```

---

## Recipe 7: Live Layout Debugging & Hot CSS Tweaks

When debugging CSS layout overflow, margin collapse, or misaligned flex items:

### Pattern:
```javascript
// 1. Toggle diagnostic red outlines across all elements
toggle_layout_debug_mode();

// 2. Inject CSS hot-patch without reloading the page
inject_css({
  cssString: `
    .navbar { position: sticky; top: 0; z-index: 1000; }
    .content-container { max-width: 1200px; margin: 0 auto; }
  `
});
```

---

## Recipe 8: Mocking Network Responses for Isolated Frontend Testing

Test frontend UI states (error banners, loading skeletons, specific roles) without backend APIs.

### Pattern:
```javascript
// Intercept fetch requests matching a pattern
mock_network_response({
  urlPattern: "/api/user/profile",
  responseBody: JSON.stringify({
    id: 1,
    name: "Om Salunke",
    tier: "Enterprise",
    permissions: ["ADMIN", "DEV"]
  }),
  status: 200
});

// Clear mocks when done
clear_network_mocks();
```

---

## Recipe 9: Scraping Tables & Repeated Cards

Quickly extract data from complex grids or dashboard tables into JSON.

### Pattern:
```javascript
// Automatically detects headers and rows in HTML tables
extract_structured_data({
  targetSelector: "table#users-table",
  type: "table"
});

// For e-commerce or directory card grids
extract_structured_data({
  targetSelector: ".product-grid",
  type: "cards",
  itemSelector: ".product-card"
});
```

---

## Recipe 10: Switching User Sessions & Mocking Auth

Seamlessly switch user personas or test authenticated vs unauthenticated flows.

### Pattern:
```javascript
// Clear current auth session
manage_storage_and_cookies({
  type: "local_storage",
  operation: "remove",
  name: "auth_token"
});

// Inject new session cookie
manage_storage_and_cookies({
  type: "cookie",
  operation: "set",
  name: "session_id",
  value: "admin-mock-token-xyz",
  domain: "localhost"
});
```

"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import Link from "next/link";

interface DocTool {
  name: string;
  category: "tabs" | "inspection" | "automation" | "devqa" | "scraping" | "observability";
  description: string;
  schema: string;
  sampleCall: string;
  response: string;
}

const ALL_DOC_TOOLS: DocTool[] = [
  // 1. Tabs & Window
  {
    name: "list_tabs",
    category: "tabs",
    description: "Returns all currently open Chrome tabs, including their unique tab IDs, window IDs, page titles, active status, and URLs.",
    schema: "{}",
    sampleCall: '{\n  "name": "list_tabs",\n  "arguments": {}\n}',
    response: '[\n  {\n    "id": 414720296,\n    "title": "Creator Studio | Creatosaurus",\n    "url": "https://www.app.creatosaurus.io/",\n    "active": true\n  }\n]'
  },
  {
    name: "open_tab",
    category: "tabs",
    description: "Spawns a new browser tab in Google Chrome and navigates immediately to the specified URL.",
    schema: '{\n  "url": "string (required)"\n}',
    sampleCall: '{\n  "name": "open_tab",\n  "arguments": {\n    "url": "https://google.com"\n  }\n}',
    response: '{\n  "success": true,\n  "tabId": 414720300,\n  "url": "https://google.com"\n}'
  },
  {
    name: "navigate",
    category: "tabs",
    description: "Navigates an existing or currently active tab to a new URL, waiting for DOM readiness.",
    schema: '{\n  "url": "string (required)",\n  "tabId": "number (optional)"\n}',
    sampleCall: '{\n  "name": "navigate",\n  "arguments": {\n    "url": "https://github.com",\n    "tabId": 414720296\n  }\n}',
    response: '{\n  "success": true,\n  "status": "complete"\n}'
  },
  {
    name: "get_tab_info",
    category: "tabs",
    description: "Extracts metadata for a tab including viewport dimensions, favicon URL, audio state, and load status.",
    schema: '{\n  "tabId": "number (optional)"\n}',
    sampleCall: '{\n  "name": "get_tab_info",\n  "arguments": {}\n}',
    response: '{\n  "id": 414720296,\n  "width": 1186,\n  "height": 609,\n  "status": "complete",\n  "title": "Creator Studio"\n}'
  },
  {
    name: "set_viewport_size",
    category: "tabs",
    description: "Resizes the Chrome window to test responsive design breakpoints (mobile 375px, tablet 768px, desktop 1440px).",
    schema: '{\n  "width": "number (required)",\n  "height": "number (required)"\n}',
    sampleCall: '{\n  "name": "set_viewport_size",\n  "arguments": {\n    "width": 375,\n    "height": 812\n  }\n}',
    response: '{\n  "success": true,\n  "width": 375,\n  "height": 812\n}'
  },

  // 2. DOM & Inspection
  {
    name: "get_dom_snapshot",
    category: "inspection",
    description: "Captures full raw outerHTML DOM tree for complete layout inspection and structural analysis.",
    schema: '{\n  "tabId": "number (optional)"\n}',
    sampleCall: '{\n  "name": "get_dom_snapshot",\n  "arguments": {}\n}',
    response: '"<!DOCTYPE html><html><head>...</head><body>...</body></html>"'
  },
  {
    name: "get_clean_dom_snapshot",
    category: "inspection",
    description: "Extracts an LLM-optimized HTML structure by stripping bulky SVG paths, styles, scripts, and classes to save up to 94% tokens.",
    schema: '{\n  "rootSelector": "string (optional)",\n  "tabId": "number (optional)"\n}',
    sampleCall: '{\n  "name": "get_clean_dom_snapshot",\n  "arguments": {\n    "rootSelector": "main"\n  }\n}',
    response: '"<main><h1>Creator Studio</h1><button class=\\"submit-btn\\">Publish</button></main>"'
  },
  {
    name: "highlight_element",
    category: "inspection",
    description: "Visually highlights an element on the user's screen with an animated pulsing neon border and scrolls it into view.",
    schema: '{\n  "selector": "string (required)",\n  "tabId": "number (optional)"\n}',
    sampleCall: '{\n  "name": "highlight_element",\n  "arguments": {\n    "selector": "button.group-hover:opacity-100"\n  }\n}',
    response: '{\n  "success": true,\n  "highlighted": true\n}'
  },
  {
    name: "wait_for_user_click",
    category: "inspection",
    description: "Enters visual 'Pencil Mode'. Pauses execution until the user clicks any element in the browser. Returns computed CSS, styles, classes, and HTML.",
    schema: "{}",
    sampleCall: '{\n  "name": "wait_for_user_click",\n  "arguments": {}\n}',
    response: '{\n  "tagName": "BUTTON",\n  "classes": "submit-btn",\n  "computedStyles": { "color": "rgb(255,255,255)" }\n}'
  },
  {
    name: "capture_screenshot",
    category: "inspection",
    description: "Captures a visible screenshot of the active browser tab and returns the absolute local path to the saved PNG image.",
    schema: '{\n  "tabId": "number (optional)"\n}',
    sampleCall: '{\n  "name": "capture_screenshot",\n  "arguments": {}\n}',
    response: '{\n  "path": "C:\\\\Users\\\\...\\\\.devpilot-screenshot.png",\n  "mimeType": "image/png"\n}'
  },

  // 3. Automation & Forms
  {
    name: "click_element",
    category: "automation",
    description: "Simulates a user click on an element with automatic polling wait and Tailwind-escaped selector resilience.",
    schema: '{\n  "selector": "string (required)",\n  "timeoutMs": "number (optional, default: 3000)",\n  "tabId": "number (optional)"\n}',
    sampleCall: '{\n  "name": "click_element",\n  "arguments": {\n    "selector": "span.ml-[10px]"\n  }\n}',
    response: '{\n  "success": true,\n  "clicked": true\n}'
  },
  {
    name: "type_text",
    category: "automation",
    description: "Types text into an input or textarea using React-compatible state setters and input event triggers.",
    schema: '{\n  "selector": "string (required)",\n  "text": "string (required)",\n  "timeoutMs": "number (optional)",\n  "tabId": "number (optional)"\n}',
    sampleCall: '{\n  "name": "type_text",\n  "arguments": {\n    "selector": "input[type=\'search\']",\n    "text": "XtraDevPilot"\n  }\n}',
    response: '{\n  "success": true,\n  "value": "XtraDevPilot"\n}'
  },
  {
    name: "batch_fill_form",
    category: "automation",
    description: "Fills multiple form fields in a single rapid roundtrip (<200ms). Supports text, selects, checkboxes, and radio buttons.",
    schema: '{\n  "actions": "array of { selector, value, action, waitMs }",\n  "tabId": "number (optional)"\n}',
    sampleCall: '{\n  "name": "batch_fill_form",\n  "arguments": {\n    "actions": [\n      { "selector": "#firstName", "value": "Om", "action": "type" },\n      { "selector": "#lastName", "value": "Salunke", "action": "type" }\n    ]\n  }\n}',
    response: '{\n  "success": true,\n  "succeeded": 2,\n  "failed": 0\n}'
  },
  {
    name: "smart_select_combobox",
    category: "automation",
    description: "Selects options from modern searchable comboboxes (Workday, ARIA comboboxes, headless UI, and custom dropdowns).",
    schema: '{\n  "triggerSelector": "string (required)",\n  "optionText": "string (required)",\n  "searchQuery": "string (optional)",\n  "tabId": "number (optional)"\n}',
    sampleCall: '{\n  "name": "smart_select_combobox",\n  "arguments": {\n    "triggerSelector": "#country-btn",\n    "optionText": "India"\n  }\n}',
    response: '{\n  "success": true,\n  "selected": "India"\n}'
  },
  {
    name: "upload_file",
    category: "automation",
    description: "Uploads a local file directly into a file input or drag-and-drop zone without OS file chooser dialogues.",
    schema: '{\n  "filePath": "string (required)",\n  "selector": "string (optional, default: input[type=\'file\'])",\n  "tabId": "number (optional)"\n}',
    sampleCall: '{\n  "name": "upload_file",\n  "arguments": {\n    "filePath": "Om_Salunke_Resume_AI_SDE.pdf"\n  }\n}',
    response: '{\n  "success": true,\n  "file": "Om_Salunke_Resume_AI_SDE.pdf",\n  "size": 5247\n}'
  },
  {
    name: "scroll_page",
    category: "automation",
    description: "Scrolls the page or inner scrollable container by direction, pixel distance, or directly into view of an element.",
    schema: '{\n  "direction": "\'down\'|\'up\'|\'top\'|\'bottom\'",\n  "amount": "number",\n  "scrollToSelector": "string",\n  "smooth": "boolean"\n}',
    sampleCall: '{\n  "name": "scroll_page",\n  "arguments": {\n    "direction": "down",\n    "amount": 500,\n    "smooth": true\n  }\n}',
    response: '{\n  "success": true,\n  "scrollX": 0,\n  "scrollY": 500\n}'
  },
  {
    name: "wait_for_element",
    category: "automation",
    description: "Waits using MutationObserver for an element matching selector to appear, become visible, or detach.",
    schema: '{\n  "selector": "string (required)",\n  "timeoutMs": "number (default: 5000)",\n  "state": "\'visible\'|\'attached\'|\'detached\'"\n}',
    sampleCall: '{\n  "name": "wait_for_element",\n  "arguments": {\n    "selector": "#dashboard",\n    "state": "visible"\n  }\n}',
    response: '{\n  "success": true,\n  "found": true\n}'
  },

  // 4. Dev & QA Engine
  {
    name: "execute_script",
    category: "devqa",
    description: "Evaluates arbitrary JS expressions in the webpage context with automatic async IIFE wrapping and Redux/store access.",
    schema: '{\n  "script": "string (required)",\n  "tabId": "number (optional)"\n}',
    sampleCall: '{\n  "name": "execute_script",\n  "arguments": {\n    "script": "return document.title"\n  }\n}',
    response: '{\n  "result": "Creator Studio | Creatosaurus"\n}'
  },
  {
    name: "assert_element_state",
    category: "devqa",
    description: "QA assertion tool checking element visibility, enabled state, text content, or attributes with pass/fail reports.",
    schema: '{\n  "selector": "string (required)",\n  "condition": "\'is_visible\'|\'is_hidden\'|\'is_enabled\'|\'contains_text\'|\'has_value\'|\'has_attribute\'",\n  "expected": "string (optional)"\n}',
    sampleCall: '{\n  "name": "assert_element_state",\n  "arguments": {\n    "selector": "h1",\n    "condition": "contains_text",\n    "expected": "Creator Studio"\n  }\n}',
    response: '{\n  "passed": true,\n  "actual": "Creator Studio"\n}'
  },
  {
    name: "record_user_flow",
    category: "devqa",
    description: "Records user interactions and compiles them into clean, deterministic @playwright/test scripts with selector sanitization.",
    schema: '{\n  "action": "\'start\'|\'stop\'|\'status\'",\n  "tabId": "number (optional)"\n}',
    sampleCall: '{\n  "name": "record_user_flow",\n  "arguments": {\n    "action": "start"\n  }\n}',
    response: '{\n  "recording": true,\n  "eventsCount": 0\n}'
  },
  {
    name: "inject_css",
    category: "devqa",
    description: "Dynamically injects custom CSS rules into the live DOM without reloading to test layout adjustments.",
    schema: '{\n  "cssString": "string (required)"\n}',
    sampleCall: '{\n  "name": "inject_css",\n  "arguments": {\n    "cssString": "body { filter: grayscale(0.5); }"\n  }\n}',
    response: '{\n  "success": true,\n  "injected": true\n}'
  },
  {
    name: "toggle_layout_debug_mode",
    category: "devqa",
    description: "Toggles red outlines on all elements in the active browser tab to instantly reveal layout boundaries and margins.",
    schema: "{}",
    sampleCall: '{\n  "name": "toggle_layout_debug_mode",\n  "arguments": {}\n}',
    response: '{\n  "success": true,\n  "debugMode": true\n}'
  },

  // 5. Scraping & Extraction
  {
    name: "extract_structured_data",
    category: "scraping",
    description: "Extracts repeated cards, tables, and product listings into clean typed JSON structures.",
    schema: '{\n  "targetSelector": "string (optional)",\n  "type": "\'auto\'|\'table\'|\'cards\'|\'list\'",\n  "itemSelector": "string (optional)"\n}',
    sampleCall: '{\n  "name": "extract_structured_data",\n  "arguments": {\n    "targetSelector": ".grid",\n    "type": "cards"\n  }\n}',
    response: '[\n  {\n    "title": "Starter Pack",\n    "price": "$29/mo",\n    "cta": "Sign Up"\n  }\n]'
  },
  {
    name: "extract_job_details",
    category: "scraping",
    description: "Intelligently parses ATS platforms (Workday, Greenhouse, Lever) to extract title, company, location, requisition ID, and description.",
    schema: '{\n  "tabId": "number (optional)"\n}',
    sampleCall: '{\n  "name": "extract_job_details",\n  "arguments": {}\n}',
    response: '{\n  "platform": "Workday",\n  "company": "SmartTech",\n  "title": "Senior Frontend Engineer",\n  "location": "Pune, India"\n}'
  },

  // 6. Observability, Diagnostics & State
  {
    name: "get_console_logs",
    category: "observability",
    description: "Streams recent browser console errors, warnings, and log statements directly into your IDE context.",
    schema: "{}",
    sampleCall: '{\n  "name": "get_console_logs",\n  "arguments": {}\n}',
    response: '[\n  {\n    "level": "error",\n    "message": "Uncaught TypeError: Cannot read properties of undefined"\n  }\n]'
  },
  {
    name: "get_network_logs",
    category: "observability",
    description: "Intercepts recent HTTP network requests, status codes, URLs, headers, and payload timings.",
    schema: "{}",
    sampleCall: '{\n  "name": "get_network_logs",\n  "arguments": {}\n}',
    response: '[\n  {\n    "method": "POST",\n    "url": "https://api.creatosaurus.io/v1/auth",\n    "statusCode": 200\n  }\n]'
  },
  {
    name: "get_web_vitals",
    category: "observability",
    description: "Measures Core Web Vitals (LCP, CLS, FCP) and full asset waterfalls directly from Chrome Performance API.",
    schema: "{}",
    sampleCall: '{\n  "name": "get_web_vitals",\n  "arguments": {}\n}',
    response: '{\n  "LCP": "1.24s",\n  "CLS": "0.012",\n  "FCP": "0.82s"\n}'
  },
  {
    name: "run_security_audit",
    category: "observability",
    description: "Scans active tab for insecure forms, unencrypted transmission, and exposed JWTs or API keys stored in LocalStorage.",
    schema: "{}",
    sampleCall: '{\n  "name": "run_security_audit",\n  "arguments": {}\n}',
    response: '{\n  "protocol": "https:",\n  "insecureForms": 0,\n  "vulnerabilities": [\n    {\n      "severity": "HIGH",\n      "type": "JWT_IN_LOCAL_STORAGE",\n      "key": "token"\n    }\n  ]\n}'
  },
  {
    name: "run_accessibility_audit",
    category: "observability",
    description: "Performs WCAG compliance audit checking for missing alt tags, unlabelled buttons, and improper heading hierarchies.",
    schema: "{}",
    sampleCall: '{\n  "name": "run_accessibility_audit",\n  "arguments": {}\n}',
    response: '{\n  "missingAltCount": 0,\n  "unlabelledButtons": 1,\n  "headingErrors": 0\n}'
  },
  {
    name: "get_storage",
    category: "observability",
    description: "Reads all localStorage, sessionStorage, and cookie entries to inspect authentication tokens and persisted state.",
    schema: "{}",
    sampleCall: '{\n  "name": "get_storage",\n  "arguments": {}\n}',
    response: '{\n  "localStorage": { "theme": "dark" },\n  "sessionStorage": {}\n}'
  },
  {
    name: "manage_storage_and_cookies",
    category: "observability",
    description: "Inspects, sets, or clears browser cookies, localStorage, and sessionStorage to easily mock login sessions or reset test state.",
    schema: '{\n  "type": "\'cookie\'|\'local_storage\'|\'session_storage\' (required)",\n  "operation": "\'get\'|\'set\'|\'remove\'|\'clear\' (required)",\n  "name": "string",\n  "value": "string"\n}',
    sampleCall: '{\n  "name": "manage_storage_and_cookies",\n  "arguments": {\n    "type": "local_storage",\n    "operation": "set",\n    "name": "mockUser",\n    "value": "{\\"id\\":1}"\n  }\n}',
    response: '{\n  "success": true,\n  "updated": true\n}'
  },
  {
    name: "mock_network_response",
    category: "observability",
    description: "Intercepts window.fetch calls matching a URL pattern and returns custom mock JSON payloads without a backend.",
    schema: '{\n  "urlPattern": "string (required)",\n  "responseBody": "string (required)",\n  "status": "number (default: 200)"\n}',
    sampleCall: '{\n  "name": "mock_network_response",\n  "arguments": {\n    "urlPattern": "/api/user",\n    "responseBody": "{\\"name\\":\\"Om\\"}"\n  }\n}',
    response: '{\n  "success": true,\n  "mockedPattern": "/api/user"\n}'
  },
  {
    name: "clear_network_mocks",
    category: "observability",
    description: "Removes all registered URL network intercept mocks, restoring standard network execution.",
    schema: "{}",
    sampleCall: '{\n  "name": "clear_network_mocks",\n  "arguments": {}\n}',
    response: '{\n  "success": true,\n  "clearedCount": 1\n}'
  }
];

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState<"installation" | "configuration" | "tools" | "architecture" | "troubleshooting" | "settings">("installation");
  const [toolCategory, setToolCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage((curr) => (curr === message ? null : curr));
    }, 3000);
  };

  const copyCode = (code: string, key: string, label: string) => {
    navigator.clipboard.writeText(code);
    setCopiedKey(key);
    showToast(`Copied ${label} to clipboard!`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const filteredTools = useMemo(() => {
    return ALL_DOC_TOOLS.filter((t) => {
      const matchCat = toolCategory === "all" || t.category === toolCategory;
      const matchQuery =
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchQuery;
    });
  }, [toolCategory, searchQuery]);

  return (
    <div className="selection:bg-[#cfbcff]/30 min-h-screen flex flex-col bg-[#0d0b12] text-[#e6e0e9]">
      {/* Top Navbar */}
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-6 md:px-12 h-16 bg-[#141218]/85 backdrop-blur-[32px] border-b border-white/10 shadow-[0_4px_25px_rgba(0,0,0,0.4)]">
        <Link href="/" className="flex items-center gap-3 group">
          <img
            alt="Xtra DevPilot Logo"
            className="h-8 w-8 object-contain transition-transform duration-300 group-hover:scale-105"
            src="/android-chrome-512x512.png"
          />
          <div className="flex flex-col">
            <span className="font-headline-lg text-lg font-bold text-white tracking-tight flex items-center gap-2">
              Xtra DevPilot
              <span className="text-[10px] uppercase font-label-mono px-1.5 py-0.5 bg-[#cfbcff]/15 text-[#cfbcff] rounded border border-[#cfbcff]/30">
                Docs
              </span>
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-4">
          <a
            href="/xtradevpilot-extension.zip"
            download="xtradevpilot-extension.zip"
            onClick={() => showToast("Downloading XtraDevPilot Chrome Extension ZIP...")}
            className="hidden sm:inline-flex items-center gap-2 bg-[#cfbcff] hover:bg-[#e0d2ff] text-[#381e72] font-bold text-xs font-label-mono px-3.5 py-1.5 rounded transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">download</span>
            Download Extension (.zip)
          </a>

          <a
            className="flex items-center gap-1.5 text-xs font-label-mono text-[#cbc4d2] hover:text-white transition-colors"
            href="https://github.com/om0852/XtraDevPilot"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="material-symbols-outlined text-base">terminal</span>
            GitHub
          </a>
        </div>
      </header>

      {/* Sidebar Navigation */}
      <aside className="fixed left-0 top-16 bottom-0 w-[270px] z-40 flex flex-col bg-[#141218]/90 backdrop-blur-[32px] border-r border-white/10">
        <div className="p-5 space-y-4">
          <div className="text-[11px] font-label-mono text-[#948e9c] uppercase tracking-wider">
            Documentation Menu
          </div>
          <nav className="space-y-1">
            {[
              { id: "installation", label: "Installation Guide", icon: "download" },
              { id: "configuration", label: "IDE Configurations", icon: "settings" },
              { id: "tools", label: "33 Tools Reference", icon: "terminal" },
              { id: "architecture", label: "Protocol & Security", icon: "security" },
              { id: "troubleshooting", label: "Troubleshooting", icon: "build" },
              { id: "settings", label: "Extension Settings", icon: "tune" },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id as any)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded font-label-mono text-xs transition-all text-left cursor-pointer ${
                  activeSection === item.id
                    ? "text-[#381e72] bg-[#cfbcff] font-bold shadow-sm"
                    : "text-[#cbc4d2] hover:bg-white/5 hover:text-white"
                }`}
              >
                <span className="material-symbols-outlined text-lg">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-auto p-5 border-t border-white/10 space-y-3">
          <div className="bg-[#0f0d13] p-3 rounded border border-white/5 text-[11px] font-label-mono space-y-1">
            <div className="text-[#948e9c]">Bridge Port:</div>
            <div className="text-emerald-400 font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              ws://127.0.0.1:42819
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="ml-[270px] mt-16 p-8 md:p-12 min-h-[calc(100vh-64px)] flex flex-col relative flex-1 max-w-5xl">
        {/* Section 1: Installation */}
        {activeSection === "installation" && (
          <div className="space-y-10">
            <div>
              <div className="text-xs font-label-mono text-[#cfbcff] uppercase tracking-wider mb-2">
                Getting Started
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white">
                Installation Guide
              </h1>
              <p className="text-[#cbc4d2] text-base mt-2 max-w-2xl">
                Set up the two components of Xtra DevPilot: the Chrome extension and the local MCP server.
              </p>
            </div>

            {/* Step 1 */}
            <div className="glass-card p-6 rounded-xl border border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#cfbcff]/20 text-[#cfbcff] text-xs flex items-center justify-center font-label-mono">
                    1
                  </span>
                  Get the Chrome Extension
                </h3>
                <a
                  href="/xtradevpilot-extension.zip"
                  download="xtradevpilot-extension.zip"
                  className="primary-gradient text-white text-xs font-bold px-4 py-2 rounded flex items-center gap-1.5 cursor-pointer shadow"
                >
                  <span className="material-symbols-outlined text-sm">download</span>
                  Download ZIP
                </a>
              </div>
              <p className="text-xs sm:text-sm text-[#cbc4d2]">
                Choose either the 1-click ZIP download or clone the repository via Git:
              </p>
              <div className="bg-[#0f0d13] p-3 rounded border border-white/10 font-label-mono text-xs text-[#cfbcff] flex justify-between items-center">
                <code>git clone https://github.com/om0852/XtraDevPilot.git</code>
                <button
                  onClick={() => copyCode("git clone https://github.com/om0852/XtraDevPilot.git", "git-clone", "git clone command")}
                  className="text-xs text-[#cbc4d2] hover:text-white uppercase"
                >
                  {copiedKey === "git-clone" ? "Copied" : "Copy"}
                </button>
              </div>
            </div>

            {/* Step 2 */}
            <div className="glass-card p-6 rounded-xl border border-white/10 space-y-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#e7c365]/20 text-[#e7c365] text-xs flex items-center justify-center font-label-mono">
                  2
                </span>
                Load Unpacked in Google Chrome
              </h3>
              <ol className="list-decimal pl-6 space-y-2 text-xs sm:text-sm text-[#cbc4d2]">
                <li>Open Chrome and navigate to <code className="text-[#e7c365] bg-white/10 px-1 rounded">chrome://extensions/</code>.</li>
                <li>Turn ON the <strong className="text-white">Developer mode</strong> switch in the top-right corner.</li>
                <li>Click <strong className="text-white">Load unpacked</strong> in the top-left corner.</li>
                <li>Select the <code className="text-[#cfbcff] bg-white/10 px-1 rounded">extension/</code> folder inside the extracted or cloned repository.</li>
                <li>Pin the Xtra DevPilot extension icon to your Chrome toolbar.</li>
              </ol>
            </div>

            {/* Step 3 */}
            <div className="glass-card p-6 rounded-xl border border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#22d3ee]/20 text-[#22d3ee] text-xs flex items-center justify-center font-label-mono">
                    3
                  </span>
                  Start the Local MCP Server Bridge
                </h3>
                <button
                  onClick={() => copyCode("npx xtradevpilot-mcp", "npx-cmd", "npx command")}
                  className="text-xs text-[#22d3ee] font-label-mono hover:underline cursor-pointer"
                >
                  {copiedKey === "npx-cmd" ? "✔ Copied" : "Copy Command"}
                </button>
              </div>
              <p className="text-xs sm:text-sm text-[#cbc4d2]">
                The server runs locally on port <code className="text-[#cfbcff]">42819</code>. Run this command in any terminal:
              </p>
              <div className="bg-[#0f0d13] p-3 rounded border border-white/10 font-label-mono text-xs text-[#cfbcff]">
                <code>npx xtradevpilot-mcp</code>
              </div>
              <p className="text-xs text-[#948e9c]">
                Once started, the Chrome extension popup indicator turns from red to <span className="text-emerald-400 font-semibold">Green (Connected)</span>.
              </p>
            </div>
          </div>
        )}

        {/* Section 2: Configurations */}
        {activeSection === "configuration" && (
          <div className="space-y-10">
            <div>
              <div className="text-xs font-label-mono text-[#cfbcff] uppercase tracking-wider mb-2">
                Setup Guides
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white">
                IDE & MCP Client Configurations
              </h1>
              <p className="text-[#cbc4d2] text-base mt-2 max-w-2xl">
                Add Xtra DevPilot to your editor of choice. Works natively with any Model Context Protocol compliant client.
              </p>
            </div>

            {/* Google Antigravity */}
            <div className="glass-card p-6 rounded-xl border border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#cfbcff]">view_in_ar</span>
                  Google Antigravity IDE
                </h3>
                <button
                  onClick={() =>
                    copyCode(
                      JSON.stringify(
                        {
                          mcpServers: {
                            xtradevpilot: {
                              command: "node",
                              args: ["c:/Users/salun/OneDrive - smarttech/Desktop/D folder/xtradevpilot/mcp-server/index.js"]
                            }
                          }
                        },
                        null,
                        2
                      ),
                      "antigravity-code",
                      "Antigravity config"
                    )
                  }
                  className="text-xs text-[#cfbcff] font-label-mono hover:underline cursor-pointer"
                >
                  {copiedKey === "antigravity-code" ? "✔ Copied" : "Copy JSON"}
                </button>
              </div>
              <p className="text-xs sm:text-sm text-[#cbc4d2]">
                Configure in your workspace root under <code className="text-[#cfbcff]">.gemini/config/mcp_config.json</code>:
              </p>
              <pre className="bg-[#0f0d13] p-4 rounded border border-white/10 font-label-mono text-xs text-[#cbc4d2] overflow-x-auto">
{`{
  "mcpServers": {
    "xtradevpilot": {
      "command": "npx",
      "args": ["-y", "xtradevpilot-mcp"]
    }
  }
}`}
              </pre>
            </div>

            {/* Claude Desktop */}
            <div className="glass-card p-6 rounded-xl border border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#e7c365]">chat</span>
                  Claude Desktop
                </h3>
                <button
                  onClick={() =>
                    copyCode(
                      JSON.stringify(
                        {
                          mcpServers: {
                            "xtra-devpilot": {
                              command: "npx",
                              args: ["-y", "xtradevpilot-mcp"]
                            }
                          }
                        },
                        null,
                        2
                      ),
                      "claude-code",
                      "Claude config"
                    )
                  }
                  className="text-xs text-[#e7c365] font-label-mono hover:underline cursor-pointer"
                >
                  {copiedKey === "claude-code" ? "✔ Copied" : "Copy JSON"}
                </button>
              </div>
              <p className="text-xs sm:text-sm text-[#cbc4d2]">
                Add to your Claude Desktop config (<code className="text-[#cfbcff]">%appdata%\Claude\claude_desktop_config.json</code> on Windows, or <code className="text-[#cfbcff]">~/Library/Application Support/Claude/claude_desktop_config.json</code> on macOS):
              </p>
              <pre className="bg-[#0f0d13] p-4 rounded border border-white/10 font-label-mono text-xs text-[#cbc4d2] overflow-x-auto">
{`{
  "mcpServers": {
    "xtra-devpilot": {
      "command": "npx",
      "args": ["-y", "xtradevpilot-mcp"]
    }
  }
}`}
              </pre>
            </div>

            {/* Cursor IDE */}
            <div className="glass-card p-6 rounded-xl border border-white/10 space-y-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-[#22d3ee]">code</span>
                Cursor IDE
              </h3>
              <ol className="list-decimal pl-6 space-y-2 text-xs sm:text-sm text-[#cbc4d2]">
                <li>Open Cursor settings and select <strong className="text-white">Features &gt; MCP</strong>.</li>
                <li>Click <strong className="text-white">+ Add New MCP Server</strong>.</li>
                <li>Set Name: <code className="text-[#cfbcff]">Xtra DevPilot</code>.</li>
                <li>Set Type: <code className="text-[#cfbcff]">command</code>.</li>
                <li>Set Command: <code className="text-[#cfbcff]">npx -y xtradevpilot-mcp</code>.</li>
                <li>Click Save. A green indicator will verify the connection.</li>
              </ol>
            </div>

            {/* TypeScript SDK */}
            <div className="glass-card p-6 rounded-xl border border-white/10 space-y-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-purple-400">dataset</span>
                TypeScript Automation SDK
              </h3>
              <p className="text-xs sm:text-sm text-[#cbc4d2]">
                For CI/CD test automation pipelines and Node.js backend scripts, use the native typed SDK:
              </p>
              <pre className="bg-[#0f0d13] p-4 rounded border border-white/10 font-label-mono text-xs text-[#cbc4d2] overflow-x-auto">
{`import { DevPilotClient } from "@xtradevpilot/sdk";

const client = new DevPilotClient({ wsUrl: "ws://127.0.0.1:42819" });
await client.connect();

const dom = await client.getCleanDomSnapshot({ rootSelector: "main" });
console.log(dom);`}
              </pre>
            </div>
          </div>
        )}

        {/* Section 3: 33 Tools Reference */}
        {activeSection === "tools" && (
          <div className="space-y-10">
            <div>
              <div className="text-xs font-label-mono text-[#cfbcff] uppercase tracking-wider mb-2">
                API Reference
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white">
                All 33 Production MCP Tools
              </h1>
              <p className="text-[#cbc4d2] text-base mt-2 max-w-2xl">
                Every tool is verified live against Google Chrome with deterministic input schemas and typed JSON responses.
              </p>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
              <div className="flex flex-wrap gap-2">
                {[
                  { id: "all", label: "All (33)" },
                  { id: "tabs", label: "Tabs (5)" },
                  { id: "inspection", label: "DOM (5)" },
                  { id: "automation", label: "Automation (7)" },
                  { id: "devqa", label: "Dev/QA (5)" },
                  { id: "scraping", label: "Scraping (2)" },
                  { id: "observability", label: "Observability (9)" },
                ].map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setToolCategory(c.id)}
                    className={`px-3 py-1 rounded text-xs font-label-mono transition-colors cursor-pointer ${
                      toolCategory === c.id
                        ? "bg-[#cfbcff] text-[#381e72] font-bold"
                        : "bg-white/5 text-[#cbc4d2] hover:bg-white/10"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tools..."
                className="bg-[#141218] border border-white/15 px-3 py-1.5 rounded text-xs font-label-mono text-white placeholder:text-[#948e9c] focus:outline-none focus:border-[#cfbcff] w-full sm:w-60"
              />
            </div>

            {/* Tools Detailed List */}
            <div className="space-y-8">
              {filteredTools.map((tool) => (
                <div key={tool.name} className="glass-card p-6 rounded-xl border border-white/10 space-y-4">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <div className="flex items-center gap-3">
                      <code className="text-base font-bold text-white font-label-mono">
                        {tool.name}
                      </code>
                      <span className="text-[10px] uppercase font-label-mono px-2 py-0.5 rounded bg-white/10 text-[#cfbcff]">
                        {tool.category}
                      </span>
                    </div>
                    <button
                      onClick={() => copyCode(tool.name, tool.name, tool.name)}
                      className="text-xs text-[#cfbcff] font-label-mono hover:underline cursor-pointer"
                    >
                      {copiedKey === tool.name ? "✔ Copied" : "Copy Name"}
                    </button>
                  </div>

                  <p className="text-xs sm:text-sm text-[#cbc4d2] leading-relaxed">
                    {tool.description}
                  </p>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <div className="text-[11px] font-label-mono text-[#e7c365] mb-1">
                        Input Arguments:
                      </div>
                      <pre className="bg-[#0f0d13] p-3 rounded border border-white/5 font-label-mono text-[11px] text-[#cbc4d2] overflow-x-auto">
                        {tool.sampleCall}
                      </pre>
                    </div>
                    <div>
                      <div className="text-[11px] font-label-mono text-emerald-400 mb-1">
                        Expected Return Payload:
                      </div>
                      <pre className="bg-[#0f0d13] p-3 rounded border border-white/5 font-label-mono text-[11px] text-[#cbc4d2] overflow-x-auto">
                        {tool.response}
                      </pre>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section 4: Architecture & Security */}
        {activeSection === "architecture" && (
          <div className="space-y-10">
            <div>
              <div className="text-xs font-label-mono text-[#cfbcff] uppercase tracking-wider mb-2">
                Security & Specs
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white">
                Architecture & Privacy Principles
              </h1>
              <p className="text-[#cbc4d2] text-base mt-2 max-w-2xl">
                Built from the ground up for strict enterprise security. Zero cloud telemetry.
              </p>
            </div>

            <div className="glass-card p-6 rounded-xl border border-white/10 space-y-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-400">lock</span>
                Zero-Cloud Residency
              </h3>
              <p className="text-xs sm:text-sm text-[#cbc4d2] leading-relaxed">
                Traditional browser automation frameworks route network payloads through remote cloud clusters. In contrast, Xtra DevPilot establishes an isolated loopback pipe on <code className="text-[#cfbcff]">127.0.0.1:42819</code>. No cookies, DOM trees, internal secrets, or source code packets leave your physical workstation.
              </p>
            </div>

            <div className="glass-card p-6 rounded-xl border border-white/10 space-y-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-[#cfbcff]">network_node</span>
                Communication Protocol
              </h3>
              <p className="text-xs sm:text-sm text-[#cbc4d2] leading-relaxed">
                The IDE communicates with the MCP server via standard JSON-RPC over <code className="text-[#cfbcff]">stdio</code>. The MCP server multiplexes requests over a local WebSocket server (<code className="text-[#cfbcff]">ws://127.0.0.1:42819</code>) to the Chrome Manifest V3 service worker, which delegates DOM commands to content scripts.
              </p>
            </div>
          </div>
        )}

        {/* Section 5: Troubleshooting */}
        {activeSection === "troubleshooting" && (
          <div className="space-y-10">
            <div>
              <div className="text-xs font-label-mono text-[#cfbcff] uppercase tracking-wider mb-2">
                Diagnostics
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white">
                Troubleshooting & FAQs
              </h1>
              <p className="text-[#cbc4d2] text-base mt-2 max-w-2xl">
                Solutions for common setup hurdles and network edge cases.
              </p>
            </div>

            <div className="space-y-6">
              <div className="glass-card p-6 rounded-xl border border-white/10 space-y-3">
                <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#ffb4ab]">error</span>
                  Extension popup shows red &quot;Disconnected&quot; badge
                </h3>
                <p className="text-xs sm:text-sm text-[#cbc4d2] leading-relaxed">
                  This occurs if the local MCP server is not currently running. Open a terminal and run <code className="text-[#cfbcff]">npx xtradevpilot-mcp</code>. Once the WebSocket server binds to port <code className="text-[#cfbcff]">42819</code>, click the <strong>Reconnect</strong> button in the popup.
                </p>
              </div>

              <div className="glass-card p-6 rounded-xl border border-white/10 space-y-3">
                <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#e7c365]">warning</span>
                  Port 42819 is in use by another process
                </h3>
                <p className="text-xs sm:text-sm text-[#cbc4d2] leading-relaxed">
                  If another Node instance holds port 42819, terminate it using your OS process manager or run:
                </p>
                <div className="bg-[#0f0d13] p-2.5 rounded border border-white/5 font-label-mono text-xs text-[#cbc4d2]">
                  <code>Get-Process -Id (Get-NetTCPConnection -LocalPort 42819).OwningProcess | Stop-Process</code>
                </div>
              </div>

              <div className="glass-card p-6 rounded-xl border border-white/10 space-y-3">
                <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#22d3ee]">help</span>
                  Targeting complex Tailwind classes with colons and brackets
                </h3>
                <p className="text-xs sm:text-sm text-[#cbc4d2] leading-relaxed">
                  Xtra DevPilot has built-in selector normalization! You can pass arbitrary classes like <code className="text-[#cfbcff]">span.ml-[10px]</code> or <code className="text-[#cfbcff]">button.group-hover:opacity-100</code> directly without manual backslash escaping.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Section 6: Settings */}
        {activeSection === "settings" && (
          <div className="space-y-10">
            <div>
              <div className="text-xs font-label-mono text-[#cfbcff] uppercase tracking-wider mb-2">
                Preferences
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white">
                Extension Settings
              </h1>
              <p className="text-[#cbc4d2] text-base mt-2 max-w-2xl">
                Configure connection host and recording defaults inside the extension popup.
              </p>
            </div>

            <div className="glass-card p-6 rounded-xl border border-white/10 space-y-4">
              <h3 className="text-base font-bold text-white">Custom Bridge Host</h3>
              <p className="text-xs sm:text-sm text-[#cbc4d2]">
                If running your MCP client inside WSL, Docker, or a VM, update the target WebSocket URL:
              </p>
              <div className="bg-[#0f0d13] p-3 rounded border border-white/5 font-label-mono text-xs text-[#cfbcff]">
                ws://127.0.0.1:42819
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Floating Toast Notification */}
      <div
        className={`fixed bottom-6 right-6 z-[120] flex items-center gap-3 px-4 py-3 bg-[#141218]/95 border border-[#cfbcff]/40 text-white rounded-lg shadow-2xl backdrop-blur-xl transition-all duration-300 ${
          toastMessage ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-4 scale-95 pointer-events-none"
        }`}
      >
        <span className="material-symbols-outlined text-[#cfbcff] text-xl">info</span>
        <span className="font-label-mono text-xs">{toastMessage}</span>
      </div>
    </div>
  );
}

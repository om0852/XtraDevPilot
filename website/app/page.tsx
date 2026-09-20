"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";

interface ToolItem {
  name: string;
  category: "tabs" | "inspection" | "automation" | "devqa" | "scraping" | "observability";
  description: string;
  badge: string;
  params: string;
  example: string;
}

const TOOLS_CATALOG: ToolItem[] = [
  // Category 1: Tabs & Window
  {
    name: "list_tabs",
    category: "tabs",
    badge: "Tabs",
    description: "Returns all open Chrome tabs with tab IDs, titles, URLs, active status, and window dimensions.",
    params: "None",
    example: "{}"
  },
  {
    name: "open_tab",
    category: "tabs",
    badge: "Tabs",
    description: "Opens a new browser tab and navigates directly to the specified target URL.",
    params: "url (string, required)",
    example: '{"url": "https://google.com"}'
  },
  {
    name: "navigate",
    category: "tabs",
    badge: "Tabs",
    description: "Navigates an existing browser tab to any target URL with automatic page load synchronization.",
    params: "url (string, required), tabId (number, optional)",
    example: '{"url": "https://app.creatosaurus.io", "tabId": 414720296}'
  },
  {
    name: "get_tab_info",
    category: "tabs",
    badge: "Tabs",
    description: "Extracts metadata of the active or target tab including dimensions, favicon, load status, and audio state.",
    params: "tabId (number, optional)",
    example: '{"tabId": 414720296}'
  },
  {
    name: "set_viewport_size",
    category: "tabs",
    badge: "Window",
    description: "Resizes the Chrome window to test responsive design breakpoints (mobile 375px, tablet 768px, desktop 1440px).",
    params: "width (number), height (number)",
    example: '{"width": 1200, "height": 800}'
  },

  // Category 2: DOM & Inspection
  {
    name: "get_dom_snapshot",
    category: "inspection",
    badge: "Inspection",
    description: "Captures full raw outerHTML DOM tree for complete offline analysis and layout structure debugging.",
    params: "tabId (number, optional)",
    example: '{"tabId": 414720296}'
  },
  {
    name: "get_clean_dom_snapshot",
    category: "inspection",
    badge: "Inspection",
    description: "Extracts an LLM-optimized HTML structure by stripping bulky SVG paths, styles, scripts, and classes to save 90% tokens.",
    params: "rootSelector (string, optional), tabId (number, optional)",
    example: '{"rootSelector": "main"}'
  },
  {
    name: "highlight_element",
    category: "inspection",
    badge: "Inspection",
    description: "Injects an animated neon pulsing border overlay on target elements and smoothly scrolls them into view.",
    params: "selector (string, required), tabId (number, optional)",
    example: '{"selector": "button.submit-btn"}'
  },
  {
    name: "wait_for_user_click",
    category: "inspection",
    badge: "Inspection",
    description: "Enters visual 'Pencil Mode'. Pauses until user clicks any element, then returns computed styles, classes, and HTML.",
    params: "None",
    example: "{}"
  },
  {
    name: "capture_screenshot",
    category: "inspection",
    badge: "Visual QA",
    description: "Captures a high-resolution PNG of the active viewport, automatically focusing window to prevent readback errors.",
    params: "tabId (number, optional)",
    example: '{"tabId": 414720296}'
  },

  // Category 3: Automation & Forms
  {
    name: "click_element",
    category: "automation",
    badge: "Automation",
    description: "Simulates user clicks with automatic polling wait and resilient Tailwind selector normalization for bracket/colon classes.",
    params: "selector (string, required), timeoutMs (number, optional)",
    example: '{"selector": "span.ml-[10px]"}'
  },
  {
    name: "type_text",
    category: "automation",
    badge: "Automation",
    description: "Types text into input/textarea triggering React and Vue state setters (HTMLInputElement.prototype value dispatch).",
    params: "selector (string, required), text (string, required)",
    example: '{"selector": "input[type=\'search\']", "text": "Next.js 16"}'
  },
  {
    name: "batch_fill_form",
    category: "automation",
    badge: "Speed QA",
    description: "Fills dozens of form inputs, selects, and checkboxes in a single roundtrip (<200ms) with zero latency overhead.",
    params: "actions (array of {selector, value, action, waitMs})",
    example: '{"actions": [{"selector": "#name", "value": "Om Salunke"}]}'
  },
  {
    name: "smart_select_combobox",
    category: "automation",
    badge: "Automation",
    description: "Interacts with modern searchable custom dropdowns (Workday, ARIA comboboxes, headless UI, and Phenom).",
    params: "triggerSelector (string), optionText (string), searchQuery (optional)",
    example: '{"triggerSelector": "#country-btn", "optionText": "India"}'
  },
  {
    name: "upload_file",
    category: "automation",
    badge: "Automation",
    description: "Uploads local workspace files (PDF, PNG, DOCX) directly into file inputs or dropzones without OS dialog hurdles.",
    params: "filePath (string, required), selector (string, optional)",
    example: '{"filePath": "Om_Salunke_Resume_AI_SDE.pdf"}'
  },
  {
    name: "scroll_page",
    category: "automation",
    badge: "Automation",
    description: "Smoothly scrolls the page or inner scrollable container by pixel amount or directly into target element view.",
    params: "direction (string), amount (number), scrollToSelector (string)",
    example: '{"direction": "down", "amount": 600, "smooth": true}'
  },
  {
    name: "wait_for_element",
    category: "automation",
    badge: "Automation",
    description: "Waits via MutationObserver for an element to appear, become visible, or be detached from the DOM tree.",
    params: "selector (string), timeoutMs (number), state ('visible'|'attached'|'detached')",
    example: '{"selector": "#dashboard-grid", "timeoutMs": 5000}'
  },

  // Category 4: Developer & QA Engine
  {
    name: "execute_script",
    category: "devqa",
    badge: "Dev & QA",
    description: "Evaluates arbitrary JS in the webpage context with automatic async IIFE wrapping, return statement safety, and Redux/window access.",
    params: "script (string, required), tabId (number, optional)",
    example: '{"script": "return window.__REDUX_STORE__?.getState()"}'
  },
  {
    name: "assert_element_state",
    category: "devqa",
    badge: "Dev & QA",
    description: "Deterministic QA assertion checking element visibility, enabled state, text contents, or attributes with pass/fail reports.",
    params: "selector (string), condition (string), expected (string, optional)",
    example: '{"selector": "h1", "condition": "contains_text", "expected": "Creator Studio"}'
  },
  {
    name: "record_user_flow",
    category: "devqa",
    badge: "Playwright",
    description: "Records user clicks and inputs in the browser, sanitizes Tailwind selectors, and generates ready-to-run Playwright test scripts.",
    params: "action ('start' | 'stop' | 'status'), tabId (number, optional)",
    example: '{"action": "start"}'
  },
  {
    name: "inject_css",
    category: "devqa",
    badge: "Styling",
    description: "Dynamically injects custom CSS rules into the live DOM without reloading to test UI styling fixes instantly.",
    params: "cssString (string, required)",
    example: '{"cssString": "body { filter: contrast(1.1); }"}'
  },
  {
    name: "toggle_layout_debug_mode",
    category: "devqa",
    badge: "Styling",
    description: "Toggles red outlines on all elements in the active browser tab to immediately spot overflow, padding, and alignment issues.",
    params: "None",
    example: "{}"
  },

  // Category 5: Scraping & Extraction
  {
    name: "extract_structured_data",
    category: "scraping",
    badge: "Scraping",
    description: "Extracts repeated cards, tables, and product listings into clean typed JSON structures for LLM summarization.",
    params: "targetSelector (string, optional), type ('auto'|'table'|'cards'|'list')",
    example: '{"targetSelector": ".grid", "type": "cards"}'
  },
  {
    name: "extract_job_details",
    category: "scraping",
    badge: "Scraping",
    description: "Intelligently parses ATS platforms (Workday, Greenhouse, Lever) to extract title, company, location, requisition ID, and description.",
    params: "tabId (number, optional)",
    example: "{}"
  },

  // Category 6: Observability, Diagnostics & State
  {
    name: "get_console_logs",
    category: "observability",
    badge: "Diagnostics",
    description: "Streams recent browser console errors, warnings, and log statements directly into your IDE chat.",
    params: "None",
    example: "{}"
  },
  {
    name: "get_network_logs",
    category: "observability",
    badge: "Diagnostics",
    description: "Intercepts recent HTTP network requests, status codes, URLs, headers, and payload timings.",
    params: "None",
    example: "{}"
  },
  {
    name: "get_web_vitals",
    category: "observability",
    badge: "Performance",
    description: "Measures Core Web Vitals (LCP, CLS, FCP) and full asset waterfalls directly from Chrome Performance API.",
    params: "None",
    example: "{}"
  },
  {
    name: "run_security_audit",
    category: "observability",
    badge: "Security",
    description: "Scans active tab for insecure forms, unencrypted transmission, and exposed JWTs or API keys stored in LocalStorage.",
    params: "None",
    example: "{}"
  },
  {
    name: "run_accessibility_audit",
    category: "observability",
    badge: "A11y",
    description: "Performs WCAG compliance audit scanning for missing alt attributes, unlabelled buttons, and improper heading hierarchies.",
    params: "None",
    example: "{}"
  },
  {
    name: "get_storage",
    category: "observability",
    badge: "State",
    description: "Reads all localStorage, sessionStorage, and cookie entries to inspect authentication tokens and persisted state.",
    params: "None",
    example: "{}"
  },
  {
    name: "manage_storage_and_cookies",
    category: "observability",
    badge: "State",
    description: "Inspects, sets, or clears browser cookies, localStorage, and sessionStorage to easily mock login sessions or reset test state.",
    params: "type ('cookie'|'local_storage'|'session_storage'), operation ('get'|'set'|'remove'|'clear')",
    example: '{"type": "local_storage", "operation": "get_all"}'
  },
  {
    name: "mock_network_response",
    category: "observability",
    badge: "Mocking",
    description: "Intercepts window.fetch calls matching a URL pattern and returns custom mock JSON payloads without a backend.",
    params: "urlPattern (string), responseBody (string), status (number)",
    example: '{"urlPattern": "/api/profile", "responseBody": "{\\"name\\":\\"Om\\"}"}'
  },
  {
    name: "clear_network_mocks",
    category: "observability",
    badge: "Mocking",
    description: "Removes all registered URL network intercept mocks, restoring standard network execution.",
    params: "None",
    example: "{}"
  }
];

export default function Landing() {
  const [showModal, setShowModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeDemo, setActiveDemo] = useState<"dom" | "batch" | "security" | "network">("dom");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage((curr) => (curr === message ? null : curr));
    }, 3200);
  };

  const copyToClipboard = (text: string, key: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    showToast(`Copied ${label} to clipboard!`);
    setTimeout(() => {
      setCopiedKey(null);
    }, 2000);
  };

  const filteredTools = useMemo(() => {
    return TOOLS_CATALOG.filter((tool) => {
      const matchesCategory = activeCategory === "all" || tool.category === activeCategory;
      const matchesSearch =
        tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tool.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tool.badge.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchQuery]);

  useEffect(() => {
    const handleAnchorClick = (e: MouseEvent) => {
      const target = e.currentTarget as HTMLAnchorElement;
      const href = target.getAttribute("href");
      if (href && href.startsWith("#") && href.length > 1) {
        e.preventDefault();
        try {
          document.querySelector(href)?.scrollIntoView({
            behavior: "smooth",
          });
        } catch (e) {}
      }
    };

    const anchors = document.querySelectorAll('a[href^="#"]');
    anchors.forEach((anchor) => {
      anchor.addEventListener("click", handleAnchorClick as EventListener);
    });

    return () => {
      anchors.forEach((anchor) => {
        anchor.removeEventListener("click", handleAnchorClick as EventListener);
      });
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#0d0b12] text-[#e6e0e9] selection:bg-[#cfbcff]/30 relative overflow-x-hidden">
      {/* Background Lighting & Dot Grid */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[700px] luminous-spotlight pointer-events-none -z-10"></div>
      <div className="absolute top-0 inset-x-0 h-[650px] hero-grid-pattern [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none -z-10"></div>
      <div className="absolute top-[35%] right-[-12%] w-[550px] h-[550px] bg-[#e7c365]/8 blur-[160px] pointer-events-none -z-10"></div>
      <div className="absolute top-[65%] left-[-12%] w-[600px] h-[600px] bg-[#22d3ee]/8 blur-[180px] pointer-events-none -z-10"></div>

      {/* Floating Glassmorphic Header Dock */}
      <header className="fixed top-4 inset-x-0 z-50 px-4 sm:px-8 flex justify-center pointer-events-none">
        <nav className="pointer-events-auto w-full max-w-6xl bg-[#121018]/85 backdrop-blur-2xl border border-white/12 rounded-full px-4 sm:px-6 py-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.65),0_0_0_1px_rgba(255,255,255,0.06)] flex items-center justify-between transition-all">
          {/* Brand Identity */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <img
              className="h-8 w-8 object-contain transition-transform duration-300 group-hover:scale-105"
              src="/android-chrome-512x512.png"
              alt="Xtra DevPilot Logo"
            />
            <div className="flex items-center gap-2">
              <span className="font-headline-lg text-base sm:text-lg font-bold text-white tracking-tight group-hover:text-[#cfbcff] transition-colors">
                Xtra DevPilot
              </span>
              <span className="text-[10px] uppercase font-label-mono px-2 py-0.5 bg-[#cfbcff]/15 text-[#cfbcff] rounded-full border border-[#cfbcff]/30 font-semibold">
                v2.0
              </span>
            </div>
          </Link>

          {/* Navigation Items (Desktop) */}
          <div className="hidden md:flex items-center gap-1 text-xs font-medium text-[#cbc4d2]">
            <a className="px-3.5 py-1.5 rounded-full hover:text-white hover:bg-white/8 transition-all" href="#features">
              Features
            </a>
            <a className="px-3.5 py-1.5 rounded-full hover:text-white hover:bg-white/8 transition-all flex items-center gap-1.5" href="#tools">
              <span>33 Tools</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#cfbcff]"></span>
            </a>
            <a className="px-3.5 py-1.5 rounded-full hover:text-white hover:bg-white/8 transition-all" href="#architecture">
              Architecture
            </a>
            <a className="px-3.5 py-1.5 rounded-full hover:text-white hover:bg-white/8 transition-all" href="#integrations">
              Integrations
            </a>
            <Link className="px-3.5 py-1.5 rounded-full hover:text-[#cfbcff] hover:bg-[#cfbcff]/10 transition-all" href="/docs">
              Docs
            </Link>
          </div>

          {/* Action CTAs */}
          <div className="flex items-center gap-2 sm:gap-3">
            <a
              href="/xtradevpilot-extension.zip"
              download="xtradevpilot-extension.zip"
              onClick={() => showToast("Downloading XtraDevPilot Chrome Extension (.zip)...")}
              className="hidden sm:inline-flex items-center gap-1.5 bg-white/6 hover:bg-white/12 border border-white/15 hover:border-[#cfbcff]/40 text-white text-xs font-label-mono px-3 py-1.5 rounded-full transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm text-[#cfbcff]">download</span>
              Extension (.zip)
            </a>
            <button
              onClick={() => setShowModal(true)}
              className="primary-gradient text-white font-bold text-xs sm:text-sm px-4 sm:px-5 py-1.5 sm:py-2 rounded-full shadow-[0_0_24px_rgba(103,80,164,0.6)] hover:shadow-[0_0_32px_rgba(207,188,255,0.6)] hover:scale-[1.03] active:scale-[0.98] transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-base">rocket_launch</span>
              Get Started
            </button>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="relative pt-36 sm:pt-44 pb-20 px-4 sm:px-8 max-w-7xl mx-auto flex flex-col items-center text-center" id="features">
        {/* Release Announcement Pill */}
        <div className="mb-6">
          <a
            href="#tools"
            className="group inline-flex items-center gap-2.5 px-4 py-1.5 glass-pill rounded-full text-xs font-label-mono text-[#cbc4d2] hover:text-white transition-all cursor-pointer"
          >
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span className="text-[#cfbcff] font-semibold tracking-wide">
              PRODUCTION RELEASE v2.0
            </span>
            <span className="text-[#948e9c] select-none">•</span>
            <span className="hidden sm:inline text-[#e6e0e9]">All 33 MCP Tools Live-Verified</span>
            <span className="material-symbols-outlined text-sm text-[#cfbcff] group-hover:translate-x-0.5 transition-transform">
              arrow_forward
            </span>
          </a>
        </div>

        {/* Hero Title */}
        <h1 className="text-4xl sm:text-6xl lg:text-[72px] font-extrabold tracking-[-0.035em] text-white leading-[1.08] max-w-5xl mx-auto">
          The Local-First AI Browser Bridge for{" "}
          <span className="bg-gradient-to-r from-[#cfbcff] via-[#e9ddff] to-[#22d3ee] bg-clip-text text-fill-transparent drop-shadow-[0_0_35px_rgba(207,188,255,0.35)]">
            Developers & AI Agents.
          </span>
        </h1>

        {/* Hero Subtitle */}
        <p className="mt-6 text-[#cbc4d2] text-base sm:text-lg md:text-xl max-w-3xl mx-auto leading-relaxed font-normal">
          Empowering <span className="text-white font-semibold">Full-Stack Developers</span>, <span className="text-white font-semibold">Autonomous AI Agents</span>, <span className="text-white font-semibold">QA Automation Teams</span>, and <span className="text-white font-semibold">Data Engineers</span>. Connect Google Antigravity, Claude Desktop, and Cursor directly to live Chrome tabs to inspect DOM, automate forms, stream telemetry, and synthesize Playwright flows with zero cloud residency.
        </p>

        {/* Multi-Persona / Multi-User Pills */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 max-w-3xl">
          <span className="text-xs font-label-mono text-[#948e9c] mr-1">Built for:</span>
          <span className="px-3 py-1 rounded-full text-xs font-label-mono bg-white/6 text-[#cfbcff] border border-white/10 flex items-center gap-1.5 shadow-sm">
            <span className="material-symbols-outlined text-sm">code</span>
            Full-Stack Developers
          </span>
          <span className="px-3 py-1 rounded-full text-xs font-label-mono bg-white/6 text-[#e7c365] border border-white/10 flex items-center gap-1.5 shadow-sm">
            <span className="material-symbols-outlined text-sm">smart_toy</span>
            Autonomous AI Agents
          </span>
          <span className="px-3 py-1 rounded-full text-xs font-label-mono bg-white/6 text-[#22d3ee] border border-white/10 flex items-center gap-1.5 shadow-sm">
            <span className="material-symbols-outlined text-sm">fact_check</span>
            QA & Automation Teams
          </span>
          <span className="px-3 py-1 rounded-full text-xs font-label-mono bg-white/6 text-purple-300 border border-white/10 flex items-center gap-1.5 shadow-sm">
            <span className="material-symbols-outlined text-sm">database</span>
            Data Scrapers & Analysts
          </span>
        </div>

        {/* Unified Action Command Dock */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5 max-w-2xl w-full">
          {/* Primary CTA */}
          <a
            href="/xtradevpilot-extension.zip"
            download="xtradevpilot-extension.zip"
            onClick={() => showToast("Downloading Extension Bundle (xtradevpilot-extension.zip)...")}
            className="primary-gradient text-white font-bold px-6 sm:px-8 py-3.5 rounded-full shadow-[0_0_30px_rgba(207,188,255,0.4)] hover:shadow-[0_0_40px_rgba(207,188,255,0.6)] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2 text-sm cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">download</span>
            Download Extension (.zip)
          </a>

          {/* Copyable Terminal Input Box */}
          <div className="flex items-center bg-[#141218]/95 border border-white/15 hover:border-[#cfbcff]/50 rounded-full px-4 py-2.5 transition-all group shadow-sm">
            <span className="text-xs text-[#948e9c] font-label-mono mr-2 select-none">$</span>
            <code className="text-xs font-label-mono text-[#cfbcff] pr-3 select-all">
              npx xtradevpilot-mcp
            </code>
            <button
              onClick={() => copyToClipboard("npx xtradevpilot-mcp", "hero-mcp", "npx command")}
              title="Copy command"
              className="p-1 hover:bg-white/10 rounded-full transition-colors text-[#cbc4d2] hover:text-white cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">
                {copiedKey === "hero-mcp" ? "check" : "content_copy"}
              </span>
            </button>
          </div>

          {/* Docs Link */}
          <Link
            href="/docs"
            className="glass-pill text-white font-semibold px-5 py-3 rounded-full hover:bg-white/10 transition-colors flex items-center gap-1.5 text-xs sm:text-sm"
          >
            Tool Reference
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </Link>
        </div>

        {/* Trust Badges Row */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-xs font-label-mono text-[#948e9c] pt-4 border-t border-white/10 w-full max-w-3xl">
          <div className="flex items-center gap-2 text-[#e6e0e9]">
            <span className="material-symbols-outlined text-emerald-400 text-base">check_circle</span>
            <span>33/33 Live-Verified Tools</span>
          </div>
          <div className="flex items-center gap-2 text-[#e6e0e9]">
            <span className="material-symbols-outlined text-[#cfbcff] text-base">bolt</span>
            <span>&lt; 12ms WebSocket Bridge</span>
          </div>
          <div className="flex items-center gap-2 text-[#e6e0e9]">
            <span className="material-symbols-outlined text-[#22d3ee] text-base">shield</span>
            <span>100% Local-First (Zero Cloud)</span>
          </div>
          <div className="flex items-center gap-2 text-[#e6e0e9]">
            <span className="material-symbols-outlined text-[#e7c365] text-base">code</span>
            <span>React 19 & Next.js Native</span>
          </div>
        </div>

        {/* Hero Centerpiece Showcase: Interactive IDE & Browser Cockpit */}
        <div className="mt-12 w-full max-w-6xl relative">
          <div className="glass-card rounded-2xl border border-white/15 shadow-[0_25px_90px_rgba(103,80,164,0.35)] overflow-hidden backdrop-blur-2xl text-left">
            {/* Cockpit Header Toolbar */}
            <div className="bg-[#171420] px-4 sm:px-6 py-3 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#ff5f56]"></div>
                <div className="w-3 h-3 rounded-full bg-[#ffbd2e]"></div>
                <div className="w-3 h-3 rounded-full bg-[#27c93f]"></div>
                <span className="text-xs font-label-mono text-[#948e9c] ml-3 hidden sm:inline">
                  Xtra DevPilot Cockpit • WebSocket Bridge Active
                </span>
              </div>

              {/* Scenario Switcher Tabs */}
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: "dom", label: "DOM Inspection", icon: "search" },
                  { id: "batch", label: "Batch Form", icon: "fact_check" },
                  { id: "security", label: "Security Audit", icon: "security" },
                  { id: "network", label: "Network & Vitals", icon: "waterfall_chart" },
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setActiveDemo(s.id as any)}
                    className={`px-3 py-1 rounded-full text-xs font-label-mono transition-all flex items-center gap-1.5 cursor-pointer ${
                      activeDemo === s.id
                        ? "bg-[#cfbcff] text-[#381e72] font-bold shadow-sm"
                        : "bg-white/5 text-[#cbc4d2] hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">{s.icon}</span>
                    <span>{s.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Cockpit Split Dual Panes */}
            <div className="grid lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-white/10 bg-[#0f0d14]">
              {/* Left Pane: AI IDE Agent Window */}
              <div className="lg:col-span-6 p-5 sm:p-6 space-y-4 font-label-mono text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-white/5 text-[#948e9c]">
                  <span className="flex items-center gap-2 text-white font-semibold">
                    <span className="material-symbols-outlined text-[#cfbcff] text-base">terminal</span>
                    IDE Agent Session (Antigravity / Claude)
                  </span>
                  <span className="text-emerald-400 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    JSON-RPC Active
                  </span>
                </div>

                {activeDemo === "dom" && (
                  <div className="space-y-3">
                    <div className="text-[#948e9c] text-[11px]">
                      // Agent analyzing button structure on active tab
                    </div>
                    <div className="bg-[#141218] p-3.5 rounded-lg border border-white/10 space-y-1.5 text-[#cbc4d2]">
                      <div className="text-[#cfbcff] font-bold">
                        &gt; call_mcp_tool(&quot;xtradevpilot&quot;, &quot;get_clean_dom_snapshot&quot;, &#123; rootSelector: &quot;main&quot; &#125;)
                      </div>
                      <div className="text-emerald-400 text-[11px]">
                        ✔ 200 OK — Token-optimized subtree returned
                      </div>
                    </div>
                    <div className="bg-[#141218] p-3.5 rounded-lg border border-white/10 space-y-2">
                      <div className="text-[11px] text-[#e7c365]">
                        &gt; call_mcp_tool(&quot;xtradevpilot&quot;, &quot;highlight_element&quot;, &#123; selector: &quot;button.submit-btn&quot; &#125;)
                      </div>
                      <div className="text-xs text-[#cbc4d2] pl-2 border-l-2 border-[#cfbcff]/50">
                        Visual overlay applied: pulsing neon border injected at element bounding rect [x: 480, y: 312, w: 142, h: 44]
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-[11px] text-[#948e9c] pt-1">
                      <span className="text-emerald-400 font-semibold">Token Savings: 94.2%</span>
                      <span>Latency: 7.8ms</span>
                    </div>
                  </div>
                )}

                {activeDemo === "batch" && (
                  <div className="space-y-3">
                    <div className="text-[#948e9c] text-[11px]">
                      // Agent submitting registration form with React synthetic dispatch
                    </div>
                    <div className="bg-[#141218] p-3.5 rounded-lg border border-white/10 space-y-1.5 text-[#cbc4d2]">
                      <div className="text-[#cfbcff] font-bold">
                        &gt; call_mcp_tool(&quot;xtradevpilot&quot;, &quot;batch_fill_form&quot;)
                      </div>
                      <div className="text-[#948e9c] text-[11px]">
                        Payload: 4 actions [firstName, lastName, email, role]
                      </div>
                    </div>
                    <div className="bg-[#141218] p-3.5 rounded-lg border border-white/10 space-y-1.5 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-[#cbc4d2]">1. #firstName: &quot;Om&quot;</span>
                        <span className="text-emerald-400">React State Triggered</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#cbc4d2]">2. #lastName: &quot;Salunke&quot;</span>
                        <span className="text-emerald-400">React State Triggered</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#cbc4d2]">3. #email: &quot;salunkeom474@...&quot;</span>
                        <span className="text-emerald-400">Validated</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-[11px] text-emerald-400 pt-1">
                      <span>✔ Succeeded: 4/4 fields in single roundtrip</span>
                      <span>Time: 148ms</span>
                    </div>
                  </div>
                )}

                {activeDemo === "security" && (
                  <div className="space-y-3">
                    <div className="text-[#948e9c] text-[11px]">
                      // Agent executing security scan on localStorage & cookies
                    </div>
                    <div className="bg-[#141218] p-3.5 rounded-lg border border-white/10 space-y-1.5 text-[#cbc4d2]">
                      <div className="text-[#cfbcff] font-bold">
                        &gt; call_mcp_tool(&quot;xtradevpilot&quot;, &quot;run_security_audit&quot;)
                      </div>
                      <div className="text-[#ffb4ab] text-[11px] font-semibold">
                        ⚠ 1 High Severity Security Exposure Detected
                      </div>
                    </div>
                    <div className="bg-[#93000a]/20 p-3.5 rounded-lg border border-[#ffb4ab]/30 space-y-1 text-[11px]">
                      <div className="text-[#ffb4ab] font-bold">Issue: Plain-text JWT Token in LocalStorage</div>
                      <div className="text-[#cbc4d2]">Key: <code className="text-[#e7c365]">supabase.auth.token</code></div>
                      <div className="text-[#948e9c]">
                        Fix: Migrate to HttpOnly, SameSite=Strict cookies to eliminate XSS token theft vectors.
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-[11px] text-[#948e9c] pt-1">
                      <span className="text-emerald-400">Forms: Insecure Action 0</span>
                      <span>HTTPS: Verified</span>
                    </div>
                  </div>
                )}

                {activeDemo === "network" && (
                  <div className="space-y-3">
                    <div className="text-[#948e9c] text-[11px]">
                      // Agent intercepting live network waterfall & Core Web Vitals
                    </div>
                    <div className="bg-[#141218] p-3.5 rounded-lg border border-white/10 space-y-1.5 text-[#cbc4d2]">
                      <div className="text-[#cfbcff] font-bold">
                        &gt; call_mcp_tool(&quot;xtradevpilot&quot;, &quot;get_web_vitals&quot;)
                      </div>
                      <div className="text-emerald-400 text-[11px]">
                        LCP: 0.82s (Good) • CLS: 0.008 • FCP: 0.44s
                      </div>
                    </div>
                    <div className="bg-[#141218] p-3.5 rounded-lg border border-white/10 space-y-1.5 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-[#cbc4d2]">POST /api/v1/auth</span>
                        <span className="text-emerald-400">200 OK (38ms)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#cbc4d2]">GET /assets/studio.bundle.js</span>
                        <span className="text-emerald-400">200 OK (84ms)</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-[11px] text-[#948e9c] pt-1">
                      <span>Total Requests Monitored: 42</span>
                      <span className="text-emerald-400">0 Network Errors</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Pane: Live Chrome Tab Mockup */}
              <div className="lg:col-span-6 p-5 sm:p-6 space-y-4 bg-[#110e17]">
                {/* Browser Tab Header & URL bar */}
                <div className="flex items-center gap-2 pb-2 border-b border-white/10">
                  <span className="material-symbols-outlined text-xs text-emerald-400">lock</span>
                  <div className="bg-[#1a1724] px-3 py-1 rounded-full text-[11px] font-label-mono text-[#cbc4d2] flex-1 truncate flex items-center justify-between border border-white/5">
                    <span>https://www.app.creatosaurus.io/studio</span>
                    <span className="text-[10px] text-emerald-400 font-bold uppercase">Tab 414720296</span>
                  </div>
                  <span className="material-symbols-outlined text-xs text-[#948e9c]">refresh</span>
                </div>

                {/* Webpage Visual Canvas Mockup */}
                <div className="p-4 bg-[#141218] rounded-xl border border-white/10 space-y-4 relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <div className="h-4 w-28 bg-white/10 rounded"></div>
                    <div className="flex gap-2">
                      <div className="h-4 w-12 bg-white/10 rounded"></div>
                      <div className="h-4 w-16 bg-white/10 rounded"></div>
                    </div>
                  </div>

                  <div className="p-4 bg-white/5 rounded-lg border border-white/5 space-y-3">
                    <div className="text-sm font-bold text-white">Creator Studio Workspace</div>
                    <div className="text-xs text-[#948e9c] leading-relaxed">
                      Real-time interactive canvas controlled by Xtra DevPilot browser bridge.
                    </div>

                    {/* Target Button with Live Highlight Overlay */}
                    <div className="relative inline-block mt-2">
                      <div className="absolute -inset-1 rounded border-2 border-[#cfbcff] bg-[#cfbcff]/15 animate-pulse pointer-events-none"></div>
                      <button className="relative bg-[#6750a4] text-white px-4 py-2 rounded text-xs font-bold font-label-mono shadow">
                        Publish Project
                      </button>
                      <div className="absolute -top-7 left-0 bg-[#cfbcff] text-[#381e72] font-label-mono text-[10px] font-bold px-2 py-0.5 rounded shadow">
                        &lt;button.submit-btn&gt; 142×44
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-label-mono pt-2 text-[#948e9c]">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      Extension Injected: MAIN & ISOLATED World
                    </span>
                    <span className="text-[#cfbcff]">ws://127.0.0.1:42819</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Master 33-Tool Interactive Showcase */}
      <section className="py-24 px-6 md:px-12 bg-[#0f0d13]/80 border-t border-b border-white/5" id="tools">
        <div className="max-w-7xl mx-auto space-y-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-label-mono text-[#cfbcff] uppercase tracking-wider mb-2">
                <span className="material-symbols-outlined text-base">terminal</span>
                Complete Tool Reference
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                All 33 Production-Ready MCP Tools
              </h2>
              <p className="text-[#cbc4d2] text-base max-w-2xl mt-2">
                Audited and live-verified against real Chrome browser sessions. Every tool is deterministic, token-efficient, and optimized for LLM reasoning.
              </p>
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-80">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#948e9c] text-lg">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter tools (e.g. click, dom, jwt)..."
                className="w-full bg-[#141218] border border-white/15 rounded py-2 pl-10 pr-4 text-xs font-label-mono text-white placeholder:text-[#948e9c] focus:outline-none focus:border-[#cfbcff] transition-colors"
              />
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap gap-2 pt-2">
            {[
              { id: "all", label: `All Tools (${TOOLS_CATALOG.length})` },
              { id: "tabs", label: "Tabs & Window (5)" },
              { id: "inspection", label: "DOM & Inspection (5)" },
              { id: "automation", label: "Automation & Forms (7)" },
              { id: "devqa", label: "Dev & QA Engine (5)" },
              { id: "scraping", label: "Scraping & Data (2)" },
              { id: "observability", label: "Observability & Mocks (9)" },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3.5 py-1.5 rounded text-xs font-label-mono transition-all cursor-pointer ${
                  activeCategory === cat.id
                    ? "bg-[#cfbcff] text-[#381e72] font-bold shadow-sm"
                    : "bg-white/5 text-[#cbc4d2] hover:bg-white/10 hover:text-white border border-white/5"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Tools Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredTools.map((tool) => (
              <div
                key={tool.name}
                className="glass-card p-5 rounded-lg flex flex-col justify-between group hover:border-[#cfbcff]/40 transition-all duration-300"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <code className="text-sm font-bold text-white font-label-mono group-hover:text-[#cfbcff] transition-colors">
                      {tool.name}
                    </code>
                    <span className="text-[10px] font-label-mono uppercase px-2 py-0.5 rounded bg-white/10 text-[#cfbcff] border border-white/10">
                      {tool.badge}
                    </span>
                  </div>
                  <p className="text-xs text-[#cbc4d2] leading-relaxed">
                    {tool.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-white/10 space-y-2">
                  <div className="flex items-start gap-1.5 text-[11px] font-label-mono text-[#948e9c]">
                    <span className="text-[#e7c365]">params:</span>
                    <span className="text-[#cbc4d2] truncate">{tool.params}</span>
                  </div>
                  <div className="flex items-center justify-between bg-[#0f0d13] px-2.5 py-1.5 rounded text-[11px] font-label-mono border border-white/5">
                    <span className="text-[#948e9c] truncate max-w-[200px]">{tool.example}</span>
                    <button
                      onClick={() => copyToClipboard(tool.name, tool.name, tool.name)}
                      className="text-[#cfbcff] hover:text-white text-[10px] uppercase font-bold cursor-pointer"
                    >
                      {copiedKey === tool.name ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Core Architectural Pillars */}
      <section className="py-24 px-6 md:px-12 relative overflow-hidden" id="architecture">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <div className="inline-flex items-center gap-2 text-xs font-label-mono text-[#cfbcff] uppercase tracking-wider">
              <span className="material-symbols-outlined text-base">hub</span>
              Local-First Bridge Architecture
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
              Zero-Cloud Residency. Millisecond Latency.
            </h2>
            <p className="text-[#cbc4d2] text-base leading-relaxed">
              Unlike cloud-hosted browser automation platforms, Xtra DevPilot establishes a direct, isolated WebSocket connection right on your machine.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="glass-card p-8 rounded-xl space-y-4 border border-white/10">
              <div className="w-12 h-12 rounded bg-[#cfbcff]/15 flex items-center justify-center text-[#cfbcff] border border-[#cfbcff]/20">
                <span className="material-symbols-outlined text-2xl">shield_lock</span>
              </div>
              <h3 className="text-lg font-bold text-white font-headline-lg">
                100% Private & Local
              </h3>
              <p className="text-xs sm:text-sm text-[#cbc4d2] leading-relaxed">
                All JSON-RPC messages stay inside <code className="text-[#cfbcff]">127.0.0.1:42819</code>. Your proprietary source code, auth cookies, internal staging dashboards, and user sessions never touch external clouds.
              </p>
            </div>

            <div className="glass-card p-8 rounded-xl space-y-4 border border-white/10">
              <div className="w-12 h-12 rounded bg-[#e7c365]/15 flex items-center justify-center text-[#e7c365] border border-[#e7c365]/20">
                <span className="material-symbols-outlined text-2xl">speed</span>
              </div>
              <h3 className="text-lg font-bold text-white font-headline-lg">
                Sub-15ms Roundtrips
              </h3>
              <p className="text-xs sm:text-sm text-[#cbc4d2] leading-relaxed">
                Direct WebSocket pipe between the Chrome Manifest V3 service worker and the local Node.js stdio MCP server ensures instantaneous command execution without proxy lag.
              </p>
            </div>

            <div className="glass-card p-8 rounded-xl space-y-4 border border-white/10">
              <div className="w-12 h-12 rounded bg-[#22d3ee]/15 flex items-center justify-center text-[#22d3ee] border border-[#22d3ee]/20">
                <span className="material-symbols-outlined text-2xl">smart_toy</span>
              </div>
              <h3 className="text-lg font-bold text-white font-headline-lg">
                React & Modern SPA Native
              </h3>
              <p className="text-xs sm:text-sm text-[#cbc4d2] leading-relaxed">
                Automated form typing and clicks invoke native property setters (<code className="text-[#cfbcff]">_valueTracker</code>) ensuring React 18/19, Next.js, and Vue state synchronizes cleanly without flakes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Multi-IDE Integration Bento Grid */}
      <section className="py-24 px-6 md:px-12 bg-[#0f0d13]/90 border-t border-white/5" id="integrations">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h2 className="text-3xl font-extrabold text-white">
              Connect to Any AI Coding Assistant
            </h2>
            <p className="text-[#cbc4d2] text-sm sm:text-base">
              Configurable in seconds across all major MCP-compatible developer environments.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Google Antigravity */}
            <div className="glass-card p-6 rounded-lg space-y-3 border border-white/10 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2.5 mb-2">
                  <span className="material-symbols-outlined text-[#cfbcff] text-xl">view_in_ar</span>
                  <h4 className="font-bold text-white text-sm">Google Antigravity</h4>
                </div>
                <p className="text-xs text-[#cbc4d2]">
                  Add directly into your active workspace root under <code className="text-[#cfbcff]">.gemini/config/mcp_config.json</code>.
                </p>
              </div>
              <button
                onClick={() =>
                  copyToClipboard(
                    JSON.stringify(
                      {
                        mcpServers: {
                          xtradevpilot: {
                            command: "npx",
                            args: ["-y", "xtradevpilot-mcp"]
                          }
                        }
                      },
                      null,
                      2
                    ),
                    "antigravity-cfg",
                    "Antigravity config"
                  )
                }
                className="w-full text-center py-2 bg-white/5 hover:bg-white/10 text-xs font-label-mono text-[#cfbcff] rounded border border-white/10 transition-colors cursor-pointer"
              >
                {copiedKey === "antigravity-cfg" ? "✔ Copied" : "Copy Config"}
              </button>
            </div>

            {/* Claude Desktop */}
            <div className="glass-card p-6 rounded-lg space-y-3 border border-white/10 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2.5 mb-2">
                  <span className="material-symbols-outlined text-[#e7c365] text-xl">chat</span>
                  <h4 className="font-bold text-white text-sm">Claude Desktop</h4>
                </div>
                <p className="text-xs text-[#cbc4d2]">
                  Place inside <code className="text-[#cfbcff]">claude_desktop_config.json</code> to give Claude browser vision.
                </p>
              </div>
              <button
                onClick={() =>
                  copyToClipboard(
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
                    "claude-cfg",
                    "Claude config"
                  )
                }
                className="w-full text-center py-2 bg-white/5 hover:bg-white/10 text-xs font-label-mono text-[#e7c365] rounded border border-white/10 transition-colors cursor-pointer"
              >
                {copiedKey === "claude-cfg" ? "✔ Copied" : "Copy Config"}
              </button>
            </div>

            {/* Cursor IDE */}
            <div className="glass-card p-6 rounded-lg space-y-3 border border-white/10 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2.5 mb-2">
                  <span className="material-symbols-outlined text-[#22d3ee] text-xl">code</span>
                  <h4 className="font-bold text-white text-sm">Cursor IDE</h4>
                </div>
                <p className="text-xs text-[#cbc4d2]">
                  Navigate to <code className="text-[#cfbcff]">Settings &gt; Features &gt; MCP</code> and add command <code className="text-[#cfbcff]">npx -y xtradevpilot-mcp</code>.
                </p>
              </div>
              <button
                onClick={() => copyToClipboard("npx -y xtradevpilot-mcp", "cursor-cfg", "Cursor command")}
                className="w-full text-center py-2 bg-white/5 hover:bg-white/10 text-xs font-label-mono text-[#22d3ee] rounded border border-white/10 transition-colors cursor-pointer"
              >
                {copiedKey === "cursor-cfg" ? "✔ Copied" : "Copy Command"}
              </button>
            </div>

            {/* TypeScript SDK */}
            <div className="glass-card p-6 rounded-lg space-y-3 border border-white/10 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2.5 mb-2">
                  <span className="material-symbols-outlined text-purple-400 text-xl">dataset</span>
                  <h4 className="font-bold text-white text-sm">TypeScript SDK</h4>
                </div>
                <p className="text-xs text-[#cbc4d2]">
                  Automate pipelines programmatically using <code className="text-[#cfbcff]">@xtradevpilot/sdk</code> with typed client bindings.
                </p>
              </div>
              <button
                onClick={() => copyToClipboard("npm install @xtradevpilot/sdk", "sdk-cfg", "SDK install")}
                className="w-full text-center py-2 bg-white/5 hover:bg-white/10 text-xs font-label-mono text-purple-400 rounded border border-white/10 transition-colors cursor-pointer"
              >
                {copiedKey === "sdk-cfg" ? "✔ Copied" : "Copy Install"}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full py-12 px-6 md:px-12 border-t border-white/10 bg-[#0d0b12]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex flex-col items-center md:items-start gap-2">
            <div className="flex items-center gap-3">
              <img
                className="h-6 w-6 rounded-sm object-contain"
                src="/android-chrome-512x512.png"
                alt="Xtra DevPilot"
              />
              <span className="font-headline-lg text-lg font-bold text-white">
                Xtra DevPilot
              </span>
            </div>
            <p className="text-xs text-[#948e9c] font-label-mono">
              © 2026 Xtra DevPilot. High-performance browser bridge for AI developers.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-xs font-label-mono text-[#cbc4d2]">
            <Link href="/docs" className="hover:text-[#cfbcff] transition-colors">
              Documentation
            </Link>
            <a
              href="/xtradevpilot-extension.zip"
              download="xtradevpilot-extension.zip"
              className="hover:text-[#cfbcff] transition-colors"
            >
              Download (.zip)
            </a>
            <a
              href="https://github.com/om0852/XtraDevPilot"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#cfbcff] transition-colors flex items-center gap-1"
            >
              GitHub
              <span className="material-symbols-outlined text-xs">open_in_new</span>
            </a>
            <button
              onClick={() => showToast("Privacy: All execution is local; no external telemetry.")}
              className="hover:text-[#cfbcff] transition-colors cursor-pointer"
            >
              Privacy
            </button>
            <span className="inline-flex items-center gap-1.5 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              Bridge Port :42819
            </span>
          </div>
        </div>
      </footer>

      {/* Installation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="relative w-full max-w-2xl bg-[#141218] border border-white/15 rounded-xl shadow-2xl overflow-hidden glass-card">
            <div className="h-1 w-full bg-gradient-to-r from-[#cfbcff] via-[#e7c365] to-[#22d3ee]"></div>

            <div className="p-6 md:p-8 space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
                    Install Xtra DevPilot
                    <span className="text-xs font-label-mono px-2 py-0.5 rounded bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">
                      v2.0.0
                    </span>
                  </h3>
                  <p className="text-xs sm:text-sm text-[#cbc4d2] mt-1 font-body-md">
                    Follow these 3 quick steps to bridge Chrome to your AI editor.
                  </p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-[#948e9c] hover:text-white transition-colors cursor-pointer p-1"
                >
                  <span className="material-symbols-outlined text-2xl">close</span>
                </button>
              </div>

              {/* Step 1: Download Extension */}
              <div className="p-4 bg-white/5 rounded-lg border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-[#cfbcff]/20 text-[#cfbcff] flex items-center justify-center font-bold text-xs font-label-mono">
                      1
                    </span>
                    <h4 className="font-bold text-white text-sm">Download Extension Bundle</h4>
                  </div>
                  <a
                    href="/xtradevpilot-extension.zip"
                    download="xtradevpilot-extension.zip"
                    onClick={() => showToast("Downloading xtradevpilot-extension.zip...")}
                    className="primary-gradient text-white text-xs font-bold px-3.5 py-1.5 rounded flex items-center gap-1.5 shadow hover:scale-105 transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">download</span>
                    Download .ZIP
                  </a>
                </div>
                <p className="text-xs text-[#cbc4d2] pl-9">
                  Extract the downloaded ZIP file to a convenient local folder (e.g. <code className="text-[#cfbcff]">Downloads/xtradevpilot/</code>).
                </p>
              </div>

              {/* Step 2: Load in Chrome */}
              <div className="p-4 bg-white/5 rounded-lg border border-white/10 space-y-2">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#e7c365]/20 text-[#e7c365] flex items-center justify-center font-bold text-xs font-label-mono">
                    2
                  </span>
                  <h4 className="font-bold text-white text-sm">Load Unpacked in Chrome</h4>
                </div>
                <ol className="list-decimal pl-13 space-y-1 text-xs text-[#cbc4d2]">
                  <li>Open Google Chrome and navigate to <code className="bg-white/10 px-1.5 py-0.5 rounded text-[#e7c365]">chrome://extensions/</code>.</li>
                  <li>Enable the <span className="text-white font-semibold">Developer mode</span> toggle in the top-right corner.</li>
                  <li>Click <span className="text-white font-semibold">Load unpacked</span> and select the extracted folder.</li>
                </ol>
              </div>

              {/* Step 3: Run MCP Server */}
              <div className="p-4 bg-white/5 rounded-lg border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-[#22d3ee]/20 text-[#22d3ee] flex items-center justify-center font-bold text-xs font-label-mono">
                      3
                    </span>
                    <h4 className="font-bold text-white text-sm">Start Local MCP Bridge</h4>
                  </div>
                  <button
                    onClick={() => copyToClipboard("npx xtradevpilot-mcp", "modal-npx", "npx command")}
                    className="text-xs font-label-mono text-[#22d3ee] hover:underline cursor-pointer"
                  >
                    {copiedKey === "modal-npx" ? "✔ Copied" : "Copy Command"}
                  </button>
                </div>
                <div className="pl-9">
                  <div className="bg-[#0f0d13] p-2.5 rounded border border-white/10 font-label-mono text-xs text-[#cfbcff] select-all">
                    npx xtradevpilot-mcp
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-between items-center">
                <Link
                  href="/docs"
                  onClick={() => setShowModal(false)}
                  className="text-xs text-[#cfbcff] hover:underline flex items-center gap-1 font-label-mono"
                >
                  View full IDE setup guides &rarr;
                </Link>
                <button
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2 bg-white/10 hover:bg-white/15 text-white text-xs font-label-mono rounded transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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

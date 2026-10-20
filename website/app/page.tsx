"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import Link from "next/link";
import CyberBackground from "./components/CyberBackground";

interface ToolItem {
  name: string;
  category: "rea" | "dom" | "network" | "interaction" | "system";
  badge: string;
  description: string;
  params: string;
  returns: string;
  example: string;
}

const TOOLS_CATALOG: ToolItem[] = [
  // Category 1: Reverse Engineering (REA)
  {
    name: "rea_scope_app",
    category: "rea",
    badge: "01 / SCOPE",
    description: "Holistic surface inspection of the active tab. Maps scripts, stylesheets, global namespaces, frameworks (React, Vue, Svelte), API roots, and state managers.",
    params: "tabId (number, optional), depth (number, optional)",
    returns: "AppTopologyReport",
    example: '{"depth": 2}'
  },
  {
    name: "rea_sourcemap_reconstruct",
    category: "rea",
    badge: "02 / SOURCEMAP",
    description: "Discovers inline or linked .map files across bundles. Automatically reconstructs the original unminified TypeScript/JavaScript source tree locally.",
    params: "inputDir (string, optional), outputDir (string, optional)",
    returns: "ReconstructionManifest",
    example: '{"outputDir": "./src"}'
  },
  {
    name: "rea_reconstruct_types",
    category: "rea",
    badge: "03 / TYPES",
    description: "Analyzes runtime objects, Redux/Zustand stores, network payloads, and GraphQL queries to infer exact TypeScript interfaces and Zod validation schemas.",
    params: "format ('typescript'|'zod', optional)",
    returns: "TypeDefinitions",
    example: '{"format": "zod"}'
  },
  {
    name: "rea_action_to_api",
    category: "rea",
    badge: "04 / FLOW",
    description: "Correlates user UI interactions (button clicks, form inputs, route changes) with outgoing XHR/Fetch network calls to map business logic directly to endpoints.",
    params: "selector (string, required), action ('click'|'type')",
    returns: "ActionApiCorrelation",
    example: '{"selector": "#btn-pay", "action": "click"}'
  },
  {
    name: "rea_generate_openapi",
    category: "rea",
    badge: "05 / OPENAPI",
    description: "Synthesizes recorded network traffic, headers, query params, request bodies, and response schemas into a spec-compliant OpenAPI 3.1 YAML or JSON documentation.",
    params: "outputPath (string, optional), version ('3.0'|'3.1')",
    returns: "OpenApiSpecification",
    example: '{"outputPath": "./openapi.json", "version": "3.1"}'
  },
  {
    name: "rea_bundle",
    category: "rea",
    badge: "06 / SUITE",
    description: "Runs the complete reverse-engineering pipeline in parallel. Bundles architecture reports, unminified source code, types, and API specs into a single developer archive.",
    params: "outputPath (string, optional), archive (boolean)",
    returns: "ReaBundleArtifact",
    example: '{"archive": true, "outputPath": "./bundle.zip"}'
  },
  {
    name: "download_sources",
    category: "rea",
    badge: "ASSET CRAWLER",
    description: "Discovers and downloads all in-scope client-side scripts, stylesheets, sourcemaps, images, and fonts with a structured manifest.",
    params: "outputDir (string, optional), types (string[], optional)",
    returns: "DownloadedSourcesManifest",
    example: '{"outputDir": "./sources", "types": ["scripts", "sourcemaps"]}'
  },

  // Category 2: DOM & Elements
  {
    name: "get_clean_dom_snapshot",
    category: "dom",
    badge: "CLEAN DOM",
    description: "Extracts an LLM-optimized HTML structure by stripping bulky SVG paths, styles, scripts, and classes to save 90% tokens.",
    params: "rootSelector (string, optional), tabId (number, optional)",
    returns: "CleanDomString",
    example: '{"rootSelector": "main"}'
  },
  {
    name: "get_dom_snapshot",
    category: "dom",
    badge: "RAW DOM",
    description: "Captures full raw outerHTML DOM tree for complete offline analysis and layout structure debugging.",
    params: "tabId (number, optional)",
    returns: "RawHtmlString",
    example: '{"tabId": 414736580}'
  },
  {
    name: "get_ax_tree",
    category: "dom",
    badge: "A11Y TREE",
    description: "Captures the Chrome Accessibility tree for screen readers, ARIA roles, states, and accessibility compliance checks.",
    params: "tabId (number, optional)",
    returns: "AxNodeTree",
    example: "{}"
  },
  {
    name: "highlight_element",
    category: "dom",
    badge: "VISUAL OVERLAY",
    description: "Injects an animated neon pulsing border overlay on target elements and smoothly scrolls them into view.",
    params: "selector (string, required), tabId (number, optional)",
    returns: "ElementBoundingBox",
    example: '{"selector": "button.submit-btn"}'
  },
  {
    name: "wait_for_user_click",
    category: "dom",
    badge: "PENCIL MODE",
    description: "Pauses until user clicks any element in the active tab, then returns computed styles, classes, and HTML hierarchy.",
    params: "timeoutMs (number, optional)",
    returns: "ClickedElementMetadata",
    example: "{}"
  },
  {
    name: "capture_screenshot",
    category: "dom",
    badge: "VISUAL QA",
    description: "Captures a high-resolution PNG of the active viewport, automatically focusing window to prevent readback errors.",
    params: "outputPath (string, optional), tabId (number, optional)",
    returns: "ScreenshotPath",
    example: '{"outputPath": "./shot.png"}'
  },
  {
    name: "inject_css",
    category: "dom",
    badge: "STYLE INJECT",
    description: "Injects arbitrary CSS stylesheets into the active tab for instant style hot-reloading and UI experimentation.",
    params: "cssString (string, required)",
    returns: "InjectionStatus",
    example: '{"cssString": "body { filter: invert(1); }"}'
  },
  {
    name: "toggle_layout_debug_mode",
    category: "dom",
    badge: "LAYOUT DEBUG",
    description: "Toggles high-contrast colored outlines on all DOM bounding boxes to rapidly diagnose layout shifts and overflow bugs.",
    params: "enabled (boolean, optional)",
    returns: "LayoutDebugState",
    example: '{"enabled": true}'
  },
  {
    name: "wait_for_element",
    category: "dom",
    badge: "SYNCHRONIZATION",
    description: "Waits until a matching DOM element is rendered and reaches the specified visibility state (visible, hidden, attached).",
    params: "selector (string, required), state ('visible'|'hidden')",
    returns: "ElementState",
    example: '{"selector": ".dashboard-grid", "state": "visible"}'
  },
  {
    name: "scroll_page",
    category: "dom",
    badge: "VIEWPORT",
    description: "Scrolls the page or inner scrollable container by direction, pixel distance, or directly into view of an element.",
    params: "direction ('down'|'up'|'top'|'bottom'), amount (number)",
    returns: "ScrollCoordinates",
    example: '{"direction": "down", "amount": 500}'
  },

  // Category 3: Network, State & Observability
  {
    name: "get_network_logs",
    category: "network",
    badge: "TRAFFIC",
    description: "Intercepts recent HTTP network requests, status codes, URLs, headers, and payload timings.",
    params: "limit (number, optional)",
    returns: "NetworkEntry[]",
    example: '{"limit": 25}'
  },
  {
    name: "export_har",
    category: "network",
    badge: "HAR ARCHIVE",
    description: "Captures full network activity into standard HAR 1.2 format with request/response payloads and timing waterfalls.",
    params: "outputPath (string, optional), clearAfterExport (boolean)",
    returns: "HarFileSummary",
    example: '{"outputPath": "./network.har"}'
  },
  {
    name: "get_console_logs",
    category: "network",
    badge: "LOG STREAM",
    description: "Streams recent browser console errors, warnings, and log statements directly into your IDE chat.",
    params: "limit (number, optional)",
    returns: "ConsoleLogEntry[]",
    example: "{}"
  },
  {
    name: "get_web_vitals",
    category: "network",
    badge: "CORE VITALS",
    description: "Measures Core Web Vitals (LCP, CLS, FCP) and full asset waterfalls directly from Chrome Performance API.",
    params: "tabId (number, optional)",
    returns: "WebVitalsReport",
    example: "{}"
  },
  {
    name: "run_security_audit",
    category: "network",
    badge: "SECURITY",
    description: "Scans active tab for insecure forms, unencrypted transmission, and exposed JWTs or API keys stored in LocalStorage.",
    params: "None",
    returns: "SecurityAuditReport",
    example: "{}"
  },
  {
    name: "run_accessibility_audit",
    category: "network",
    badge: "A11Y AUDIT",
    description: "Performs WCAG compliance audit scanning for missing alt attributes, unlabelled buttons, and improper heading hierarchies.",
    params: "None",
    returns: "A11yViolationsList",
    example: "{}"
  },
  {
    name: "get_storage",
    category: "network",
    badge: "STORAGE",
    description: "Reads all localStorage, sessionStorage, and cookie entries to inspect authentication tokens and persisted state.",
    params: "type ('all'|'local'|'session'|'cookies')",
    returns: "BrowserStorageMap",
    example: '{"type": "local"}'
  },
  {
    name: "manage_storage_and_cookies",
    category: "network",
    badge: "AUTH STATE",
    description: "Inspects, sets, or clears browser cookies, localStorage, and sessionStorage to easily mock login sessions or reset test state.",
    params: "type ('cookie'|'local_storage'), operation ('get'|'set'|'remove')",
    returns: "StorageOperationResult",
    example: '{"type": "local_storage", "operation": "get_all"}'
  },
  {
    name: "mock_network_response",
    category: "network",
    badge: "MOCKING",
    description: "Intercepts window.fetch calls matching a URL pattern and returns custom mock JSON payloads without a backend.",
    params: "urlPattern (string), responseBody (string), status (number)",
    returns: "MockRegistrationStatus",
    example: '{"urlPattern": "/api/profile", "responseBody": "{\\"name\\":\\"Om\\"}"}'
  },

  // Category 4: Agent Action & Automation
  {
    name: "click_element",
    category: "interaction",
    badge: "SYNTHETIC CLICK",
    description: "Simulates user clicks with automatic polling wait and resilient Tailwind selector normalization for bracket/colon classes.",
    params: "selector (string, required), timeoutMs (number, optional)",
    returns: "ClickResult",
    example: '{"selector": "button[type=\'submit\']"}'
  },
  {
    name: "type_text",
    category: "interaction",
    badge: "INPUT DISPATCH",
    description: "Types text into input/textarea triggering React and Vue state setters (HTMLInputElement.prototype value dispatch).",
    params: "selector (string, required), text (string, required)",
    returns: "TypeResult",
    example: '{"selector": "input[type=\'search\']", "text": "XtraDevPilot"}'
  },
  {
    name: "batch_fill_form",
    category: "interaction",
    badge: "SPEED QA",
    description: "Fills entire multi-field forms in a single sub-200ms roundtrip with native React/Vue synthetic event triggers.",
    params: "actions (array of { selector, value, action })",
    returns: "BatchResult",
    example: '{"actions": [{"selector": "#name", "value": "Om"}]}'
  },
  {
    name: "smart_select_combobox",
    category: "interaction",
    badge: "COMBOBOX",
    description: "Interacts with modern headless ARIA dropdowns, filtering, searching, and keyboard-selecting custom option nodes.",
    params: "triggerSelector (string), optionText (string)",
    returns: "SelectionResult",
    example: '{"triggerSelector": "#country", "optionText": "India"}'
  },
  {
    name: "upload_file",
    category: "interaction",
    badge: "FILE UPLOAD",
    description: "Attaches local files directly to file input fields or drag-and-drop targets using synthetic DataTransfer events.",
    params: "filePath (string, required), selector (string, optional)",
    returns: "UploadResult",
    example: '{"filePath": "./document.pdf"}'
  },
  {
    name: "press_key",
    category: "interaction",
    badge: "KEYBOARD",
    description: "Dispatches keyboard key events (Enter, Escape, Tab, ArrowDown, Backspace) with proper keyCodes and modifier flags.",
    params: "key (string, required), modifiers (string[], optional)",
    returns: "KeyEventResult",
    example: '{"key": "Enter"}'
  },
  {
    name: "mouse_action",
    category: "interaction",
    badge: "MOUSE GESTURE",
    description: "Simulates mouse movement, hover states, drag-and-drop operations, and double-clicks on coordinate targets.",
    params: "action ('hover'|'drag'|'dblclick'), selector (string)",
    returns: "MouseActionResult",
    example: '{"action": "hover", "selector": ".menu-item"}'
  },
  {
    name: "assert_element_state",
    category: "interaction",
    badge: "ASSERTION",
    description: "Performs deterministic QA assertions on element existence, text matching, visibility, or computed CSS properties.",
    params: "selector (string), condition ('is_visible'|'contains_text')",
    returns: "AssertionReport",
    example: '{"selector": "h1", "condition": "is_visible"}'
  },

  // Category 5: System & Tabs
  {
    name: "list_tabs",
    category: "system",
    badge: "TABS",
    description: "Returns all open Chrome tabs with tab IDs, titles, URLs, active status, and window dimensions.",
    params: "None",
    returns: "TabInfo[]",
    example: "{}"
  },
  {
    name: "open_tab",
    category: "system",
    badge: "NAVIGATION",
    description: "Opens a new browser tab and navigates directly to the specified target URL.",
    params: "url (string, required)",
    returns: "OpenedTabInfo",
    example: '{"url": "https://linktree.work.gd"}'
  },
  {
    name: "navigate",
    category: "system",
    badge: "NAVIGATION",
    description: "Navigates an existing browser tab to any target URL with automatic page load synchronization.",
    params: "url (string, required), tabId (number, optional)",
    returns: "NavigationStatus",
    example: '{"url": "https://github.com"}'
  },
  {
    name: "get_tab_info",
    category: "system",
    badge: "METADATA",
    description: "Extracts metadata of the active or target tab including dimensions, favicon, load status, and audio state.",
    params: "tabId (number, optional)",
    returns: "TabMetadata",
    example: "{}"
  },
  {
    name: "set_viewport_size",
    category: "system",
    badge: "RESPONSIVE",
    description: "Resizes the Chrome window to test responsive design breakpoints (mobile 375px, tablet 768px, desktop 1440px).",
    params: "width (number), height (number)",
    returns: "ViewportSize",
    example: '{"width": 1200, "height": 800}'
  },
  {
    name: "execute_script",
    category: "system",
    badge: "EVAL",
    description: "Evaluates runtime JavaScript expressions directly in the main execution world with access to window globals and state stores.",
    params: "script (string, required)",
    returns: "ExecutionResult",
    example: '{"script": "window.location.href"}'
  },
  {
    name: "record_user_flow",
    category: "system",
    badge: "PLAYWRIGHT",
    description: "Records user clicks, inputs, and navigation gestures in Chrome and synthesizes production-ready Playwright test scripts.",
    params: "action ('start'|'stop'|'status')",
    returns: "PlaywrightScriptResult",
    example: '{"action": "status"}'
  }
];

export default function LandingPage() {
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showModal, setShowModal] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [cockpitTab, setCockpitTab] = useState<"terminal" | "network" | "scope">("terminal");
  const [featuresOpen, setFeaturesOpen] = useState<boolean>(false);
  const cockpitRef = useRef<HTMLDivElement | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey((curr) => (curr === key ? null : curr));
    }, 2000);
  };

  // Dynamic 3D Cockpit Tilt based on mouse position
  const handleCockpitMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cockpitRef.current) return;
    const rect = cockpitRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const rotX = ((y / rect.height) - 0.5) * -10;
    const rotY = ((x / rect.width) - 0.5) * 10;
    cockpitRef.current.style.transform = `perspective(1000px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale3d(1.01, 1.01, 1.01)`;
  };

  const handleCockpitMouseLeave = () => {
    if (!cockpitRef.current) return;
    cockpitRef.current.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
  };

  const filteredTools = useMemo(() => {
    return TOOLS_CATALOG.filter((tool) => {
      const matchesCategory =
        activeCategory === "all" || tool.category === activeCategory;
      const matchesSearch =
        tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tool.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tool.badge.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchQuery]);

  return (
    <div className="bg-[#0b0912] text-[#e6e0e9] min-h-screen flex flex-col selection:bg-[#cfbcff]/30 relative overflow-x-hidden font-sans">
      {/* 1. Ambient WebGL Quantum Plasma & Interactive Cursor Animation */}
      <CyberBackground />

      {/* 2. Floating Glassmorphic Header */}
      <header className="fixed top-4 inset-x-0 z-50 px-4 sm:px-8 flex justify-center pointer-events-none">
        <nav className="pointer-events-auto w-full max-w-5xl bg-[#120f1f]/85 backdrop-blur-2xl border border-white/10 rounded-full px-4 sm:px-6 py-2 shadow-[0_12px_45px_rgba(0,0,0,0.7)] flex items-center justify-between transition-all duration-300 hover:border-white/20">
          {/* Official Brand Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="relative h-8 w-8 rounded-lg overflow-hidden shadow-md shadow-[#22d3ee]/20 group-hover:scale-105 transition-transform flex items-center justify-center bg-black/40 border border-white/10">
              <img
                src="/xtradevpilot_logo.png"
                alt="Xtra DevPilot Logo"
                className="h-full w-full object-contain p-0.5"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-base sm:text-lg font-bold text-white tracking-tight">
                Xtra DevPilot
              </span>
              <span className="text-[10px] uppercase font-label-mono px-2 py-0.5 bg-[#cfbcff]/15 text-[#cfbcff] rounded-full border border-[#cfbcff]/30 font-semibold tracking-wider">
                v2.0
              </span>
            </div>
          </Link>

          {/* Minimalist Center Navigation with Features Dropdown */}
          <div className="hidden md:flex items-center gap-2 text-xs font-medium text-[#cbc4d2]">
            {/* Features Dropdown */}
            <div
              className="relative group/dropdown"
              onMouseEnter={() => setFeaturesOpen(true)}
              onMouseLeave={() => setFeaturesOpen(false)}
            >
              <button
                onClick={() => setFeaturesOpen(!featuresOpen)}
                className={`px-3.5 py-1.5 rounded-full hover:text-white transition-all flex items-center gap-1 cursor-pointer ${
                  featuresOpen ? "bg-white/10 text-white" : "hover:bg-white/5"
                }`}
              >
                <span>Features</span>
                <span
                  className={`material-symbols-outlined text-sm transition-transform duration-200 ${
                    featuresOpen
                      ? "rotate-180 text-[#cfbcff]"
                      : "text-white/50 group-hover/dropdown:rotate-180 group-hover/dropdown:text-[#cfbcff]"
                  }`}
                >
                  expand_more
                </span>
              </button>

              {/* Dropdown Menu Card */}
              <div
                className={`absolute top-full left-1/2 -translate-x-1/2 pt-2 w-80 z-50 ${
                  featuresOpen ? "block" : "hidden group-hover/dropdown:block"
                }`}
              >
                <div className="glass-panel rounded-2xl p-2 shadow-[0_20px_50px_rgba(0,0,0,0.85)] border border-white/15 flex flex-col gap-1">
                    <a
                      href="#reverse-engineering"
                      onClick={() => setFeaturesOpen(false)}
                      className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-all group/item"
                    >
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-300 shrink-0 group-hover/item:scale-105 transition-transform">
                        <span className="material-symbols-outlined text-base">biotech</span>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                          Reverse Engineering
                          <span className="text-[9px] font-label-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-semibold">6 Tools</span>
                        </div>
                        <div className="text-[11px] text-[#cbc4d2] leading-tight mt-0.5">
                          Sourcemap decompiler, OpenAPI generator, AST recovery
                        </div>
                      </div>
                    </a>

                    <a
                      href="#tools"
                      onClick={() => setFeaturesOpen(false)}
                      className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-all group/item"
                    >
                      <div className="w-8 h-8 rounded-lg bg-[#cfbcff]/15 border border-[#cfbcff]/30 flex items-center justify-center text-[#cfbcff] shrink-0 group-hover/item:scale-105 transition-transform">
                        <span className="material-symbols-outlined text-base">handyman</span>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                          40 Browser Tools
                          <span className="text-[9px] font-label-mono px-1.5 py-0.2 rounded bg-[#cfbcff]/20 text-[#cfbcff] font-semibold">Atomic</span>
                        </div>
                        <div className="text-[11px] text-[#cbc4d2] leading-tight mt-0.5">
                          Granular DOM, Network HAR, CDP actions & state
                        </div>
                      </div>
                    </a>

                    <a
                      href="#cli"
                      onClick={() => setFeaturesOpen(false)}
                      className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-all group/item"
                    >
                      <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-300 shrink-0 group-hover/item:scale-105 transition-transform">
                        <span className="material-symbols-outlined text-base">terminal</span>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">
                          Universal CLI Suite
                        </div>
                        <div className="text-[11px] text-[#cbc4d2] leading-tight mt-0.5">
                          Terminal automation commands for developers & agents
                        </div>
                      </div>
                    </a>

                    <a
                      href="#architecture"
                      onClick={() => setFeaturesOpen(false)}
                      className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-all group/item"
                    >
                      <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-300 shrink-0 group-hover/item:scale-105 transition-transform">
                        <span className="material-symbols-outlined text-base">security</span>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">
                          Local Architecture
                        </div>
                        <div className="text-[11px] text-[#cbc4d2] leading-tight mt-0.5">
                          100% on-device WebSocket bridge with zero cloud telemetry
                        </div>
                      </div>
                    </a>
                  </div>
                </div>
            </div>

            <a
              className="px-3.5 py-1.5 rounded-full hover:text-white hover:bg-white/5 transition-all"
              href="#integrations"
            >
              Integrations
            </a>

            <Link
              className="px-3.5 py-1.5 rounded-full hover:text-white hover:bg-white/5 transition-all"
              href="/docs"
            >
              Docs
            </Link>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-3">
            <a
              href="/xtradevpilot-extension.zip"
              download="xtradevpilot-extension.zip"
              className="hidden sm:inline-flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-label-mono px-3.5 py-1.5 rounded-full transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm text-[#cfbcff]">download</span>
              Extension (.zip)
            </a>
            <button
              onClick={() => setShowModal(true)}
              className="bg-gradient-to-r from-[#6750a4] via-[#7d65b9] to-[#cfbcff] hover:brightness-110 text-white font-semibold text-xs sm:text-sm px-4 sm:px-5 py-2 rounded-full shadow-[0_0_25px_rgba(103,80,164,0.5)] flex items-center gap-1.5 transition-all transform active:scale-95 cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">rocket_launch</span>
              Get Started
            </button>
          </div>
        </nav>
      </header>

      {/* 3. Hero Section & Cockpit Interface */}
      <section className="relative pt-36 sm:pt-44 pb-20 px-4 sm:px-8 max-w-7xl mx-auto flex flex-col items-center text-center" id="features">
        {/* Release Announcement Pill */}
        <div className="mb-6 transform hover:scale-105 transition-transform">
          <a
            href="#reverse-engineering"
            className="inline-flex items-center gap-2 px-4 py-1.5 glass-pill rounded-full text-xs font-label-mono text-[#cbc4d2] border border-[#cfbcff]/20 shadow-[0_0_20px_rgba(207,188,255,0.15)] cursor-pointer"
          >
            <span className="text-[#cfbcff] font-semibold tracking-wide">
              RELEASE v2.0 • REVERSE ENGINEERING SUITE
            </span>
            <span className="material-symbols-outlined text-xs text-white/60">arrow_forward</span>
          </a>
        </div>

        {/* Hero Title */}
        <h1 className="text-4xl sm:text-6xl lg:text-[76px] font-extrabold tracking-[-0.035em] text-white leading-[1.08] max-w-5xl mx-auto">
          The Local-First AI Browser Bridge for <br className="hidden sm:inline" />
          <span className="glow-gradient-text drop-shadow-[0_0_35px_rgba(103,80,164,0.4)]">
            Developers &amp; AI Agents.
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mt-6 text-[#cbc4d2] text-base sm:text-lg md:text-xl max-w-3xl mx-auto leading-relaxed font-normal">
          Empowering Full-Stack Developers, Autonomous AI Agents, Reverse Engineers, and QA Teams. Connect Google Antigravity, Claude Desktop, and Cursor directly to live Chrome tabs with zero cloud residency.
        </p>

        {/* Action Command Bar */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5 max-w-2xl w-full">
          <button
            onClick={() => copyToClipboard("npx xtradevpilot-mcp", "hero-cmd")}
            className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-white font-label-mono text-xs flex items-center gap-2 backdrop-blur-md shadow-inner transition-all hover:bg-white/10 cursor-pointer"
          >
            <span className="text-[#cfbcff]">$</span>
            <span>npx xtradevpilot-mcp</span>
            <span className="material-symbols-outlined text-sm opacity-60">
              {copiedKey === "hero-cmd" ? "check" : "content_copy"}
            </span>
          </button>

          <a
            href="#reverse-engineering"
            className="px-5 py-2.5 rounded-xl bg-[#22d3ee]/10 border border-[#22d3ee]/30 text-[#22d3ee] hover:bg-[#22d3ee]/20 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">explore</span>
            Explore 6 REA Tools
          </a>

          <Link
            href="/docs"
            className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 text-xs font-semibold flex items-center gap-1.5 transition-all"
          >
            Tool Reference
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </Link>
        </div>

        {/* 3D Interactive Cockpit Area */}
        <div className="relative w-full max-w-5xl mt-14" id="cockpit-container">
          {/* Main 3D Tilt Cockpit Card */}
          <div
            ref={cockpitRef}
            onMouseMove={handleCockpitMouseMove}
            onMouseLeave={handleCockpitMouseLeave}
            className="glass-panel rounded-2xl overflow-hidden shadow-[0_25px_80px_rgba(0,0,0,0.85)] border border-white/15 transition-transform duration-200 text-left"
            id="cockpit-tilt"
          >
            {/* Header Toolbar */}
            <div className="px-4 py-3 bg-black/40 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-red-500/80 inline-block"></span>
                  <span className="w-3 h-3 rounded-full bg-yellow-500/80 inline-block"></span>
                  <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block"></span>
                </div>
                <span className="ml-3 font-label-mono text-xs text-white/50 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-xs text-emerald-400">lock</span>
                  ws://127.0.0.1:42819 [chrome_tab_71]
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-label-mono text-[#cfbcff]">
                <span className="px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10">
                  Local Bridge Attached
                </span>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="bg-black/20 border-b border-white/5 px-4 flex gap-4 text-xs font-label-mono">
              <button
                onClick={() => setCockpitTab("terminal")}
                className={`py-2.5 flex items-center gap-1.5 font-medium transition-colors cursor-pointer ${
                  cockpitTab === "terminal"
                    ? "text-[#cfbcff] border-b-2 border-[#cfbcff]"
                    : "text-white/50 hover:text-white"
                }`}
              >
                <span className="material-symbols-outlined text-sm">terminal</span>
                Terminal Stream
              </button>
              <button
                onClick={() => setCockpitTab("network")}
                className={`py-2.5 flex items-center gap-1.5 font-medium transition-colors cursor-pointer ${
                  cockpitTab === "network"
                    ? "text-[#cfbcff] border-b-2 border-[#cfbcff]"
                    : "text-white/50 hover:text-white"
                }`}
              >
                <span className="material-symbols-outlined text-sm">network_check</span>
                Network Inspect
              </button>
              <button
                onClick={() => setCockpitTab("scope")}
                className={`py-2.5 flex items-center gap-1.5 font-medium transition-colors cursor-pointer ${
                  cockpitTab === "scope"
                    ? "text-[#cfbcff] border-b-2 border-[#cfbcff]"
                    : "text-white/50 hover:text-white"
                }`}
              >
                <span className="material-symbols-outlined text-sm">integration_instructions</span>
                Source Scope
              </button>
            </div>

            {/* Terminal Body */}
            <div className="p-5 font-label-mono text-xs leading-relaxed space-y-2 overflow-x-auto bg-[#0a0812]/90 min-h-[220px]">
              {cockpitTab === "terminal" && (
                <>
                  <div className="text-white/40">// Establishing local WebSocket link to Chrome Extension MV3 on port 42819...</div>
                  <div className="text-emerald-400 font-semibold">[READY] Attached to Tab &quot;Checkout / Payment Gateway (Stripe v3)&quot; (tabId: 104)</div>
                  <div className="text-white/70">
                    <span className="text-[#cfbcff]">&gt; MCP stdio:</span> calling <code className="text-yellow-300 font-bold">rea_scope_app</code>(maxDepth: 3, frameworkDetect: true)
                  </div>
                  <div className="pl-4 border-l border-white/10 text-white/60 space-y-1">
                    <div><span className="text-cyan-400">✓ Framework detected:</span> Next.js 15 (App Router) + Tailwind CSS + TRPC</div>
                    <div><span className="text-cyan-400">✓ Source Maps:</span> 14 mapped bundles unpacked into memory</div>
                    <div><span className="text-cyan-400">✓ Endpoints identified:</span> 12 internal APIs, 3 WebSocket push handlers</div>
                  </div>
                  <div className="text-white/70">
                    <span className="text-[#cfbcff]">&gt; Agent Execution:</span> <span className="text-emerald-300">rea_generate_openapi</span> &rarr; <span className="text-white">Generated valid OpenAPI 3.1 YAML in 240ms</span>
                  </div>
                  <div className="p-3 bg-white/5 rounded-lg border border-white/10 text-[11px] text-white/80 flex items-center justify-between">
                    <span>&quot;rea_bundle&quot;: &#123; &quot;scope&quot;: &quot;completed&quot;, &quot;endpoints&quot;: 12, &quot;types&quot;: &quot;./types/app.d.ts&quot;, &quot;coverage&quot;: &quot;98.4%&quot; &#125;</span>
                    <span className="text-emerald-400 font-bold">200 OK</span>
                  </div>
                </>
              )}

              {cockpitTab === "network" && (
                <>
                  <div className="text-white/40">// Capturing live HTTP/XHR traffic &amp; WebSocket frames on active tab...</div>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between items-center text-white/80">
                      <span className="text-emerald-400 font-bold">POST /api/trpc/checkout.createSession</span>
                      <span className="text-white/40">200 OK • 32ms</span>
                    </div>
                    <div className="flex justify-between items-center text-white/80">
                      <span className="text-[#22d3ee] font-bold">GET /_next/static/chunks/app/checkout-bundle.js.map</span>
                      <span className="text-white/40">200 OK • 74ms (1.4MB)</span>
                    </div>
                    <div className="flex justify-between items-center text-white/80">
                      <span className="text-purple-300 font-bold">WS wss://stream.live/v1/telemetry</span>
                      <span className="text-white/40">101 Switching Protocols</span>
                    </div>
                  </div>
                  <div className="mt-3 p-3 bg-white/5 rounded-lg border border-white/10 text-[11px] text-cyan-300">
                    HarStream: 24 active entries correlated to action &quot;button#submit-order&quot;
                  </div>
                </>
              )}

              {cockpitTab === "scope" && (
                <>
                  <div className="text-white/40">// Sourcemap Project Reconstruction Tree (in-memory AST)...</div>
                  <div className="text-[#cbc4d2] space-y-1 text-[11px]">
                    <div>📁 src/</div>
                    <div className="pl-4">├── 📁 components/CheckoutModal.tsx (23.4 KB)</div>
                    <div className="pl-4">├── 📁 hooks/usePaymentIntent.ts (11.2 KB)</div>
                    <div className="pl-4">├── 📁 server/routers/checkout.ts (18.9 KB)</div>
                    <div className="pl-4">└── 📄 schema.prisma (4.1 KB)</div>
                  </div>
                  <div className="mt-2 text-emerald-400 text-[11px]">
                    ✔ Reconstructed 43 pristine TypeScript files with 100% path resolution
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 4. Reverse Engineering Suite (01-06) */}
      <section className="py-24 px-4 sm:px-8 max-w-7xl mx-auto" id="reverse-engineering">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs font-label-mono mb-3">
            <span className="material-symbols-outlined text-xs">biotech</span>
            AUTONOMOUS INSPECTION SUITE
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            6 Autonomous Reverse Engineering Tools
          </h2>
          <p className="mt-4 text-[#cbc4d2] text-sm sm:text-base">
            Give your AI agents direct surgical capabilities over any frontend application. Extract architectures, capture live network payloads, reconstruct TypeScript models, and auto-generate OpenAPI specs.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* 01: rea_scope_app */}
          <div className="cyber-border-card rounded-2xl p-6 flex flex-col justify-between group">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="font-label-mono text-xs px-2.5 py-1 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-semibold">
                  01 / SCOPE
                </span>
                <span className="material-symbols-outlined text-emerald-400 group-hover:rotate-12 transition-transform">
                  layers
                </span>
              </div>
              <h3 className="text-lg font-bold text-white mb-2 font-mono">rea_scope_app</h3>
              <p className="text-xs text-[#cbc4d2] leading-relaxed mb-4">
                Holistic surface inspection of the active tab. Maps scripts, stylesheets, global namespaces, frameworks (React, Vue, Svelte, Angular), API roots, and state managers.
              </p>
            </div>
            <div>
              <div className="bg-black/40 rounded-lg p-2.5 border border-white/5 font-label-mono text-[11px] text-white/70 mb-3 flex items-center justify-between">
                <code>scope_app(&#123; depth: 2 &#125;)</code>
                <button
                  className="text-white/40 hover:text-white cursor-pointer"
                  onClick={() => copyToClipboard('scope_app({ depth: 2 })', 'copy-01')}
                >
                  <span className="material-symbols-outlined text-sm">
                    {copiedKey === "copy-01" ? "check" : "content_copy"}
                  </span>
                </button>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-label-mono text-emerald-400">
                <span>DOM Tree &rarr; State Graph &rarr; Agent Context</span>
              </div>
            </div>
          </div>

          {/* 02: rea_sourcemap_reconstruct */}
          <div className="cyber-border-card rounded-2xl p-6 flex flex-col justify-between group">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="font-label-mono text-xs px-2.5 py-1 rounded-md bg-[#cfbcff]/15 border border-[#cfbcff]/30 text-[#cfbcff] font-semibold">
                  02 / SOURCEMAP
                </span>
                <span className="material-symbols-outlined text-[#cfbcff] group-hover:rotate-12 transition-transform">
                  code_blocks
                </span>
              </div>
              <h3 className="text-lg font-bold text-white mb-2 font-mono">rea_sourcemap_reconstruct</h3>
              <p className="text-xs text-[#cbc4d2] leading-relaxed mb-4">
                Discovers inline or linked <code className="text-[#cfbcff]">.map</code> files across bundles. Automatically reconstructs the original unminified TypeScript/JavaScript source tree locally.
              </p>
            </div>
            <div>
              <div className="bg-black/40 rounded-lg p-2.5 border border-white/5 font-label-mono text-[11px] text-white/70 mb-3 flex items-center justify-between">
                <code>reconstruct(&#123; outputDir: &quot;./src&quot; &#125;)</code>
                <button
                  className="text-white/40 hover:text-white cursor-pointer"
                  onClick={() => copyToClipboard('reconstruct({ outputDir: "./src" })', 'copy-02')}
                >
                  <span className="material-symbols-outlined text-sm">
                    {copiedKey === "copy-02" ? "check" : "content_copy"}
                  </span>
                </button>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-label-mono text-[#cfbcff]">
                <span>Chunk Bundle &rarr; Source Tree Extraction</span>
              </div>
            </div>
          </div>

          {/* 03: rea_reconstruct_types */}
          <div className="cyber-border-card rounded-2xl p-6 flex flex-col justify-between group">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="font-label-mono text-xs px-2.5 py-1 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 font-semibold">
                  03 / TYPES
                </span>
                <span className="material-symbols-outlined text-amber-400 group-hover:rotate-12 transition-transform">
                  schema
                </span>
              </div>
              <h3 className="text-lg font-bold text-white mb-2 font-mono">rea_reconstruct_types</h3>
              <p className="text-xs text-[#cbc4d2] leading-relaxed mb-4">
                Analyzes runtime objects, Redux/Zustand stores, network payloads, and GraphQL queries to infer exact TypeScript interfaces and Zod validation schemas.
              </p>
            </div>
            <div>
              <div className="bg-black/40 rounded-lg p-2.5 border border-white/5 font-label-mono text-[11px] text-white/70 mb-3 flex items-center justify-between">
                <code>infer_types(&#123; format: &quot;zod&quot; &#125;)</code>
                <button
                  className="text-white/40 hover:text-white cursor-pointer"
                  onClick={() => copyToClipboard('infer_types({ format: "zod" })', 'copy-03')}
                >
                  <span className="material-symbols-outlined text-sm">
                    {copiedKey === "copy-03" ? "check" : "content_copy"}
                  </span>
                </button>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-label-mono text-amber-400">
                <span>Runtime Object &rarr; Strongly Typed Interface</span>
              </div>
            </div>
          </div>

          {/* 04: rea_action_to_api */}
          <div className="cyber-border-card rounded-2xl p-6 flex flex-col justify-between group">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="font-label-mono text-xs px-2.5 py-1 rounded-md bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-semibold">
                  04 / FLOW
                </span>
                <span className="material-symbols-outlined text-cyan-400 group-hover:rotate-12 transition-transform">
                  hub
                </span>
              </div>
              <h3 className="text-lg font-bold text-white mb-2 font-mono">rea_action_to_api</h3>
              <p className="text-xs text-[#cbc4d2] leading-relaxed mb-4">
                Correlates user UI interactions (button clicks, form inputs, route changes) with outgoing XHR/Fetch network calls to map business logic directly to endpoints.
              </p>
            </div>
            <div>
              <div className="bg-black/40 rounded-lg p-2.5 border border-white/5 font-label-mono text-[11px] text-white/70 mb-3 flex items-center justify-between">
                <code>trace_action(&#123; selector: &quot;#btn-pay&quot; &#125;)</code>
                <button
                  className="text-white/40 hover:text-white cursor-pointer"
                  onClick={() => copyToClipboard('trace_action({ selector: "#btn-pay" })', 'copy-04')}
                >
                  <span className="material-symbols-outlined text-sm">
                    {copiedKey === "copy-04" ? "check" : "content_copy"}
                  </span>
                </button>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-label-mono text-cyan-400">
                <span>DOM Event &rarr; Trace &rarr; REST / RPC Route</span>
              </div>
            </div>
          </div>

          {/* 05: rea_generate_openapi */}
          <div className="cyber-border-card rounded-2xl p-6 flex flex-col justify-between group">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="font-label-mono text-xs px-2.5 py-1 rounded-md bg-purple-500/15 border border-purple-500/30 text-purple-300 font-semibold">
                  05 / OPENAPI
                </span>
                <span className="material-symbols-outlined text-purple-400 group-hover:rotate-12 transition-transform">
                  description
                </span>
              </div>
              <h3 className="text-lg font-bold text-white mb-2 font-mono">rea_generate_openapi</h3>
              <p className="text-xs text-[#cbc4d2] leading-relaxed mb-4">
                Synthesizes recorded network traffic, headers, query params, request bodies, and response schemas into a spec-compliant OpenAPI 3.1 YAML or JSON documentation.
              </p>
            </div>
            <div>
              <div className="bg-black/40 rounded-lg p-2.5 border border-white/5 font-label-mono text-[11px] text-white/70 mb-3 flex items-center justify-between">
                <code>generate_spec(&#123; version: &quot;3.1.0&quot; &#125;)</code>
                <button
                  className="text-white/40 hover:text-white cursor-pointer"
                  onClick={() => copyToClipboard('generate_spec({ version: "3.1.0" })', 'copy-05')}
                >
                  <span className="material-symbols-outlined text-sm">
                    {copiedKey === "copy-05" ? "check" : "content_copy"}
                  </span>
                </button>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-label-mono text-purple-400">
                <span>Traffic Capture &rarr; Valid OpenAPI Spec</span>
              </div>
            </div>
          </div>

          {/* 06: rea_bundle */}
          <div className="cyber-border-card rounded-2xl p-6 flex flex-col justify-between group">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="font-label-mono text-xs px-2.5 py-1 rounded-md bg-gradient-to-r from-emerald-500/20 to-purple-500/20 border border-emerald-400/30 text-white font-semibold">
                  06 / SUITE
                </span>
                <span className="material-symbols-outlined text-emerald-400 group-hover:rotate-12 transition-transform">
                  folder_zip
                </span>
              </div>
              <h3 className="text-lg font-bold text-white mb-2 font-mono">rea_bundle</h3>
              <p className="text-xs text-[#cbc4d2] leading-relaxed mb-4">
                Runs the complete reverse-engineering pipeline in parallel. Bundles architecture reports, unminified source code, types, and API specs into a single developer ZIP.
              </p>
            </div>
            <div>
              <div className="bg-black/40 rounded-lg p-2.5 border border-white/5 font-label-mono text-[11px] text-white/70 mb-3 flex items-center justify-between">
                <code>bundle_all(&#123; archive: true &#125;)</code>
                <button
                  className="text-white/40 hover:text-white cursor-pointer"
                  onClick={() => copyToClipboard('bundle_all({ archive: true })', 'copy-06')}
                >
                  <span className="material-symbols-outlined text-sm">
                    {copiedKey === "copy-06" ? "check" : "content_copy"}
                  </span>
                </button>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-label-mono text-emerald-300">
                <span>All Tools Executed &rarr; Standalone Artifact</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. DevPilot CLI Universal Suite */}
      <section className="py-20 px-4 sm:px-8 max-w-7xl mx-auto border-t border-white/10" id="cli">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
          <div>
            <div className="font-label-mono text-xs text-[#cfbcff] uppercase tracking-wider mb-2">
              COMMAND LINE SUITE
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
              Autonomous Shell Automation
            </h2>
            <p className="text-xs sm:text-sm text-[#cbc4d2] mt-2 max-w-xl">
              Execute browser commands, reconstruct project trees, and run testing flows directly from your terminal or AI shell subagent.
            </p>
          </div>
          <button
            onClick={() => copyToClipboard("npm install -g xtradevpilot", "cli-install")}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl font-label-mono text-xs border border-white/10 flex items-center gap-2 cursor-pointer transition-colors"
          >
            <span className="text-[#cfbcff]">$ npm i -g xtradevpilot</span>
            <span className="material-symbols-outlined text-sm">
              {copiedKey === "cli-install" ? "check" : "content_copy"}
            </span>
          </button>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-3">
            <div className="text-sm font-bold text-[#cfbcff] font-label-mono">
              devpilot reconstruct
            </div>
            <p className="text-xs text-[#cbc4d2]">
              Extracts complete original project from sourcemaps into clean <code className="text-[#cfbcff]">src/</code> folders.
            </p>
            <pre className="bg-black/60 p-3 rounded-xl font-label-mono text-[11px] text-[#cbc4d2] overflow-x-auto border border-white/5">
              $ devpilot reconstruct ./sources -o ./reconstructed
            </pre>
          </div>

          <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-3">
            <div className="text-sm font-bold text-[#e7c365] font-label-mono">
              devpilot trace-action
            </div>
            <p className="text-xs text-[#cbc4d2]">
              Clicks or submits UI elements and captures all correlated outbound HTTP/XHR mutations.
            </p>
            <pre className="bg-black/60 p-3 rounded-xl font-label-mono text-[11px] text-[#cbc4d2] overflow-x-auto border border-white/5">
              $ devpilot trace-action &quot;#submit-btn&quot; --action click --wait 2000
            </pre>
          </div>

          <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-3">
            <div className="text-sm font-bold text-emerald-400 font-label-mono">
              devpilot export-rea
            </div>
            <p className="text-xs text-[#cbc4d2]">
              Packages DOM, HAR traffic, storage, and discovered APIs into canonical REA Schema 2.0.0.
            </p>
            <pre className="bg-black/60 p-3 rounded-xl font-label-mono text-[11px] text-[#cbc4d2] overflow-x-auto border border-white/5">
              $ devpilot export-rea -o ./evidence.json
            </pre>
          </div>
        </div>
      </section>

      {/* 6. Interactive 40 MCP Tools Section */}
      <section className="py-20 px-4 sm:px-8 max-w-7xl mx-auto border-t border-white/10" id="tools">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-6">
          <div>
            <div className="font-label-mono text-xs text-[#cfbcff] uppercase tracking-wider mb-2">
              TOOL MATRIX
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
              40 Granular Browser Bridge Tools
            </h2>
            <p className="text-xs sm:text-sm text-[#cbc4d2] mt-2 max-w-xl">
              Every capability is exposed as an atomic MCP Tool. Agentic LLMs invoke commands via JSON-RPC over local WebSocket with deterministic typings.
            </p>
          </div>

          {/* Search Input Filter */}
          <div className="w-full md:w-72">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-white/40 text-lg">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search 40 MCP tools..."
                className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs font-label-mono text-white placeholder-white/40 focus:outline-none focus:border-[#cfbcff] transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 mb-8 font-label-mono text-xs">
          {[
            { id: "all", label: `All (${TOOLS_CATALOG.length})` },
            { id: "rea", label: "Reverse Eng (7)" },
            { id: "dom", label: "DOM & Elements (10)" },
            { id: "network", label: "Network & State (9)" },
            { id: "interaction", label: "Agent Action (7)" },
            { id: "system", label: "System & Tabs (7)" },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg border font-medium transition-all cursor-pointer ${
                activeCategory === cat.id
                  ? "bg-[#cfbcff]/20 text-[#cfbcff] border-[#cfbcff]/40 shadow-sm"
                  : "bg-white/5 text-[#cbc4d2] hover:text-white border-white/10"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Tools Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredTools.map((tool) => (
            <div
              key={tool.name}
              className="glass-panel rounded-xl p-4 border border-white/10 hover:border-[#cfbcff]/50 transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-label-mono px-2 py-0.5 rounded bg-white/5 text-[#cfbcff] border border-white/10">
                    {tool.badge}
                  </span>
                  <button
                    onClick={() => copyToClipboard(tool.name, tool.name)}
                    className="text-white/40 hover:text-white cursor-pointer"
                    title="Copy tool name"
                  >
                    <span className="material-symbols-outlined text-sm">
                      {copiedKey === tool.name ? "check" : "content_copy"}
                    </span>
                  </button>
                </div>
                <div className="text-xs font-mono font-bold text-white mb-1 group-hover:text-[#cfbcff] transition-colors">
                  {tool.name}
                </div>
                <p className="text-[11px] text-[#cbc4d2] leading-tight">
                  {tool.description}
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-white/5 text-[10px] font-label-mono text-white/50 truncate">
                returns: {tool.returns}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 7. Architecture & Data Flow */}
      <section className="py-24 px-4 sm:px-8 max-w-7xl mx-auto border-t border-white/10" id="architecture">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="font-label-mono text-xs text-[#22d3ee] uppercase tracking-wider mb-2">
            ZERO CLOUD RESIDENCY
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white">
            Local-First Architecture
          </h2>
          <p className="mt-3 text-sm sm:text-base text-[#cbc4d2]">
            Data stays strictly between your local browser and your IDE. No remote telemetry, no proxy servers.
          </p>
        </div>

        {/* Architecture Pipeline */}
        <div className="glass-panel rounded-2xl p-6 sm:p-10 border border-white/10 relative overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
            {/* Node 1: Chrome Extension */}
            <div className="bg-black/40 border border-white/10 rounded-xl p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-label-mono text-yellow-300 bg-yellow-500/10 px-2 py-0.5 rounded border border-yellow-500/20">
                    MV3 MANIFEST
                  </span>
                  <span className="material-symbols-outlined text-yellow-300">tab</span>
                </div>
                <h4 className="text-white font-bold text-base mb-1">Local Chrome Tab</h4>
                <p className="text-xs text-[#cbc4d2] leading-relaxed">
                  Standard Chrome Extension running inside developer browser. Direct DOM &amp; CDP access without sandboxing bottlenecks.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-white/5 text-[11px] font-label-mono text-yellow-400">
                Port: chrome.debugger
              </div>
            </div>

            {/* Node 2: DevPilot Core Server */}
            <div className="bg-[#181329]/90 border border-[#cfbcff]/30 rounded-xl p-5 flex flex-col justify-between shadow-[0_0_30px_rgba(103,80,164,0.2)]">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-label-mono text-[#cfbcff] bg-[#cfbcff]/15 px-2 py-0.5 rounded border border-[#cfbcff]/30">
                    WEBSOCKET SERVER
                  </span>
                  <span className="material-symbols-outlined text-[#cfbcff]">memory</span>
                </div>
                <h4 className="text-white font-bold text-base mb-1">Xtra DevPilot Core</h4>
                <p className="text-xs text-[#cbc4d2] leading-relaxed">
                  High-performance local bridge. Serializes Chrome events into standard MCP protocol messages.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-white/5 text-[11px] font-label-mono text-emerald-400 flex items-center justify-between">
                <span>ws://127.0.0.1:42819</span>
              </div>
            </div>

            {/* Node 3: AI Agents / IDE */}
            <div className="bg-black/40 border border-white/10 rounded-xl p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-label-mono text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                    MCP CLIENT
                  </span>
                  <span className="material-symbols-outlined text-cyan-300">smart_toy</span>
                </div>
                <h4 className="text-white font-bold text-base mb-1">Claude / Cursor / Antigravity</h4>
                <p className="text-xs text-[#cbc4d2] leading-relaxed">
                  Local MCP Client receives tool calls via stdio JSON-RPC. Direct execution with zero prompt latency.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-white/5 text-[11px] font-label-mono text-cyan-400">
                stdio: mcp-jsonrpc-2.0
              </div>
            </div>
          </div>

          {/* Packet Flow Indicator */}
          <div className="mt-8 pt-6 border-t border-white/10 flex items-center justify-between text-xs font-label-mono text-white/60">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>Secure Localhost Only</span>
            </div>
            <div className="hidden sm:block text-[#cbc4d2]">100% On-Device &bull; No Data Leaves Your Machine</div>
            <div className="text-emerald-400">&lt; 15ms Latency</div>
          </div>
        </div>
      </section>

      {/* 8. Integration Matrix & One-Click Configs */}
      <section className="py-20 px-4 sm:px-8 max-w-7xl mx-auto border-t border-white/10" id="integrations">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="font-label-mono text-xs text-[#cfbcff] uppercase tracking-wider mb-2">
            INTEGRATION MATRIX
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
            Plug into Your Favorite AI Environment
          </h2>
          <p className="mt-3 text-xs sm:text-sm text-[#cbc4d2]">
            Add one block to your configuration file to enable complete browser automation and reverse-engineering.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Claude Desktop */}
          <div className="glass-panel rounded-2xl p-6 border border-white/10 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="font-bold text-white text-base flex items-center gap-2">
                  <span className="material-symbols-outlined text-purple-400 text-xl">psychology</span>
                  Claude Desktop
                </div>
                <span className="text-[10px] font-label-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-300">
                  claude_desktop_config.json
                </span>
              </div>
              <pre className="bg-black/60 rounded-xl p-3 text-[11px] font-label-mono text-[#cbc4d2] overflow-x-auto border border-white/5">
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
                  "cfg-claude"
                )
              }
              className="mt-4 w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-label-mono text-white flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">
                {copiedKey === "cfg-claude" ? "check" : "content_copy"}
              </span>
              {copiedKey === "cfg-claude" ? "Copied Config!" : "Copy Config"}
            </button>
          </div>

          {/* Cursor IDE */}
          <div className="glass-panel rounded-2xl p-6 border border-white/10 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="font-bold text-white text-base flex items-center gap-2">
                  <span className="material-symbols-outlined text-cyan-400 text-xl">code</span>
                  Cursor IDE
                </div>
                <span className="text-[10px] font-label-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300">
                  Settings &gt; Features &gt; MCP
                </span>
              </div>
              <pre className="bg-black/60 rounded-xl p-3 text-[11px] font-label-mono text-[#cbc4d2] overflow-x-auto border border-white/5">
{`{
  "mcpServers": {
    "devpilot": {
      "type": "stdio",
      "command": "npx -y xtradevpilot-mcp"
    }
  }
}`}
              </pre>
            </div>
            <button
              onClick={() =>
                copyToClipboard("npx -y xtradevpilot-mcp", "cfg-cursor")
              }
              className="mt-4 w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-label-mono text-white flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">
                {copiedKey === "cfg-cursor" ? "check" : "content_copy"}
              </span>
              {copiedKey === "cfg-cursor" ? "Copied Command!" : "Copy Command"}
            </button>
          </div>

          {/* Google Antigravity */}
          <div className="glass-panel rounded-2xl p-6 border border-white/10 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="font-bold text-white text-base flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-400 text-xl">satellite_alt</span>
                  Google Antigravity
                </div>
                <span className="text-[10px] font-label-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300">
                  .gemini/config/mcp_config.json
                </span>
              </div>
              <pre className="bg-black/60 rounded-xl p-3 text-[11px] font-label-mono text-[#cbc4d2] overflow-x-auto border border-white/5">
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
                  "cfg-antigravity"
                )
              }
              className="mt-4 w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-label-mono text-white flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">
                {copiedKey === "cfg-antigravity" ? "check" : "content_copy"}
              </span>
              {copiedKey === "cfg-antigravity" ? "Copied Config!" : "Copy Config"}
            </button>
          </div>
        </div>
      </section>

      {/* 9. Minimal Footer */}
      <footer className="mt-auto border-t border-white/10 bg-[#09080e]/95 backdrop-blur-2xl py-12 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="relative h-8 w-8 rounded-lg overflow-hidden shadow-md shadow-[#22d3ee]/20 flex items-center justify-center bg-black/40 border border-white/10">
              <img
                src="/xtradevpilot_logo.png"
                alt="Xtra DevPilot Logo"
                className="h-full w-full object-contain p-0.5"
              />
            </div>
            <span className="text-white font-bold tracking-tight">Xtra DevPilot</span>
            <span className="text-xs text-white/40">&copy; 2026 Xtra Engine Inc.</span>
          </div>

          <div className="flex items-center gap-6 text-xs font-label-mono text-white/70">
            <span className="text-emerald-400">Bridge Port :42819</span>
            <a
              className="hover:text-white transition-colors"
              href="https://github.com/om0852/XtraDevPilot"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
            <Link className="hover:text-white transition-colors" href="/docs">
              Documentation
            </Link>
          </div>
        </div>
      </footer>

      {/* 10. Quickstart Installation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-2xl bg-[#14121c] border border-white/15 rounded-2xl shadow-2xl overflow-hidden glass-panel">
            <div className="h-1 w-full bg-gradient-to-r from-[#cfbcff] via-[#22d3ee] to-[#10b981]"></div>
            <div className="p-6 md:p-8 space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl md:text-2xl font-bold text-white">
                    Setup Xtra DevPilot
                  </h3>
                  <p className="text-xs sm:text-sm text-[#cbc4d2] mt-1 font-sans">
                    3 steps to bridge live Chrome directly into your AI editor.
                  </p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-white/40 hover:text-white transition-colors p-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-2xl">close</span>
                </button>
              </div>

              {/* Step 1 */}
              <div className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-[#cfbcff]/20 text-[#cfbcff] flex items-center justify-center font-bold text-xs font-label-mono">
                      1
                    </span>
                    <h4 className="font-bold text-white text-sm">Download Chrome Extension</h4>
                  </div>
                  <a
                    href="/xtradevpilot-extension.zip"
                    download="xtradevpilot-extension.zip"
                    className="bg-[#6750a4] hover:bg-[#7d65b9] text-white text-xs font-bold px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">download</span>
                    Download .ZIP
                  </a>
                </div>
                <p className="text-xs text-[#cbc4d2] pl-9">
                  Extract the downloaded ZIP file to a local folder.
                </p>
              </div>

              {/* Step 2 */}
              <div className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-2">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-yellow-500/20 text-yellow-300 flex items-center justify-center font-bold text-xs font-label-mono">
                    2
                  </span>
                  <h4 className="font-bold text-white text-sm">Load Unpacked in Chrome</h4>
                </div>
                <ol className="list-decimal pl-13 space-y-1 text-xs text-[#cbc4d2]">
                  <li>Navigate to <code className="bg-white/10 px-1.5 py-0.5 rounded text-yellow-300">chrome://extensions/</code> in Chrome.</li>
                  <li>Enable <span className="text-white font-semibold">Developer mode</span> in the top-right corner.</li>
                  <li>Click <span className="text-white font-semibold">Load unpacked</span> and select the extracted extension folder.</li>
                </ol>
              </div>

              {/* Step 3 */}
              <div className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-bold text-xs font-label-mono">
                      3
                    </span>
                    <h4 className="font-bold text-white text-sm">Start Local Bridge Server</h4>
                  </div>
                  <button
                    onClick={() => copyToClipboard("npx xtradevpilot-mcp", "modal-cmd")}
                    className="text-xs font-label-mono text-cyan-300 hover:underline cursor-pointer"
                  >
                    {copiedKey === "modal-cmd" ? "Copied" : "Copy Command"}
                  </button>
                </div>
                <div className="pl-9">
                  <div className="bg-black/60 p-2.5 rounded-lg border border-white/10 font-label-mono text-xs text-[#cfbcff] select-all">
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
                  View full documentation &rarr;
                </Link>
                <button
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2 bg-white/10 hover:bg-white/15 text-white text-xs font-label-mono rounded-lg transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

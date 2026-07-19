"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export default function DocsPage() {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [activeSection, setActiveSection] = useState<"installation" | "configuration" | "usage" | "security" | "support" | "settings">("installation");
  const [showModal, setShowModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ section: string; title: string }[]>([]);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage((curr) => (curr === message ? null : curr));
    }, 3000);
  };

  const searchIndex = [
    { section: "installation", title: "Installation Guide", keywords: "install browser extension github repository clone unpacked developer option" },
    { section: "installation", title: "MCP Server Setup", keywords: "install mcp server npm npx xtradevpilot-mcp bridge node" },
    { section: "configuration", title: "Claude Desktop Config", keywords: "claude desktop configuration json mcpServers command path" },
    { section: "configuration", title: "Cursor IDE Setup", keywords: "cursor ide settings features mcp server command" },
    { section: "usage", title: "get_dom_snapshot tool", keywords: "get_dom_snapshot tool html structure viewport dom snapshot" },
    { section: "usage", title: "capture_screenshot tool", keywords: "capture_screenshot base64 view tab debug image screenshot" },
    { section: "usage", title: "interact_with_page tool", keywords: "interact click type scroll inputs selectors page interaction" },
    { section: "usage", title: "evaluate_javascript tool", keywords: "evaluate javascript console log window code execution" },
    { section: "security", title: "Local-First Architecture", keywords: "local-first loop connection websocket private design security" },
    { section: "security", title: "Telemetry & Verbose Logs", keywords: "telemetry logs data collection verbose mode privacy" },
    { section: "support", title: "Troubleshooting Connection Issues", keywords: "red status disconnected websocket port 42819 occupied reload" },
    { section: "support", title: "IDE Server Timeouts", keywords: "ide timeout crash node dependencies npm install error" },
    { section: "settings", title: "Connection Settings", keywords: "settings host URL ws localhost reconnect port wsl custom" }
  ];

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    const filtered = searchIndex
      .filter(item => item.keywords.toLowerCase().includes(query.toLowerCase()) || item.title.toLowerCase().includes(query.toLowerCase()))
      .map(item => ({
        section: item.section,
        title: item.title
      }));
    setSearchResults(filtered);
  };

  useEffect(() => {
    // Hover effect on glass panels
    const handleMouseMove = (e: MouseEvent) => {
      const card = e.currentTarget as HTMLElement;
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      card.style.setProperty("--mouse-x", `${x}px`);
      card.style.setProperty("--mouse-y", `${y}px`);
    };

    const cards = document.querySelectorAll(".glass-card");
    cards.forEach((card) => {
      (card as HTMLElement).addEventListener("mousemove", handleMouseMove as EventListener);
    });

    // Smooth Scroll
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

    // Search Bar Focus Effect
    const searchInput = searchInputRef.current;
    const handleFocus = () => {
      searchInput?.parentElement?.classList.add("scale-105");
    };
    const handleBlur = () => {
      searchInput?.parentElement?.classList.remove("scale-105");
    };

    if (searchInput) {
      searchInput.addEventListener("focus", handleFocus);
      searchInput.addEventListener("blur", handleBlur);
    }

    return () => {
      cards.forEach((card) => {
        (card as HTMLElement).removeEventListener("mousemove", handleMouseMove as EventListener);
      });
      anchors.forEach((anchor) => {
        anchor.removeEventListener("click", handleAnchorClick as EventListener);
      });
      if (searchInput) {
        searchInput.removeEventListener("focus", handleFocus);
        searchInput.removeEventListener("blur", handleBlur);
      }
    };
  }, [activeSection]);

  return (
    <div className="selection:bg-primary/30 min-h-screen flex flex-col">
      {/* TopNavBar */}
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-margin-desktop h-16 bg-surface/40 backdrop-blur-[40px] border-b border-white/10 shadow-[0_0_20px_rgba(207,188,255,0.1)]">
        <Link href="/" className="flex items-center gap-4">
          <img
            alt="Xtra DevPilot Logo"
            className="h-8 w-8 object-contain rounded-sm"
            src="/android-chrome-512x512.png"
          />
          <span className="font-headline-lg text-headline-lg font-bold text-primary tracking-tighter">
            Xtra DevPilot
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-8">
          <Link
            className="font-body-md text-body-md text-on-surface-variant hover:text-primary transition-colors duration-200"
            href="/docs"
          >
            Docs
          </Link>
          <button
            onClick={() => showToast("Changelog is coming soon in v2.5.0!")}
            className="font-body-md text-body-md text-on-surface-variant hover:text-primary transition-colors duration-200 cursor-pointer"
          >
            Changelog
          </button>
          <button
            onClick={() => showToast("API Reference documentation is coming soon!")}
            className="font-body-md text-body-md text-on-surface-variant hover:text-primary transition-colors duration-200 cursor-pointer"
          >
            API
          </button>
          <button
            onClick={() => showToast("Community Hub is coming soon!")}
            className="font-body-md text-body-md text-on-surface-variant hover:text-primary transition-colors duration-200 cursor-pointer"
          >
            Community
          </button>
        </nav>
        <div className="flex items-center gap-6">
          {/* Search Bar */}
          <div className="relative hidden lg:block transition-all duration-300">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">
              search
            </span>
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="bg-[#0A0A0A] border border-white/10 text-on-surface py-2 pl-10 pr-4 rounded-sm font-label-mono text-label-mono w-64 focus:border-primary focus:ring-0 focus:outline-none transition-colors duration-300"
              placeholder="Search documentation..."
              type="text"
            />
            {/* Search Results Dropdown */}
            {searchResults.length > 0 && (
              <div className="absolute right-0 top-12 w-80 bg-[#141218] border border-white/10 rounded-sm shadow-2xl z-50 glass-card p-2 max-h-60 overflow-y-auto">
                <div className="font-label-mono text-xs text-primary/60 px-2 py-1 uppercase tracking-wider border-b border-white/5 mb-1">
                  Search Results
                </div>
                {searchResults.map((result, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setActiveSection(result.section as any);
                      setSearchQuery("");
                      setSearchResults([]);
                    }}
                    className="w-full text-left px-2 py-1.5 rounded-sm hover:bg-white/5 transition-colors font-body-md text-sm text-on-surface hover:text-primary flex flex-col"
                  >
                    <span className="font-semibold">{result.title}</span>
                    <span className="text-xs text-on-surface-variant font-label-mono capitalize">{result.section} docs</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <a
            className="flex items-center gap-2 font-label-mono text-label-mono text-on-surface-variant hover:text-primary transition-colors duration-200"
            href="https://github.com/om0852/XtraDevPilot"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="material-symbols-outlined">terminal</span>
            GitHub
          </a>
          <button
            onClick={() => setShowModal(true)}
            className="bg-primary text-on-primary font-body-md text-body-md px-6 py-2 rounded-sm hover:scale-105 active:scale-95 transition-all glow-accent cursor-pointer"
          >
            Get Started
          </button>
        </div>
      </header>

      {/* Sidebar Navigation */}
      <aside className="fixed left-0 top-16 bottom-0 w-[280px] z-40 flex flex-col bg-surface/40 backdrop-blur-[40px] border-r border-white/10 transition-all duration-300 ease-in-out">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-sm bg-primary/20 flex items-center justify-center text-primary border border-primary/30">
              <span className="material-symbols-outlined">menu_book</span>
            </div>
            <div>
              <div className="font-label-mono text-label-mono text-primary font-bold">
                Documentation
              </div>
              <div className="font-label-mono text-xs text-on-surface-variant opacity-60">
                v2.4.0
              </div>
            </div>
          </div>
          <nav className="space-y-1">
            <button
              onClick={() => setActiveSection("installation")}
              className={`w-full flex items-center gap-3 px-4 py-3 font-label-mono text-label-mono transition-all duration-200 rounded-sm text-left cursor-pointer group ${
                activeSection === "installation"
                  ? "text-primary bg-primary/10 border-r-2 border-primary"
                  : "text-on-surface-variant hover:bg-white/5 hover:text-on-surface"
              }`}
            >
              <span className="material-symbols-outlined text-xl group-hover:text-primary">
                download
              </span>
              Installation
            </button>
            <button
              onClick={() => setActiveSection("configuration")}
              className={`w-full flex items-center gap-3 px-4 py-3 font-label-mono text-label-mono transition-all duration-200 rounded-sm text-left cursor-pointer group ${
                activeSection === "configuration"
                  ? "text-primary bg-primary/10 border-r-2 border-primary"
                  : "text-on-surface-variant hover:bg-white/5 hover:text-on-surface"
              }`}
            >
              <span
                className="material-symbols-outlined text-xl"
                style={{ fontVariationSettings: activeSection === "configuration" ? "'FILL' 1" : "'FILL' 0" }}
              >
                settings
              </span>
              Configuration
            </button>
            <button
              onClick={() => setActiveSection("usage")}
              className={`w-full flex items-center gap-3 px-4 py-3 font-label-mono text-label-mono transition-all duration-200 rounded-sm text-left cursor-pointer group ${
                activeSection === "usage"
                  ? "text-primary bg-primary/10 border-r-2 border-primary"
                  : "text-on-surface-variant hover:bg-white/5 hover:text-on-surface"
              }`}
            >
              <span className="material-symbols-outlined text-xl group-hover:text-primary">
                terminal
              </span>
              Usage
            </button>
            <button
              onClick={() => setActiveSection("security")}
              className={`w-full flex items-center gap-3 px-4 py-3 font-label-mono text-label-mono transition-all duration-200 rounded-sm text-left cursor-pointer group ${
                activeSection === "security"
                  ? "text-primary bg-primary/10 border-r-2 border-primary"
                  : "text-on-surface-variant hover:bg-white/5 hover:text-on-surface"
              }`}
            >
              <span className="material-symbols-outlined text-xl group-hover:text-primary">
                security
              </span>
              Security
            </button>
          </nav>
        </div>
        <div className="mt-auto p-6 border-t border-white/5">
          <button
            onClick={() => setActiveSection("settings")}
            className="w-full py-3 bg-secondary-container/30 border border-secondary-container text-secondary font-label-mono text-label-mono rounded-sm hover:bg-secondary-container/50 transition-all mb-6 cursor-pointer"
          >
            Developer Portal
          </button>
          <nav className="space-y-1">
            <button
              onClick={() => setActiveSection("support")}
              className={`w-full flex items-center gap-3 px-4 py-2 font-label-mono text-label-mono transition-all duration-200 rounded-sm text-left cursor-pointer group ${
                activeSection === "support"
                  ? "text-primary bg-primary/10 border-r-2 border-primary"
                  : "text-on-surface-variant hover:bg-white/5 hover:text-on-surface"
              }`}
            >
              <span className="material-symbols-outlined text-lg">help</span>
              Support
            </button>
            <button
              onClick={() => setActiveSection("settings")}
              className={`w-full flex items-center gap-3 px-4 py-2 font-label-mono text-label-mono transition-all duration-200 rounded-sm text-left cursor-pointer group ${
                activeSection === "settings"
                  ? "text-primary bg-primary/10 border-r-2 border-primary"
                  : "text-on-surface-variant hover:bg-white/5 hover:text-on-surface"
              }`}
            >
              <span className="material-symbols-outlined text-lg">
                settings_accessibility
              </span>
              Settings
            </button>
          </nav>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="ml-[280px] mt-16 p-margin-desktop min-h-[calc(100vh-64px)] flex flex-col relative overflow-hidden flex-1">
        {/* Decorative Ambient Background */}
        <div className="absolute -top-[20%] -right-[10%] w-[600px] h-[600px] bg-primary/10 blur-[120px] rounded-full pointer-events-none"></div>
        <div className="absolute top-[40%] -left-[5%] w-[400px] h-[400px] bg-secondary/5 blur-[100px] rounded-full pointer-events-none"></div>

        <div className="max-w-[1000px] relative z-10 flex-1">
          {activeSection === "installation" && (
            <>
              {/* Breadcrumbs */}
              <div className="flex items-center gap-2 font-label-mono text-xs text-on-surface-variant/60 mb-6 uppercase tracking-widest">
                <span>Docs</span>
                <span className="material-symbols-outlined text-sm">
                  chevron_right
                </span>
                <span className="text-primary">Installation</span>
              </div>

              {/* Page Title */}
              <h1 className="font-display-lg text-display-lg mb-4 text-on-surface tracking-tighter">
                Getting Started with <span className="primary-gradient-text">Xtra DevPilot</span>
              </h1>
              <p className="font-body-md text-lg text-on-surface-variant max-w-2xl mb-12">
                Xtra DevPilot is an AI Browser Bridge for your IDE. Connect Chrome to an MCP-enabled AI assistant so it can inspect the live DOM, console, and network without leaving your editor.
              </p>

              {/* Content Sections */}
              <section className="space-y-12">
                {/* Section 1 */}
                <div className="group">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-[1px] w-8 bg-primary"></div>
                    <h2 className="font-headline-lg text-headline-lg text-on-surface">
                      1. Install the Browser Extension
                    </h2>
                  </div>
                  <p className="font-body-md text-on-surface-variant leading-relaxed mb-6">
                    Clone the official repository to download the extension. Then, open Chrome and load the <code className="bg-white/10 px-1 rounded font-label-mono text-sm">extension/</code> folder as an unpacked extension.
                  </p>
                  <button
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 bg-primary text-on-primary font-body-md px-6 py-3 rounded-sm hover:scale-105 active:scale-95 transition-all glow-accent cursor-pointer"
                  >
                    <span className="material-symbols-outlined">download</span>
                    Install Extension Guide
                  </button>
                </div>

                {/* Code Block Section */}
                <div className="space-y-4">
                  <div className="relative glass-card code-block-glow p-6 rounded-sm border border-white/10 overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-primary to-secondary"></div>
                    <pre className="font-code-sm text-code-sm leading-6 overflow-x-auto">
                      <code className="text-on-surface-variant">
                        git clone https://github.com/om0852/XtraDevPilot.git
                      </code>
                    </pre>
                  </div>
                </div>

                {/* Section 2 */}
                <div className="group">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-[1px] w-8 bg-secondary"></div>
                    <h2 className="font-headline-lg text-headline-lg text-on-surface">
                      2. Install the MCP Server
                    </h2>
                  </div>
                  <p className="font-body-md text-on-surface-variant leading-relaxed">
                    The MCP server acts as the bridge between your IDE and the browser extension. It is deployed on NPM, making it incredibly easy to run using <code className="bg-white/10 px-1 rounded font-label-mono text-sm">npx</code>.
                  </p>
                </div>

                {/* Code Block Section */}
                <div className="space-y-4">
                  <div className="relative glass-card code-block-glow p-6 rounded-sm border border-white/10 overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-secondary to-tertiary"></div>
                    <pre className="font-code-sm text-code-sm leading-6 overflow-x-auto">
                      <code className="text-on-surface-variant">
                        npx xtradevpilot-mcp
                      </code>
                    </pre>
                  </div>
                </div>

                {/* Bento Info Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter py-8">
                  <div className="glass-card p-6 rounded-sm hover:border-primary/40 transition-colors cursor-pointer group">
                    <div className="w-10 h-10 rounded-sm bg-primary/10 flex items-center justify-center text-primary mb-4 group-hover:scale-110 transition-transform">
                      <span className="material-symbols-outlined">visibility</span>
                    </div>
                    <h3 className="font-headline-lg text-xl text-on-surface mb-2">
                      DOM Inspection
                    </h3>
                    <p className="font-body-md text-on-surface-variant text-sm">
                      Reads live DOM and extracts an LLM-friendly view, automatically capturing browser screenshots.
                    </p>
                  </div>
                  <div className="glass-card p-6 rounded-sm hover:border-secondary/40 transition-colors cursor-pointer group">
                    <div className="w-10 h-10 rounded-sm bg-secondary/10 flex items-center justify-center text-secondary mb-4 group-hover:scale-110 transition-transform">
                      <span className="material-symbols-outlined">network_check</span>
                    </div>
                    <h3 className="font-headline-lg text-xl text-on-surface mb-2">
                      Network & Console
                    </h3>
                    <p className="font-body-md text-on-surface-variant text-sm">
                      Watches console logs and network requests directly inside your IDE without leaving the editor.
                    </p>
                  </div>
                </div>

                {/* Callout */}
                <div className="p-6 bg-primary/5 border border-primary/20 rounded-sm flex gap-4 items-start">
                  <span
                    className="material-symbols-outlined text-primary mt-1"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    info
                  </span>
                  <div>
                    <div className="font-body-md font-bold text-on-surface mb-1">
                      IDE Configuration
                    </div>
                    <p className="font-body-md text-on-surface-variant text-sm">
                      Remember to add the <code className="bg-white/10 px-1 rounded font-label-mono text-xs">npx xtradevpilot-mcp</code> command to your Cursor, Claude Desktop, or compatible MCP client's configuration to establish the bridge.
                    </p>
                  </div>
                </div>
              </section>
            </>
          )}

          {activeSection === "configuration" && (
            <>
              {/* Breadcrumbs */}
              <div className="flex items-center gap-2 font-label-mono text-xs text-on-surface-variant/60 mb-6 uppercase tracking-widest">
                <span>Docs</span>
                <span className="material-symbols-outlined text-sm">chevron_right</span>
                <span className="text-secondary">Configuration</span>
              </div>

              {/* Page Title */}
              <h1 className="font-display-lg text-display-lg mb-4 text-on-surface tracking-tighter">
                Bridge <span className="primary-gradient-text">Configuration</span>
              </h1>
              <p className="font-body-md text-lg text-on-surface-variant max-w-2xl mb-12">
                Set up Xtra DevPilot in your favorite IDEs or MCP clients. The local bridge server uses WebSocket port <code className="bg-white/10 px-1.5 py-0.5 rounded font-label-mono text-sm text-secondary">42819</code>.
              </p>

              <section className="space-y-12">
                <div className="group">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-[1px] w-8 bg-secondary"></div>
                    <h2 className="font-headline-lg text-headline-lg text-on-surface">
                      Claude Desktop Configuration
                    </h2>
                  </div>
                  <p className="font-body-md text-on-surface-variant leading-relaxed mb-4">
                    Add the server to your Claude Desktop configuration file:
                  </p>
                  <div className="font-label-mono text-xs text-outline mb-2">
                    File Location: <code className="bg-white/15 px-1 py-0.5 rounded">%appdata%\Claude\claude_desktop_config.json</code> (Windows) or <code className="bg-white/15 px-1 py-0.5 rounded">~/Library/Application Support/Claude/claude_desktop_config.json</code> (macOS)
                  </div>
                  <div className="relative glass-card code-block-glow p-6 rounded-sm border border-white/10 overflow-hidden">
                    <pre className="font-code-sm text-code-sm leading-6 overflow-x-auto">
                      <code className="text-on-surface-variant">
{`{
  "mcpServers": {
    "xtra-devpilot": {
      "command": "npx",
      "args": ["-y", "xtradevpilot-mcp"]
    }
  }
}`}
                      </code>
                    </pre>
                  </div>
                </div>

                <div className="group">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-[1px] w-8 bg-primary"></div>
                    <h2 className="font-headline-lg text-headline-lg text-on-surface">
                      Cursor IDE Configuration
                    </h2>
                  </div>
                  <p className="font-body-md text-on-surface-variant leading-relaxed mb-4">
                    To configure Cursor to communicate with your browser, perform the following steps:
                  </p>
                  <ul className="list-decimal pl-6 space-y-2 font-body-md text-on-surface-variant text-sm">
                    <li>Open Cursor settings, then navigate to the <span className="text-primary font-bold">Features</span> tab.</li>
                    <li>Scroll down to the <span className="text-primary font-bold">MCP</span> section.</li>
                    <li>Click <span className="text-primary font-bold">+ Add New MCP Server</span>.</li>
                    <li>Enter the following details:
                      <ul className="list-disc pl-6 mt-1 space-y-1">
                        <li>Name: <code className="bg-white/10 px-1 rounded">Xtra DevPilot</code></li>
                        <li>Type: <code className="bg-white/10 px-1 rounded">command</code></li>
                        <li>Command: <code className="bg-white/10 px-1 rounded">npx -y xtradevpilot-mcp</code></li>
                      </ul>
                    </li>
                    <li>Click <span className="text-primary font-bold">Save</span>. The server status should display green if connected.</li>
                  </ul>
                </div>
              </section>
            </>
          )}

          {activeSection === "usage" && (
            <>
              {/* Breadcrumbs */}
              <div className="flex items-center gap-2 font-label-mono text-xs text-on-surface-variant/60 mb-6 uppercase tracking-widest">
                <span>Docs</span>
                <span className="material-symbols-outlined text-sm">chevron_right</span>
                <span className="text-tertiary">Usage</span>
              </div>

              {/* Page Title */}
              <h1 className="font-display-lg text-display-lg mb-4 text-on-surface tracking-tighter">
                Command & <span className="primary-gradient-text">Usage Guide</span>
              </h1>
              <p className="font-body-md text-lg text-on-surface-variant max-w-2xl mb-12">
                Once the bridge is active, you can interact with your browser directly from your AI agent. Here are the core capabilities and sample prompts.
              </p>

              <section className="space-y-12">
                <div className="group">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-[1px] w-8 bg-tertiary"></div>
                    <h2 className="font-headline-lg text-headline-lg text-on-surface">
                      Supported MCP Tools
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter py-4">
                    <div className="glass-card p-6 rounded-sm border border-white/10">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="material-symbols-outlined text-primary">analytics</span>
                        <h4 className="font-bold text-on-surface font-headline-lg text-base">get_dom_snapshot</h4>
                      </div>
                      <p className="text-sm text-on-surface-variant">
                        Extracts a highly condensed, semantic, LLM-optimized representation of the DOM tree. Includes element attributes and viewport visibility status.
                      </p>
                    </div>
                    <div className="glass-card p-6 rounded-sm border border-white/10">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="material-symbols-outlined text-secondary">photo_camera</span>
                        <h4 className="font-bold text-on-surface font-headline-lg text-base">capture_screenshot</h4>
                      </div>
                      <p className="text-sm text-on-surface-variant">
                        Takes a live, high-resolution screenshot of the currently active browser tab. Returns it as base64 or saves it to your workspace.
                      </p>
                    </div>
                    <div className="glass-card p-6 rounded-sm border border-white/10">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="material-symbols-outlined text-tertiary">mouse</span>
                        <h4 className="font-bold text-on-surface font-headline-lg text-base">interact_with_page</h4>
                      </div>
                      <p className="text-sm text-on-surface-variant">
                        Performs browser actions like `click` on elements (by CSS selector or coordinates), `type` text into input fields, or `scroll` down the page.
                      </p>
                    </div>
                    <div className="glass-card p-6 rounded-sm border border-white/10">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="material-symbols-outlined text-primary">code</span>
                        <h4 className="font-bold text-on-surface font-headline-lg text-base">evaluate_javascript</h4>
                      </div>
                      <p className="text-sm text-on-surface-variant">
                        Evaluates custom JavaScript code in the context of the active tab. Useful for reading window state or running test assertions.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="group">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-[1px] w-8 bg-primary"></div>
                    <h2 className="font-headline-lg text-headline-lg text-on-surface">
                      Example Prompts
                    </h2>
                  </div>
                  <p className="font-body-md text-on-surface-variant leading-relaxed mb-4">
                    Try these instructions inside Cursor Composer or your MCP-enabled chat client:
                  </p>
                  <div className="space-y-3 font-label-mono text-sm">
                    <div className="bg-[#0A0A0A] border border-white/10 p-4 rounded-sm text-on-surface-variant">
                      &gt; "Look at the current tab and inspect the header. Why is the logo misaligned on mobile?"
                    </div>
                    <div className="bg-[#0A0A0A] border border-white/10 p-4 rounded-sm text-on-surface-variant">
                      &gt; "Click the settings button, navigate to general, and toggle developer mode."
                    </div>
                    <div className="bg-[#0A0A0A] border border-white/10 p-4 rounded-sm text-on-surface-variant">
                      &gt; "Check the active page console and let me know if there are any CORS warnings."
                    </div>
                  </div>
                </div>
              </section>
            </>
          )}

          {activeSection === "security" && (
            <>
              {/* Breadcrumbs */}
              <div className="flex items-center gap-2 font-label-mono text-xs text-on-surface-variant/60 mb-6 uppercase tracking-widest">
                <span>Docs</span>
                <span className="material-symbols-outlined text-sm">chevron_right</span>
                <span className="text-error">Security</span>
              </div>

              {/* Page Title */}
              <h1 className="font-display-lg text-display-lg mb-4 text-on-surface tracking-tighter">
                Security & <span className="primary-gradient-text">Privacy Principles</span>
              </h1>
              <p className="font-body-md text-lg text-on-surface-variant max-w-2xl mb-12">
                Xtra DevPilot is built to be private by design. Your code, browser sessions, and secrets never leave your local environment.
              </p>

              <section className="space-y-12">
                <div className="p-6 bg-error-container/10 border border-error/20 rounded-sm flex gap-4 items-start">
                  <span className="material-symbols-outlined text-error mt-1" style={{ fontVariationSettings: "'FILL' 1" }}>
                    security
                  </span>
                  <div>
                    <div className="font-body-md font-bold text-on-surface mb-1">
                      Zero Cloud Residency
                    </div>
                    <p className="font-body-md text-on-surface-variant text-sm">
                      Unlike traditional browser-automation tools, Xtra DevPilot has zero cloud storage. No data is stored, cached, or compiled on third-party cloud infrastructure.
                    </p>
                  </div>
                </div>

                <div className="group">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-[1px] w-8 bg-error"></div>
                    <h2 className="font-headline-lg text-headline-lg text-on-surface">
                      Local Loop Communication
                    </h2>
                  </div>
                  <p className="font-body-md text-on-surface-variant leading-relaxed">
                    Communication between the Chrome extension and the IDE occurs via a local WebSocket connection (port <code className="bg-white/10 px-1 rounded font-label-mono text-sm">42819</code>). This loop is fully contained inside your operating system's local loopback network (<code className="bg-white/10 px-1 rounded font-label-mono text-sm">127.0.0.1</code>), bypassing external networks.
                  </p>
                </div>

                <div className="group">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-[1px] w-8 bg-secondary"></div>
                    <h2 className="font-headline-lg text-headline-lg text-on-surface">
                      Telemetry & Logs
                    </h2>
                  </div>
                  <p className="font-body-md text-on-surface-variant leading-relaxed">
                    No background analytics or data collection processes are enabled. You can inspect all payload logs in real-time by launching the server in verbose mode:
                  </p>
                  <div className="mt-4 relative glass-card code-block-glow p-6 rounded-sm border border-white/10 overflow-hidden">
                    <pre className="font-code-sm text-code-sm leading-6 overflow-x-auto">
                      <code className="text-on-surface-variant">
                        npx xtradevpilot-mcp --verbose
                      </code>
                    </pre>
                  </div>
                </div>
              </section>
            </>
          )}

          {activeSection === "support" && (
            <>
              {/* Breadcrumbs */}
              <div className="flex items-center gap-2 font-label-mono text-xs text-on-surface-variant/60 mb-6 uppercase tracking-widest">
                <span>Docs</span>
                <span className="material-symbols-outlined text-sm">chevron_right</span>
                <span className="text-primary">Support</span>
              </div>

              {/* Page Title */}
              <h1 className="font-display-lg text-display-lg mb-4 text-on-surface tracking-tighter">
                Support & <span className="primary-gradient-text">Troubleshooting</span>
              </h1>
              <p className="font-body-md text-lg text-on-surface-variant max-w-2xl mb-12">
                Resolve common configuration and connection issues with this troubleshooting guide.
              </p>

              <section className="space-y-12">
                <div className="space-y-6">
                  <div className="border border-white/10 rounded-sm p-6 bg-white/5">
                    <h3 className="font-bold text-on-surface text-base mb-2">Extension shows a red disconnected status</h3>
                    <p className="text-sm text-on-surface-variant">
                      This means the extension is unable to connect to the local WebSocket server.
                    </p>
                    <ul className="list-disc pl-6 mt-2 space-y-1 text-sm text-on-surface-variant">
                      <li>Ensure you have run the MCP server using <code className="bg-white/10 px-1 rounded">npx xtradevpilot-mcp</code> in your terminal.</li>
                      <li>Check that the port <code className="bg-white/10 px-1 rounded">42819</code> is not being used by another process.</li>
                      <li>Reload the extension in Chrome: go to <code className="bg-white/10 px-1 rounded">chrome://extensions/</code> and click the reload icon.</li>
                    </ul>
                  </div>

                  <div className="border border-white/10 rounded-sm p-6 bg-white/5">
                    <h3 className="font-bold text-on-surface text-base mb-2">IDE client reports "server disconnected" or timeouts</h3>
                    <p className="text-sm text-on-surface-variant">
                      Some IDEs spin up the MCP server process in isolation, which might fail if dependencies are not correctly resolved.
                    </p>
                    <ul className="list-disc pl-6 mt-2 space-y-1 text-sm text-on-surface-variant">
                      <li>Ensure Node.js is installed on your system path (v18.0.0 or higher recommended).</li>
                      <li>If you are running the MCP server from a cloned copy of the repository, navigate to the <code className="bg-white/10 px-1 rounded">mcp-server/</code> directory and verify dependencies:
                        <div className="mt-2 bg-[#0A0A0A] border border-white/10 px-3 py-2 rounded-sm font-code-sm text-xs text-on-surface-variant select-all w-fit">
                          cd mcp-server && npm install
                        </div>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="p-6 bg-primary/5 border border-primary/20 rounded-sm flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-on-surface font-headline-lg text-base">Still need help?</h4>
                    <p className="text-sm text-on-surface-variant mt-1 font-body-md">Join the community on Discord or create a ticket on GitHub.</p>
                  </div>
                  <div className="flex gap-3">
                    <a href="https://github.com/om0852/XtraDevPilot/issues" target="_blank" rel="noopener noreferrer" className="bg-[#0A0A0A] border border-white/10 text-on-surface-variant px-4 py-2 font-label-mono text-xs hover:text-primary transition-all flex items-center justify-center">
                      GitHub Issues
                    </a>
                    <button
                      onClick={() => showToast("Discord link is coming soon!")}
                      className="bg-primary text-on-primary px-4 py-2 font-label-mono text-xs hover:scale-105 transition-all cursor-pointer"
                    >
                      Join Discord
                    </button>
                  </div>
                </div>
              </section>
            </>
          )}

          {activeSection === "settings" && (
            <>
              {/* Breadcrumbs */}
              <div className="flex items-center gap-2 font-label-mono text-xs text-on-surface-variant/60 mb-6 uppercase tracking-widest">
                <span>Docs</span>
                <span className="material-symbols-outlined text-sm">chevron_right</span>
                <span className="text-secondary">Settings</span>
              </div>

              {/* Page Title */}
              <h1 className="font-display-lg text-display-lg mb-4 text-on-surface tracking-tighter">
                Extension <span className="primary-gradient-text">Settings</span>
              </h1>
              <p className="font-body-md text-lg text-on-surface-variant max-w-2xl mb-12">
                Configure the default behavior and network properties of the Xtra DevPilot browser extension.
              </p>

              <section className="space-y-12">
                <div className="group">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-[1px] w-8 bg-secondary"></div>
                    <h2 className="font-headline-lg text-headline-lg text-on-surface">
                      Configuring Connection Endpoint
                    </h2>
                  </div>
                  <p className="font-body-md text-on-surface-variant leading-relaxed mb-4 text-sm">
                    By default, the browser extension links to the local host address. If you run your MCP client or server inside a container or VM (such as WSL), you may need to configure a custom endpoint:
                  </p>
                  <ul className="list-decimal pl-6 space-y-3 font-body-md text-on-surface-variant text-sm">
                    <li>Click the <span className="text-secondary font-bold font-body-md">Xtra DevPilot</span> extension icon in your Chrome toolbar.</li>
                    <li>In the popup menu, choose <span className="text-secondary font-bold font-body-md">Connection Settings</span>.</li>
                    <li>Update the URL to your target workspace (e.g. <code className="bg-white/10 px-1 rounded font-label-mono">ws://127.0.0.1:42819</code> or a custom tunnel address).</li>
                    <li>Click <span className="text-secondary font-bold font-body-md">Reconnect</span> to apply changes.</li>
                  </ul>
                </div>
              </section>
            </>
          )}
        </div>

        {/* Footer */}
        <footer className="w-full py-8 flex flex-col md:flex-row justify-between items-center mt-20 border-t border-white/10">
          <div className="mb-4 md:mb-0">
            <p className="font-label-mono text-label-mono text-on-surface-variant opacity-60">
              © 2024 Xtra DevPilot. Built for elite engineers.
            </p>
          </div>
          <div className="flex gap-8">
            <a
              className="font-label-mono text-label-mono text-on-surface-variant hover:text-tertiary transition-colors"
              href="https://github.com/om0852/XtraDevPilot"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
            <button
              onClick={() => showToast("Discord link is coming soon!")}
              className="font-label-mono text-label-mono text-on-surface-variant hover:text-tertiary transition-colors cursor-pointer"
            >
              Discord
            </button>
            <button
              onClick={() => showToast("All local bridge systems are online.")}
              className="font-label-mono text-label-mono text-on-surface-variant hover:text-tertiary transition-colors cursor-pointer"
            >
              Status
            </button>
            <button
              onClick={() => showToast("MIT License")}
              className="font-label-mono text-label-mono text-on-surface-variant hover:text-tertiary transition-colors cursor-pointer"
            >
              Terms
            </button>
          </div>
        </footer>
      </main>

      {/* Elegant Installation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="relative w-full max-w-2xl bg-[#141218] border border-white/10 rounded-sm shadow-2xl overflow-hidden glass-card">
            {/* Accent strip */}
            <div className="h-1.5 w-full bg-gradient-to-r from-primary via-secondary to-tertiary"></div>
            
            <div className="p-6 md:p-8">
              {/* Header */}
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="font-headline-lg text-2xl font-bold text-on-surface">
                    Install Xtra DevPilot Extension
                  </h3>
                  <p className="text-sm text-on-surface-variant mt-1 font-body-md">
                    Follow these steps to set up the browser bridge in Chrome.
                  </p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-on-surface-variant hover:text-primary transition-colors focus:outline-none cursor-pointer"
                >
                  <span className="material-symbols-outlined text-2xl">close</span>
                </button>
              </div>

              {/* Steps */}
              <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
                {/* Step 1: Download */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 text-primary border border-primary/30 flex items-center justify-center font-label-mono font-bold text-sm">
                    1
                  </div>
                  <div>
                    <h4 className="font-bold text-on-surface text-base font-body-md">Get the Extension Source</h4>
                    <p className="text-sm text-on-surface-variant mt-1 font-body-md">
                      Download or clone the official repository from GitHub:
                    </p>
                    <div className="mt-3 flex flex-wrap gap-3 items-center">
                      <a
                        href="https://github.com/om0852/XtraDevPilot"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 bg-primary text-on-primary px-4 py-2 rounded-sm font-label-mono text-xs hover:scale-105 transition-all"
                      >
                        <span className="material-symbols-outlined text-sm">open_in_new</span>
                        GitHub Repository
                      </a>
                      <div className="bg-[#0A0A0A] border border-white/10 px-3 py-2 rounded-sm font-code-sm text-xs text-on-surface-variant select-all">
                        git clone https://github.com/om0852/XtraDevPilot.git
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step 2: Developer Mode */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary/20 text-secondary border border-secondary/30 flex items-center justify-center font-label-mono font-bold text-sm">
                    2
                  </div>
                  <div>
                    <h4 className="font-bold text-on-surface text-base font-body-md">Enable Chrome Developer Mode</h4>
                    <p className="text-sm text-on-surface-variant mt-1 font-body-md">
                      Open a new tab in Google Chrome and enter <code className="bg-white/10 px-1 rounded font-label-mono text-xs text-secondary">chrome://extensions/</code> in the address bar.
                    </p>
                    <p className="text-sm text-on-surface-variant mt-1 font-body-md">
                      In the top-right corner of the Extensions page, turn on the <span className="text-secondary font-bold font-body-md">Developer mode</span> switch.
                    </p>
                  </div>
                </div>

                {/* Step 3: Load Unpacked */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-tertiary/20 text-tertiary border border-tertiary/30 flex items-center justify-center font-label-mono font-bold text-sm">
                    3
                  </div>
                  <div>
                    <h4 className="font-bold text-on-surface text-base font-body-md">Load Unpacked Extension</h4>
                    <p className="text-sm text-on-surface-variant mt-1 font-body-md">
                      Click the <span className="text-tertiary font-bold font-body-md">Load unpacked</span> button in the top-left corner.
                    </p>
                    <p className="text-sm text-on-surface-variant mt-1 font-body-md">
                      Select the <code className="bg-white/10 px-1 rounded font-label-mono text-xs">extension/</code> folder within your cloned <code className="bg-white/10 px-1 rounded font-label-mono text-xs">XtraDevPilot</code> directory.
                    </p>
                  </div>
                </div>

                {/* Step 4: Verification */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 text-primary border border-primary/30 flex items-center justify-center font-label-mono font-bold text-sm">
                    4
                  </div>
                  <div>
                    <h4 className="font-bold text-on-surface text-base font-body-md">Verify Connection</h4>
                    <p className="text-sm text-on-surface-variant mt-1 font-body-md">
                      Once loaded, the Xtra DevPilot extension icon will appear in your toolbar. Pin it, then start your local MCP bridge:
                    </p>
                    <div className="mt-2 bg-[#0A0A0A] border border-white/10 px-3 py-2 rounded-sm font-code-sm text-xs text-on-surface-variant select-all w-fit">
                      npx xtradevpilot-mcp
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="mt-8 pt-4 border-t border-white/10 flex justify-end">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2 border border-white/10 text-on-surface hover:bg-white/5 font-label-mono text-xs rounded-sm transition-all cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      <div
        className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-4 py-3 bg-[#141218] border border-primary/30 text-on-surface rounded-sm shadow-lg backdrop-blur-md transition-all duration-300 ${
          toastMessage ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
        }`}
      >
        <span className="material-symbols-outlined text-primary">info</span>
        <span className="font-label-mono text-sm">{toastMessage}</span>
      </div>
    </div>
  );
}

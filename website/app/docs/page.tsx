"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

export default function DocsPage() {
  const searchInputRef = useRef<HTMLInputElement>(null);

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
      if (href && href.startsWith("#")) {
        e.preventDefault();
        document.querySelector(href)?.scrollIntoView({
          behavior: "smooth",
        });
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
  }, []);

  return (
    <div className="selection:bg-primary/30 min-h-screen flex flex-col">
      {/* TopNavBar */}
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-margin-desktop h-16 bg-surface/40 backdrop-blur-[40px] border-b border-white/10 shadow-[0_0_20px_rgba(207,188,255,0.1)]">
        <Link href="/" className="flex items-center gap-4">
          <img
            alt="Xtra DevPilot Logo"
            className="h-8 w-8 object-contain"
            src="/xtradevpilot_logo.png"
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
          <a
            className="font-body-md text-body-md text-on-surface-variant hover:text-primary transition-colors duration-200"
            href="#"
          >
            Changelog
          </a>
          <a
            className="font-body-md text-body-md text-on-surface-variant hover:text-primary transition-colors duration-200"
            href="#"
          >
            API
          </a>
          <a
            className="font-body-md text-body-md text-on-surface-variant hover:text-primary transition-colors duration-200"
            href="#"
          >
            Community
          </a>
        </nav>
        <div className="flex items-center gap-6">
          {/* Search Bar */}
          <div className="relative hidden lg:block transition-all duration-300">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">
              search
            </span>
            <input
              ref={searchInputRef}
              className="bg-[#0A0A0A] border border-white/10 text-on-surface py-2 pl-10 pr-4 rounded-sm font-label-mono text-label-mono w-64 focus:border-primary focus:ring-0 focus:outline-none transition-colors duration-300"
              placeholder="Search documentation..."
              type="text"
            />
          </div>
          <a
            className="flex items-center gap-2 font-label-mono text-label-mono text-on-surface-variant hover:text-primary transition-colors duration-200"
            href="https://github.com"
          >
            <span className="material-symbols-outlined">terminal</span>
            GitHub
          </a>
          <button className="bg-primary text-on-primary font-body-md text-body-md px-6 py-2 rounded-sm hover:scale-105 active:scale-95 transition-all glow-accent">
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
            <a
              className="flex items-center gap-3 px-4 py-3 font-label-mono text-label-mono text-on-surface-variant hover:bg-white/5 hover:text-on-surface transition-all duration-200 rounded-sm group"
              href="#"
            >
              <span className="material-symbols-outlined text-xl group-hover:text-primary">
                download
              </span>
              Installation
            </a>
            <a
              className="flex items-center gap-3 px-4 py-3 font-label-mono text-label-mono text-primary bg-primary/10 border-r-2 border-primary transition-all duration-200 rounded-sm"
              href="#"
            >
              <span
                className="material-symbols-outlined text-xl"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                settings
              </span>
              Configuration
            </a>
            <a
              className="flex items-center gap-3 px-4 py-3 font-label-mono text-label-mono text-on-surface-variant hover:bg-white/5 hover:text-on-surface transition-all duration-200 rounded-sm group"
              href="#"
            >
              <span className="material-symbols-outlined text-xl group-hover:text-primary">
                terminal
              </span>
              Usage
            </a>
            <a
              className="flex items-center gap-3 px-4 py-3 font-label-mono text-label-mono text-on-surface-variant hover:bg-white/5 hover:text-on-surface transition-all duration-200 rounded-sm group"
              href="#"
            >
              <span className="material-symbols-outlined text-xl group-hover:text-primary">
                security
              </span>
              Security
            </a>
          </nav>
        </div>
        <div className="mt-auto p-6 border-t border-white/5">
          <button className="w-full py-3 bg-secondary-container/30 border border-secondary-container text-secondary font-label-mono text-label-mono rounded-sm hover:bg-secondary-container/50 transition-all mb-6">
            Developer Portal
          </button>
          <nav className="space-y-1">
            <a
              className="flex items-center gap-3 px-4 py-2 font-label-mono text-label-mono text-on-surface-variant hover:text-on-surface"
              href="#"
            >
              <span className="material-symbols-outlined text-lg">help</span>
              Support
            </a>
            <a
              className="flex items-center gap-3 px-4 py-2 font-label-mono text-label-mono text-on-surface-variant hover:text-on-surface"
              href="#"
            >
              <span className="material-symbols-outlined text-lg">
                settings_accessibility
              </span>
              Settings
            </a>
          </nav>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="ml-[280px] mt-16 p-margin-desktop min-h-[calc(100vh-64px)] flex flex-col relative overflow-hidden flex-1">
        {/* Decorative Ambient Background */}
        <div className="absolute -top-[20%] -right-[10%] w-[600px] h-[600px] bg-primary/10 blur-[120px] rounded-full pointer-events-none"></div>
        <div className="absolute top-[40%] -left-[5%] w-[400px] h-[400px] bg-secondary/5 blur-[100px] rounded-full pointer-events-none"></div>

        <div className="max-w-[1000px] relative z-10 flex-1">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 font-label-mono text-xs text-on-surface-variant/60 mb-6 uppercase tracking-widest">
            <span>Docs</span>
            <span className="material-symbols-outlined text-sm">
              chevron_right
            </span>
            <span className="text-primary">Configuration</span>
          </div>

          {/* Page Title */}
          <h1 className="font-display-lg text-display-lg mb-4 text-on-surface tracking-tighter">
            Configuring your <span className="primary-gradient-text">MCP Server</span>
          </h1>
          <p className="font-body-md text-lg text-on-surface-variant max-w-2xl mb-12">
            The Model Context Protocol (MCP) server is the brain of your
            development pilot. Properly configuring the `mcp_config.json` allows
            the AI to access the correct kernels, runtime environments, and
            local resource endpoints.
          </p>

          {/* Content Sections */}
          <section className="space-y-12">
            {/* Section 1 */}
            <div className="group">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-[1px] w-8 bg-primary"></div>
                <h2 className="font-headline-lg text-headline-lg text-on-surface">
                  Server Architecture
                </h2>
              </div>
              <p className="font-body-md text-on-surface-variant leading-relaxed">
                Xtra DevPilot uses a dual-node architecture to ensure
                high-performance code inference while maintaining local security
                boundaries. By defining your server context, you're telling the
                Pilot exactly which files and services it has permission to
                interact with.
              </p>
            </div>

            {/* Code Block Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-label-mono text-label-mono text-on-surface">
                  <span className="material-symbols-outlined text-primary">
                    description
                  </span>
                  mcp_config.json
                </div>
                <button className="font-label-mono text-xs text-on-surface-variant hover:text-primary flex items-center gap-1 transition-colors">
                  <span className="material-symbols-outlined text-sm">
                    content_copy
                  </span>
                  Copy code
                </button>
              </div>
              <div className="relative glass-card code-block-glow p-6 rounded-sm border border-white/10 overflow-hidden">
                {/* Neon Accent Line */}
                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-primary to-secondary"></div>
                <pre className="font-code-sm text-code-sm leading-6 overflow-x-auto">
                  <code className="text-on-surface-variant">
                    {"{\n"}
                    {'  '}<span className="text-tertiary">"server_name"</span>: <span className="text-secondary">"xtra-pilot-core"</span>,{"\n"}
                    {'  '}<span className="text-tertiary">"version"</span>: <span className="text-secondary">"2.4.0-stable"</span>,{"\n"}
                    {'  '}<span className="text-tertiary">"runtime"</span>: {"{\n"}
                    {'    '}<span className="text-tertiary">"engine"</span>: <span className="text-secondary">"node-20"</span>,{"\n"}
                    {'    '}<span className="text-tertiary">"memory_limit"</span>: <span className="text-secondary">"4096MB"</span>,{"\n"}
                    {'    '}<span className="text-tertiary">"accelerator"</span>: <span className="text-primary">true</span>{"\n"}
                    {'  '}{"},\n"}
                    {'  '}<span className="text-tertiary">"security"</span>: {"{\n"}
                    {'    '}<span className="text-tertiary">"sandbox"</span>: <span className="text-primary">true</span>,{"\n"}
                    {'    '}<span className="text-tertiary">"allow_external_apis"</span>: [<span className="text-secondary">"api.github.com"</span>, <span className="text-secondary">"openai.com"</span>],{"\n"}
                    {'    '}<span className="text-tertiary">"local_path_whitelist"</span>: [<span className="text-secondary">"./src"</span>, <span className="text-secondary">"./tests"</span>]{"\n"}
                    {'  '}{"},\n"}
                    {'  '}<span className="text-tertiary">"telemetry"</span>: {"{\n"}
                    {'    '}<span className="text-tertiary">"enabled"</span>: <span className="text-primary">false</span>,{"\n"}
                    {'    '}<span className="text-tertiary">"log_level"</span>: <span className="text-secondary">"debug"</span>{"\n"}
                    {'  '}{"}\n"}
                    {"}\n"}
                  </code>
                </pre>
              </div>
            </div>

            {/* Bento Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter py-8">
              <div className="glass-card p-6 rounded-sm hover:border-primary/40 transition-colors cursor-pointer group">
                <div className="w-10 h-10 rounded-sm bg-primary/10 flex items-center justify-center text-primary mb-4 group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined">memory</span>
                </div>
                <h3 className="font-headline-lg text-xl text-on-surface mb-2">
                  Memory Allocation
                </h3>
                <p className="font-body-md text-on-surface-variant text-sm">
                  Configure the `memory_limit` to prevent the pilot from
                  consuming excessive system resources during large codebase
                  indexing.
                </p>
              </div>
              <div className="glass-card p-6 rounded-sm hover:border-secondary/40 transition-colors cursor-pointer group">
                <div className="w-10 h-10 rounded-sm bg-secondary/10 flex items-center justify-center text-secondary mb-4 group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined">shield</span>
                </div>
                <h3 className="font-headline-lg text-xl text-on-surface mb-2">
                  Sandbox Isolation
                </h3>
                <p className="font-body-md text-on-surface-variant text-sm">
                  Enabling `sandbox` ensures the pilot cannot execute arbitrary
                  shell commands without your explicit one-time permission.
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
                  Expert Tip
                </div>
                <p className="font-body-md text-on-surface-variant text-sm">
                  Always place your `mcp_config.json` in the root `.devpilot/`
                  directory for automatic discovery. If using a custom location,
                  specify it via the `--config` flag in your CLI.
                </p>
              </div>
            </div>
          </section>
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
              href="#"
            >
              GitHub
            </a>
            <a
              className="font-label-mono text-label-mono text-on-surface-variant hover:text-tertiary transition-colors"
              href="#"
            >
              Discord
            </a>
            <a
              className="font-label-mono text-label-mono text-on-surface-variant hover:text-tertiary transition-colors"
              href="#"
            >
              Status
            </a>
            <a
              className="font-label-mono text-label-mono text-on-surface-variant hover:text-tertiary transition-colors"
              href="#"
            >
              Terms
            </a>
          </div>
        </footer>
      </main>
    </div>
  );
}

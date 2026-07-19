"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function Landing() {
  const [showModal, setShowModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage((curr) => (curr === message ? null : curr));
    }, 3000);
  };

  useEffect(() => {
    // Smooth scroll for anchors
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

    // Simple parallax effect for glass cards
    const handleMouseMove = (e: MouseEvent) => {
      const moveX = (e.clientX - window.innerWidth / 2) / 100;
      const moveY = (e.clientY - window.innerHeight / 2) / 100;

      document.querySelectorAll(".glass-card").forEach((card) => {
        (card as HTMLElement).style.transform = `translate(${moveX}px, ${moveY}px)`;
      });
    };

    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      anchors.forEach((anchor) => {
        anchor.removeEventListener("click", handleAnchorClick as EventListener);
      });
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  return (
    <>
      <nav className="fixed top-0 w-full z-50 bg-white/4 backdrop-blur-[40px] border-b border-white/10 shadow-[0_0_20px_rgba(207,188,255,0.1)]">
        <div className="flex justify-between items-center px-margin-desktop py-4 max-w-container-max-width mx-auto">
          <Link href="/" className="flex items-center gap-3">
            <img
              className="h-8 w-8 object-contain rounded-sm"
              src="/android-chrome-512x512.png"
              alt="Xtra DevPilot Logo"
            />
            <span className="font-headline-lg text-headline-lg font-bold text-on-surface tracking-tight">
              Xtra DevPilot
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <a
              className="text-on-surface-variant hover:text-on-surface transition-colors font-body-md text-body-md"
              href="#features"
            >
              Features
            </a>
            <a
              className="text-on-surface-variant hover:text-on-surface transition-colors font-body-md text-body-md"
              href="#architecture"
            >
              Architecture
            </a>
            <a
              className="text-on-surface-variant hover:text-on-surface transition-colors font-body-md text-body-md"
              href="#pricing"
            >
              Pricing
            </a>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="primary-gradient text-on-primary font-bold px-6 py-2 rounded-sm bloom-glow active:scale-95 transition-all text-body-md cursor-pointer"
          >
            Install Extension
          </button>
        </div>
      </nav>

      <section className="relative pt-32 pb-20 px-margin-desktop overflow-hidden">
        <div className="max-w-container-max-width mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 glass-card border-primary/20 rounded-full">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
              <span className="font-label-mono text-label-mono text-primary uppercase tracking-widest">
                v2.4 Live Now
              </span>
            </div>
            <h1 className="font-display-lg text-display-lg leading-tight tracking-tighter">
              The AI Copilot for{" "}
              <span className="text-gradient">Elite Frontend Engineers.</span>
            </h1>
            <p className="text-on-surface-variant text-xl max-w-lg leading-relaxed">
              Ship features 10x faster with ghost automation, visual debugging,
              and local-first architecture. Built for the terminal-obsessed.
            </p>
            <div className="flex flex-wrap gap-4">
              <button
                onClick={() => setShowModal(true)}
                className="primary-gradient text-on-primary font-bold px-8 py-4 rounded-sm bloom-glow text-body-md cursor-pointer"
              >
                Install Extension
              </button>
              <Link href="/docs" className="glass-card text-on-surface font-bold px-8 py-4 rounded-sm hover:bg-white/10 text-body-md flex items-center gap-2">
                View Docs
                <span className="material-symbols-outlined text-sm">
                  arrow_forward
                </span>
              </Link>
            </div>
            <div className="flex items-center gap-6 pt-4 grayscale opacity-50">
              <span className="font-label-mono text-xs uppercase tracking-widest">
                Trusted By Lead Engineers At
              </span>
              <div className="flex gap-4">
                <img src="/xtracontext_logo.png" alt="Xtra Context" className="h-6 object-contain" />
                <img src="/xtrafusion_logo.png" alt="Xtra Fusion" className="h-6 object-contain" />
                <img src="/xtrasecurity_logo.png" alt="Xtra Security" className="h-6 object-contain" />
              </div>
            </div>
          </div>

          <div className="relative group">
            <div className="absolute -inset-4 bg-primary/20 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
            <div className="glass-card rounded-lg overflow-hidden shadow-2xl relative border-white/20">
              <div className="bg-surface-container px-4 py-3 border-b border-white/10 flex items-center justify-between">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-error/40"></div>
                  <div className="w-3 h-3 rounded-full bg-tertiary/40"></div>
                  <div className="w-3 h-3 rounded-full bg-primary/40"></div>
                </div>
                <div className="font-label-mono text-xs text-outline">
                  ProductCard.tsx — Xtra DevPilot
                </div>
                <div className="w-12"></div>
              </div>
              <div className="p-6 font-code-sm text-code-sm space-y-2">
                <div className="flex gap-4">
                  <span className="text-outline w-6 text-right select-none">
                    24
                  </span>
                  <code className="text-secondary">
                    export const <span className="text-primary">ProductCard</span>{" "}
                    = {"({ product }) => {"}
                  </code>
                </div>
                <div className="flex gap-4 relative">
                  <span className="text-outline w-6 text-right select-none">
                    25
                  </span>
                  <code className="text-on-surface"> return (</code>
                </div>
                <div className="relative flex gap-4 bg-primary/10 -mx-6 px-6 py-1 border-l-2 border-primary">
                  <span className="text-outline w-6 text-right select-none">
                    26
                  </span>
                  <code className="text-on-surface">
                    {"    <div className=\"relative group overflow-hidden\">"}
                  </code>
                </div>
                <div className="flex gap-4">
                  <span className="text-outline w-6 text-right select-none">
                    27
                  </span>
                  <code className="text-on-surface">
                    {"      <Image src={product.img} alt={product.name} />"}
                  </code>
                </div>
                <div className="flex gap-4">
                  <span className="text-outline w-6 text-right select-none">
                    28
                  </span>
                  <code className="text-on-surface">
                    {"      <div className=\"p-4\">"}
                  </code>
                </div>
                <div className="flex gap-4 text-tertiary">
                  <span className="text-outline w-6 text-right select-none">
                    29
                  </span>
                  <code className="italic">
                    // @devpilot visual-debug: check layout shift on mount
                  </code>
                </div>
                <div className="flex gap-4">
                  <span className="text-outline w-6 text-right select-none">
                    30
                  </span>
                  <code className="text-on-surface">
                    {"        <h3>{product.title}</h3>"}
                  </code>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        className="py-32 px-margin-desktop bg-surface-container-lowest"
        id="features"
      >
        <div className="max-w-container-max-width mx-auto">
          <div className="mb-20 space-y-4">
            <h2 className="font-headline-lg text-headline-lg">
              Engineered for <span className="text-primary">Precision</span>
            </h2>
            <p className="text-on-surface-variant max-w-xl">
              A suite of tools that bridge the gap between your intent and the
              DOM.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-gutter">
            <div className="glass-card p-8 flex flex-col gap-6 group hover:-translate-y-2">
              <div className="w-12 h-12 rounded-sm bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                <span className="material-symbols-outlined text-3xl">
                  record_voice_over
                </span>
              </div>
              <div>
                <h3 className="font-headline-lg text-xl mb-3">
                  Ghost User Automation
                </h3>
                <p className="text-on-surface-variant text-sm leading-relaxed">
                  Record and replay complex user flows with AI-generated test
                  scripts that never flake.
                </p>
              </div>
            </div>

            <div className="glass-card p-8 flex flex-col gap-6 group hover:-translate-y-2">
              <div className="w-12 h-12 rounded-sm bg-secondary/10 flex items-center justify-center text-secondary border border-secondary/20">
                <span className="material-symbols-outlined text-3xl">
                  visibility
                </span>
              </div>
              <div>
                <h3 className="font-headline-lg text-xl mb-3">
                  Visual Eyes Debugging
                </h3>
                <p className="text-on-surface-variant text-sm leading-relaxed">
                  One-click screenshot debugging with pixel-perfect diffing and
                  instant fix suggestions.
                </p>
              </div>
            </div>

            <div className="glass-card p-8 flex flex-col gap-6 group hover:-translate-y-2">
              <div className="w-12 h-12 rounded-sm bg-tertiary/10 flex items-center justify-center text-tertiary border border-tertiary/20">
                <span className="material-symbols-outlined text-3xl">api</span>
              </div>
              <div>
                <h3 className="font-headline-lg text-xl mb-3">API Mocking</h3>
                <p className="text-on-surface-variant text-sm leading-relaxed">
                  Instant, typesafe API mocks that evolve automatically with
                  your backend schema changes.
                </p>
              </div>
            </div>

            <div className="glass-card p-8 flex flex-col gap-6 group hover:-translate-y-2">
              <div className="w-12 h-12 rounded-sm bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                <span className="material-symbols-outlined text-3xl">hub</span>
              </div>
              <div>
                <h3 className="font-headline-lg text-xl mb-3">
                  LLM-Optimized DOM
                </h3>
                <p className="text-on-surface-variant text-sm leading-relaxed">
                  A specialized DOM representation designed for maximum context
                  window efficiency.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        className="py-32 px-margin-desktop relative overflow-hidden"
        id="architecture"
      >
        <div className="absolute inset-0 -z-10 opacity-20"></div>
        <div className="max-w-container-max-width mx-auto flex flex-col lg:flex-row gap-20 items-center">
          <div className="lg:w-1/2 space-y-8">
            <h2 className="font-display-lg text-display-lg tracking-tight">
              Local-First. <br />
              <span className="text-gradient">Private by Design.</span>
            </h2>
            <p className="text-on-surface-variant text-lg leading-relaxed">
              Xtra DevPilot runs locally on your machine via the Model Context
              Protocol (MCP). Your code never leaves your device. We process
              intelligence where your source lives.
            </p>
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="mt-1 bg-primary/20 p-1 rounded">
                  <span className="material-symbols-outlined text-primary text-sm">
                    shield
                  </span>
                </div>
                <div>
                  <p className="font-bold">Zero-Cloud Residency</p>
                  <p className="text-on-surface-variant text-sm">
                    Sensitive logic and proprietary assets remain within your
                    local firewall.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="mt-1 bg-primary/20 p-1 rounded">
                  <span className="material-symbols-outlined text-primary text-sm">
                    speed
                  </span>
                </div>
                <div>
                  <p className="font-bold">Millisecond Latency</p>
                  <p className="text-on-surface-variant text-sm">
                    Local MCP server ensures your browser and AI are perfectly
                    synchronized.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:w-1/2 w-full glass-card p-12 relative overflow-hidden rounded-xl border-white/10">
            <div className="flex flex-col items-center gap-12 relative z-10">
              <div className="flex flex-col items-center gap-2 mcp-node">
                <div className="w-24 h-24 rounded-full glass-card flex items-center justify-center border-primary/40 bg-primary/5">
                  <img
                    className="w-12 h-12 object-contain rounded-sm"
                    src="/android-chrome-512x512.png"
                    alt="Extension Node"
                  />
                </div>
                <span className="font-label-mono text-xs uppercase text-primary">
                  Browser Extension
                </span>
              </div>

              <div className="h-24 w-1 flex items-center justify-center">
                <div className="h-full w-px bg-gradient-to-b from-primary to-secondary relative">
                  <div className="absolute top-0 w-2 h-2 rounded-full bg-primary -left-[3.5px] blur-[2px]"></div>
                  <div className="absolute bottom-0 w-2 h-2 rounded-full bg-secondary -left-[3.5px] blur-[2px]"></div>
                </div>
              </div>

              <div className="flex flex-col items-center gap-2 mcp-node">
                <div className="w-24 h-24 rounded-sm glass-card flex items-center justify-center border-secondary/40 bg-secondary/5 rotate-45">
                  <span className="material-symbols-outlined text-secondary text-4xl -rotate-45">
                    terminal
                  </span>
                </div>
                <span className="font-label-mono text-xs uppercase text-secondary">
                  Local MCP Server
                </span>
              </div>
            </div>

            <div className="absolute inset-0 opacity-10 pointer-events-none"></div>
          </div>
        </div>
      </section>

      <section className="py-24 px-margin-desktop text-center relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-primary/10 blur-[120px] rounded-full -z-10"></div>
        <div className="max-w-3xl mx-auto space-y-10">
          <h2 className="font-headline-lg text-5xl font-bold tracking-tight">
            Ready to transcend?
          </h2>
          <p className="text-on-surface-variant text-xl">
            Join 20,000+ elite frontend engineers using Xtra DevPilot to build
            the future of the web.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <button
              onClick={() => setShowModal(true)}
              className="primary-gradient text-on-primary font-bold px-12 py-5 rounded-sm bloom-glow text-lg cursor-pointer"
            >
              Install Extension
            </button>
            <button
              onClick={() => showToast("Demo requests will open next week!")}
              className="glass-card text-on-surface font-bold px-12 py-5 rounded-sm hover:bg-white/10 text-lg cursor-pointer"
            >
              Book a Demo
            </button>
          </div>
          <p className="font-label-mono text-xs text-outline uppercase tracking-widest">
            Available on Chrome, Edge, and Brave
          </p>
        </div>
      </section>

      <footer className="bg-surface-container-lowest dark:bg-surface-container-lowest w-full py-12 border-t border-white/5">
        <div className="flex flex-col md:flex-row justify-between items-center px-margin-desktop max-w-container-max-width mx-auto gap-gutter">
          <div className="flex flex-col items-center md:items-start gap-4">
            <Link href="/" className="flex items-center gap-3">
              <img
                className="h-6 w-6 rounded-sm"
                src="/android-chrome-512x512.png"
                alt="Xtra DevPilot Logo"
              />
              <span className="font-headline-lg text-2xl font-bold text-on-surface">
                Xtra DevPilot
              </span>
            </Link>
            <p className="font-label-mono text-label-mono text-outline">
              © 2024 Xtra DevPilot. Built for elite engineers.
            </p>
          </div>
          <div className="flex gap-8">
            <Link
              className="font-label-mono text-label-mono text-outline hover:text-primary transition-colors"
              href="/docs"
            >
              Documentation
            </Link>
            <button
              onClick={() => showToast("Privacy Policy: All data is processed locally on your machine.")}
              className="font-label-mono text-label-mono text-outline hover:text-primary transition-colors cursor-pointer text-left"
            >
              Privacy
            </button>
            <a
              className="font-label-mono text-label-mono text-outline hover:text-primary transition-colors"
              href="https://github.com/om0852/XtraDevPilot"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
            <button
              onClick={() => showToast("Discord link is coming soon!")}
              className="font-label-mono text-label-mono text-outline hover:text-primary transition-colors cursor-pointer text-left"
            >
              Discord
            </button>
          </div>
        </div>
      </footer>

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
    </>
  );
}

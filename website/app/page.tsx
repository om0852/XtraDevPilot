"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Landing() {
  useEffect(() => {
    // Smooth scroll for anchors
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
              className="h-8 w-8 object-contain"
              src="/xtradevpilot_logo.png"
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
          <button className="primary-gradient text-on-primary font-bold px-6 py-2 rounded-sm bloom-glow active:scale-95 transition-all text-body-md">
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
              <button className="primary-gradient text-on-primary font-bold px-8 py-4 rounded-sm bloom-glow text-body-md">
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
                    className="w-12 h-12 object-contain"
                    src="/xtradevpilot_logo.png"
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
            <button className="primary-gradient text-on-primary font-bold px-12 py-5 rounded-sm bloom-glow text-lg">
              Install Extension
            </button>
            <button className="glass-card text-on-surface font-bold px-12 py-5 rounded-sm hover:bg-white/10 text-lg">
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
                className="h-6 w-6"
                src="/xtradevpilot_logo.png"
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
            <a
              className="font-label-mono text-label-mono text-outline hover:text-primary transition-colors"
              href="#"
            >
              Privacy
            </a>
            <a
              className="font-label-mono text-label-mono text-outline hover:text-primary transition-colors"
              href="#"
            >
              GitHub
            </a>
            <a
              className="font-label-mono text-label-mono text-outline hover:text-primary transition-colors"
              href="#"
            >
              Discord
            </a>
          </div>
        </div>
      </footer>
    </>
  );
}

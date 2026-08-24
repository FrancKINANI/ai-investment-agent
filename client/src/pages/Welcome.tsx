import React from "react";
import { ArrowRight, BookOpen, Bot, CheckCircle2, ChevronRight, Clock3, Github, Landmark, MessageSquareText, MonitorCog, Moon, ShieldCheck, Star, Sun, WalletCards } from "lucide-react";
import { useTheme, type ThemePreference } from "@/contexts/ThemeContext";
import { prefetchRoute } from "@/lib/routePrefetch";

const repositoryUrl = "https://github.com/FrancKINANI/ai-investment-agent-mvp";

const documentation = [
  { title: "Getting started", detail: "Install, verify, and follow a safe first workflow.", path: "docs/guides/getting-started.md" },
  { title: "Operator guide", detail: "Use Command, Chat, Wallets, Connections, Settings, and Activity.", path: "docs/guides/operator-guide.md" },
  { title: "System overview", detail: "Understand routes, services, the agent fabric, and authority flow.", path: "docs/architecture/system-overview.md" },
  { title: "Security and data", detail: "Review non-negotiable storage, execution, and privacy boundaries.", path: "docs/architecture/security-and-data.md" },
];

export default function Welcome() {
  const { themePreference, setThemePreference } = useTheme();
  const chooseTheme = (preference: ThemePreference) => setThemePreference?.(preference);
  return <div className="welcome-page">
    <header className="welcome-nav">
      <a className="welcome-brand" href="/welcome" aria-label="Ledgerline welcome"><span><Landmark size={17} /></span><strong>ledgerline</strong><small>simulation-first investment operations</small></a>
      <div className="welcome-nav-actions"><a href="/changelog" onPointerEnter={() => prefetchRoute("/changelog")} onFocus={() => prefetchRoute("/changelog")}><Clock3 size={15} /> Changelog</a><a href={`${repositoryUrl}/tree/main/docs`} target="_blank" rel="noreferrer"><BookOpen size={15} /> Documentation</a><div className="welcome-theme-controls" role="group" aria-label="Welcome theme preview"><button type="button" aria-label="Use light theme" aria-pressed={themePreference === "light"} title="Use light theme" onClick={() => chooseTheme("light")}><Sun size={15} /></button><button type="button" aria-label="Use dark theme" aria-pressed={themePreference === "dark"} title="Use dark theme" onClick={() => chooseTheme("dark")}><Moon size={15} /></button><button type="button" aria-label="Follow system theme" aria-pressed={themePreference === "system"} title="Follow system theme" onClick={() => chooseTheme("system")}><MonitorCog size={15} /></button></div><a className="welcome-star" href={repositoryUrl} target="_blank" rel="noreferrer"><Star size={15} /> Star on GitHub</a></div>
    </header>

    <main>
      <section className="welcome-hero">
        <div className="welcome-hero-copy">
          <span className="eyebrow"><CheckCircle2 size={14} /> OPEN-SOURCE-READY · SIMULATION-ONLY</span>
          <h1>Build conviction.<br /><em>Keep authority bounded.</em></h1>
          <p>Ledgerline is a personal investment operations workspace for policy-bound research, multi-agent debate, and reviewable paper proposals. It turns investigation into a durable decision trail without reaching for custody or execution.</p>
          <div className="welcome-actions"><a className="welcome-primary" href="/" onPointerEnter={() => prefetchRoute("/")} onFocus={() => prefetchRoute("/")}>Open Command <ArrowRight size={16} /></a><a className="welcome-secondary" href={`${repositoryUrl}/blob/main/docs/guides/getting-started.md`} target="_blank" rel="noreferrer">Read the setup guide <ChevronRight size={15} /></a></div>
          <p className="welcome-safety"><ShieldCheck size={15} /> No wallet keys, venue credentials, signing, custody, or live order routing.</p>
        </div>
        <aside className="welcome-authority-card" aria-label="Ledgerline authority model"><span>OPERATOR AUTHORITY MODEL</span><strong>Observe → debate → simulate → review</strong><p>Every action remains source-bound, policy-governed, and explicitly owner-controlled.</p><div><i /><small>simulation default</small></div></aside>
      </section>

      <section className="welcome-promise" aria-label="Product capabilities">
        <article><span><Bot size={19} /></span><div><strong>Bounded agent fabric</strong><p>Protected roles debate evidence, while optional specialists retain visible read-only scope and ownership.</p></div></article>
        <article><span><MessageSquareText size={19} /></span><div><strong>Dedicated research conversation</strong><p>Separate Bull, Bear, and Supervisor views make disagreement legible without confusing it with execution.</p></div></article>
        <article><span><WalletCards size={19} /></span><div><strong>Paper-only lifecycle</strong><p>Policy review and owner approval can advance a simulated proposal, never a live venue order.</p></div></article>
      </section>

      <section className="welcome-docs">
        <header><div><span className="eyebrow">DOCUMENTATION LIBRARY</span><h2>Start with the right operating context.</h2></div><a href={`${repositoryUrl}/tree/main/docs`} target="_blank" rel="noreferrer">Browse all docs <ArrowRight size={15} /></a></header>
        <div>{documentation.map((doc) => <a key={doc.path} href={`${repositoryUrl}/blob/main/${doc.path}`} target="_blank" rel="noreferrer"><span><BookOpen size={16} /></span><div><strong>{doc.title}</strong><p>{doc.detail}</p></div><ChevronRight size={16} /></a>)}</div>
      </section>
    </main>

    <footer className="welcome-footer"><span>MIT licensed · simulation-first by design</span><a href={repositoryUrl} target="_blank" rel="noreferrer"><Github size={15} /> Star on GitHub when the repository is public</a></footer>
  </div>;
}

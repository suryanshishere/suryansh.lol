"use client";

import { useState } from "react";
import { ArrowUpRight } from "./icons";

export function Navigation() {
  const [open, setOpen] = useState(false);
  return <header className="site-header wrap">
    <a href="#home" className="wordmark" aria-label="Suryansh home">suryansh<span>.lol</span><span className="wordmark-dot" /></a>
    <button className="menu-toggle" aria-expanded={open} aria-controls="main-navigation" onClick={() => setOpen(!open)} aria-label={open ? "Close navigation" : "Open navigation"}><span /><span /></button>
    <nav id="main-navigation" className={open ? "navigation is-open" : "navigation"} aria-label="Main navigation" onKeyDown={e => { if (e.key === "Escape") setOpen(false); }}>
      <a href="#work" onClick={() => setOpen(false)}>Work</a>
      <a href="#about" onClick={() => setOpen(false)}>About</a>
      <a href="/Suryansh-Singh-Resume.docx" download>Resume <ArrowUpRight width="15" height="15" /></a>
      <a href="#contact" className="nav-contact" onClick={() => setOpen(false)}>Let’s talk <span>↗</span></a>
    </nav>
  </header>;
}

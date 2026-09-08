import Image from "next/image";
import { Navigation } from "@/components/navigation";
import { ContactForm } from "@/components/contact-form";
import { ArrowRight, ArrowUpRight, Github, Spark } from "@/components/icons";
import { experience, profile, projects } from "@/lib/content";

export default function Home() {
  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <Navigation />
    <main id="main">
      <section className="hero wrap" id="home" aria-labelledby="hero-heading">
        <div className="hero-copy">
          <p className="eyebrow"><span className="hello-line" /> HEY, I’M SURYANSH</p>
          <h1 id="hero-heading">I turn ideas<br />into things<br /><span className="underlined">people use.<svg viewBox="0 0 600 26" aria-hidden="true"><path d="M4 17C174 3 383 2 591 12M58 23C244 12 440 16 543 22" /></svg></span></h1>
          <p className="hero-description">Software & data engineer. I build web products,<br className="desktop-break" /> untangle data, and learn by shipping.</p>
          <div className="hero-actions"><a className="button button-dark" href="#work">Explore my work <ArrowRight /></a><a href={profile.github} className="github-link" target="_blank" rel="noopener noreferrer"><Github /> <span>GitHub</span><ArrowUpRight width="15" height="15" /></a></div>
        </div>
        <div className="hero-art">
          <div className="art-orbit" aria-hidden="true" />
          <span className="art-code" aria-hidden="true">&lt;/&gt;</span>
          <Spark className="art-spark" />
          <Image src="/images/coder-doodle.webp" alt="A doodle of a young coder with tousled hair, sitting cross-legged with his laptop. No glasses, just curiosity." width={900} height={900} priority className="coder-image" sizes="(max-width: 680px) 88vw, (max-width: 1000px) 48vw, 560px" />
          <div className="art-note" aria-hidden="true"><svg viewBox="0 0 80 60"><path d="M73 48C40 60 3 47 18 8m-9 8L19 5l8 12" /></svg><span>usually building something</span></div>
        </div>
        <div className="hero-bottom"><p><span className="availability-dot" /> Based in Noida, India <span className="hero-divider">/</span> Open to opportunities</p><a href="#work">A few things I’ve made <span>↓</span></a></div>
      </section>

      <section className="work-section wrap section-space" id="work" aria-labelledby="work-heading">
        <div className="section-heading"><div><p className="eyebrow">IDEAS THAT MADE IT OUT OF MY HEAD</p><h2 id="work-heading">Built. Shipped.<br className="mobile-break" /> Still improving<span className="red">.</span></h2></div><p>Real projects, real users.<br />A little bit of me in every one.</p></div>
        <div className="project-grid">{projects.map(project => <article className="project" key={project.name}>
          <a className={`project-preview ${project.color}`} href={project.href} target="_blank" rel="noopener noreferrer" aria-label={`Visit ${project.name} (opens in a new tab)`}>
            <div className="browser-frame"><div className="browser-toolbar"><span className="browser-dots"><i /><i /><i /></span><span>{project.domain}</span><span className="browser-lock">↗</span></div><Image src={project.image} alt={`${project.name} live website homepage`} width={1440} height={1000} sizes="(max-width: 680px) 100vw, 50vw" loading="lazy" /></div>
            <span className="preview-visit">Visit live <ArrowUpRight width="17" height="17" /></span>
          </a>
          <div className="project-title-row"><h3><a href={project.href} target="_blank" rel="noopener noreferrer">{project.name}</a></h3><a href={project.href} className="project-arrow" aria-label={`Open ${project.name}`} target="_blank" rel="noopener noreferrer"><ArrowUpRight width="25" height="25" /></a></div>
          <p className="project-label">{project.label}</p><p className="project-description">{project.description}</p>
          <div className="tags">{project.tags.map(tag => <span key={tag}>{tag}</span>)}</div>
          <details className="project-details"><summary>Behind the build <span>+</span></summary><div><p className="project-result">{project.result}</p><ul>{project.details.map(detail => <li key={detail}>{detail}</li>)}</ul></div></details>
        </article>)}</div>
        <a className="more-work" href={profile.github} target="_blank" rel="noopener noreferrer"><Github /><span>More experiments, pipelines, and late-night commits on GitHub</span><ArrowUpRight /></a>
      </section>

      <section className="experience-section section-space" aria-labelledby="experience-heading"><div className="wrap">
        <div className="section-heading"><div><p className="eyebrow">LEARNING BY DOING</p><h2 id="experience-heading">Where I’ve been.</h2></div><span className="handwritten experience-note">good people, interesting problems <svg viewBox="0 0 60 40" aria-hidden="true"><path d="M2 6c33-6 48 9 43 26m-8-6 7 9 9-7" /></svg></span></div>
        <div className="experience-list">{experience.map(job => <article className="experience-row" key={job.company}><div className="experience-company"><span className="timeline-dot" /><h3>{job.company}</h3><p>{job.date}</p></div><div><h4>{job.role}</h4><p>{job.description}</p></div><span className="experience-date">{job.date}</span></article>)}</div>
      </div></section>

      <section className="about-section wrap section-space" id="about" aria-labelledby="about-heading">
        <div className="about-intro"><p className="eyebrow">A LITTLE MORE HUMAN</p><h2 id="about-heading">Code is the craft.<br />Curiosity is<br /><span className="red">the constant.</span></h2><Spark className="about-spark" /><p className="handwritten">And yes, I edit videos too.</p></div>
        <div className="about-copy"><p className="about-lead">Hey, I’m Suryansh — a developer who likes taking an idea all the way to a working product.</p><p>I’ve worked across backend development, data engineering, and teaching. I like the whole puzzle: the interface someone clicks, the API behind it, and the pipeline that makes the data useful.</p><p>Outside the code editor, you’ll find me editing videos or starting another side project. Making things has a habit of turning into making more things.</p><div className="education"><span className="education-icon" aria-hidden="true">↗</span><div><strong>B.Tech, Computer Science</strong><p>Galgotias University · 2022–2026 · 8.07 CGPA</p></div></div><a href="/Suryansh-Singh-Resume.docx" download className="text-link">The full story, in my resume <ArrowUpRight width="17" height="17" /></a></div>
        <div className="toolbox"><p className="eyebrow">TOOLS I REACH FOR</p><div className="toolbox-grid"><div><h3>Building for the web</h3><p>TypeScript · JavaScript · React · Next.js · Node.js · Express · HTML & CSS</p></div><div><h3>Making data useful</h3><p>Python · SQL · PySpark · Pandas · Azure Data Factory · Databricks · Microsoft Fabric</p></div><div><h3>Behind the scenes</h3><p>PostgreSQL · MongoDB · Drizzle · Cloudflare · Git · GitHub · pytest</p></div></div></div>
      </section>

      <section className="contact-section section-space" id="contact" aria-labelledby="contact-heading"><div className="wrap contact-grid"><div className="contact-copy"><p className="eyebrow">GOOD THINGS START WITH A HELLO</p><h2 id="contact-heading">Got something<br />in mind<span className="red">?</span></h2><p>A product to build, a role to talk about,<br />or a curious question. I’m all ears.</p><a className="contact-email" href={`mailto:${profile.email}`}>{profile.email}<ArrowUpRight width="18" height="18" /></a><span className="handwritten contact-note">let’s make it happen <svg viewBox="0 0 90 35" aria-hidden="true"><path d="M3 22c27-22 58-20 78-4m-12-2 14 4-5-14" /></svg></span></div><ContactForm /></div></section>
    </main>
    <footer className="site-footer wrap"><a className="wordmark" href="#home">suryansh<span>.lol</span><span className="wordmark-dot" /></a><p>Built with curiosity. And Next.js.</p><div className="footer-links"><a href={profile.github} target="_blank" rel="noopener noreferrer">GitHub <ArrowUpRight width="13" height="13" /></a><a href={profile.linkedin} target="_blank" rel="noopener noreferrer">LinkedIn <ArrowUpRight width="13" height="13" /></a><a href={profile.x} target="_blank" rel="noopener noreferrer">X <ArrowUpRight width="13" height="13" /></a><a href="/admin" className="admin-link">Admin</a></div></footer>
  </>;
}

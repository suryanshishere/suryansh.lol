(() => {
  const root = document.documentElement;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const header = document.querySelector("[data-site-header]");
  const navLinks = Array.from(document.querySelectorAll(".site-nav a"));
  const sections = navLinks
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);
  const reveals = Array.from(document.querySelectorAll(".reveal"));
  const compactDetails = Array.from(document.querySelectorAll("[data-compact-details]"));
  const year = document.querySelector("#current-year");

  if (year) {
    year.textContent = String(new Date().getFullYear());
  }

  const setScrolledState = () => {
    if (header) {
      header.classList.toggle("is-scrolled", window.scrollY > 12);
    }
  };

  setScrolledState();
  window.addEventListener("scroll", setScrolledState, { passive: true });

  const compactViewport = window.matchMedia("(max-width: 40rem)");
  const setCompactDetails = (event) => {
    compactDetails.forEach((detail) => {
      detail.open = !event.matches;
    });
  };

  setCompactDetails(compactViewport);
  compactViewport.addEventListener("change", setCompactDetails);

  if (reducedMotion.matches) {
    reveals.forEach((element) => element.classList.add("is-visible"));
    return;
  }

  root.classList.add("js");

  if ("IntersectionObserver" in window) {
    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );

    reveals.forEach((element) => revealObserver.observe(element));

    const navigationObserver = new IntersectionObserver(
      (entries) => {
        const visibleSection = entries
          .filter((entry) => entry.isIntersecting)
          .sort((first, second) => second.intersectionRatio - first.intersectionRatio)[0];

        if (!visibleSection) {
          return;
        }

        navLinks.forEach((link) => {
          const isCurrent = link.getAttribute("href") === "#" + visibleSection.target.id;
          if (isCurrent) {
            link.setAttribute("aria-current", "true");
          } else {
            link.removeAttribute("aria-current");
          }
        });
      },
      { rootMargin: "-35% 0px -55% 0px", threshold: [0.01, 0.25, 0.5] },
    );

    sections.forEach((section) => navigationObserver.observe(section));
  } else {
    reveals.forEach((element) => element.classList.add("is-visible"));
  }
})();

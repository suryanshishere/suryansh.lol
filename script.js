import {
  motion,
  enter,
  pixelWipe,
  finishFiniteAnimations,
} from "./js/motion.js";
import { createProjectDock } from "./js/dock.js";
import { initializeSignature } from "./js/signature.js";
import { createPreview } from "./js/preview.js";

const projects = [
  {
    name: "GovernmentNinja",
    initials: "GN",
    url: "https://governmentninja.com",
    icon: "assets/projects/governmentninja.svg",
    category: "Data pipelines · Job discovery",
    summary:
      "A government job discovery platform powered by a scheduled pipeline that turns scattered notifications into searchable information, eligibility checks, and alerts.",
    contributions: [
      "Built a 20+ step pipeline spanning source ingestion, cleaning, transformation, validation, automated testing, publication, and job alerts.",
      "Aggregated and published 1,900+ government job notifications, with automated quality checks before publication.",
      "Configured GitHub Actions workflows, monitoring, and analytics to track pipeline runs and platform usage.",
      "Integrated AI-generated notification highlights and refined prompts to optimize token usage.",
    ],
    resultsLabel: "Launch results (historical)",
    results:
      "Within two months of launch: 100,000+ search impressions, 3,000+ clicks, and 100+ registered users.",
  },
  {
    name: "BulkFlow",
    initials: "BF",
    url: "https://bulkflow.suryansh.lol",
    icon: "assets/projects/bulkflow.ico",
    category: "Batch processing · Spreadsheets",
    summary:
      "An upload and batch processing workflow built to handle large Excel datasets without losing records.",
    contributions: [
      "Built an Excel upload and processing workflow for datasets with 85,000+ rows.",
      "Preserved all records throughout processing.",
    ],
    resultsLabel: "Repository access",
    results:
      "Project code is available on GitHub. Private repository access is available on request.",
  },
  {
    name: "Outmatch",
    initials: "OM",
    url: "https://outmatch.lol",
    icon: "assets/projects/outmatch.svg",
    category: "Product discovery · Community rankings",
    summary:
      "A product leaderboard where people choose a winner in head-to-head comparisons, with chess-style ratings determining the rankings.",
    contributions: [
      "Created a product comparison experience centered on head-to-head voting.",
      "Presented the resulting rankings in a community-driven leaderboard.",
    ],
    results: "",
  },
  {
    name: "Cutu",
    initials: "CU",
    url: "https://cutu.suryansh.lol",
    icon: "assets/projects/cutu.png",
    category: "Creative tools · Animated memes",
    summary:
      "A playful tool for adding your own text to the animated Baby Boo hamster meme, previewing it, and downloading or sharing the result.",
    contributions: [
      "Created a text customization and animated preview experience.",
      "Made the finished meme available to download or share.",
    ],
    results: "",
  },
  {
    name: "PollBuzz",
    initials: "PB",
    url: "https://pollbuzz.suryansh.lol",
    icon: "assets/projects/pollbuzz.png",
    category: "Live polling · Shared results",
    summary:
      "A real-time polling tool for creating a poll, sharing a participation code, and following results as votes arrive.",
    contributions: [
      "Created a poll creation and code-based participation experience.",
      "Presented live results for classrooms, teams, meetings, and events.",
    ],
    results: "",
  },
  {
    name: "Menus Processing Microservice",
    initials: "MP",
    url: null,
    icon: "assets/projects/menus.svg",
    category: "Parallel processing · Data transformation",
    summary:
      "A parallel processing pipeline that turns food menu source data into clean, structured JSON for downstream workflows.",
    contributions: [
      "Extracted source files from Google Cloud Storage and parsed menu content for processing.",
      "Built parallel processing to convert menu datasets into cleaned JSON.",
      "Routed processed outputs to their configured targets.",
    ],
    results: "",
  },
];
const toggle = document.querySelector("#work-toggle");
const intro = document.querySelector("#intro-content");
const work = document.querySelector("#work-view");
const dock = document.querySelector("[data-project-dock]");
const preview = document.querySelector("[data-preview]");
const details = document.querySelector("#project-details");
const detailsOpen = document.querySelector("[data-details-open]");
const detailsClose = document.querySelector("[data-details-close]");
const windowBar = document.querySelector(".window-bar");
const stage = document.querySelector(".view-stage");
const page = document.querySelector(".page");
const themeColor = document.querySelector('meta[name="theme-color"]');
const toggleLabel = toggle.querySelector("span");
const projectName = document.querySelector("[data-project-name]");
const chip = document.querySelector("[data-project-chip-icon]");
const link = document.querySelector("[data-project-link]");
const story = details.querySelector(".project-story");
const title = story.querySelector("#project-title");
const category = story.querySelector("[data-project-category]");
const summary = story.querySelector("[data-project-summary]");
const list = story.querySelector("[data-project-contributions]");
const results = story.querySelector("[data-project-results]");
const replaySignature = initializeSignature();
document.querySelector("[data-year]").textContent = new Date().getFullYear();
let selected = 0;
let open = false;
let transitioning = false;
let detailsAnimation;
let detailsVersion = 0;

const showFallback = () => {
  const project = projects[selected];
  previewController.stop();
  const panel = story.cloneNode(true);
  panel.classList.add("preview-description");
  panel.removeAttribute("aria-labelledby");
  panel.setAttribute("aria-label", `${project.name} project details`);
  panel
    .querySelectorAll("[id]")
    .forEach((element) => element.removeAttribute("id"));
  panel.querySelectorAll("*").forEach((element) => {
    [...element.attributes]
      .filter((attribute) => attribute.name.startsWith("data-project-"))
      .forEach((attribute) => element.removeAttribute(attribute.name));
  });
  preview.append(panel);
  work.classList.add("showing-description");
  enter(panel);
};
const setDetails = async (visible, restoreFocus = true) => {
  if (
    !visible &&
    restoreFocus &&
    detailsOpen.getAttribute("aria-expanded") === "false"
  )
    return;
  const version = ++detailsVersion;
  detailsAnimation?.cancel();
  detailsAnimation = null;
  detailsOpen.setAttribute("aria-expanded", String(visible));
  if (visible) {
    details.hidden = false;
    [windowBar, preview].forEach((element) => {
      element.inert = true;
    });
    story.scrollTop = 0;
    if (!motion.matches && details.animate) {
      detailsAnimation = details.animate(
        [
          { opacity: 0, transform: "translateY(5px)" },
          { opacity: 1, transform: "none" },
        ],
        { duration: 300, easing: "cubic-bezier(.22, 1, .36, 1)" },
      );
      details
        .querySelectorAll(".contributions li, .project-results:not([hidden])")
        .forEach((point, index) => {
          point.animate(
            [
              { opacity: 0, transform: "translateY(6px)" },
              { opacity: 1, transform: "none" },
            ],
            {
              duration: 300,
              delay: index * 45,
              easing: "cubic-bezier(.22, 1, .36, 1)",
              fill: "backwards",
            },
          );
        });
    }
    if (restoreFocus) detailsClose.focus({ preventScroll: true });
  } else {
    if (!details.hidden && restoreFocus && !motion.matches && details.animate) {
      detailsAnimation = details.animate(
        [
          { opacity: 1, transform: "none" },
          { opacity: 0, transform: "translateY(4px)" },
        ],
        {
          duration: 240,
          easing: "cubic-bezier(.4, 0, .2, 1)",
          fill: "forwards",
        },
      );
      try {
        await detailsAnimation.finished;
      } catch {
        return;
      }
      if (version !== detailsVersion) return;
      detailsAnimation.cancel();
      detailsAnimation = null;
    }
    details.hidden = true;
    [windowBar, preview].forEach((element) => {
      element.inert = false;
    });
    if (restoreFocus) detailsOpen.focus({ preventScroll: true });
  }
};
const render = (keepDetailsOpen = false) => {
  setDetails(false, false);
  work.classList.remove("showing-description");
  const project = projects[selected];
  projectName.textContent = project.name;
  chip.textContent = project.initials;
  const chipImage = document.createElement("img");
  chipImage.src = project.icon;
  chipImage.alt = "";
  chipImage.addEventListener(
    "load",
    () => {
      if (projects[selected] === project) chip.replaceChildren(chipImage);
    },
    { once: true },
  );
  projectName.title = project.name;
  link.hidden = !project.url;
  if (project.url) link.href = project.url;
  else link.removeAttribute("href");
  title.textContent = project.name;
  category.textContent = project.category;
  summary.textContent = project.summary;
  list.replaceChildren(
    ...project.contributions.map((text) => {
      const li = document.createElement("li");
      li.textContent = text;
      return li;
    }),
  );
  results.replaceChildren();
  if (project.results) {
    const heading = document.createElement("h2");
    heading.textContent = project.resultsLabel || "Project notes";
    const copy = document.createElement("p");
    copy.textContent = project.results;
    results.append(heading, copy);
  }
  results.hidden = !project.results;
  projectDock.select(selected);
  if (keepDetailsOpen) setDetails(true, false);
  previewController.show(project);
};
const previewController = createPreview({
  preview,
  work,
  status: document.querySelector("[data-preview-status]"),
  loadingLabel: document.querySelector("[data-loading-label]"),
  onFallback: showFallback,
});
const projectDock = createProjectDock({
  projects,
  dock,
  work,
  onSelect(index) {
    if (selected === index) return;
    const keepDetailsOpen =
      !details.hidden && detailsOpen.getAttribute("aria-expanded") === "true";
    selected = index;
    render(keepDetailsOpen);
  },
});
detailsOpen.addEventListener("click", () => setDetails(true));
detailsClose.addEventListener("click", () => setDetails(false));
work.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !details.hidden) {
    event.preventDefault();
    setDetails(false);
  }
});
motion.addEventListener("change", () => {
  if (motion.matches) finishFiniteAnimations();
});
toggle.addEventListener("click", async () => {
  if (transitioning) return;
  transitioning = true;
  const rect = toggle.getBoundingClientRect();
  const origin = {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
  const outgoingColor = open ? "#eef4f8" : "#faf9f6";
  if (open) work.hidden = true;
  open = !open;
  document.body.dataset.theme = open ? "work" : "intro";
  themeColor.content = open ? "#dfeaf8" : "#faf9f6";
  stage.classList.toggle("showing-work", open);
  intro.inert = open;
  intro.setAttribute("aria-hidden", String(open));
  const incoming = open ? work : intro;
  incoming.hidden = false;
  toggle.setAttribute("aria-expanded", String(open));
  toggleLabel.textContent = open ? "Hide work" : "Show work";
  if (open) render();
  else {
    setDetails(false, false);
    previewController.stop();
  }
  projectDock.resize();
  try {
    if (!motion.matches) {
      const wipe = pixelWipe(outgoingColor, origin);
      if (wipe) {
        page.animate([{ filter: "blur(6px)" }, { filter: "blur(0px)" }], {
          duration: 720,
          easing: "cubic-bezier(.22, 1, .36, 1)",
        });
        await wipe;
      } else if (page.animate) {
        await page.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: 260,
          easing: "cubic-bezier(.22, 1, .36, 1)",
        }).finished;
      }
    }
  } finally {
    transitioning = false;
    if (!open) replaySignature();
  }
});

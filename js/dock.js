import { motion } from "./motion.js";

export function createProjectDock({ projects, dock, work, onSelect }) {
  const dockBounces = new WeakMap();
  projects.forEach((project, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "dock-item";
    button.setAttribute("aria-label", `Show ${project.name}`);
    button.setAttribute("aria-controls", "work-view");
    const icon = document.createElement("span");
    icon.className = "dock-icon";
    const initials = document.createElement("span");
    initials.textContent = project.initials;
    initials.setAttribute("aria-hidden", "true");
    const image = document.createElement("img");
    image.src = project.icon;
    image.alt = "";
    image.addEventListener("error", () => image.remove());
    icon.append(initials, image);
    const name = document.createElement("span");
    name.className = "dock-label";
    name.textContent = project.name;
    name.setAttribute("aria-hidden", "true");
    button.append(icon, name);
    button.addEventListener("click", () => {
      if (!motion.matches && icon.animate) {
        const currentTransform = getComputedStyle(icon).transform;
        dockBounces.get(icon)?.cancel();
        dockBounces.set(
          icon,
          icon.animate(
            [
              { transform: currentTransform },
              { transform: "translateY(-5px)", offset: 0.35 },
              { transform: "none" },
            ],
            { duration: 420, easing: "cubic-bezier(.22, 1, .36, 1)" },
          ),
        );
      }
      onSelect(index);
    });
    dock.append(button);
  });

  const dockButtons = [...dock.children];
  const dockLabels = dockButtons.map((button) =>
    button.querySelector(".dock-label"),
  );
  let pointer = null;
  let focusIndex = null;
  let dockFrame = 0;
  let lastDockTime = 0;
  let scales = projects.map(() => 1);
  let centers = projects.map(() => 0);
  let baseSize, gap, padding, maxScale, effectWidth;
  const drawDock = () => {
    const workWidth = work.clientWidth;
    const labelWidths = dockLabels.map((label) => label.offsetWidth);
    const naturalWidth =
      scales.reduce((sum, scale) => sum + baseSize * scale, 0) +
      gap * (projects.length - 1) +
      2 * padding;
    const fit = Math.min(1, Math.max(1, workWidth - 24) / naturalWidth);
    const targetCenters = [];
    let left = padding;
    scales.forEach((scale) => {
      targetCenters.push(left + (baseSize * scale) / 2);
      left += baseSize * scale + gap;
    });
    dock.style.setProperty("--dock-width", `${naturalWidth * fit}px`);
    dockButtons.forEach((button, index) => {
      // Derive every position from the eased sizes so neighbors stay separated.
      centers[index] = targetCenters[index];
      const size = baseSize * scales[index] * fit;
      button.style.left = `${centers[index] * fit - size / 2}px`;
      button.style.width = `${size}px`;
      button.style.height = `${size}px`;
      button.style.zIndex = String(Math.round(10 * scales[index]));
      const centerInWork =
        (workWidth - naturalWidth * fit) / 2 + centers[index] * fit;
      const halfLabel = labelWidths[index] / 2;
      const labelCenter = Math.max(
        8 + halfLabel,
        Math.min(workWidth - 8 - halfLabel, centerInWork),
      );
      dockLabels[index].style.setProperty(
        "--label-offset",
        `${labelCenter - centerInWork}px`,
      );
    });
  };
  const tickDock = (now) => {
    const baselineWidth =
      baseSize * projects.length + gap * (projects.length - 1);
    const origin =
      pointer === null
        ? focusIndex === null
          ? null
          : focusIndex * (baseSize + gap) + baseSize / 2
        : pointer -
          dock.getBoundingClientRect().left -
          dock.getBoundingClientRect().width / 2 +
          baselineWidth / 2;
    const elapsed = Math.min(48, Math.max(0, now - lastDockTime));
    lastDockTime = now;
    const smoothing = motion.matches
      ? 1
      : 1 - Math.exp(-elapsed / (origin === null ? 120 : 80));
    let moving = false;
    scales = scales.map((value, index) => {
      const distance =
        origin === null
          ? Infinity
          : Math.abs(index * (baseSize + gap) + baseSize / 2 - origin);
      const target =
        motion.matches || distance > effectWidth / 2
          ? 1
          : 1 +
            ((1 + Math.cos((distance / (effectWidth / 2)) * Math.PI)) / 2) *
              (maxScale - 1);
      const next = value + (target - value) * smoothing;
      if (Math.abs(target - next) > 0.002) moving = true;
      return Math.abs(target - next) <= 0.002 ? target : next;
    });
    drawDock();
    dockFrame = moving ? requestAnimationFrame(tickDock) : 0;
  };
  const startDock = () => {
    if (!dockFrame) {
      lastDockTime = performance.now();
      dockFrame = requestAnimationFrame(tickDock);
    }
  };
  const sizeDock = () => {
    pointer = null;
    focusIndex = null;
    const mobile = window.innerWidth < 768;
    baseSize = mobile ? 38 : 48;
    gap = Math.max(4, baseSize * 0.08);
    padding = 6;
    maxScale = mobile ? 1.4 : 1.65;
    effectWidth = mobile ? window.innerWidth * 0.3 : 300;
    dock.style.setProperty("--dock-size", `${baseSize}px`);
    dock.style.setProperty("--dock-padding", `${padding}px`);
    dock.style.setProperty(
      "--dock-radius",
      `${Math.max(12, baseSize * 0.4)}px`,
    );
    scales = projects.map(() => 1);
    centers = projects.map(
      (_, index) => padding + index * (baseSize + gap) + baseSize / 2,
    );
    drawDock();
  };
  dock.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch") return;
    pointer = event.clientX;
    startDock();
  });
  dock.addEventListener("pointerleave", () => {
    pointer = null;
    startDock();
  });
  dockButtons.forEach((button, index) => {
    button.addEventListener("focus", () => {
      if (button.matches(":focus-visible")) {
        focusIndex = index;
        startDock();
      }
    });
    button.addEventListener("blur", () => {
      focusIndex = null;
      startDock();
    });
  });
  window.addEventListener("resize", sizeDock);
  sizeDock();
  motion.addEventListener("change", sizeDock);
  return {
    resize: sizeDock,
    select(index) {
      dockButtons.forEach((button, current) =>
        button.setAttribute("aria-pressed", String(current === index)),
      );
    },
  };
}

import { enter } from "./motion.js";

const PREVIEW_TIMEOUT = 12000;

// External frames do not expose reliable cross-origin error information.
// Only the current frame may update loading state or trigger the fallback.
export function createPreview({
  preview,
  work,
  status,
  loadingLabel,
  onFallback,
}) {
  let loadingTimer;

  const setLoading = (loading, project) => {
    work.classList.toggle("is-loading", loading);
    preview.setAttribute("aria-busy", String(loading));
    status.hidden = !loading;
    loadingLabel.textContent = loading
      ? `Loading ${project.name} website…`
      : "";
  };

  const stop = () => {
    clearTimeout(loadingTimer);
    setLoading(false);
    preview.replaceChildren();
  };

  const show = (project) => {
    stop();
    if (!project.url) {
      onFallback();
      return;
    }

    setLoading(true, project);
    const frame = document.createElement("iframe");
    frame.title = `${project.name} live website preview`;
    frame.referrerPolicy = "no-referrer";
    const isCurrent = () => frame === preview.firstElementChild;

    frame.addEventListener("error", () => {
      if (isCurrent()) onFallback();
    });
    frame.addEventListener("load", () => {
      if (!isCurrent()) return;
      clearTimeout(loadingTimer);
      setLoading(false);
      frame.classList.add("is-ready");
      enter(frame, 420, 4);
    });
    frame.src = project.url;
    preview.append(frame);
    loadingTimer = setTimeout(() => {
      if (isCurrent()) onFallback();
    }, PREVIEW_TIMEOUT);
  };

  return { show, stop };
}

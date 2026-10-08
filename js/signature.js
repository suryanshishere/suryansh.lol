import { motion } from "./motion.js";

export function initializeSignature() {
  const signature = document.querySelector(".signature");
  const strokes = [
    ...(signature?.querySelectorAll("[data-signature-stroke]") ?? []),
  ];
  if (!signature || !strokes.length) return () => {};
  let animations = [];
  let generation = 0;
  const finish = () => {
    generation++;
    animations.forEach((animation) => animation.cancel());
    animations = [];
    strokes.forEach((stroke) =>
      stroke.style.removeProperty("stroke-dasharray"),
    );
    signature.dataset.state = "complete";
  };
  const replay = () => {
    finish();
    if (motion.matches || !strokes[0].animate) return;
    const current = generation;
    try {
      const lengths = strokes.map((stroke) => stroke.getTotalLength());
      const totalLength = lengths.reduce((sum, length) => sum + length, 0);
      const gap = 35;
      let delay = 120;
      const drawingTime = 3000 - delay - gap * (strokes.length - 1);
      const timeAtProgress = (progress) =>
        (Math.sqrt(0.0625 + 3 * progress) - 0.25) / 1.5;
      let progress = 0;
      strokes.forEach((stroke, index) => {
        const nextProgress = progress + lengths[index] / totalLength;
        const startTime = timeAtProgress(progress);
        const endTime = timeAtProgress(nextProgress);
        const duration = (endTime - startTime) * drawingTime;
        const keyframes = Array.from({ length: 21 }, (_, step) => {
          const fraction = step / 20;
          return {
            strokeDashoffset: String(1 - fraction),
            offset:
              step === 0
                ? 0
                : step === 20
                  ? 1
                  : (timeAtProgress(
                      progress + (nextProgress - progress) * fraction,
                    ) -
                      startTime) /
                    (endTime - startTime),
          };
        });
        stroke.style.strokeDasharray = "1";
        animations.push(
          stroke.animate(keyframes, {
            duration,
            delay,
            easing: "linear",
            fill: "both",
          }),
        );
        delay += duration + gap;
        progress = nextProgress;
      });
      signature.dataset.state = "writing";
      Promise.allSettled(
        animations.map((animation) => animation.finished),
      ).then(() => {
        if (current === generation) finish();
      });
    } catch {
      finish();
    }
  };
  motion.addEventListener("change", (event) => {
    if (event.matches) finish();
  });
  replay();
  return replay;
}

import * as utils from "./play_utils.js";
import { getDetector } from "./play_detector.js";

let latestPose = null;
let renderRaf = null;
let estimateStop = false;
let estimating = false;
let estimateTimerId = null;

export function startEstimationPump(videoEl, fps = 12) {
  const detector = getDetector();
  const interval = Math.max(16, Math.floor(1000 / fps));

  async function pump() {
    if (estimateStop) return;
    if (!estimating && detector) {
      estimating = true;
      try {
        const poses = await detector.estimatePoses(videoEl, { flipHorizontal: false });
        latestPose = (poses && poses[0]) || null;
      } finally { estimating = false; }
    }
    estimateTimerId = setTimeout(pump, interval);
  }
  pump();
}

export function startRenderLoop(canvasEl, ctx, targetKeyRef, bestAccRef, allowAccRef) {
  const accNowEl = document.getElementById("accuracyNow");
  const accBestEl = document.getElementById("accuracyBest");
  const sims = [];

  function render() {
    if (ctx && canvasEl) ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

    if (latestPose && ctx) {
      const kp = latestPose.keypoints;
      utils.drawSkeleton(kp, ctx);

      if (targetKeyRef.value && allowAccRef.value) {
        const vec = utils.normalizeKeypoints(kp);
        const sim = utils.computeSimilarity(vec, targetKeyRef.value);
        const percent = Math.round(sim * 100);

        sims.push(sim);
        if (sims.length > 15) sims.shift();

        if (accNowEl) accNowEl.textContent = `${percent}%`;
        if (percent > bestAccRef.value) {
          bestAccRef.value = percent;
          if (accBestEl) accBestEl.textContent = `${bestAccRef.value}%`;
        }
      }
    }
    renderRaf = requestAnimationFrame(render);
  }
  render();
}

import * as utils from "./play_utils.js";
import { getDetector } from "./play_detector.js";

let latestPose = null;
let renderRaf = null;
let estimating = false;

export function startEstimationPump(videoEl, fps = 12) {
  const detector = getDetector();
  const interval = Math.max(16, Math.floor(1000 / fps));

  async function pump() {
    if (!estimating && detector) {
      estimating = true;
      try {
        const poses = await detector.estimatePoses(videoEl, { flipHorizontal: false });
        latestPose = (poses && poses[0]) || null;
      } finally {
        estimating = false;
      }
    }
    setTimeout(pump, interval);
  }
  pump();
}

export function startRenderLoop(canvasEl, ctx, targetKeyRef, bestAccRef) {
  const accNowEl = document.getElementById("accuracyNow");
  const accBestEl = document.getElementById("accuracyBest");

  function render() {
    if (ctx && canvasEl) ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

    if (latestPose && ctx) {
      const kp = latestPose.keypoints;
      utils.drawSkeleton(kp, ctx);

      if (targetKeyRef.value) {
        const vecMe = utils.normalizeKeypoints(kp);
        const vecTarget = utils.normalizeKeypoints(targetKeyRef.value);

        if (vecMe && vecTarget) {
          const sim = utils.computeSimilarity(vecMe, vecTarget);
          const percent = Math.round(sim * 100);

          if (accNowEl) accNowEl.textContent = `${percent}%`;
          if (percent > bestAccRef.value) {
            bestAccRef.value = percent;
            if (accBestEl) accBestEl.textContent = `${bestAccRef.value}%`;
          }
        }
      }
    }
    renderRaf = requestAnimationFrame(render);
  }
  render();
}

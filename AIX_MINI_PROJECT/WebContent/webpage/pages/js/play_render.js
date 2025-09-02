import { getDetector } from "./play_detector.js";
import {
  drawMySkeleton,
  drawGuideSkeleton,
  normalizeKeypoints,
  computeSimilarity
} from "./play_utils.js";

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
      } finally {
        estimating = false;
      }
    }
    estimateTimerId = setTimeout(pump, interval);
  }
  pump();
}

export function stopEstimationPump() {
  estimateStop = true;
  if (estimateTimerId) clearTimeout(estimateTimerId);
}

export function getLatestPose() {
  return latestPose;
}

export function startRenderLoop(canvasEl, ctx, targetKeyRef, bestAccRef, allowAccRef) {
  const accNowEl = document.getElementById("accuracyNow");
  const accBestEl = document.getElementById("accuracyBest");
  const sims = [];

  function render() {
    if (ctx && canvasEl) ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

    // 🔹 타겟 스켈레톤 (가이드: 시안 점선)
    if (targetKeyRef.value) {
      drawGuideSkeleton(targetKeyRef.value, ctx);
    }

    // 🔹 내 스켈레톤 (빨간 점 + 라임색 선)
    if (latestPose && latestPose.keypoints && ctx) {
      drawMySkeleton(latestPose.keypoints, ctx);

      // 정확도 계산
      if (targetKeyRef.value && allowAccRef.value) {
        const vec = normalizeKeypoints(latestPose.keypoints);
        const sim = computeSimilarity(vec, targetKeyRef.value);
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

export function stopRenderLoop() {
  if (renderRaf) cancelAnimationFrame(renderRaf);
}

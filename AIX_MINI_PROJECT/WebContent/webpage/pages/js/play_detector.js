import { normalizeKeypoints } from "./play_utils.js";

let detector = null;

export async function initDetector() {
  await tf.setBackend("webgl");
  await tf.ready();
  detector = await poseDetection.createDetector(
    poseDetection.SupportedModels.MoveNet,
    { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING }
  );
}

// 이미지 먼저 보여주기
export async function pickRandomTarget(targetImgEl, pool) {
  return new Promise(resolve => {
    const url = pool[Math.floor(Math.random() * pool.length)];
    targetImgEl.onload = () => resolve(url);
    targetImgEl.onerror = () => resolve(null);
    targetImgEl.src = url;
  });
}

// 포즈 키포인트 감지 (느려도 OK)
export async function detectTargetKey(targetImgEl) {
  if (!detector) return null;
  const tempCanvas = document.createElement("canvas");
  const tctx = tempCanvas.getContext("2d");
  tempCanvas.width = targetImgEl.naturalWidth || targetImgEl.width;
  tempCanvas.height = targetImgEl.naturalHeight || targetImgEl.height;
  tctx.drawImage(targetImgEl, 0, 0);

  const poses = await detector.estimatePoses(tempCanvas, { flipHorizontal: false });
  return poses?.[0]?.keypoints ? normalizeKeypoints(poses[0].keypoints) : null;
}

export function getDetector() {
  return detector;
}

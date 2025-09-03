let detector = null;

export function getDetector() {
  return detector;
}

export async function initDetector() {
  if (detector) return detector;
  await tf.setBackend("webgl");
  await tf.ready();
  detector = await poseDetection.createDetector(
    poseDetection.SupportedModels.MoveNet,
    { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING }
  );
  return detector;
}

export async function detectTargetKey(targetImgEl) {
  if (!detector) await initDetector();

  async function tryEstimate(canvas) {
    const poses = await detector.estimatePoses(canvas, { flipHorizontal: false });
    return poses?.[0]?.keypoints || null;
  }

  // 1차: 원본 크기
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = targetImgEl.naturalWidth || targetImgEl.width;
  tempCanvas.height = targetImgEl.naturalHeight || targetImgEl.height;
  tempCanvas.getContext("2d").drawImage(targetImgEl, 0, 0);
  let keypoints = await tryEstimate(tempCanvas);

  // 2차: 해상도 절반으로 줄여서 재시도
  if (!keypoints) {
    const w = (targetImgEl.naturalWidth || targetImgEl.width) / 2;
    const h = (targetImgEl.naturalHeight || targetImgEl.height) / 2;
    const smallCanvas = document.createElement("canvas");
    smallCanvas.width = w;
    smallCanvas.height = h;
    smallCanvas.getContext("2d").drawImage(targetImgEl, 0, 0, w, h);
    keypoints = await tryEstimate(smallCanvas);
  }

  // 그래도 실패하면 → 기본값 벡터
  if (!keypoints) {
    console.error("[detectTargetKey] failed → using fallback keypoints");
    keypoints = Array(17).fill({ x: 0, y: 0, score: 0 });
  }

  return keypoints;
}

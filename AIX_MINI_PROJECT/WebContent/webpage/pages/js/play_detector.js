let detector = null;

// ✅ detector 반환용 함수
export function getDetector() {
  return detector;
}

// 초기화 함수
export async function initDetector() {
  if (detector) return detector;

  try {
    detector = await poseDetection.createDetector(
      poseDetection.SupportedModels.MoveNet,
      {
        modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
        runtime: "tfjs"
      }
    );
    console.log("[poseDetection] MoveNet detector initialized");
  } catch (err) {
    console.error("[poseDetection] init failed:", err);
    throw err;
  }

  return detector;
}

// 타겟 이미지에서 키포인트 감지
export async function detectTargetKey(targetImgEl) {
  if (!detector) {
    await initDetector();
  }

  try {
    const poses = await detector.estimatePoses(targetImgEl);
    if (poses && poses.length > 0) {
      console.log("[poseDetection] target keypoints detected:", poses[0].keypoints);
      return poses[0].keypoints;
    }
  } catch (err) {
    console.error("[poseDetection] detectTargetKey error:", err);
  }

  return null;
}

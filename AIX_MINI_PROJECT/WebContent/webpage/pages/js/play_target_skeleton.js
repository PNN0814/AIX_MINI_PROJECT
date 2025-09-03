// play_target_skeleton.js
import { initDetector } from "./play_detector.js";

window.addEventListener("DOMContentLoaded", async () => {
  const img = document.getElementById("targetImage");
  if (!img) return;

  // 이미지 로딩 완료 대기
  await new Promise(res => (img.complete ? res() : (img.onload = res)));

  try {
    const detector = await initDetector();

    // 임시 캔버스에 타겟 이미지 복사
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    const tmp = document.createElement("canvas");
    tmp.width = w;
    tmp.height = h;
    tmp.getContext("2d").drawImage(img, 0, 0);

    // 포즈 추출
    const poses = await detector.estimatePoses(tmp, { flipHorizontal: false });
    const kp = poses && poses[0] ? poses[0].keypoints : null;

    if (kp) {
      console.log("[target-skel] keypoints extracted");
      // ✅ targetKeyRef가 있으면 거기에 저장
      if (window.targetKeyRef) {
        window.targetKeyRef.value = kp;
      } else {
        window.targetKey = kp;
      }
    } else {
      console.warn("[target-skel] no keypoints detected");
      if (window.targetKeyRef) window.targetKeyRef.value = null;
      else window.targetKey = null;
    }
  } catch (e) {
    console.error("[target-skel] error", e);
    if (window.targetKeyRef) window.targetKeyRef.value = null;
    else window.targetKey = null;
  }
});

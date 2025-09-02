/* play_target_skeleton.js
 * - #targetImage 위에 스켈레톤을 그립니다.
 * - 기존 코드 수정 없이 독립 실행 (tfjs/pose-detection 자동 로드)
 */

(() => {
  const JOINT_PAIRS = [
    ["left_shoulder","right_shoulder"],["left_shoulder","left_elbow"],["left_elbow","left_wrist"],
    ["right_shoulder","right_elbow"],["right_elbow","right_wrist"],["left_shoulder","left_hip"],
    ["right_shoulder","right_hip"],["left_hip","right_hip"],["left_hip","left_knee"],
    ["left_knee","left_ankle"],["right_hip","right_knee"],["right_knee","right_ankle"]
  ];

  // ---- helpers ----
  function ensureOverlayCanvas(id, anchorEl, zIndex = 9999) {
    let c = document.getElementById(id);
    if (!c) {
      c = document.createElement("canvas");
      c.id = id;
      c.style.position = "absolute";
      c.style.left = "0";
      c.style.top = "0";
      c.style.pointerEvents = "none";
      c.style.zIndex = String(zIndex);
      (anchorEl.parentElement || document.body).appendChild(c);
    }
    const parent = anchorEl.parentElement || document.body;
    if (getComputedStyle(parent).position === "static") parent.style.position = "relative";
    syncOverlayToElement(c, anchorEl);
    return c;
  }

  function syncOverlayToElement(canvas, anchorEl) {
    const rect = anchorEl.getBoundingClientRect();
    const w = anchorEl.clientWidth || rect.width;
    const h = anchorEl.clientHeight || rect.height;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    canvas.width  = w;
    canvas.height = h;
  }

  function drawSkeletonScaled(keypoints, ctx, sx, sy) {
    ctx.save();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(239,68,68,.9)";
    ctx.fillStyle   = "rgba(239,68,68,.9)";

    const by = {};
    keypoints.forEach(k => (by[k.name] = k));

    ctx.beginPath();
    JOINT_PAIRS.forEach(([a,b]) => {
      const pa = by[a], pb = by[b];
      if (!pa || !pb) return;
      ctx.moveTo(pa.x * sx, pa.y * sy);
      ctx.lineTo(pb.x * sx, pb.y * sy);
    });
    ctx.stroke();

    keypoints.forEach(k => {
      if (!k) return;
      ctx.beginPath();
      ctx.arc(k.x * sx, k.y * sy, 4, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  // ---- tfjs/pose-detection lazy loader ----
  function loadScriptOnce(src) {
    return new Promise((resolve, reject) => {
      if ([...document.scripts].some(s => s.src.includes(src))) return resolve();
      const s = document.createElement("script");
      s.src = src; s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  async function ensureTfAndPose() {
    if (!window.tf)           await loadScriptOnce("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4");
    if (!window.poseDetection) await loadScriptOnce("https://cdn.jsdelivr.net/npm/@tensorflow-models/pose-detection");
  }

  // ---- main ----
  window.addEventListener("DOMContentLoaded", async () => {
    const img = document.getElementById("targetImage");
    if (!img) { console.warn("[target-skel] #targetImage not found"); return; }

    // 이미지 로드 대기
    await new Promise(res => (img.complete ? res() : (img.onload = res)));

    // 오버레이 준비
    const overlay = ensureOverlayCanvas("targetImageOverlay", img, 9999);
    const ctx = overlay.getContext("2d");
    window.addEventListener("resize", () => syncOverlayToElement(overlay, img));

    try {
      // 모델 준비
      await ensureTfAndPose();
      await tf.setBackend("webgl"); await tf.ready();
      const detector = await poseDetection.createDetector(
        poseDetection.SupportedModels.MoveNet,
        { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING }
      );

      // 원본(자연 크기)로 추정
      const w = img.naturalWidth  || img.width;
      const h = img.naturalHeight || img.height;
      const tmp = document.createElement("canvas");
      tmp.width = w; tmp.height = h;
      tmp.getContext("2d").drawImage(img, 0, 0);

      const poses = await detector.estimatePoses(tmp, { flipHorizontal: false });
      const kp = poses && poses[0] ? poses[0].keypoints : null;
      if (!kp) { console.warn("[target-skel] no pose found on target image"); return; }

      // 표시 크기에 맞춰 스케일 후 그리기
      syncOverlayToElement(overlay, img);
      const sx = overlay.width  / w;
      const sy = overlay.height / h;
      ctx.clearRect(0, 0, overlay.width, overlay.height);
      drawSkeletonScaled(kp, ctx, sx, sy);

      console.log("[target-skel] drawn");
    } catch (e) {
      console.error("[target-skel] error", e);
    }
  });
})();

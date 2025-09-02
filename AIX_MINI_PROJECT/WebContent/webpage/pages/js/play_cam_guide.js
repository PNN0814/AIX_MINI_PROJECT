/* play_cam_guide.js — fixed guide + auto fit to webcam
 * 웹캠(#webcam) 위에 타겟 가이드를 고정 표시. 캔버스 크기에 맞춰 자동 스케일링.
 */

(() => {
  const JOINT_ORDER = [
    "nose","left_eye","right_eye","left_shoulder","right_shoulder","left_elbow","right_elbow",
    "left_wrist","right_wrist","left_hip","right_hip","left_knee","right_knee","left_ankle","right_ankle"
  ];
  const LINK_PAIRS = [
    ["left_shoulder","right_shoulder"],["left_shoulder","left_elbow"],["left_elbow","left_wrist"],
    ["right_shoulder","right_elbow"],["right_elbow","right_wrist"],["left_shoulder","left_hip"],
    ["right_shoulder","right_hip"],["left_hip","right_hip"],["left_hip","left_knee"],
    ["left_knee","left_ankle"],["right_hip","right_knee"],["right_knee","right_ankle"]
  ];

  const FIXED_GUIDE = true;
  const GUIDE_COLOR = "rgba(0,255,255,0.85)";
  const GUIDE_GLOW  = "rgba(0,255,255,0.6)";
  const GUIDE_LINEW = 3;
  const FIT_MARGIN_RATIO = 0.90;

  const videoEl  = document.getElementById("webcam");
  const targetEl = document.getElementById("targetImage");
  if (!videoEl || !targetEl) return;

  function ensureOverlayCanvas(id, anchorEl, z = 9999) {
    let c = document.getElementById(id);
    if (!c) {
      c = document.createElement("canvas");
      c.id = id;
      c.style.position = "absolute";
      c.style.left = "0";
      c.style.top  = "0";
      c.style.pointerEvents = "none";
      c.style.zIndex = String(z);
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
  const guideCanvas = ensureOverlayCanvas("camGuideOverlay", videoEl, 9999);
  const gctx = guideCanvas.getContext("2d");
  window.addEventListener("resize", () => syncOverlayToElement(guideCanvas, videoEl));
  videoEl.addEventListener("loadedmetadata", () => syncOverlayToElement(guideCanvas, videoEl));

  function loadScriptOnce(src) {
    return new Promise((resolve, reject) => {
      if ([...document.scripts].some(s => s.src.includes(src))) return resolve();
      const s = document.createElement("script");
      s.src = src; s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  async function ensureTfPose() {
    if (!window.tf)            await loadScriptOnce("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4");
    if (!window.poseDetection) await loadScriptOnce("https://cdn.jsdelivr.net/npm/@tensorflow-models/pose-detection");
  }

  function pelvisScaleFromKeypoints(keypoints) {
    const by = {}; keypoints.forEach(k => (by[k.name] = k));
    const LHIP=by["left_hip"], RHIP=by["right_hip"], LSH=by["left_shoulder"], RSH=by["right_shoulder"];
    if (!LHIP || !RHIP || !LSH || !RSH) return null;
    const cx = (LHIP.x + RHIP.x) / 2, cy = (LHIP.y + RHIP.y) / 2;
    const hip = Math.hypot(LHIP.x - RHIP.x, LHIP.y - RHIP.y);
    const sh  = Math.hypot(LSH.x  - RSH.x , LSH.y  - RSH.y );
    const scale = ((hip || 0) + (sh || 0)) / 2 || 1;
    return { cx, cy, scale };
  }
  function normalizeLikeProject(keypoints) {
    const ref = pelvisScaleFromKeypoints(keypoints);
    if (!ref) return null;
    const by = {}; keypoints.forEach(k => (by[k.name] = k));
    const out = [];
    for (const n of JOINT_ORDER) {
      const p = by[n];
      out.push(p ? (p.x - ref.cx) / ref.scale : 0, p ? (p.y - ref.cy) / ref.scale : 0);
    }
    return out;
  }
  function vectorToKeypoints_fixed(vec, anchorX, anchorY, scale) {
    const out = [];
    for (let i=0;i<JOINT_ORDER.length;i++) {
      const name = JOINT_ORDER[i];
      const x = anchorX + vec[i*2] * scale;
      const y = anchorY + vec[i*2+1] * scale;
      out.push({ name, x, y, score: 1 });
    }
    return out;
  }
  function computeExtents(vec) {
    let maxAbsX = 0, maxAbsY = 0;
    for (let i=0;i<vec.length; i+=2) {
      const x = vec[i], y = vec[i+1];
      if (Math.abs(x) > maxAbsX) maxAbsX = Math.abs(x);
      if (Math.abs(y) > maxAbsY) maxAbsY = Math.abs(y);
    }
    return { maxAbsX: Math.max(maxAbsX, 1e-6), maxAbsY: Math.max(maxAbsY, 1e-6) };
  }

  let targetVec = null;
  async function ensureTargetVec(force = false) {
    if (targetVec?.length && !force) return true;
    targetVec = null;

    await ensureTfPose();
    await tf.setBackend("webgl"); await tf.ready();
    const det = await poseDetection.createDetector(
      poseDetection.SupportedModels.MoveNet,
      { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING }
    );
    await new Promise(res => (targetEl.complete ? res() : (targetEl.onload = res)));
    const w = targetEl.naturalWidth || targetEl.width, h = targetEl.naturalHeight || targetEl.height;
    if (!w || !h) return false;
    const tmp = document.createElement("canvas");
    tmp.width = w; tmp.height = h;
    tmp.getContext("2d").drawImage(targetEl, 0, 0);
    const poses = await det.estimatePoses(tmp, { flipHorizontal:false });
    const kp = poses?.[0]?.keypoints;
    if (!kp) return false;
    targetVec = normalizeLikeProject(kp);
    window.targetKey = targetVec;
    return true;
  }

  // 이미지 바뀌면 가이드 리셋
  targetEl.addEventListener("load", () => {
    targetVec = null;
    window.targetKey = null;
  });

  function drawGuide(keypoints, ctx) {
    const by = {}; keypoints.forEach(k => (by[k.name] = k));
    ctx.save();
    ctx.lineWidth = GUIDE_LINEW;
    ctx.strokeStyle = GUIDE_COLOR;
    ctx.fillStyle   = GUIDE_COLOR;
    ctx.setLineDash([6,6]);
    ctx.shadowColor = GUIDE_GLOW;
    ctx.shadowBlur  = 8;

    ctx.beginPath();
    for (const [a,b] of LINK_PAIRS) {
      const pa = by[a], pb = by[b];
      if (!pa || !pb) continue;
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    for (const k of keypoints) {
      if (!k) continue;
      ctx.beginPath();
      ctx.arc(k.x, k.y, 4.5, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
  }

  let stop = false;
  async function loop() {
    if (stop) return;
    try {
      syncOverlayToElement(guideCanvas, videoEl);

      const ok = await ensureTargetVec();
      if (!ok) { requestAnimationFrame(loop); return; }

      gctx.clearRect(0,0,guideCanvas.width,guideCanvas.height);

      if (FIXED_GUIDE) {
        const { maxAbsX, maxAbsY } = computeExtents(targetVec);
        const fitW = guideCanvas.width  * FIT_MARGIN_RATIO;
        const fitH = guideCanvas.height * FIT_MARGIN_RATIO;
        const sW = fitW / (2 * maxAbsX);
        const sH = fitH / (2 * maxAbsY);
        const scale = Math.min(sW, sH)*1.2;

        const cx = guideCanvas.width  / 2;
        const cy = guideCanvas.height * 0.6;

        const guideKps = vectorToKeypoints_fixed(targetVec, cx, cy, scale);
        drawGuide(guideKps, gctx);
      }
    } catch (e) {
      console.error("[cam-guide] loop error", e);
    }
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);

  // 🔥 외부 제어 API
  function setGuideVisible(show) {
    guideCanvas.style.display = show ? "block" : "none";
  }

  window.CamGuide = {
    stop(){ stop = true; },
    start(){ if (stop) { stop = false; requestAnimationFrame(loop); } },
    show(){ setGuideVisible(true); },
    hide(){ setGuideVisible(false); }
  };
})();

(() => {
  const LINK_PAIRS = [
    ["left_shoulder","right_shoulder"],["left_shoulder","left_elbow"],["left_elbow","left_wrist"],
    ["right_shoulder","right_elbow"],["right_elbow","right_wrist"],["left_shoulder","left_hip"],
    ["right_shoulder","right_hip"],["left_hip","right_hip"],["left_hip","left_knee"],
    ["left_knee","left_ankle"],["right_hip","right_knee"],["right_knee","right_ankle"]
  ];

  const GUIDE_COLOR = "rgba(0,255,255,0.85)";
  const GUIDE_LINEW = 3;

  const videoEl  = document.getElementById("webcam");
  if (!videoEl) return;

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

  function drawGuide(ctx, w, h) {
    ctx.save();
    ctx.strokeStyle = GUIDE_COLOR;
    ctx.fillStyle   = GUIDE_COLOR;
    ctx.lineWidth   = GUIDE_LINEW;
    ctx.setLineDash([6,6]);

    const cx = w/2, cy = h*0.6;
    ctx.beginPath();
    ctx.arc(cx, cy, 80, 0, Math.PI*2);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI*2);
    ctx.fill();

    ctx.restore();
  }

  function loop() {
    syncOverlayToElement(guideCanvas, videoEl);
    gctx.clearRect(0,0,guideCanvas.width,guideCanvas.height);
    drawGuide(gctx, guideCanvas.width, guideCanvas.height);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();

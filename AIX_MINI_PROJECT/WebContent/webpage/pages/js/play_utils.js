export function normalizeKeypoints(keypoints) {
  const by = {};
  keypoints.forEach(k => (by[k.name] = k));

  const LHIP = by["left_hip"], RHIP = by["right_hip"], LSH = by["left_shoulder"], RSH = by["right_shoulder"];
  if (!LHIP || !RHIP || !LSH || !RSH) return null;

  const xy = {};
  for (const n in by) {
    const p = by[n];
    xy[n] = (p && p.score != null && p.score >= 0.5) ? { x: p.x, y: p.y } : { x: NaN, y: NaN };
  }

  const pelvis = { x: (LHIP.x + RHIP.x) / 2, y: (LHIP.y + RHIP.y) / 2 };
  const hipDist = Math.hypot(LHIP.x - RHIP.x, LHIP.y - RHIP.y);
  const shDist  = Math.hypot(LSH.x - RSH.x, LSH.y - RSH.y);
  const scale = (hipDist + shDist) / 2 || 1.0;

  const ids = [
    "nose","left_eye","right_eye","left_shoulder","right_shoulder","left_elbow","right_elbow",
    "left_wrist","right_wrist","left_hip","right_hip","left_knee","right_knee","left_ankle","right_ankle"
  ];

  const vec = [];
  for (const n of ids) {
    const p = xy[n];
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) {
      vec.push(0, 0);
    } else {
      vec.push((p.x - pelvis.x) / scale, (p.y - pelvis.y) / scale);
    }
  }
  return vec;
}

export function computeSimilarity(a, b) {
  if (!a || !b) return 0;
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na  += a[i] * a[i];
    nb  += b[i] * b[i];
  }
  const denom = (Math.sqrt(na) * Math.sqrt(nb)) || 1e-6;
  const cos = dot / denom;
  return (Math.max(-1, Math.min(1, cos)) + 1) / 2;
}

export function drawSkeleton(kps, ctx) {
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(239,68,68,.9)";
  ctx.fillStyle   = "rgba(239,68,68,.9)";

  const by = {};
  kps.forEach(k => (by[k.name] = k));

  const pairs = [
    ["left_shoulder","right_shoulder"],["left_shoulder","left_elbow"],["left_elbow","left_wrist"],
    ["right_shoulder","right_elbow"],["right_elbow","right_wrist"],["left_shoulder","left_hip"],
    ["right_shoulder","right_hip"],["left_hip","right_hip"],["left_hip","left_knee"],
    ["left_knee","left_ankle"],["right_hip","right_knee"],["right_knee","right_ankle"]
  ];

  ctx.beginPath();
  pairs.forEach(([a,b]) => {
    const pa = by[a], pb = by[b];
    if (!pa || !pb) return;
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
  });
  ctx.stroke();

  kps.forEach(k => {
    if (!k) return;
    ctx.beginPath();
    ctx.arc(k.x, k.y, 4, 0, Math.PI * 2);
    ctx.fill();
  });
}

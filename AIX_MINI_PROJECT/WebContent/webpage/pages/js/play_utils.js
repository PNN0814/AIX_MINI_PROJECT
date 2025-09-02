// 공통 연결 관계 정의
export const CONNECTED_KEYPOINTS = [
  [0,1],[1,3],[0,2],[2,4],
  [5,7],[7,9],[6,8],[8,10],
  [5,6],[5,11],[6,12],
  [11,12],[11,13],[13,15],[12,14],[14,16]
];

// 내 스켈레톤 (빨간 점 + 빨간 선)
export function drawMySkeleton(keypoints, ctx) {
  // 점
  keypoints.forEach(kp => {
    if (kp.score > 0.4) {
      ctx.beginPath();
      ctx.arc(kp.x, kp.y, 4, 0, 2 * Math.PI);
      ctx.fillStyle = "red";
      ctx.fill();
    }
  });

  // 선
  ctx.strokeStyle = "red";
  ctx.lineWidth = 2;
  ctx.setLineDash([]); // 실선
  CONNECTED_KEYPOINTS.forEach(([a, b]) => {
    const kp1 = keypoints[a];
    const kp2 = keypoints[b];
    if (kp1 && kp2 && kp1.score > 0.4 && kp2.score > 0.4) {
      ctx.beginPath();
      ctx.moveTo(kp1.x, kp1.y);
      ctx.lineTo(kp2.x, kp2.y);
      ctx.stroke();
    }
  });
}

// 가이드 스켈레톤 (시안 점선)
export function drawGuideSkeleton(keypoints, ctx) {
  // 점
  keypoints.forEach(kp => {
    if (kp.score > 0.4) {
      ctx.beginPath();
      ctx.arc(kp.x, kp.y, 4, 0, 2 * Math.PI);
      ctx.fillStyle = "cyan";
      ctx.fill();
    }
  });

  // 선
  ctx.strokeStyle = "cyan";
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]); // 점선
  CONNECTED_KEYPOINTS.forEach(([a, b]) => {
    const kp1 = keypoints[a];
    const kp2 = keypoints[b];
    if (kp1 && kp2 && kp1.score > 0.4 && kp2.score > 0.4) {
      ctx.beginPath();
      ctx.moveTo(kp1.x, kp1.y);
      ctx.lineTo(kp2.x, kp2.y);
      ctx.stroke();
    }
  });
  ctx.setLineDash([]); // 원래대로 복구
}

// 키포인트 정규화
export function normalizeKeypoints(keypoints) {
  const xs = keypoints.map(kp => kp.x);
  const ys = keypoints.map(kp => kp.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const scaleX = maxX - minX;
  const scaleY = maxY - minY;

  return keypoints.map(kp => {
    return {
      x: (kp.x - minX) / (scaleX || 1),
      y: (kp.y - minY) / (scaleY || 1),
      score: kp.score
    };
  });
}

// 두 포즈의 유사도 계산 (코사인 유사도)
export function computeSimilarity(vec1, vec2) {
  if (!vec1 || !vec2 || vec1.length !== vec2.length) return 0;

  let dot = 0, norm1 = 0, norm2 = 0;
  for (let i = 0; i < vec1.length; i++) {
    if (vec1[i].score > 0.4 && vec2[i].score > 0.4) {
      dot += vec1[i].x * vec2[i].x + vec1[i].y * vec2[i].y;
      norm1 += vec1[i].x * vec1[i].x + vec1[i].y * vec1[i].y;
      norm2 += vec2[i].x * vec2[i].x + vec2[i].y * vec2[i].y;
    }
  }
  if (norm1 === 0 || norm2 === 0) return 0;
  return dot / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

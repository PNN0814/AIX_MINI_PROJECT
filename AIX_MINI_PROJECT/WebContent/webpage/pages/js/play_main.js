import { showLoadingOverlay, hideLoadingOverlay, showRoundOverlay, showEndOverlay } from "./play_overlay.js";
import { initCameraWithFallback, resizeCanvasToVideo } from "./play_camera.js";
import { initDetector, detectTargetKey } from "./play_detector.js";
import { startEstimationPump, startRenderLoop } from "./play_render.js";

let targetKey = { value: null };
let bestAcc = { value: 0 };
let allowAccuracyUpdate = { value: false };

let players = 1; // URL에서 가져온 값
let usedImages = new Set(); // 중복 방지
let latestPose = null; // 현재 추정된 포즈 저장 (renderLoop에서 업데이트)

window.addEventListener("DOMContentLoaded", async () => {
  const videoEl = document.getElementById("webcam");
  const canvasEl = document.getElementById("overlay");
  const ctx = canvasEl.getContext("2d");
  const targetImgEl = document.getElementById("targetImage");

  const urlParams = new URL(location.href).searchParams;
  const attemptNum = Number(urlParams.get("n") || 1);
  const photosCount = Number(urlParams.get("photos") || 1);
  players = Number(urlParams.get("players") || 1);

  // 🔥 게임 시작 시 세션 초기화
  await fetch("/end", { method: "POST" });

  // 1. 첫 라운드용 사진 미리 뽑아두기 (이미지 로딩 끝까지 보장)
  await pickRandomTarget(targetImgEl, players);

  // 2. 카메라/모델 준비
  await showLoadingOverlay();
  await initCameraWithFallback(videoEl);
  resizeCanvasToVideo(canvasEl, videoEl);
  await initDetector();
  hideLoadingOverlay();

  // 3. 추정 + 렌더 시작
  startEstimationPump(videoEl, 12, pose => { latestPose = pose; });
  startRenderLoop(canvasEl, ctx, targetKey, bestAcc, allowAccuracyUpdate, () => latestPose);

  // 4. 첫 라운드 시작
  runRound(1, photosCount, attemptNum, videoEl, targetImgEl);
});

async function runRound(roundIdx, photosCount, attemptNum, videoEl, targetImgEl) {
  document.getElementById("accuracyNow").textContent = "0%";
  allowAccuracyUpdate.value = false;

  if (roundIdx > 1) {
    // 2라운드 이상 → 새로운 사진 교체 후 detect
    await pickRandomTarget(targetImgEl, players);
    targetKey.value = await detectTargetKey(targetImgEl);
  } else {
    // 첫 라운드 → detect 실행
    targetKey.value = await detectTargetKey(targetImgEl);
  }

  // 준비 오버레이 실행
  await showRoundOverlay(roundIdx);

  // 준비 끝난 후 정확도 갱신 허용
  allowAccuracyUpdate.value = true;

  // 카운트다운 시작
  startCountdown(
    10,
    document.getElementById("countdownValue"),
    async () => {
      // 🔥 타이머 종료 시 캡처 실행 (원본만 저장)
      await captureFrame(videoEl, false, roundIdx);

      if (roundIdx >= photosCount) {
        // 종료 시 정확도 갱신 정지
        allowAccuracyUpdate.value = false;
        await showEndOverlay(attemptNum, bestAcc.value);
      } else {
        runRound(roundIdx + 1, photosCount, attemptNum, videoEl, targetImgEl);
      }
    },
    videoEl,
    roundIdx
  );
}

function startCountdown(sec, el, onDone, videoEl, roundIdx) {
  const endAt = Date.now() + sec * 1000;
  let lastShown = -1;
  const timer = setInterval(async () => {
    const left = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
    if (left !== lastShown) {
      lastShown = left;
      if (el) el.textContent = left;
    }
    if (left <= 0) {
      clearInterval(timer);
      onDone && onDone();
    }
  }, 200);
}

// 🔥 캡처 함수 (원본만 저장됨)
async function captureFrame(videoEl, withSkeleton, roundIdx) {
  const canvas = document.createElement("canvas");
  canvas.width = videoEl.videoWidth;
  canvas.height = videoEl.videoHeight;
  const ctx = canvas.getContext("2d");

  // 비디오 프레임 그리기
  ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

  // 스켈레톤 옵션 (지금은 호출 안 하니까 실행되지 않음)
  if (withSkeleton && latestPose?.keypoints) {
    drawSkeleton(latestPose.keypoints, ctx);
  }

  const dataUrl = canvas.toDataURL("image/jpeg");

  try {
    const res = await fetch("/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image: dataUrl,
        skeleton: withSkeleton,
        round: roundIdx,
      }),
    });
    const result = await res.json();
    console.log("[capture result]", result);
  } catch (err) {
    console.error("[capture error]", err);
  }
}

// 🔥 players 값에 맞춰 랜덤 범위 세팅 & 중복 방지
async function pickRandomTarget(targetImgEl, players) {
  let maxRange = 20;
  if (players === 3) maxRange = 18;

  // 모든 이미지를 다 썼다면 초기화
  if (usedImages.size >= maxRange) {
    usedImages.clear();
  }

  // 중복되지 않는 번호 뽑기
  let randomIdx;
  do {
    randomIdx = Math.floor(Math.random() * maxRange) + 1;
  } while (usedImages.has(randomIdx));

  usedImages.add(randomIdx);

  const url = `/static/result_images/matching/${players}/${randomIdx}.jpg`;

  // 이미지 로딩 완료 후 resolve
  return new Promise(resolve => {
    targetImgEl.onload = () => {
      // 🔥 이미지 교체 후 스켈레톤 가이드 리셋
      targetImgEl.removeAttribute("data-target-key");
      window.targetKey = null;
      resolve(url);
    };
    targetImgEl.onerror = () => resolve(null);
    targetImgEl.src = url;
  });
}

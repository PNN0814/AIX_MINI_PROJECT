import {
  showLoadingOverlay,
  hideLoadingOverlay,
  showRoundOverlay,
  showEndOverlay,
  showSavingOverlay,
  hideSavingOverlay,
  updateSavingProgress
} from "./play_overlay.js";
import { initCameraWithFallback, resizeCanvasToVideo } from "./play_camera.js";
import { initDetector, detectTargetKey } from "./play_detector.js";
import { startEstimationPump, startRenderLoop } from "./play_render.js";
import "./play_target_skeleton.js";

let targetKey = { value: null };
let bestAcc = { value: 0 };   // ✅ 게임 전체 도중 최고 정확도
let currentAcc = 0;           // 이번 라운드 순간 정확도

let players = 1;
let usedImages = new Set();
let photosCount = 1;
let attemptNum = 1;

export let mediaRecorder;
let recordedChunks = [];

// ✅ 좌우반전용 캔버스 (녹화 & 캡처 공통 사용)
let mirrorCanvas = null;
let mirrorCtx = null;

let lastCaptureFolder = null;
let capturedImages = [];
let capturedTargets = [];
let capturedAccuracies = []; // 라운드별 순간 정확도 기록

// ----------------------------
// 정확도 업데이트 (렌더루프/디텍터에서 호출)
// ----------------------------
export function updateAccuracy(acc) {
  currentAcc = acc;               // 이번 라운드 순간값
  if (acc > bestAcc.value) {      // 게임 전체 최고값 갱신
    bestAcc.value = acc;
  }
}

// ----------------------------
// 녹화 시작 (좌우반전 적용)
// ----------------------------
export async function startWebcamRecording(videoEl) {
  const stream = videoEl.srcObject;
  if (!stream) return;

  // ✅ 좌우반전용 캔버스 준비
  mirrorCanvas = document.createElement("canvas");
  mirrorCanvas.width = videoEl.videoWidth || 640;
  mirrorCanvas.height = videoEl.videoHeight || 480;
  mirrorCtx = mirrorCanvas.getContext("2d");

  function drawMirror() {
    mirrorCtx.save();
    mirrorCtx.translate(mirrorCanvas.width, 0);
    mirrorCtx.scale(-1, 1);
    mirrorCtx.drawImage(videoEl, 0, 0, mirrorCanvas.width, mirrorCanvas.height);
    mirrorCtx.restore();
    requestAnimationFrame(drawMirror);
  }
  drawMirror();

  // ✅ 반전된 스트림으로 녹화
  const mirroredStream = mirrorCanvas.captureStream(30);

  recordedChunks = [];
  mediaRecorder = new MediaRecorder(mirroredStream, { mimeType: "video/webm; codecs=vp9" });

  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) recordedChunks.push(e.data);
  };

  mediaRecorder.start();
  console.log("[recording] started (mirrored)");
}

// ----------------------------
// 녹화 중단 + 업로드
// ----------------------------
export function stopWebcamRecordingAndUpload() {
  return new Promise((resolve, reject) => {
    if (!mediaRecorder || mediaRecorder.state === "inactive") {
      console.warn("[recording] no active recorder");
      return resolve();
    }

    showSavingOverlay();

    mediaRecorder.onstop = async () => {
      const blob = new Blob(recordedChunks, { type: "video/webm" });

      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/upload_video", true);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          updateSavingProgress(percent);
        }
      };

      xhr.onload = () => {
        hideSavingOverlay();
        if (xhr.status === 200) {
          console.log("[recording] upload complete", xhr.responseText);
          resolve();
        } else {
          console.error("[recording] upload failed", xhr.responseText);
          reject(new Error("Upload failed"));
        }
      };

      xhr.onerror = () => {
        hideSavingOverlay();
        reject(new Error("XHR error"));
      };

      const formData = new FormData();
      formData.append("file", blob, "recording.mp4"); // 서버에서는 mp4로 저장
      xhr.send(formData);
    };

    mediaRecorder.stop();
    console.log("[recording] stopped");
  });
}

// ----------------------------
// 초기화
// ----------------------------
window.addEventListener("DOMContentLoaded", async () => {
  const videoEl = document.getElementById("webcam");
  const canvasEl = document.getElementById("overlay");
  const ctx = canvasEl.getContext("2d");
  const targetImgEl = document.getElementById("targetImage");

  const urlParams = new URL(location.href).searchParams;
  attemptNum = Number(urlParams.get("n") || 1);
  photosCount = Number(urlParams.get("photos") || 1);
  players = Number(urlParams.get("players") || 1);

  await showLoadingOverlay();

  await pickRandomTarget(targetImgEl, players);

  await initCameraWithFallback(videoEl);
  resizeCanvasToVideo(canvasEl, videoEl);

  await initDetector();

  startEstimationPump(videoEl, 12);
  startRenderLoop(canvasEl, ctx, targetKey, bestAcc);

  hideLoadingOverlay();
  await runRound(1, photosCount, attemptNum, videoEl, targetImgEl);
});

// ----------------------------
// 라운드 실행
// ----------------------------
async function runRound(roundIdx, photosCount, attemptNum, videoEl, targetImgEl) {
  if (roundIdx > 1) {
    await pickRandomTarget(targetImgEl, players);
    targetKey.value = await detectTargetKey(targetImgEl);
  } else {
    targetKey.value = await detectTargetKey(targetImgEl);
  }

  await showRoundOverlay(roundIdx);

  if (roundIdx === 1) {
    startWebcamRecording(videoEl);
  }

  startCountdown(
    10,
    document.getElementById("countdownValue"),
    async () => {
      await captureFrame(videoEl, false, roundIdx);

      // 이번 라운드 순간 정확도 저장
      capturedAccuracies.push(currentAcc);

      if (roundIdx >= photosCount) {
        await stopWebcamRecordingAndUpload();

        const today = new Date().toISOString().split("T")[0];

        // ✅ 최고 정확도는 게임 전체 도중 갱신된 최고값 저장
        await fetch("/result_redirect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: today,
            folder: lastCaptureFolder,
            player: players,
            max_image: photosCount,
            images_nm: capturedImages,
            images_ac: capturedAccuracies,
            best_ac: bestAcc.value, // ← 게임 전체 중 최고값
            targets: capturedTargets
          }),
        });

        window.location.href = "/result";
      } else {
        runRound(roundIdx + 1, photosCount, attemptNum, videoEl, targetImgEl);
      }
    }
  );
}

// ----------------------------
// 카운트다운
// ----------------------------
function startCountdown(sec, el, onDone) {
  const endAt = Date.now() + sec * 1000;
  let lastShown = -1;
  const timer = setInterval(() => {
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

// ----------------------------
// 캡처 (좌우반전 적용)
// ----------------------------
async function captureFrame(videoEl, withSkeleton, roundIdx) {
  const canvas = document.createElement("canvas");
  canvas.width = videoEl.videoWidth;
  canvas.height = videoEl.videoHeight;
  const ctx = canvas.getContext("2d");

  // ✅ 좌우반전된 화면 그리기
  ctx.save();
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
  ctx.restore();

  const dataUrl = canvas.toDataURL("image/jpeg");
  const targetImgEl = document.getElementById("targetImage");
  const targetSrc = targetImgEl ? targetImgEl.src.split("/").pop() : null;

  try {
    const res = await fetch("/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image: dataUrl,
        skeleton: withSkeleton,
        round: roundIdx,
        player: players,
        accuracy: currentAcc
      }),
    });
    const result = await res.json();
    console.log("[capture result]", result);

    lastCaptureFolder = result.session;
    capturedImages.push(result.saved); // 파일명만 반환됨
    if (targetSrc) capturedTargets.push(targetSrc);
  } catch (err) {
    console.error("[capture error]", err);
  }
}

// ----------------------------
// 랜덤 타겟 선택
// ----------------------------
async function pickRandomTarget(targetImgEl, players) {
  let maxRange = 20;
  if (players === 3) maxRange = 18;

  if (usedImages.size >= maxRange) usedImages.clear();

  let randomIdx;
  do {
    randomIdx = Math.floor(Math.random() * maxRange) + 1;
  } while (usedImages.has(randomIdx));

  usedImages.add(randomIdx);

  const url = `/static/result_images/matching/${players}/${randomIdx}.jpg`;

  return new Promise(resolve => {
    targetImgEl.onload = async () => {
      targetImgEl.removeAttribute("data-target-key");
      window.targetKey = null;
      targetKey.value = await detectTargetKey(targetImgEl);
      resolve(url);
    };
    targetImgEl.onerror = () => resolve(null);
    targetImgEl.src = url;
  });
}

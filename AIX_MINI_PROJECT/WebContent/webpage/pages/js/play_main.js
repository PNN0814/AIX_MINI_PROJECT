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
import { initDetector, detectTargetKeys } from "./play_detector.js"; // ✅ 멀티포즈
import { startEstimationPump, startRenderLoop } from "./play_render.js";
import "./play_target_skeleton.js";

let targetKey = { value: [] };  // ✅ 배열로
let bestAcc = { value: 0 };
let currentAcc = 0;

let players = 1;
let usedImages = new Set();
let photosCount = 1;
let attemptNum = 1;

export let mediaRecorder;
let recordedChunks = [];

// ----------------------------
// 정확도 업데이트 (렌더루프에서 호출)
// ----------------------------
export function updateAccuracy(acc) {
  currentAcc = acc;
  if (acc > bestAcc.value) {
    bestAcc.value = acc;
  }
}

// ----------------------------
// 녹화 관련 (최신 소스 그대로)
// ----------------------------
export async function startWebcamRecording(videoEl) {
  const stream = videoEl.srcObject;
  if (!stream) return;

  recordedChunks = [];
  mediaRecorder = new MediaRecorder(stream, { mimeType: "video/webm; codecs=vp9" });

  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) recordedChunks.push(e.data);
  };

  mediaRecorder.start();
  console.log("[recording] started");
}

export function stopWebcamRecordingAndUpload() {
  return new Promise((resolve, reject) => {
    if (!mediaRecorder || mediaRecorder.state === "inactive") {
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
      formData.append("file", blob, "recording.webm");
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
    targetKey.value = await detectTargetKeys(targetImgEl); // ✅ 배열
  } else {
    targetKey.value = await detectTargetKeys(targetImgEl);
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

      if (roundIdx >= photosCount) {
        await stopWebcamRecordingAndUpload();
        await showEndOverlay(attemptNum, bestAcc);
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
// 캡처
// ----------------------------
async function captureFrame(videoEl, withSkeleton, roundIdx) {
  const canvas = document.createElement("canvas");
  canvas.width = videoEl.videoWidth;
  canvas.height = videoEl.videoHeight;
  const ctx = canvas.getContext("2d");

  ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

  const dataUrl = canvas.toDataURL("image/jpeg");

  try {
    const res = await fetch("/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: dataUrl, skeleton: withSkeleton, round: roundIdx, accuracy: currentAcc }),
    });
    const result = await res.json();
    console.log("[capture result]", result);
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
      targetKey.value = await detectTargetKeys(targetImgEl); // ✅ 배열
      resolve(url);
    };
    targetImgEl.onerror = () => resolve(null);
    targetImgEl.src = url;
  });
}

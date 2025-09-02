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

let targetKey = { value: null };
let bestAcc = { value: 0 };
let allowAccuracyUpdate = { value: false };

let players = 1;
let usedImages = new Set();
let latestPose = null;

// ----------------------------
// 녹화 관련
// ----------------------------
export let mediaRecorder;
let recordedChunks = [];

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
// DOMContentLoaded
// ----------------------------
window.addEventListener("DOMContentLoaded", async () => {
  const videoEl = document.getElementById("webcam");
  const canvasEl = document.getElementById("overlay");
  const ctx = canvasEl.getContext("2d");
  const targetImgEl = document.getElementById("targetImage");

  const urlParams = new URL(location.href).searchParams;
  const attemptNum = Number(urlParams.get("n") || 1);
  const photosCount = Number(urlParams.get("photos") || 1);
  players = Number(urlParams.get("players") || 1);

  await fetch("/end", { method: "POST" });

  await pickRandomTarget(targetImgEl, players);

  await showLoadingOverlay();
  await initCameraWithFallback(videoEl);
  resizeCanvasToVideo(canvasEl, videoEl);

  await initDetector();
  hideLoadingOverlay();

  startEstimationPump(videoEl, 12, pose => { latestPose = pose; });
  startRenderLoop(canvasEl, ctx, targetKey, bestAcc, allowAccuracyUpdate, () => latestPose);

  runRound(1, photosCount, attemptNum, videoEl, targetImgEl);
});

// ----------------------------
// 라운드
// ----------------------------
async function runRound(roundIdx, photosCount, attemptNum, videoEl, targetImgEl) {
  document.getElementById("accuracyNow").textContent = "0%";
  document.getElementById("accuracyBest").textContent = "0%";
  allowAccuracyUpdate.value = false;

  if (roundIdx > 1) {
    await pickRandomTarget(targetImgEl, players);
    targetKey.value = await detectTargetKey(targetImgEl);
  } else {
    targetKey.value = await detectTargetKey(targetImgEl);
  }

  await showRoundOverlay(roundIdx);

  if (roundIdx === 1) {
    startWebcamRecording(videoEl); // 1번째 준비부터 녹화
  }

  allowAccuracyUpdate.value = true;

  startCountdown(
    10,
    document.getElementById("countdownValue"),
    async () => {
      await captureFrame(videoEl, false, roundIdx);

      if (roundIdx >= photosCount) {
        allowAccuracyUpdate.value = false;
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

  if (withSkeleton && latestPose?.keypoints) {
    drawSkeleton(latestPose.keypoints, ctx);
  }

  const dataUrl = canvas.toDataURL("image/jpeg");

  try {
    const res = await fetch("/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: dataUrl, skeleton: withSkeleton, round: roundIdx }),
    });
    const result = await res.json();
    console.log("[capture result]", result);
  } catch (err) {
    console.error("[capture error]", err);
  }
}

// ----------------------------
// 랜덤 타겟 이미지
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
    targetImgEl.onload = () => {
      targetImgEl.removeAttribute("data-target-key");
      window.targetKey = null;
      resolve(url);
    };
    targetImgEl.onerror = () => resolve(null);
    targetImgEl.src = url;
  });
}

// ----------------------------
// 스켈레톤 캡처용 함수 (로컬만)
// ----------------------------
function drawSkeleton(keypoints, ctx) {
  const CONNECTED_KEYPOINTS = [
    [0,1],[1,3],[0,2],[2,4],
    [5,7],[7,9],[6,8],[8,10],
    [5,6],[5,11],[6,12],
    [11,12],[11,13],[13,15],[12,14],[14,16]
  ];

  ctx.strokeStyle = "lime";
  ctx.lineWidth = 2;

  keypoints.forEach(kp => {
    if (kp.score > 0.4) {
      ctx.beginPath();
      ctx.arc(kp.x, kp.y, 4, 0, 2 * Math.PI);
      ctx.fillStyle = "red";
      ctx.fill();
    }
  });

  CONNECTED_KEYPOINTS.forEach(([a, b]) => {
    const kp1 = keypoints[a];
    const kp2 = keypoints[b];
    if (kp1.score > 0.4 && kp2.score > 0.4) {
      ctx.beginPath();
      ctx.moveTo(kp1.x, kp1.y);
      ctx.lineTo(kp2.x, kp2.y);
      ctx.stroke();
    }
  });
}

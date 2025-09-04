document.addEventListener("DOMContentLoaded", function () {
  const data = window.resultData || {};
  console.log("[result data]", data);

  if (!data.date) return;

  let currentIndex = 0;
  const total = data.max_image || 1;

  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");

  // 버튼 노출 조건
  if (total <= 1) {
    prevBtn.style.display = "none";
    nextBtn.style.display = "none";
  }

  function updateDisplay(index) {
    const userImage = document.getElementById("userImage");
    const targetImage = document.getElementById("targetImage");
    if (userImage) {
      userImage.src = `/static/result_images/capture/${data.date}/${data.folder}/${data.images_nm[index]}`;
    }
    if (targetImage) {
      targetImage.src = `/static/result_images/matching/${data.player}/${data.targets[index]}`;
    }

    document.getElementById("currentAccuracy").textContent = `${data.images_ac[index]}%`;
    document.getElementById("bestAccuracy").textContent = `${data.best_ac}%`;

    const videoEl = document.getElementById("recordedVideo");
    if (videoEl) {
      const source = videoEl.querySelector("source");
      source.src = `/static/result_images/video/${data.date}/${data.folder}/${data.date}.mp4`;
      videoEl.load();
      videoEl.playbackRate = 1.5;
    }
  }

  // 초기 로드
  updateDisplay(currentIndex);

  prevBtn.addEventListener("click", () => {
    currentIndex = (currentIndex - 1 + total) % total;
    updateDisplay(currentIndex);
  });

  nextBtn.addEventListener("click", () => {
    currentIndex = (currentIndex + 1) % total;
    updateDisplay(currentIndex);
  });

  const downloadBtn = document.getElementById("downloadBtn");
  if (downloadBtn) {
    downloadBtn.addEventListener("click", () => {
      const a = document.createElement("a");
      a.href = `/static/result_images/video/${data.date}/${data.folder}/${data.date}.mp4`;
      a.download = `${data.date}.mp4`;
      a.click();
    });
  }
});

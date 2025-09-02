export async function showLoadingOverlay() {
  const overlay = document.getElementById("loadingOverlay");
  if (overlay) overlay.style.display = "flex";
  if (window.CamGuide) window.CamGuide.hide();   // 🔥 로딩 중에는 가이드 숨김
}

export function hideLoadingOverlay() {
  const overlay = document.getElementById("loadingOverlay");
  if (overlay) overlay.style.display = "none";
  // 준비 단계에서도 가이드 안 보임
}

export async function showRoundOverlay(roundIdx) {
  return new Promise(resolve => {
    const overlay = document.getElementById("roundOverlay");
    const textEl = document.getElementById("roundText");
    if (!overlay || !textEl) return resolve();

    // 🔥 준비 오버레이가 뜰 때마다 가이드 숨기기
    if (window.CamGuide) window.CamGuide.hide();

    overlay.style.display = "flex";
    textEl.textContent = `${roundIdx}번째 준비...`;

    setTimeout(() => { textEl.textContent = "시작!"; }, 2300);
    setTimeout(() => {
      overlay.style.display = "none";
      if (window.CamGuide) window.CamGuide.show();   // 🔥 "시작!" 직후 가이드 표시
      resolve();
    }, 3300);
  });
}

export async function showEndOverlay(attemptNum, bestAcc) {
  return new Promise(resolve => {
    const overlay = document.getElementById("endOverlay");
    const textEl = document.getElementById("endText");
    if (!overlay || !textEl) return resolve();

    // 🔥 종료 오버레이가 뜰 때도 가이드 숨기기
    if (window.CamGuide) window.CamGuide.hide();

    overlay.style.display = "flex";
    textEl.textContent = "종료!";

    setTimeout(() => {
      overlay.style.display = "none";
      location.href = `/result?n=${attemptNum}&a=${bestAcc}`;
      resolve();
    }, 2000);
  });
}

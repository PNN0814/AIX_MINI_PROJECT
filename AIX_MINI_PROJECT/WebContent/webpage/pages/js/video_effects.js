// ========================================
// 1. 효과 저장소 - 여기에 새로운 효과를 추가하세요!
// ========================================
const videoEffects = {
  // 🎨 세피아 효과 (갈색 필터)
  sepia: {
    name: '세피아',
    apply: (canvas, ctx) => {
      ctx.filter = 'sepia(100%)';
      ctx.drawImage(canvas._originalCanvas, 0, 0);
      ctx.filter = 'none';
    }
  },
  
  // 🌫️ 블러 효과
  blur: {
    name: '블러',
    apply: (canvas, ctx) => {
      ctx.filter = 'blur(3px)';
      ctx.drawImage(canvas._originalCanvas, 0, 0);
      ctx.filter = 'none';
    }
  },
  
  // 🌈 밝기 증가
  bright: {
    name: '밝게',
    apply: (canvas, ctx) => {
      ctx.filter = 'brightness(150%)';
      ctx.drawImage(canvas._originalCanvas, 0, 0);
      ctx.filter = 'none';
    }
  },
  
  // 🔄 흑백 효과
  grayscale: {
    name: '흑백',
    apply: (canvas, ctx) => {
      ctx.filter = 'grayscale(100%)';
      ctx.drawImage(canvas._originalCanvas, 0, 0);
      ctx.filter = 'none';
    }
  },
  
  // ⭐⭐⭐ 새로 추가된 효과들 ⭐⭐⭐
  // 🌈 무지개 효과
  rainbow: {
    name: '무지개',
    apply: (canvas, ctx) => {
      ctx.filter = 'hue-rotate(180deg) saturate(200%)';
      ctx.drawImage(canvas._originalCanvas, 0, 0);
      ctx.filter = 'none';
    }
  },
  
  // ❄️ 차가운 느낌
  cool: {
    name: '차가움',
    apply: (canvas, ctx) => {
      ctx.filter = 'hue-rotate(180deg) brightness(110%)';
      ctx.drawImage(canvas._originalCanvas, 0, 0);
      ctx.filter = 'none';
    }
  },
  
  // 🔥 따뜻한 느낌
  warm: {
    name: '따뜻함',
    apply: (canvas, ctx) => {
      ctx.filter = 'sepia(30%) saturate(140%) brightness(110%)';
      ctx.drawImage(canvas._originalCanvas, 0, 0);
      ctx.filter = 'none';
    }
  }
  // ⭐⭐⭐ 새 효과는 여기 위에 추가! (마지막 효과 뒤에는 콤마 없음) ⭐⭐⭐
};

// ========================================
// 2. 효과 목록 가져오기 (result.js에서 사용)
// ========================================
window.getAvailableVideoEffects = function() {
  return Object.keys(videoEffects).map(id => ({
    id: id,
    name: videoEffects[id].name
  }));
};

// ========================================
// 3. 메인 효과 처리 시스템
// ========================================
window.VideoEffectsProcessor = {
  // 비디오에 효과 적용하는 메인 함수
  async applyEffectsToVideo(videoElement, selectedEffects = [], options = {}) {
    const { onProgress } = options;
    
    // 진행률 콜백이 없으면 빈 함수로 대체
    const progressCallback = onProgress || (() => {});
    
    try {
      progressCallback(0);
      
      // 1단계: 비디오 정보 가져오기
      const videoWidth = videoElement.videoWidth || 640;
      const videoHeight = videoElement.videoHeight || 480;
      
      progressCallback(10);
      
      // 2단계: 캔버스 준비
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = videoWidth;
      canvas.height = videoHeight;
      
      // 원본 이미지를 저장할 임시 캔버스
      const originalCanvas = document.createElement('canvas');
      const originalCtx = originalCanvas.getContext('2d');
      originalCanvas.width = videoWidth;
      originalCanvas.height = videoHeight;
      canvas._originalCanvas = originalCanvas;
      
      progressCallback(20);
      
      // 3단계: 비디오 녹화 준비
      const stream = canvas.captureStream(30); // 30fps
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp8'
      });
      
      const chunks = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      
      progressCallback(30);
      
      // 4단계: 녹화 시작
      mediaRecorder.start();
      
      // 5단계: 비디오 재생하면서 프레임마다 효과 적용
      return new Promise((resolve, reject) => {
        videoElement.currentTime = 0;
        let frameCount = 0;
        const totalDuration = videoElement.duration || 10;
        
        // 각 프레임을 처리하는 함수
        const processFrame = () => {
          if (videoElement.ended || videoElement.paused) {
            // 녹화 완료
            mediaRecorder.stop();
            mediaRecorder.onstop = () => {
              progressCallback(100);
              const blob = new Blob(chunks, { type: 'video/webm' });
              resolve(blob);
            };
            return;
          }
          
          // 원본 프레임을 임시 캔버스에 그리기
          originalCtx.drawImage(videoElement, 0, 0, videoWidth, videoHeight);
          
          // 효과 적용
          ctx.clearRect(0, 0, videoWidth, videoHeight);
          
          if (selectedEffects.length === 0) {
            // 효과 없으면 원본 그대로
            ctx.drawImage(originalCanvas, 0, 0);
          } else {
            // 선택된 효과들을 순서대로 적용
            selectedEffects.forEach(effectId => {
              if (videoEffects[effectId]) {
                videoEffects[effectId].apply(canvas, ctx);
              }
            });
          }
          
          // 진행률 업데이트
          const progress = Math.min(90, 30 + (videoElement.currentTime / totalDuration) * 60);
          progressCallback(Math.round(progress));
          
          frameCount++;
          requestAnimationFrame(processFrame);
        };
        
        // 비디오 재생 시작
        videoElement.play().then(() => {
          processFrame();
        }).catch(reject);
        
        // 에러 처리
        videoElement.onerror = reject;
        mediaRecorder.onerror = reject;
      });
      
    } catch (error) {
      console.error('효과 처리 중 오류:', error);
      throw error;
    }
  }
};

// ========================================
// 4. 다운로드 함수 (result.js와 연동)
// ========================================
window.downloadVideoWithEffects = async function(videoElement, selectedEffects = []) {
  if (!videoElement || !videoElement.src) {
    alert('다운로드할 비디오가 없습니다.');
    return;
  }

  // 효과가 선택되지 않았으면 원본 다운로드
  if (!selectedEffects || selectedEffects.length === 0) {
    downloadOriginalVideo(videoElement);
    return;
  }

  // 진행률 표시 오버레이 생성
  const overlay = createProgressOverlay();
  document.body.appendChild(overlay);

  try {
    const processedBlob = await window.VideoEffectsProcessor.applyEffectsToVideo(
      videoElement, 
      selectedEffects,
      {
        onProgress: (percent) => {
          updateProgressOverlay(overlay, `효과 적용 중... ${percent}%`, percent);
        }
      }
    );

    if (processedBlob) {
      updateProgressOverlay(overlay, '다운로드 준비 중...', 100);
      
      const url = URL.createObjectURL(processedBlob);
      const link = document.createElement('a');
      link.href = url;
      const today = new Date().toISOString().split('T')[0];
      link.download = `10second_challenge_${today}_effects.webm`;
      link.style.display = 'none';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  } catch (error) {
    console.error('효과 적용 실패:', error);
    alert('효과 적용 중 오류가 발생했습니다. 원본을 다운로드합니다.');
    downloadOriginalVideo(videoElement);
  } finally {
    if (document.body.contains(overlay)) {
      document.body.removeChild(overlay);
    }
  }
};

// ========================================
// 5. 도우미 함수들
// ========================================

// 원본 비디오 다운로드
function downloadOriginalVideo(videoElement) {
  const link = document.createElement('a');
  link.href = videoElement.src;
  const today = new Date().toISOString().split('T')[0];
  link.download = `10second_challenge_${today}_original.mp4`;
  link.style.display = 'none';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// 진행률 오버레이 생성
function createProgressOverlay() {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.85);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    z-index: 10000;
    color: white;
    font-family: Arial, sans-serif;
  `;
  
  const text = document.createElement('div');
  text.style.cssText = `
    font-size: 1.8rem;
    font-weight: 600;
    margin-bottom: 20px;
  `;
  text.textContent = '처리 시작...';
  
  const progressContainer = document.createElement('div');
  progressContainer.style.cssText = `
    width: 60%;
    height: 25px;
    border: 2px solid #fff;
    border-radius: 8px;
    overflow: hidden;
  `;
  
  const progressBar = document.createElement('div');
  progressBar.style.cssText = `
    width: 0%;
    height: 100%;
    background: lime;
    transition: width 0.2s linear;
  `;
  
  progressContainer.appendChild(progressBar);
  overlay.appendChild(text);
  overlay.appendChild(progressContainer);
  
  overlay._textEl = text;
  overlay._progressEl = progressBar;
  
  return overlay;
}

// 진행률 오버레이 업데이트
function updateProgressOverlay(overlay, text, percent) {
  if (overlay._textEl) overlay._textEl.textContent = text;
  if (overlay._progressEl) overlay._progressEl.style.width = percent + '%';
}

// ========================================
// 💡 더 많은 효과 추가하고 싶다면 여기 참고!
// ========================================

/*
✅ 새 효과 추가하는 방법:

1. 위의 videoEffects 객체 안에 새 효과를 추가
2. 마지막 효과가 아니면 끝에 콤마(,) 추가
3. 마지막 효과는 콤마 없음

예시:
vintage: {
  name: '빈티지',
  apply: (canvas, ctx) => {
    ctx.filter = 'sepia(70%) contrast(120%)';
    ctx.drawImage(canvas._originalCanvas, 0, 0);
    ctx.filter = 'none';
  }
}, // ← 마지막이 아니면 콤마 추가!

neon: {
  name: '네온',
  apply: (canvas, ctx) => {
    ctx.filter = 'saturate(300%) brightness(150%)';
    ctx.drawImage(canvas._originalCanvas, 0, 0);
    ctx.filter = 'none';
  }
} // ← 마지막이면 콤마 없음!

🎨 인기 효과들:
- contrast(200%) : 대비 강화
- invert(100%) : 색상 반전  
- hue-rotate(90deg) : 색조 변경
- opacity(70%) : 투명도
- drop-shadow(5px 5px 10px red) : 그림자
*/
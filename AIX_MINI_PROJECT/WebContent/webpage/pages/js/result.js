// 전역 변수
let currentSession = null;
let currentImageIndex = 1;
let totalImages = 1;
let sessionImages = [];

document.addEventListener('DOMContentLoaded', function() {
    // URL 파라미터 가져오기
    const urlParams = new URLSearchParams(window.location.search);
    const attempt = parseInt(urlParams.get('n')) || 1;
    const accuracy = parseInt(urlParams.get('a')) || 0;
    
    currentImageIndex = attempt;
    
    // 정확도 표시
    updateAccuracyDisplay(accuracy);
    
    // 결과 데이터 로드
    loadResultData();
    
    // 다운로드 버튼 이벤트
    setupDownloadButton();
});

function updateAccuracyDisplay(accuracy) {
    const currentAccEl = document.getElementById('currentAccuracy');
    const bestAccEl = document.getElementById('bestAccuracy');
    
    if (currentAccEl) currentAccEl.textContent = `${accuracy}%`;
    if (bestAccEl) bestAccEl.textContent = `${accuracy}%`;
}

async function loadResultData() {
    try {
        const today = new Date().toISOString().split('T')[0];
        
        // 세션 정보 추정 (오늘 날짜의 가장 최근 세션)
        await loadSessionData(today);
        
        // 현재 이미지 표시
        displayCurrentResult();
        
        // 네비게이션 버튼 상태 업데이트
        updateNavigationButtons();
        
    } catch (error) {
        console.error('결과 데이터 로딩 실패:', error);
        loadDefaultContent();
    }
}

async function loadSessionData(date) {
    // main.py의 파일 구조에 맞춰 세션 번호를 추정
    // capture와 video 폴더에서 가장 큰 번호를 찾음
    
    for (let sessionNum = 10; sessionNum >= 1; sessionNum--) {
        const testImageUrl = `/static/result_images/capture/${date}/${sessionNum}/${date}_1.jpg`;
        
        if (await checkFileExists(testImageUrl)) {
            currentSession = sessionNum;
            
            // 해당 세션의 모든 이미지 수 확인
            totalImages = await countSessionImages(date, sessionNum);
            break;
        }
    }
    
    if (!currentSession) {
        currentSession = 1;
        totalImages = 1;
    }
}

async function countSessionImages(date, sessionNum) {
    let count = 0;
    for (let i = 1; i <= 10; i++) {
        const imageUrl = `/static/result_images/capture/${date}/${sessionNum}/${date}_${i}.jpg`;
        if (await checkFileExists(imageUrl)) {
            count = i;
        } else {
            break;
        }
    }
    return Math.max(count, 1);
}

async function checkFileExists(url) {
    try {
        const response = await fetch(url, { method: 'HEAD' });
        return response.ok;
    } catch {
        return false;
    }
}

function displayCurrentResult() {
    const today = new Date().toISOString().split('T')[0];
    
    // 사용자 캡처 이미지
    const userImage = document.getElementById('userImage');
    const captureUrl = `/static/result_images/capture/${today}/${currentSession}/${today}_${currentImageIndex}.jpg`;
    
    loadImageWithFallback(userImage, captureUrl, '/static/images/user_placeholder.png');
    
    // 녹화 비디오
    const recordedVideo = document.getElementById('recordedVideo');
    const videoUrl = `/static/result_images/video/${today}/${currentSession}/${today}.mp4`;
    
    loadVideoWithFallback(recordedVideo, videoUrl);
    
    // 미션 예시 이미지
    const targetImage = document.getElementById('targetImage');
    const urlParams = new URLSearchParams(window.location.search);
    const players = parseInt(urlParams.get('players')) || 1;
    
    const maxRange = players === 3 ? 18 : 20;
    const randomTargetId = Math.floor(Math.random() * maxRange) + 1;
    const targetUrl = `/static/result_images/matching/${players}/${randomTargetId}.jpg`;
    
    loadImageWithFallback(targetImage, targetUrl, '/static/images/target_placeholder.png');
}

function loadImageWithFallback(imgElement, primaryUrl, fallbackUrl) {
    if (!imgElement) return;
    
    const testImg = new Image();
    testImg.onload = function() {
        imgElement.src = primaryUrl;
    };
    testImg.onerror = function() {
        imgElement.src = fallbackUrl;
    };
    testImg.src = primaryUrl;
}

function loadVideoWithFallback(videoElement, videoUrl) {
    if (!videoElement) return;
    
    const source = videoElement.querySelector('source');
    if (source) {
        // 비디오 존재 여부 확인
        fetch(videoUrl, { method: 'HEAD' })
            .then(response => {
                if (response.ok) {
                    source.src = videoUrl;
                    videoElement.load();
                    videoElement.playbackRate = 1.5;   // ✅ 1.5배속 추가
                } else {
                    videoElement.style.display = 'none';
                }
            })
            .catch(() => {
                videoElement.style.display = 'none';
            });
    }
}

function updateNavigationButtons() {
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    
    if (prevBtn) {
        prevBtn.style.opacity = currentImageIndex > 1 ? '1' : '0.3';
        prevBtn.style.cursor = currentImageIndex > 1 ? 'pointer' : 'not-allowed';
    }
    
    if (nextBtn) {
        nextBtn.style.opacity = currentImageIndex < totalImages ? '1' : '0.3';
        nextBtn.style.cursor = currentImageIndex < totalImages ? 'pointer' : 'not-allowed';
    }
}

function previousResult() {
    if (currentImageIndex > 1) {
        currentImageIndex--;
        displayCurrentResult();
        updateNavigationButtons();
        
        const urlParams = new URLSearchParams(window.location.search);
        const accuracy = urlParams.get('a') || 0;
        history.pushState(null, '', `?n=${currentImageIndex}&a=${accuracy}`);
    }
}

function nextResult() {
    if (currentImageIndex < totalImages) {
        currentImageIndex++;
        displayCurrentResult();
        updateNavigationButtons();
        
        const urlParams = new URLSearchParams(window.location.search);
        const accuracy = urlParams.get('a') || 0;
        history.pushState(null, '', `?n=${currentImageIndex}&a=${accuracy}`);
    }
}

function setupDownloadButton() {
    const downloadBtn = document.getElementById('downloadBtn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', function(e) {
            e.preventDefault();
            downloadVideo();
        });
    }
}

function downloadVideo() {
    const today = new Date().toISOString().split('T')[0];
    const videoUrl = `/static/result_images/video/${today}/${currentSession}/${today}.mp4`;
    
    fetch(videoUrl, { method: 'HEAD' })
        .then(response => {
            if (response.ok) {
                const link = document.createElement('a');
                link.href = videoUrl;
                link.download = `10second_challenge_${today}_session${currentSession}.mp4`;
                link.style.display = 'none';
                
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else {
                alert('다운로드할 비디오 파일이 없습니다.');
            }
        })
        .catch(() => {
            alert('비디오 다운로드 중 오류가 발생했습니다.');
        });
}

function loadDefaultContent() {
    const userImage = document.getElementById('userImage');
    const targetImage = document.getElementById('targetImage');
    const recordedVideo = document.getElementById('recordedVideo');
    
    if (userImage) {
        userImage.src = '/static/images/user_placeholder.png';
        userImage.alt = '캡처된 이미지가 없습니다';
    }
    
    if (targetImage) {
        targetImage.src = '/static/images/target_placeholder.png';
        targetImage.alt = '미션 이미지가 없습니다';
    }
    
    if (recordedVideo) {
        recordedVideo.style.display = 'none';
    }
    
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    
    if (prevBtn) {
        prevBtn.style.opacity = '0.3';
        prevBtn.style.cursor = 'not-allowed';
    }
    
    if (nextBtn) {
        nextBtn.style.opacity = '0.3';
        nextBtn.style.cursor = 'not-allowed';
    }
}

// 뒤로가기/앞으로가기 지원
window.addEventListener('popstate', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const newIndex = parseInt(urlParams.get('n')) || 1;
    const accuracy = parseInt(urlParams.get('a')) || 0;
    
    currentImageIndex = newIndex;
    updateAccuracyDisplay(accuracy);
    displayCurrentResult();
    updateNavigationButtons();
});

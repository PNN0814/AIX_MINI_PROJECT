from common import (
    FastAPI, Request, HTMLResponse, RedirectResponse, StaticFiles, Jinja2Templates,
    cv2, mp, Image, np, pd, os, json, shutil, time, datetime,
    IMG_PC_DIR, IMG_RESULT_DIR
)
from fastapi.responses import FileResponse
from fastapi import UploadFile, File
import base64

app = FastAPI()

# -------------------------
# 정적 파일 라우팅
# -------------------------
app.mount("/static/css", StaticFiles(directory="pages/css"), name="css")
app.mount("/static/js", StaticFiles(directory="pages/js"), name="js")
app.mount("/static/images", StaticFiles(directory=IMG_PC_DIR), name="images")
app.mount("/static/result_images", StaticFiles(directory=IMG_RESULT_DIR), name="result_images")

templates = Jinja2Templates(directory="pages/html")

# -------------------------
# favicon
# -------------------------
@app.get("/favicon.ico")
async def favicon():
    favicon_path = os.path.join(IMG_PC_DIR, "favicon.ico")
    if os.path.exists(favicon_path):
        return FileResponse(favicon_path)
    return HTMLResponse(status_code=204)

# -------------------------
# 페이지 라우팅
# -------------------------
@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse("main.html", {"request": request})

@app.get("/setting", response_class=HTMLResponse)
async def get_setting(request: Request):
    return templates.TemplateResponse("setting.html", {"request": request})

@app.get("/play", response_class=HTMLResponse)
async def get_play(request: Request):
    return templates.TemplateResponse("play.html", {"request": request})

@app.get("/result", response_class=HTMLResponse)
async def get_result(request: Request, n: int = 1, a: int = 0):
    return templates.TemplateResponse("result.html", {
        "request": request,
        "attempt": n,
        "accuracy": a
    })

# -------------------------
# 세션 관리
# -------------------------
current_session = {}

# -------------------------
# 캡처 API
# -------------------------
@app.post("/capture")
async def capture(req: Request):
    data = await req.json()
    image = data["image"]

    today = datetime.now().strftime("%Y-%m-%d")
    base_folder = os.path.join(IMG_RESULT_DIR, "capture")
    date_folder = os.path.join(base_folder, today)
    os.makedirs(date_folder, exist_ok=True)

    if today not in current_session:
        subfolders = [f for f in os.listdir(date_folder) if os.path.isdir(os.path.join(date_folder, f))]
        next_folder = str(len(subfolders) + 1)
        current_session[today] = next_folder
    next_folder = current_session[today]

    subfolder_path = os.path.join(date_folder, next_folder)
    os.makedirs(subfolder_path, exist_ok=True)

    existing_files = [f for f in os.listdir(subfolder_path) if f.endswith(".jpg")]
    filename = f"{today}_{len(existing_files)+1}.jpg"
    filepath = os.path.join(subfolder_path, filename)

    with open(filepath, "wb") as f:
        f.write(base64.b64decode(image.split(",")[1]))

    print(f"[capture] saved {filepath}")
    return {"status": "ok", "session": next_folder, "saved": filepath}

# -------------------------
# 게임 종료 → 세션 초기화
# -------------------------
@app.post("/end")
async def end_game():
    today = datetime.now().strftime("%Y-%m-%d")
    if today in current_session:
        del current_session[today]
    print("[end_game] 세션 초기화 완료")
    return {"status": "ok", "message": "세션 초기화 완료"}

# -------------------------
# 비디오 업로드 (fallback 저장)
# -------------------------
@app.post("/upload_video")
async def upload_video(file: UploadFile = File(...)):
    today = datetime.now().strftime("%Y-%m-%d")
    base_folder = os.path.join(IMG_RESULT_DIR, "video")
    date_folder = os.path.join(base_folder, today)
    os.makedirs(date_folder, exist_ok=True)

    if today not in current_session:
        subfolders = [f for f in os.listdir(date_folder) if os.path.isdir(os.path.join(date_folder, f))]
        next_folder = str(len(subfolders) + 1)
        current_session[today] = next_folder
    next_folder = current_session[today]

    subfolder_path = os.path.join(date_folder, next_folder)
    os.makedirs(subfolder_path, exist_ok=True)

    mp4_path = os.path.join(subfolder_path, f"{today}.mp4")

    print(f"[upload_video] called → saving {mp4_path}")

    try:
        with open(mp4_path, "wb") as f:
            content = await file.read()
            f.write(content)
    except Exception as e:
        print(f"[upload_video] save failed: {e}")
        return {"status": "error", "message": f"파일 저장 실패: {str(e)}"}

    print(f"[upload_video] saved OK: {mp4_path}")
    return {"status": "ok", "path": mp4_path}

# -------------------------
# 실행
# -------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)

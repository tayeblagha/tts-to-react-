# fastapi_tts.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import edge_tts
import asyncio
from tempfile import NamedTemporaryFile
from fastapi.responses import FileResponse

app = FastAPI()

# Allow React frontend (adjust origin)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # React dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TTSRequest(BaseModel):
    text: str
    lang: str = "ar-EG-ShakirNeural"  # default Arabic male voice

@app.post("/tts")
async def tts(req: TTSRequest):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text is empty")

    # Create a temporary file to store mp3
    tmp_file = NamedTemporaryFile(delete=False, suffix=".mp3")
    tmp_path = tmp_file.name
    tmp_file.close()

    try:
        communicate = edge_tts.Communicate(req.text, req.lang)
        await communicate.save(tmp_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return FileResponse(tmp_path, media_type="audio/mpeg", filename="tts.mp3")

from openai import OpenAI
from dotenv import load_dotenv
from typing import Final

from fastapi import FastAPI, WebSocket, WebSocketDisconnect

load_dotenv()

AI_MODEL: Final[str] = "gpt-4.1"

ai_client = OpenAI()

app=FastAPI()

@app.get("/heart-beat")
def heart_beat():
    return {"status":"okay"}

@app.websocket("/chat-ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            await websocket.send_text(f"message sent was: {data}")
    except WebSocketDisconnect:
        print("client disconnected")
    except Exception as e :
        print(f"error: {e}") 
    
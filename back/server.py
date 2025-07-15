from openai import OpenAI
from dotenv import load_dotenv
from typing import Final
import requests 
import json
import os

from fastapi import FastAPI, WebSocket, WebSocketDisconnect

load_dotenv()

AI_MODEL: Final[str] = "gpt-4.1"

ai_client = OpenAI()

async def startChat(userIn: str):
    return ai_client.responses.create(
    model=AI_MODEL,
    input=[
        {
        "role": "system",
        "content": [
            {
            "type": "input_text",
            "text": "your frendly and helpfull"
            }
        ]
        },
        {
        "role": "user",
        "content": [
            {
            "type": "input_text",
            "text": userIn
            }
        ]
        }
    ],
    text={
        "format": {
        "type": "text"
        }
    },
    reasoning={},
    tools=[],
    temperature=1,
    top_p=1,
    store=True
    )

app=FastAPI()

@app.get("/heart-beat")
def heart_beat():
    return {"status":"okay"}

@app.websocket("/chat-ws-text")
async def websocket_text_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        firstUserInput = await websocket.receive_text()
        chatObject = await startChat(firstUserInput)
        await websocket.send_text(chatObject.output_text)
        while True:
            userIn = await websocket.receive_text()
            aiResponse = ai_client.responses.create(
                model=AI_MODEL,
                previous_response_id=chatObject.id,
                input=[{"role":"user","content": userIn}]
            )
            await websocket.send_text(aiResponse.output_text)
    except WebSocketDisconnect:
        print("client disconnected")
    except Exception as e :
        print(f"error: {e}") 
    

@app.get("/key-for-webrtc")
async def get_webrtc_key():
    url: Final[str] = "https://api.openai.com/v1/realtime/sessions"
    headers: Final = {"Authorization":f"Bearer {os.getenv("OPENAI_API_KEY")}", "Content-Type": "application/json"}
    payload: Final = {"model":"gpt-4o-mini-realtime-preview","voice":"coral"}
    response = requests.post(url,headers=headers,data=json.dumps(payload))
    jsonResp = response.json()

    return jsonResp

# @app.websocket("/chat-ws-voice")
# async def websocket_voice_endpoint(websocket: WebSocket):
#     await websocket.accept()
#     try:
        
#     except WebSocketDisconnect:
#         print("client disconnected")
#     except Exception as e :
#         print(f"error: {e}") 
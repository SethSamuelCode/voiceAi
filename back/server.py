from openai import OpenAI
from dotenv import load_dotenv
from typing import Final
import requests 
import json
import os
import numpy
import av
import io
import ffmpeg
import subprocess

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from agents import Agent, ModelSettings, function_tool, Runner, SQLiteSession
from agents.voice import SingleAgentVoiceWorkflow, VoicePipeline, StreamedAudioInput
import asyncio 

load_dotenv()

AI_MODEL: Final[str] = "gpt-4.1"

AI_SYSTEM_INSTRUCTIONS: Final[str] = "You are a helpfull assistant but you are also a cat and have to mew at least once every sentence"

# ----------------------- AGENTS ----------------------- #

ai_Agent= Agent(
    name="jenny",
    instructions="You're speaking to a human, so be polite and concise.",
    model="gpt-4o-mini",
)



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

origins = [
    "http://localhost:3000"
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
    payload: Final = {"model":"gpt-4o-mini-realtime-preview","voice":"coral","instructions": AI_SYSTEM_INSTRUCTIONS}
    response = requests.post(url,headers=headers,data=json.dumps(payload))
    jsonResp = response.json()

    return jsonResp

@app.websocket("/audio")
async def audio_websocket(websocket: WebSocket):
    await websocket.accept()
    audioPipeline = VoicePipeline(workflow=SingleAgentVoiceWorkflow(ai_Agent))
    streamed_audio_input_buffer = StreamedAudioInput()
    try:
        while True:
            data= await websocket.receive_bytes()
            # buffer for received data
            input_audio_raw_data_buffer = io.BytesIO(data)
            #open the raw buffer with av to convert the data into an audio stream
            audio_container = av.open(input_audio_raw_data_buffer, mode='r')
            try:
                #decode audio frames into numpyArrays 
                for frame in audio_container.decode(audio=0):
                    print("frame processed")
                    # convert the audio frame to a numpy array
                    numpy_array = frame.to_ndarray().astype(numpy.int16)
                    print(numpy_array)
                    # Feed the audio data into the pipeline
                    await streamed_audio_input_buffer.add_audio(numpy_array)
                    # Process the audio through the pipeline
                    result = await audioPipeline.run(streamed_audio_input_buffer)

                    async for event in result.stream():
                            # play audio
                            if event.type == "voice_stream_event_audio":
                                print(event.data)
                            # lifecycle
                            elif event.type == "voice_stream_event_lifecycle":
                                print(event.event)
                            # error
                            elif event.type == "voice_stream_event_error":
                                print(event.error)
            except Exception as e:
                print(e)
            # await websocket.send_bytes(data=data)
    except WebSocketDisconnect:
        print("client disconnected")
    except Exception as e :
        print(f"error: {e}") 

# @app.websocket("/chat-ws-voice")
# async def websocket_voice_endpoint(websocket: WebSocket):
#     await websocket.accept()
#     try:
        
#     except WebSocketDisconnect:
#         print("client disconnected")
#     except Exception as e :
#         print(f"error: {e}") 
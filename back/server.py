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
from datetime import datetime

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
    print("socket Opened")
    audioPipeline = VoicePipeline(workflow=SingleAgentVoiceWorkflow(ai_Agent))
    streamed_audio_input_buffer = StreamedAudioInput()

    # Create output directory if it doesn't exist
    output_dir = "audio_output"
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    # Generate unique filename using timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = os.path.join(output_dir, f"audio_{timestamp}.mp4")


    ffmpeg_process = subprocess.Popen([
        'ffmpeg',
        '-f', 'webm',            # Input format: WebM
        '-i', 'pipe:0',          # Read from stdin
        '-c:a', 'aac',           # Output codec: AAC
        '-b:a', '192k',          # Bitrate (higher for AAC)
        '-ar', '44100',          # Sample rate (standard for AAC)
        '-ac', '2',              # Output channels (stereo)
        '-vn',                   # No video
        '-f', 'mp4',             # Output container format
        '-movflags', '+faststart', # Optimize for web playback
        '-y',                    # Overwrite output file
        output_file              # Output MP4 file
    ], stdin=subprocess.PIPE, stderr=subprocess.PIPE)

    try:
        while True:
            data_from_websocket = await websocket.receive_bytes()
            print("data from web socket get")
            try:
                if ffmpeg_process.stdin is not None:
                    print("push to ffmpeg")
                    ffmpeg_process.stdin.write(data_from_websocket)
                    ffmpeg_process.stdin.flush()
                else:
                    print("FFmpeg process stdin is None.")
                    continue
                
                if ffmpeg_process.stdout is not None:
                    audio_chunk = ffmpeg_process.stdout.read(4096)
                    numpy_array = numpy.frombuffer(audio_chunk, dtype=numpy.int16)
                    if len(numpy_array) > 0:
                        print(numpy_array)
                        # await streamed_audio_input_buffer.add_audio(numpy_array)
                        # # Process the audio through the pipeline
                        # result = await audioPipeline.run(streamed_audio_input_buffer)
                        # async for event in result.stream():
                        #         # play audio
                        #         if event.type == "voice_stream_event_audio":
                        #             print(event.data)
                        #         # lifecycle
                        #         elif event.type == "voice_stream_event_lifecycle":
                        #             print(event.event)
                        #         # error
                        #         elif event.type == "voice_stream_event_error":
                        #             print(event.error)
            except subprocess.SubprocessError as e:
                print(f"FFmpeg subprocess error: {e}")
            except Exception as e:
                print(f"some exception{e}")
            # await websocket.send_bytes(data=data)
    except WebSocketDisconnect:
        print("client disconnected")
    except Exception as e :
        print(f"error: {e}") 
    finally:
        # Clean up and finalize the FFmpeg process
        try:
            print("Finalizing FFmpeg process...")
            if ffmpeg_process.stdin is not None:
                # Close stdin to signal end of input
                ffmpeg_process.stdin.close()
            
            # Wait for FFmpeg to finish processing
            return_code = ffmpeg_process.wait(timeout=10)
            
            # Get any error output if available
            if ffmpeg_process.stderr is not None:
                stderr_data = ffmpeg_process.stderr.read()
                if return_code != 0 and stderr_data:
                    print(f"FFmpeg error (return code {return_code}):")
                    print(stderr_data.decode())
            
            if return_code == 0:
                print(f"Successfully saved audio to {output_file}")
            else:
                print(f"FFmpeg process failed with return code {return_code}")
                
            # Close remaining pipes
            if ffmpeg_process.stderr is not None:
                ffmpeg_process.stderr.close()
            if ffmpeg_process.stdout is not None:
                ffmpeg_process.stdout.close()
        except Exception as e:
            print(f"Error finalizing FFmpeg process: {e}")
            # Try to force terminate if something goes wrong
            try:
                ffmpeg_process.terminate()
                ffmpeg_process.wait(timeout=2)
            except:
                ffmpeg_process.kill()

# @app.websocket("/chat-ws-voice")
# async def websocket_voice_endpoint(websocket: WebSocket):
#     await websocket.accept()
#     try:
        
#     except WebSocketDisconnect:
#         print("client disconnected")
#     except Exception as e :
#         print(f"error: {e}") 
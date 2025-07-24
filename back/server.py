from openai import OpenAI
from dotenv import load_dotenv
from typing import Final
import requests 
import json
import os
from datetime import datetime
import threading
import queue

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from agents import Agent, ModelSettings, function_tool, Runner, SQLiteSession
from agents.voice import SingleAgentVoiceWorkflow, VoicePipeline, StreamedAudioInput
import asyncio 

from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

AI_MODEL: Final[str] = "gpt-4.1"

AI_SYSTEM_INSTRUCTIONS: Final[str] = " your sick, you have to sound sick, you have a strong european accent and you speak in broken english. if the user wants a horroscape sign call the horror_scope_get function and let the user know you are doing this"

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
    "*"
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
    

AI_VOICE_TOOLS = [ 
    {
    "type":"function",
    "name":"horror_scope_get",
    "description": "Give todays horoscope for an astrological sign",
    "parameters": {
          "type": "object",
          "properties": {
            "sign": {
              "type": "string",
              "description": "The sign for the horoscope.",
              "enum": [
                "Aries",
                "Taurus",
                "Gemini",
                "Cancer",
                "Leo",
                "Virgo",
                "Libra",
                "Scorpio",
                "Sagittarius",
                "Capricorn",
                "Aquarius",
                "Pisces"
              ]
            }
          },
          "required": ["sign"]
        }
},
{
    "type": "function",
    "name": "test_function",
    "description": "A test function that echoes back the input",
    "parameters": {
        "type": "object",
        "properties": {
            "input": {
                "type": "string",
                "description": "Input for the test function"
            }
        },
        "required": ["input"]
    }
},{
    "type": "function",
    "name": "random",
    "description": "get a random number between 0 and 100"
}]


@app.get("/key-for-webrtc")
async def get_webrtc_key():
    url: Final[str] = "https://api.openai.com/v1/realtime/sessions"
    headers: Final = {"Authorization":f"Bearer {os.getenv('OPENAI_API_KEY')}", "Content-Type": "application/json"}
    payload: Final = {"model":"gpt-4o-mini-realtime-preview","voice":"coral","instructions": AI_SYSTEM_INSTRUCTIONS,"tools":AI_VOICE_TOOLS}
    response = requests.post(url,headers=headers,data=json.dumps(payload))
    jsonResp = response.json()
    print(jsonResp)

    return jsonResp

@app.get("/transcription")
def transcribe_audio():
    url: Final[str] = "https://api.openai.com/v1/realtime/transcription_sessions"
    headers: Final = {"Authorization":f"Bearer {os.getenv('OPENAI_API_KEY')}", "Content-Type": "application/json"}
    # payload: Final = {"model":"gpt-4o-mini-realtime-preview","voice":"coral","instructions": AI_SYSTEM_INSTRUCTIONS,"tools":AI_VOICE_TOOLS}
    response = requests.post(url,headers=headers)
    jsonResp = response.json()
    print(jsonResp)

    return jsonResp
# @app.websocket("/audio")
# async def audio_websocket(websocket: WebSocket):
#     await websocket.accept()
#     print("socket Opened")
#     audioPipeline = VoicePipeline(workflow=SingleAgentVoiceWorkflow(ai_Agent))
#     streamed_audio_input_buffer = StreamedAudioInput()

#     # Use os.pipe() for more explicit pipe creation
#     import os
#     r, w = os.pipe()
    
#     ffmpeg_process = subprocess.Popen([
#         'ffmpeg',
#         '-f', 'webm',            # Input format: WebM
#         '-i', 'pipe:0',          # Read from stdin
#         '-f', 's16le',           # Signed 16-bit output format
#         '-acodec', 'pcm_s16le',  # Signed 16-bit PCM codec
#         '-ar', '16000',          # Sample rate: 16kHz (common for speech)
#         '-ac', '1',              # Mono audio
#         '-vn',                   # No video
#         'pipe:1'                 # Output to stdout
#     ], stdout=w, stdin=subprocess.PIPE, stderr=subprocess.PIPE,
#        bufsize=0)  # Unbuffered mode
    
#     # Close the write end of the pipe in the parent process
#     os.close(w)
    
#     # Create a file-like object for reading
#     stdout_reader = os.fdopen(r, 'rb')

#     # Create a thread-safe queue for audio chunks
#     audio_queue = queue.Queue()
#     stop_thread = threading.Event()

#     def stdout_reader_thread(stdout_reader, audio_queue, stop_event):
#         while not stop_event.is_set():
#             try:
#                 chunk = stdout_reader.read(4096)
#                 if chunk:
#                     audio_queue.put(chunk)
#                 else:
#                     # EOF reached
#                     break
#             except Exception as e:
#                 print(f"Error in stdout_reader_thread: {e}")
#                 break

#     # Start the background thread
#     reader_thread = threading.Thread(target=stdout_reader_thread, args=(stdout_reader, audio_queue, stop_thread), daemon=True)
#     reader_thread.start()

#     async def websocket_audio_receiver():
#         try:
#             while True:
#                 data_from_websocket = await websocket.receive_bytes()
#                 if ffmpeg_process.stdin and not ffmpeg_process.stdin.closed:
#                     try:
#                         ffmpeg_process.stdin.write(data_from_websocket)
#                         ffmpeg_process.stdin.flush()
#                         print("Pushed data to FFmpeg")
#                     except BrokenPipeError:
#                         print("FFmpeg stdin pipe is broken")
#                         break
#                     except Exception as stdin_error:
#                         print(f"Error writing to FFmpeg stdin: {stdin_error}")
#                         break
#                 else:
#                     print("FFmpeg process stdin is not available")
#                     break

#                 # Non-blocking audio chunk retrieval from queue
#                 while not audio_queue.empty():
#                     audio_chunk = audio_queue.get_nowait()
#                     if audio_chunk:
#                         numpy_array = numpy.frombuffer(audio_chunk, dtype=numpy.int16)
#                         if len(numpy_array) > 0:
#                             print(f"Standard deviation: {numpy_array.std()}")
#                             await streamed_audio_input_buffer.add_audio(audio_chunk)
#                     else:
#                         print("Audio chunk is empty (zero bytes)")
#         except Exception as e:
#             print(f"WebSocket audio receiver error: {e}")

#     async def ai_event_handler():
#         # Start FFmpeg encoder for PCM -> WebM Opus
#         encoder_process = subprocess.Popen([
#             'ffmpeg',
#             '-f', 's16le',            # Input format: PCM 16-bit
#             '-ar', '16000',           # Sample rate
#             '-ac', '1',               # Mono
#             '-i', 'pipe:0',           # Read from stdin
#             '-c:a', 'libopus',        # Encode to Opus
#             '-f', 'webm',             # Output format
#             '-application', 'audio',  # Opus application mode
#             '-b:a', '32k',            # Bitrate
#             '-loglevel', 'error',     # Only errors
#             'pipe:1'                  # Output to stdout
#         ], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, bufsize=0)
#         try:
#             ai_result = await audioPipeline.run(streamed_audio_input_buffer)
#             async for event in ai_result.stream():
#                 if event.type == "voice_stream_event_audio":
#                     # event.data is PCM bytes
#                     if encoder_process.stdin and not encoder_process.stdin.closed:
#                         try:
#                             encoder_process.stdin.write(event.data)
#                             encoder_process.stdin.flush()
#                             # Read available encoded data
#                             while True:
#                                 encoded = encoder_process.stdout.read(4096)
#                                 if not encoded:
#                                     break
#                                 await websocket.send_bytes(encoded)
#                         except Exception as enc_err:
#                             print(f"Encoder error: {enc_err}")
#                     else:
#                         print("Encoder process stdin is closed")
#                     print(event.data)
#                 elif event.type == "voice_stream_event_lifecycle":
#                     print(event.event)
#                 elif event.type == "voice_stream_event_error":
#                     print(event.error)
#         except Exception as e:
#             print(f"AI event handler error: {e}")
#         finally:
#             try:
#                 if encoder_process.stdin:
#                     encoder_process.stdin.close()
#                 if encoder_process.stdout:
#                     encoder_process.stdout.close()
#                 if encoder_process.stderr:
#                     encoder_process.stderr.close()
#                 encoder_process.wait(timeout=2)
#             except Exception as e:
#                 print(f"Error closing encoder process: {e}")

#     try:
#         receiver_task = asyncio.create_task(websocket_audio_receiver())
#         ai_task = asyncio.create_task(ai_event_handler())
#         await asyncio.gather(receiver_task, ai_task)
#     except WebSocketDisconnect:
#         print("client disconnected")
#     except Exception as e:
#         print(f"error: {e}")
#     finally:
#         # Clean up and finalize the FFmpeg process
#         try:
#             print("Finalizing FFmpeg process...")
#             stop_thread.set()
#             reader_thread.join(timeout=2)
#             if ffmpeg_process.stdin is not None:
#                 ffmpeg_process.stdin.close()
#             return_code = ffmpeg_process.wait(timeout=10)
#             if ffmpeg_process.stderr is not None:
#                 stderr_data = ffmpeg_process.stderr.read()
#                 if return_code != 0 and stderr_data:
#                     print(f"FFmpeg error (return code {return_code}):")
#                     print(stderr_data.decode())
#             # if return_code == 0:
#             #     # print(f"Successfully saved audio to {output_file}")
#             # else:
#             #     print(f"FFmpeg process failed with return code {return_code}")
#             if ffmpeg_process.stderr is not None:
#                 ffmpeg_process.stderr.close()
#             if ffmpeg_process.stdout is not None:
#                 ffmpeg_process.stdout.close()
#         except Exception as e:
#             print(f"Error finalizing FFmpeg process: {e}")
#             try:
#                 ffmpeg_process.terminate()
#                 ffmpeg_process.wait(timeout=2)
#             except:
#                 ffmpeg_process.kill()

# # @app.websocket("/chat-ws-voice")
# async def websocket_voice_endpoint(websocket: WebSocket):
#     await websocket.accept()
#     try:
        
#     except WebSocketDisconnect:
#         print("client disconnected")
#     except Exception as e :
#         print(f"error: {e}")
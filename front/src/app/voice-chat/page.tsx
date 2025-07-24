"use client";
import { connect } from "http2";
import React, { useEffect, useRef, useState } from "react";
const BACKEND_SERVER_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_SERVER_BASE_URL;
import { ChatObject, OwnerEnum } from "../../types/typedef";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function page() {
  //create peer connection
  const refPeerConnection = useRef<RTCPeerConnection>(null);
  //local mic input
  const refLocalMic = useRef<MediaStream>(null);
  //audio element ref
  const refAudioEl = useRef<HTMLAudioElement>(null);
  //websocketRef
  const refWebSocket = useRef<WebSocket>(null);
  //media source used to play incoming audio
  const refMediaSource = useRef<MediaSource>(null);
  //source buffer used to process incoming audio data to be demuxed and played
  const refSourceBuffer = useRef<SourceBuffer>(null);
  //chat transcript
  const [ChatTranscript, setChatTranscript] = useState<ChatObject[]>([]);

  //for file saving
  const audioChunks = useRef<Blob[]>([]);

  console.log(process.env.NEXT_PUBLIC_BACKEND_SERVER_BASE_URL);

  function random() {
    return Math.floor(Math.random() * 100);
  }

  function test_function(input: any): any {
    return input.input;
  }
  async function initVoice() {
    const tokenRespose = await fetch(`${BACKEND_SERVER_BASE_URL}/key-for-webrtc`);
    const data = await tokenRespose.json();
    const AI_EPHEMERAL_KEY = data.client_secret.value;

    //create new connection
    refPeerConnection.current = new RTCPeerConnection();

    // Set up to play remote audio from model
    refAudioEl.current = document.createElement("audio");
    refAudioEl.current.autoplay = true;
    refPeerConnection.current.ontrack = (e) => {
      if (refAudioEl.current) {
        refAudioEl.current.srcObject = e.streams[0];
      } else {
        throw Error("mic not connected");
      }
    };

    //add local as input
    refLocalMic.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    refPeerConnection.current.addTrack(refLocalMic.current.getTracks()[0]);

    //set data channel for sending and receiving events
    const dataChannel = refPeerConnection.current.createDataChannel("oai-events");
    dataChannel.addEventListener("message", (e) => {
      console.log(e);
      const data = JSON.parse(e.data);
      if (data.type == "response.done") {
        console.log("----------------response.done-----------------");
        console.log(data.response);
        const functionName = data.response.output[0].name;
        console.log(functionName);
        const functionInputs = data.response.output[0].arguments;
        console.log(JSON.parse(functionInputs));
        const callId = data.response.output[0].call_id;
        console.log(callId);

        if (functionName == "test_function") {
          const result = test_function(functionInputs);
          // return data to AI
          dataChannel.send(
            JSON.stringify({
              type: "conversation.item.create",
              item: {
                type: "function_call_output",
                call_id: callId,
                output: JSON.stringify({
                  data: result,
                }),
              },
            })
          );
          // generate response from AI
          dataChannel.send(
            JSON.stringify({
              type: "response.create",
            })
          );
        }

        if (functionName == "random") {
          const result = random();
          console.log(`RANDOM NUMBER: ${result}`)
          // return data to AI
          dataChannel.send(
            JSON.stringify({
              type: "conversation.item.create",
              item: {
                type: "function_call_output",
                call_id: callId,
                output: JSON.stringify({
                  data: result,
                }),
              },
            })
          );
          // generate response from AI
          dataChannel.send(
            JSON.stringify({
              type: "response.create",
            })
          );
        }
      }
    });

    //start session
    const offer = await refPeerConnection.current.createOffer();
    await refPeerConnection.current.setLocalDescription(offer);

    const AI_BASE_URL = "https://api.openai.com/v1/realtime";
    const MODEL = process.env.OPENAI_VOICE_MODEL;
    const sdpResponse = await fetch(`${AI_BASE_URL}?model=${MODEL}`, {
      method: "POST",
      body: offer.sdp,
      headers: {
        Authorization: `Bearer ${AI_EPHEMERAL_KEY}`,
        "Content-Type": "application/sdp",
      },
    });

    const answerFromSdpRequest: RTCSessionDescriptionInit = {
      type: "answer",
      sdp: await sdpResponse.text(),
    };

    await refPeerConnection.current.setRemoteDescription(answerFromSdpRequest);
  }

  const saveRecording = () => {
    if (audioChunks.current.length) {
      const blob = new Blob(audioChunks.current, { type: "audio/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `recording-${new Date().getTime()}.webm`;
      a.click();
      URL.revokeObjectURL(url);
      audioChunks.current = []; // Clear the chunks after saving
    }
  };

  function stopAndCleanUpVoice() {
    if (refPeerConnection.current) {
      refPeerConnection.current.close();
      refPeerConnection.current.ontrack = null;
      refPeerConnection.current = null;
    }
    if (refLocalMic.current) {
      refLocalMic.current.getTracks().forEach((track) => {
        track.stop();
      });
      refLocalMic.current = null;
    }
    if (refAudioEl.current) {
      refAudioEl.current = null;
    }
  }

  // async function initVoiceToTextToVoice() {
  //   //add local mic
  //   refLocalMic.current = await navigator.mediaDevices.getUserMedia({
  //     audio: {
  //       echoCancellation: true,
  //       noiseSuppression: true,
  //       sampleRate: 44100,
  //     },
  //   });
  //   const micMediaStream = new MediaStream([refLocalMic.current.getTracks()[0]]);
  //   refWebSocket.current = new WebSocket(`${BACKEND_SERVER_BASE_URL}/audio`);

  //   //media recorder to record the audio
  //   const mediaRecorder = new MediaRecorder(refLocalMic.current, {
  //     mimeType: "audio/webm; codecs=opus",
  //   });

  //   // Handle data available from MediaRecorder
  //   mediaRecorder.ondataavailable = (event) => {
  //     if (event.data.size > 0 && refWebSocket.current?.readyState === WebSocket.OPEN) {
  //       refWebSocket.current.send(event.data);
  //       // Store the chunk for later saving
  //       audioChunks.current.push(event.data);
  //     }
  //   };

  //   //setup media source to process incoming audio
  //   refMediaSource.current = new MediaSource();
  //   refAudioEl.current = document.createElement("audio");
  //   refAudioEl.current.autoplay = true;
  //   refAudioEl.current.src = URL.createObjectURL(refMediaSource.current);

  //   refMediaSource.current.addEventListener("sourceopen", () => {
  //     if (refMediaSource.current) {
  //       refSourceBuffer.current = refMediaSource.current.addSourceBuffer("audio/webm; codecs=opus");
  //     }
  //   });

  //   //push the data from the websocket into the buffer
  //   refWebSocket.current.onmessage = async (e) => {
  //     if (refSourceBuffer.current && !refSourceBuffer.current.updating) {
  //       const tempArrayBuffer = await e.data.arrayBuffer();
  //       refSourceBuffer.current.appendBuffer(tempArrayBuffer);
  //     }
  //   };

  //   // Handle WebSocket connection
  //   refWebSocket.current.onopen = () => {
  //     console.log("WebSocket Connected");
  //     mediaRecorder.start(100); // Collect data every 100ms
  //   };

  //   refWebSocket.current.onclose = () => {
  //     console.log("WebSocket Closed");
  //     mediaRecorder.stop();
  //   };

  //   refWebSocket.current.onerror = (error) => {
  //     console.error("WebSocket Error:", error);
  //     mediaRecorder.stop();
  //   };

  //   //add playback from audio source to speakers
  //   // refAudioEl.current = document.createElement("audio");
  //   // refAudioEl.current.autoplay = true;

  //   //give mic back to speakers
  //   // const micMediaStream = new MediaStream([refLocalMic.current.getTracks()[0]])
  //   // refAudioEl.current.srcObject=micMediaStream
  // }

  // function stopVoiceToTextToVoice() {

  //   saveRecording();
  //   // Clean up microphone tracks
  //   if (refLocalMic.current) {
  //     // console.log("clean up mic")
  //     refLocalMic.current.getTracks().forEach((track) => track.stop());
  //     refLocalMic.current = null;
  //   }

  //   // Clean up audio element
  //   if (refAudioEl.current) {
  //     // console.log("clean up audio EL")
  //     refAudioEl.current.pause();
  //     refAudioEl.current.src = "";
  //     refAudioEl.current = null;
  //   }

  //   // Clean up MediaSource and SourceBuffer
  //   if (refSourceBuffer.current) {
  //     // console.log("clean up ref source buffer")
  //     try {
  //       // refSourceBuffer.current.abort();
  //       if (refSourceBuffer.current) {
  //         refSourceBuffer.current = null;
  //       }
  //     } catch (e) {
  //       console.warn("Error cleaning up SourceBuffer:", e);
  //     }
  //   }

  //   if (refMediaSource.current) {
  //     // console.log("clean up ref media source")
  //     try {
  //       if (refMediaSource.current.readyState === "open") {
  //         refMediaSource.current.endOfStream();
  //       }
  //       refMediaSource.current = null;
  //     } catch (e) {
  //       // console.warn('Error cleaning up MediaSource:', e);
  //     }
  //   }

  //   // Clean up WebSocket
  //   if (refWebSocket.current) {
  //     if (
  //       refWebSocket.current.readyState === WebSocket.OPEN ||
  //       refWebSocket.current.readyState === WebSocket.CONNECTING
  //     ) {
  //       refWebSocket.current.close();
  //     }
  //     refWebSocket.current = null;
  //   }
  // }

  return (
    <div className="h-dvh">
      <div className="flex flex-col border border-green-500">
        <p className="self-center">audio to audio</p>
        <div className="flex justify-around [&_div]:border [&_div]:border-red-400 [&_div]:p-4 [&_div]:m-4 [&_div]:cursor-pointer ">
          <div onClick={initVoice}>START</div>
          <div onClick={stopAndCleanUpVoice}>STOP</div>
        </div>
      </div>
      {/* <div className="flex flex-col border border-green-500">
        <p className="self-center"> audio to text to audio</p>
        <div className="flex justify-around [&_div]:border [&_div]:border-red-400 [&_div]:p-4 [&_div]:m-4 [&_div]:cursor-pointer ">
          <div onClick={initVoiceToTextToVoice}>START</div>
          <div onClick={stopVoiceToTextToVoice}>STOP</div>
        </div>
      </div> */}
      <div className="border border-white h-11/12">
        {ChatTranscript.length > 0 && (
          <div className="flex flex-col gap-2">
            {ChatTranscript.map((singleChat: ChatObject) => {
              if (singleChat.owner === OwnerEnum.user) {
                return (
                  <div
                    key={singleChat.message}
                    className="bg-green-400 rounded-2xl p-2">
                    <p>{singleChat.message}</p>
                  </div>
                );
              } else if (singleChat.owner === OwnerEnum.ai) {
                return (
                  <div
                    key={singleChat.message}
                    className="bg-blue-900 rounded-2xl p-2">
                    <ReactMarkdown
                      children={singleChat.message}
                      remarkPlugins={[remarkGfm]}
                    />
                  </div>
                );
              }
            })}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";
import { connect } from "http2";
import React, { useEffect, useRef } from "react";
const BACKEND_SERVER_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_SERVER_BASE_URL;

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

  console.log(process.env.NEXT_PUBLIC_BACKEND_SERVER_BASE_URL);

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

  async function initVoiceToTextToVoice() {
    //add local mic
    refLocalMic.current = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 44100,
      },
    });
    const micMediaStream = new MediaStream([refLocalMic.current.getTracks()[0]]);
    refWebSocket.current = new WebSocket(`${BACKEND_SERVER_BASE_URL}/audio`);

    //media recorder to record the audio
    const mediaRecorder = new MediaRecorder(refLocalMic.current, {
      mimeType: "audio/aac",
    });

    // Handle data available from MediaRecorder
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0 && refWebSocket.current?.readyState === WebSocket.OPEN) {
        refWebSocket.current.send(event.data);
      }
    };

    //setup media source to process incoming audio
    refMediaSource.current = new MediaSource();
    refAudioEl.current = document.createElement("audio");
    refAudioEl.current.autoplay = true;
    refAudioEl.current.src = URL.createObjectURL(refMediaSource.current);

    refMediaSource.current.addEventListener("sourceopen", () => {
      if (refMediaSource.current) {
        refSourceBuffer.current = refMediaSource.current.addSourceBuffer('audio/webm; codecs="opus"');
      }
    });

    //push the data from the websocket into the buffer
    refWebSocket.current.onmessage = async (e) => {
      if (refSourceBuffer.current && !refSourceBuffer.current.updating) {
        const tempArrayBuffer = await e.data.arrayBuffer();
        refSourceBuffer.current.appendBuffer(tempArrayBuffer);
      }
    };

    // Handle WebSocket connection
    refWebSocket.current.onopen = () => {
      console.log("WebSocket Connected");
      mediaRecorder.start(100); // Collect data every 100ms
    };

    refWebSocket.current.onclose = () => {
      console.log("WebSocket Closed");
      mediaRecorder.stop();
    };

    refWebSocket.current.onerror = (error) => {
      console.error("WebSocket Error:", error);
      mediaRecorder.stop();
    };

    //add playback from audio source to speakers
    // refAudioEl.current = document.createElement("audio");
    // refAudioEl.current.autoplay = true;

    //give mic back to speakers
    // const micMediaStream = new MediaStream([refLocalMic.current.getTracks()[0]])
    // refAudioEl.current.srcObject=micMediaStream
  }

  function stopVoiceToTextToVoice() {
    // Clean up microphone tracks
    if (refLocalMic.current) {
      refLocalMic.current.getTracks().forEach((track) => track.stop());
      refLocalMic.current = null;
    }

    // Clean up audio element
    if (refAudioEl.current) {
      refAudioEl.current.pause();
      refAudioEl.current.src = '';
      refAudioEl.current = null;
    }

    // Clean up MediaSource and SourceBuffer
    if (refSourceBuffer.current) {
      try {
        refSourceBuffer.current.abort();
        refSourceBuffer.current = null;
      } catch (e) {
        console.warn('Error cleaning up SourceBuffer:', e);
      }
    }

    if (refMediaSource.current) {
      try {
        if (refMediaSource.current.readyState === 'open') {
          refMediaSource.current.endOfStream();
        }
        refMediaSource.current = null;
      } catch (e) {
        console.warn('Error cleaning up MediaSource:', e);
      }
    }

    // Clean up WebSocket
    if (refWebSocket.current) {
      if (refWebSocket.current.readyState === WebSocket.OPEN || 
          refWebSocket.current.readyState === WebSocket.CONNECTING) {
        refWebSocket.current.close();
      }
      refWebSocket.current = null;
    }
  }

  return (
    <div>
      <div className="flex flex-col border border-green-500">
        <p className="self-center">audio to audio</p>
        <div className="flex justify-around [&_div]:border [&_div]:border-red-400 [&_div]:p-4 [&_div]:m-4 [&_div]:cursor-pointer ">
          <div onClick={initVoice}>START</div>
          <div onClick={stopAndCleanUpVoice}>STOP</div>
        </div>
      </div>
      <div className="flex flex-col border border-green-500">
        <p className="self-center"> audio to text to audio</p>
        <div className="flex justify-around [&_div]:border [&_div]:border-red-400 [&_div]:p-4 [&_div]:m-4 [&_div]:cursor-pointer ">
          <div onClick={initVoiceToTextToVoice}>START</div>
          <div onClick={stopVoiceToTextToVoice}>STOP</div>
        </div>
      </div>
    </div>
  );
}

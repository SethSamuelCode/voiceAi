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

  async function initVoiceToTextToVoice(){

  }

  function stopVoiceToTextToVoice(){

  }

  return (
    <div>
      <div className="flex flex-col border border-green-500" >
        <p className="self-center">audio to audio</p>
        <div className="flex justify-around [&_div]:border [&_div]:border-red-400 [&_div]:p-4 [&_div]:m-4 [&_div]:cursor-pointer ">
          <div onClick={initVoice}>START</div>
          <div onClick={stopAndCleanUpVoice}>STOP</div>
        </div>
      </div>
      <div className="flex flex-col border border-green-500">
        <p className="self-center"> audio to text to audio</p>
        <div className="flex justify-around [&_div]:border [&_div]:border-red-400 [&_div]:p-4 [&_div]:m-4 [&_div]:cursor-pointer " >
          <div onClick={initVoiceToTextToVoice}>START</div>
          <div onClick={stopVoiceToTextToVoice} >STOP</div>
        </div>
      </div>
    </div>
  );
}

"use client";
import { connect } from "http2";
import React, { useEffect, useRef } from "react";
const BACKEND_SERVER_BASE_URL = process.env.BACKEND_SERVER_BASE_URL;

export default function page() {
  // crate a peer connection
  useEffect(() => {
    //get key from backend
    async function initVoice() {
      const tokenRespose = await fetch(`${BACKEND_SERVER_BASE_URL}/key-for-webrtc`);
      const data = await tokenRespose.json();
      const AI_EPHEMERAL_KEY = data.client_secret.value;

      // create a peer connection
      const peerConnection = new RTCPeerConnection();

      // Set up to play remote audio from model
      const audioEl = document.createElement("audio");
      audioEl.autoplay = true;
      peerConnection.ontrack = (e) => {
        audioEl.srcObject = e.streams[0];
      };

      //add local as input
      const micDevice = await navigator.mediaDevices.getUserMedia({ audio: true });
      peerConnection.addTrack(micDevice.getTracks()[0]);

      //set data channel for sending and receiving events
      const dataChannel = peerConnection.createDataChannel("oai-events");
      dataChannel.addEventListener("message", (e) => {
        console.log(e);
      });

      //start session
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

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

      await peerConnection.setRemoteDescription(answerFromSdpRequest);
    }

    initVoice();
    return () => {};
  }, []);

  return (
    <div>
      <p>voice</p>
    </div>
  );
}

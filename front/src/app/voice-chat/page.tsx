"use client";
import React, { useEffect, useRef } from "react";
// import { OwnerEnum } from "@/types/typedef";

export default function page() {
  const wsRef = useRef<WebSocket | null>(null);
  useEffect(()=>{
    const websocket = new WebSocket("ws://localhost:8000/chat-ws-voice");
    wsRef.current = websocket;

    websocket.onopen = () =>{
      console.log("Websocket connected")
    }

    websocket.onmessage = (event)=>{


    }
  },[])

  return <div></div>;
}

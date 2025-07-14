"use client";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import { Interface } from "readline";
// import WebSocket from 'ws';

export default function Home() {
  const [userInput, setUserInput] = useState<string>("");
  const [chatHistory, setChatHistory] = useState<Array<ChatObject>>([]);
  // const socket: WebSocket = new WebSocket("ws://localhost:8000/chat-ws");
  // socket.binaryType = "arraybuffer"
  const wsRef = useRef<WebSocket|null>(null)

  useEffect(()=>{
    const websocket = new WebSocket("ws://localhost:8000/chat-ws");
    wsRef.current = websocket;

    websocket.onopen = () =>{
      console.log("Websocket connected")
    }

    websocket.onmessage = (event)=>{

      const aiResponse: ChatObject = {
        owner: OwnerEnum.ai,
        message: event.data.toString()
      }

      setChatHistory((prevState)=>{
        return [...prevState, aiResponse]
      } )
    }

  },[])

  enum OwnerEnum {
    user = "user",
    ai = "ai",
  }

  interface ChatObject {
    owner: OwnerEnum;
    message: string;
  }
  function handleUserInput(e: ChangeEvent<HTMLTextAreaElement>) {
    setUserInput(e.target.value);
  }

  function sendUserInput() {
    wsRef.current?.send(userInput)
    const userResponse = {
      owner: OwnerEnum.user,
      message: userInput
    }

    setChatHistory((prevState)=>{
      return [...prevState,userResponse]
    })
  }

  return (
    <div className="flex justify-center items-center h-screen">
      <div className="flex flex-col w-4/5">
        <div>
          {chatHistory.map((singleChat: ChatObject) => {
            if (singleChat.owner === OwnerEnum.user) {
              return (
                <div key={singleChat.message} className="bg-green-400">
                  <p>{singleChat.message}</p>
                </div>
              );
            } else if (singleChat.owner === OwnerEnum.ai) {
              return (
                <div key={singleChat.message} className="bg-blue-900">
                  <p>{singleChat.message}</p>
                </div>
              );
            }
          })}
        </div>
        <textarea
          name="userInput"
          id="userInput"
          value={userInput}
          onChange={handleUserInput}></textarea>
        <button className="h-8" onClick={sendUserInput}>send</button>
      </div>
    </div>
  );
}

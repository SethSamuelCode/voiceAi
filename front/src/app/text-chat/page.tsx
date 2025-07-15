"use client";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import { Interface } from "readline";
import ReactMarkdown from 'react-markdown'
import remarkGfm from "remark-gfm";

// import WebSocket from 'ws';

export default function Page() {
  const [userInput, setUserInput] = useState<string>("");
  const [chatHistory, setChatHistory] = useState<Array<ChatObject>>([]);
  // const socket: WebSocket = new WebSocket("ws://localhost:8000/chat-ws");
  // socket.binaryType = "arraybuffer"
  const wsRef = useRef<WebSocket|null>(null)
  useEffect(()=>{
    const websocket = new WebSocket("ws://localhost:8000/chat-ws-text");
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

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement> ){
    if (e.key==="Enter"&&e.ctrlKey){
      sendUserInput()
    }
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
    setUserInput("")
  }

  return (
    <div className="flex justify-center items-center overflow-y-auto">
      <div className="flex flex-col w-11/12">
        <div className="flex flex-col gap-2">
          {chatHistory.map((singleChat: ChatObject) => {
            if (singleChat.owner === OwnerEnum.user) {
              return (
                <div key={singleChat.message} className="bg-green-400 rounded-2xl p-2">
                  <p>{singleChat.message}</p>
                </div>
              );
            } else if (singleChat.owner === OwnerEnum.ai) {
              return (
                <div key={singleChat.message} className="bg-blue-900 rounded-2xl p-2">
                  <ReactMarkdown children={singleChat.message} remarkPlugins={[remarkGfm]} />
                </div>
              );
            }
          })}
        </div>
        <textarea
          className="border-2 border-blue-500 "
          name="userInput"
          id="userInput"
          value={userInput}
          onChange={handleUserInput}
          onKeyDown={handleKeyDown}></textarea>
        <button className="h-8 border-2 border-amber-200" onClick={sendUserInput}>send</button>
      </div>
    </div>
  );
}

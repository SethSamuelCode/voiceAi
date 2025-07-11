"use client";
import { ChangeEvent, useState } from "react";
import { Interface } from "readline";

export default function Home() {
  const [userInput, setUserInput] = useState<string>("");
  const [chatHistory, setChatHistory] = useState<Array<ChatObject>>([]);

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

  function sendUserInput() {}

  return (
    <div className="flex justify-center items-center h-screen">
      <div className="flex flex-col w-4/5">
        <div>
          {chatHistory.map((singleChat: ChatObject) => {
            if (singleChat.owner === OwnerEnum.user) {
              return (
                <div key={singleChat.message} className="bg-green-400">
                  <p>singleChat.message</p>
                </div>
              );
            } else if (singleChat.owner === OwnerEnum.ai) {
              return (
                <div key={singleChat.message} className="bg-amber-300">
                  <p>singleChat.message</p>
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
        <button className="h-8">send</button>
      </div>
    </div>
  );
}

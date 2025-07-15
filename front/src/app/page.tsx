import React from "react";
import Link from "next/link";

export default function page() {
  return (
    <div className="grid grid-cols-2 h-screen v-screen *:border *:border-red-500 gap-4 p-4 *:flex *:justify-center *:items-center *:hover:bg-blue-300 *:text-8xl *:cursor-pointer ">
      <Link href="/text-chat">
        <div>chat</div>
      </Link>
      <Link href="/voice-chat">
        <div>voice</div>
      </Link>
    </div>
  );
}

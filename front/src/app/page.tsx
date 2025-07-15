import React from "react";

export default function page() {
  return (
    <div className="grid grid-cols-2 h-screen v-screen [&_div]:border [&_div]:border-red-500 gap-4 p-4 [&_div]:flex [&_div]:justify-center [&_div]:items-center [&_div]:hover:bg-blue-300 [&_div]:text-8xl [&_div]:cursor-pointer ">
      <div>chat</div>
      <div>voice</div>
    </div>
  );
}

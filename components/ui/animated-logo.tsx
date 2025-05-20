"use client";

import Image from "next/image";

export function AnimatedLogo() {
  return (
    <div
      className="bg-black w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
      style={{
        animation: "glowPulse 5s ease-in-out infinite",
      }}
    >
      <style jsx>{`
        @keyframes glowPulse {
          0% {
            box-shadow: 0 0 10px rgba(59, 130, 246, 0.2);
          }
          50% {
            box-shadow: 0 0 25px rgba(59, 130, 246, 0.4);
          }
          100% {
            box-shadow: 0 0 10px rgba(59, 130, 246, 0.2);
          }
        }
      `}</style>
      <Image src="/logo.svg" alt="Logo" width={44} height={44} />
    </div>
  );
}

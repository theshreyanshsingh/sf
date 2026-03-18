"use client";
import React, { useEffect, useState } from "react";

interface VoiceWavesProps {
  isListening: boolean;
}

const VoiceWaves: React.FC<VoiceWavesProps> = ({ isListening }) => {
  const [waveHeights, setWaveHeights] = useState<number[]>([
    0.3, 0.5, 0.8, 0.4, 0.6,
  ]);

  useEffect(() => {
    if (!isListening) {
      setWaveHeights([0.3, 0.5, 0.8, 0.4, 0.6]);
      return;
    }

    const interval = setInterval(() => {
      setWaveHeights((prev) => prev.map(() => 0.2 + Math.random() * 0.8));
    }, 150);

    return () => clearInterval(interval);
  }, [isListening]);

  if (!isListening) return null;

  return (
    <div className="flex items-center justify-center gap-1 px-3 py-2 bg-violet-900/10 h-[30px] rounded-lg border border-violet-900/20">
      <div className="flex items-center gap-1">
        {waveHeights.map((height, i) => (
          <div
            key={i}
            className="bg-gradient-to-t from-violet-400 via-pink-400 to-blue-400 rounded-full transition-all duration-150 ease-out"
            style={{
              width: "2px",
              height: `${8 + height * 16}px`,
              opacity: 0.7 + height * 0.3,
            }}
          />
        ))}
      </div>
      <span className="text-violet-400 text-xs font-medium ml-2">
        Listening...
      </span>
    </div>
  );
};

export default VoiceWaves;

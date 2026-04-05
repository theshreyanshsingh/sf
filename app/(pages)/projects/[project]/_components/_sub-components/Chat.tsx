"use client";

import { NextPage } from "next";
import React, { useState } from "react";
import Messages from "./Messages";
import Keyboard from "./Keyboard";
// import { motion } from "framer-motion";
import Palette from "./Palette";

const Chat: NextPage = () => {
  const [selected] = useState<"palette" | "ai">("ai");
  // const options = ["palette", "ai"];

  return (
    <div className="hidden h-full min-h-0 w-[clamp(300px,22vw,380px)] shrink-0 flex-col overflow-x-hidden border-l border-[#201F22] bg-[#0F0F0F] md:flex">
      {/* Head */}
      {/* <div className="justify-center items-center flex p-3 bg-[#141415] border-b border-[#201F22]">
        <div className="relative flex bg-[#1A1A1A] rounded-lg px-1 py-1 w-40">
          <motion.div
            layoutId="switcher"
            className="absolute top-1 bottom-1 w-1/2 bg-[#333] rounded-md"
            animate={{ x: selected === "ai" ? "100%" : "0%" }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          />

          {options.map((option) => (
            <button
              key={option}
              onClick={() => setSelected(option as "palette" | "ai")}
              className="relative flex-1 text-xs font-sans font-medium text-white py-1 z-10 justify-center items-center flex"
            >
              <span className="relative z-10 flex justify-center items-center gap-x-2 ">
                {option === "palette" ? (
                  <LuLayoutDashboard className="text-lg" />
                ) : (
                  <Image
                    src={logo}
                    alt="Bot Logo"
                    width={14}
                    height={14}
                    className="rounded-sm"
                  />
                )}
                {option.charAt(0).toUpperCase() + option.slice(1)}
              </span>
            </button>
          ))}
        </div>
      </div> */}

      {/* Palette / Messages */}
      <div className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-hidden break-words scrollbar-hide">
        {selected === "ai" ? (
          <div
            className="flex h-full min-h-0 flex-1 flex-col break-words"
            style={{ display: selected === "ai" ? "flex" : "none" }}
          >
            <Messages />
          </div>
        ) : (
          <div
            className="h-full break-words"
            style={{ display: selected === "palette" ? "block" : "none" }}
          >
            <Palette />
          </div>
        )}
      </div>

      {/* Input Keyboard */}
      {selected === "ai" && (
        <div className="justify-center items-center flex flex-col w-full">
          <div className="p-3 border-y border-[#201F22] bg-[#1a1a1b] w-full overflow-x-hidden">
            <Keyboard />
          </div>
        </div>
      )}
    </div>
  );
};

export default Chat;

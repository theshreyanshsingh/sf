"use client";
import { NextPage } from "next";
import Sheet from "./_components/Sheet";
import Chat from "./_components/_sub-components/Chat";
import MobileChat from "./_components/_sub-components/MobileChat";

import Header from "./_components/Header";

const Page: NextPage = () => {
  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      <Header />

      <div className="flex min-h-0 flex-1 flex-row overflow-hidden">
        {/* Desktop */}
        <Chat />
        <Sheet />
        {/* Mobile */}
        <MobileChat />
      </div>
    </div>
  );
};

export default Page;

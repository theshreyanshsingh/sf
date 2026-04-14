import React, { Suspense } from "react";
import Hero from "./_components/Hero";

const page = () => {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#06070a]" />}>
      <Hero />
    </Suspense>
  );
};

export default page;

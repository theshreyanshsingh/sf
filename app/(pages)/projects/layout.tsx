import React from "react";

const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="relative flex min-h-screen w-full min-w-0 flex-1 flex-col overflow-hidden bg-black">
      <div className="relative z-0 flex min-h-screen w-full min-h-0 flex-1 flex-col">
        {children}
      </div>
    </div>
  );
};

export default Layout;

"use client";
import React, { memo, useEffect, useRef, useState } from "react";

import Explorer from "./components/Explorer";
import Playground from "./components/Playground";
import Header from "./components/Header";

const Editor = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isExplorerCollapsed, setIsExplorerCollapsed] =
    useState<boolean>(false);

  const [explorerWidth, setExplorerWidth] = useState<number>(20);
  const dividerRef = useRef<HTMLDivElement>(null);

  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isHovering, setIsHovering] = useState<boolean>(false);

  // dragging logic
  const handleDragStart = (e: React.MouseEvent): void => {
    e.preventDefault();
    setIsDragging(true);

    // // Disable the editor to prevent errors during resize
    // if (editorRef.current) {
    //   try {
    //     editorRef.current.updateOptions({ readOnly: true });
    //   } catch (error) {
    //     // Ignore errors from Monaco
    //   }
    // }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent): void => {
      if (!isDragging || !containerRef.current) return;

      // Calculate the new width as a percentage
      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth =
        ((e.clientX - containerRect.left) / containerRect.width) * 100;

      // Limit the size between 10% and 50%
      if (newWidth >= 10 && newWidth <= 50) {
        setExplorerWidth(newWidth);
      }
    };

    const handleMouseUp = (): void => {
      setIsDragging(false);

      // Re-enable the editor after resize
      //   if (editorRef.current) {
      //     setTimeout(() => {
      //       try {
      //         editorRef.current!.updateOptions({ readOnly: false });
      //         editorRef.current!.layout();
      //       } catch (error) {
      //         console.log("Error", error);
      //         // Ignore errors from Monaco
      //       }
      //     }, 0);
      //   }
    };

    // Add listeners only when dragging
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  return (
    <div className="h-full w-full flex flex-col">
      {/* Header */}
      <Header />

      <div ref={containerRef} className="relative flex h-full w-full">
        {/* FileExplorer */}
        <div
          className="h-full overflow-auto"
          style={{
            width: isExplorerCollapsed ? "28px" : `${explorerWidth}%`,
            transition: "width 150ms ease",
            overflow: isExplorerCollapsed ? "hidden" : "auto",
          }}
        >
          <Explorer />
        </div>

        {/* Drag Handle */}
        <div
          ref={dividerRef}
          className={`h-full cursor-col-resize transition-all duration-150 ${
            isHovering || isDragging
              ? "w-1 bg-[#4a4a4a]"
              : "w-px bg-transparent"
          }`}
          onMouseDown={handleDragStart}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          style={{
            userSelect: "none",
            borderRight:
              isHovering || isDragging ? "none" : "1px solid #2a2a2a",
            position: "relative",
          }}
        >
          {/* Invisible touch target overlay */}
          <div
            className="absolute top-0 bottom-0 -left-2 w-5"
            style={{
              zIndex: 5,
            }}
          />
        </div>

        {/* Editor */}
        <div
          className="h-full flex flex-col bg-[#141415]"
          style={{
            width: isExplorerCollapsed
              ? "calc(100% - 28px - 1px)"
              : `calc(100% - ${explorerWidth}% - ${isHovering || isDragging ? "8px" : "1px"})`,
            transition: "width 150ms ease",
          }}
          //   onContextMenu={handleContextMenu}
        >
          <div className="flex-grow relative bg-[#141415]">
            <div className="absolute inset-0">
              <Playground />
            </div>
          </div>
        </div>

        {/* Overlay to prevent interaction during resizing */}
        {isDragging && (
          <div
            className="fixed inset-0 z-50 cursor-col-resize bg-transparent"
            style={{ userSelect: "none" }}
          />
        )}
      </div>
    </div>
  );
};

export default memo(Editor);

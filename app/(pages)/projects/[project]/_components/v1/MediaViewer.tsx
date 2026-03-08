"use client";

import React, { useEffect, useState } from "react";
import { useWebContainerContext } from "@/app/redux/useWebContainerContext";
import { UIFileEntry } from "./types";

interface MediaViewerProps {
  file: UIFileEntry;
}

const MediaViewer: React.FC<MediaViewerProps> = ({ file }) => {
  const [mediaContent, setMediaContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { webcontainerInstance } = useWebContainerContext();

  useEffect(() => {
    // Reset state when file changes
    setLoading(true);
    setError(null);
    
    // Clean up previous blob URL if it exists
    if (mediaContent) {
      URL.revokeObjectURL(mediaContent);
      setMediaContent(null);
    }
    
    const loadMediaContent = async () => {
      if (!webcontainerInstance || !file?.path) {
        setError("Cannot display media: WebContainer or file path not available");
        setLoading(false);
        return;
      }

      try {
        const path = file.path;
        console.log(`Attempting to load media from path: "${path}"`);
        
        // Normalize path to ensure consistent handling
        const normalizedPath = path.startsWith('/') ? path : `/${path}`;
        console.log(`Normalized path: "${normalizedPath}"`);
        
        // Add a small delay for renamed files to ensure file system has completely processed the rename
        // We can detect this by checking for the _refreshKey property we added in the FileExplorer component
        if (file['_refreshKey']) {
          console.log('File was recently renamed, adding small delay before loading');
          await new Promise(resolve => setTimeout(resolve, 150));
        }
        
        // Get the file as a blob
        const fileContent = await webcontainerInstance.fs.readFile(normalizedPath);
        
        // Create a blob URL that can be used in img, video, or iframe tags
        const blob = new Blob([fileContent]);
        const url = URL.createObjectURL(blob);
        setMediaContent(url);
        setLoading(false);
      } catch (error) {
        console.error("Error loading media:", error);
        setError(`Failed to load media file: ${error instanceof Error ? error.message : String(error)}`);
        setLoading(false);
        
        // If there was an error and this is a recently renamed file, retry after a longer delay
        if (file['_refreshKey']) {
          console.log('Retrying recently renamed file after error...');
          setTimeout(() => {
            console.log('Retrying media load after delay');
            setLoading(true);
            setError(null);
            loadMediaContent();
          }, 500);
        }
      }
    };

    loadMediaContent();

    // Clean up blob URL on unmount or when file changes
    return () => {
      if (mediaContent) {
        URL.revokeObjectURL(mediaContent);
      }
    };
  }, [file?.path, file['_refreshKey'], webcontainerInstance]); // Add _refreshKey as a dependency to respond to renames

  const getFileExtension = (filename: string) => {
    return filename.split('.').pop()?.toLowerCase() || '';
  };

  const renderMediaContent = () => {
    if (!mediaContent) return null;

    const extension = getFileExtension(file.name);

    // Handle image files
    if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(extension)) {
      return (
        <div className="flex items-center justify-center h-full">
          <img 
            src={mediaContent} 
            alt={file.name} 
            className="max-w-full max-h-full object-contain"
          />
        </div>
      );
    }
    
    // Handle video files
    if (['mp4', 'webm', 'ogg'].includes(extension)) {
      return (
        <div className="flex items-center justify-center h-full">
          <video 
            src={mediaContent} 
            controls 
            className="max-w-full max-h-full"
          >
            Your browser does not support the video tag.
          </video>
        </div>
      );
    }
    
    // Handle audio files
    if (['mp3', 'wav', 'ogg'].includes(extension)) {
      return (
        <div className="flex items-center justify-center h-full">
          <audio 
            src={mediaContent} 
            controls 
            className="w-full max-w-md"
          >
            Your browser does not support the audio tag.
          </audio>
        </div>
      );
    }
    
    // Handle PDF files
    if (extension === 'pdf') {
      return (
        <div className="h-full w-full">
          <iframe 
            src={mediaContent} 
            className="w-full h-full border-0"
            title={file.name}
          />
        </div>
      );
    }

    // For other files, provide a download link
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="bg-gray-800 p-6 rounded-lg text-center">
          <p className="text-white mb-4">
            This file type ({extension}) cannot be previewed directly.
          </p>
          <a
            href={mediaContent}
            download={file.name}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Download {file.name}
          </a>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full w-full bg-[#1E1E1E] text-white overflow-auto">
      {loading && (
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      )}
      
      {error && (
        <div className="flex items-center justify-center h-full">
          <div className="bg-red-900/20 border border-red-700 text-red-300 p-4 rounded max-w-lg">
            <h3 className="text-lg font-medium mb-2">Error</h3>
            <p>{error}</p>
          </div>
        </div>
      )}
      
      {!loading && !error && renderMediaContent()}
    </div>
  );
};

export default MediaViewer;

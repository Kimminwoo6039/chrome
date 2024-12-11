'use client';

import React, {createContext, useContext, useRef, useState} from 'react';

interface ScreenShareContextType {
  stream: MediaStream | null;
  setStream: (stream: MediaStream | null) => void;
  videoRef: React.RefObject<HTMLVideoElement>;
  startScreenShare: () => Promise<void>;
  stopScreenShare: () => void;
  capturedFile: File | null;
  setCapturedFile: (file: File | null) => void;
}

const ScreenShareContext = createContext<ScreenShareContextType | undefined>(undefined);

export const ScreenShareProvider = ({children}: { children: React.ReactNode }) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const startScreenShare = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      setStream(mediaStream);

      mediaStream.getVideoTracks()[0].onended = () => {
        setStream(null);
      };
    } catch (err) {
      console.error('Error starting screen capture: ', err);
      throw err;
    }
  };

  const stopScreenShare = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  return (
      <ScreenShareContext.Provider
          value={{
            stream,
            setStream,
            videoRef,
            startScreenShare,
            stopScreenShare,
            capturedFile,
            setCapturedFile
          }}
      >
        {children}
      </ScreenShareContext.Provider>
  );
};

export const useScreenShare = () => {
  const context = useContext(ScreenShareContext);
  if (context === undefined) {
    throw new Error('useScreenShare must be used within a ScreenShareProvider');
  }
  return context;
};
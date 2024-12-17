"use client"
import React, {useEffect} from 'react';
import {useScreenShare} from "@/lib/provider/screen-share-context";

function ScreenCapture() {
  const EXTENSION_IDENTIFIER = 'URL_HISTORY_TRACKER_f7e8d9c6b5a4';
  const {stream, videoRef, setStream, setCapturedFile} = useScreenShare();
  const captureInterval = 5000; // 캡처 간격 5초


  // 데이터 요청 함수
  const requestShareAndContent = () => {
    window.postMessage({
      type: "SHARE",
      source: "SHARE",
      identifier: EXTENSION_IDENTIFIER
    }, "*");
  };

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      startStreamCapture();
    }
  }, [stream]);

  const startStreamCapture = async () => {
    try {
      // 임시로 주석 추후에 다시 주석 해제후 실행
      //requestShareAndContent();

      // 캡처 간격에 맞춰 캡처 호출
      const intervalId = setInterval(() => {
        captureScreen();
      }, captureInterval);

      // 스트림 종료 시 처리
      if (stream) {
        stream.getTracks()[0].onended = () => {
          clearInterval(intervalId);
          setStream(null);
        };
      }

      return () => {
        clearInterval(intervalId);
      };
    } catch (err) {
      console.error("Error starting screen capture: ", err);
    }
  };

  const captureScreen = async () => {
    const video = videoRef.current;
    if (video) {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        try {
          const blob = await new Promise<Blob>((resolve) => {
            canvas.toBlob((blob) => {
              if (blob) resolve(blob);
            }, 'image/jpg');
          });

          const file = new File([blob], 'screenshot.jpg', {type: 'image/jpg'});
          setCapturedFile(file);
        } catch (error) {
          console.error('Error capturing screen:', error);
        }
      }
    }
  };

  return (
      <div className="w-full h-full flex flex-col items-center">
        <video
            ref={videoRef}
            
            autoPlay
            playsInline
            className="w-full h-full object-contain mt-2.5"
        />
      </div>
  );
}

export default ScreenCapture;
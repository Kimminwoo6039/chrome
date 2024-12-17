"use client"
import React from 'react';
import ScreenCapture from "@/components/detection/screen-capture";
import YOLOv8 from "@/components/detection/yolo-8v-detection";

const CaptureToDetection = () => {
  return (
      <div className="hidden">  {/* 숨겨진 상태로 실행 */}
        <ScreenCapture/>
        <YOLOv8/>
      </div>
  );
};

export default CaptureToDetection;
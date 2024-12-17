"use client";

import React, {useEffect, useState} from "react";
import {Trash2} from 'lucide-react';
import {useGambling} from "@/lib/provider/gambling-context";
import {Card, CardContent, CardHeader} from "@/components/ui/card";
import {useScreenShare} from "@/lib/provider/screen-share-context";
import {Button} from "@/components/ui/button";
import {ScrollArea} from "@/components/ui/scroll-area";
import {hasGamblingContent, highlightGamblingContent, initDB} from "./gambling-utils";
import {Dialog, DialogContent, DialogHeader, DialogTitle} from "@/components/ui/dialog";

interface Detection {
  id?: number;
  url: string;
  title: string;
  content: string;
  screenshot?: string;
  detectedAt: Date;
  score: number;
}

const truncateUrl = (url: string) => {
  if (url.length > 20) {
    return url.substring(0, 20) + '...';
  }
  return url;
};

export default function Gambling() {
  const {urlHistory} = useGambling();
  const {stream, videoRef} = useScreenShare();
  const [selectedItem, setSelectedItem] = useState<Detection | null>(null);
  const [detectionHistory, setDetectionHistory] = useState<Detection[]>([]);
  const [viewMode, setViewMode] = useState<'all' | 'detections'>('all');
  // 모달
  const [modalOpen, setModalOpen] = useState(false);
  const [modalImage, setModalImage] = useState<{ url: string; title: string } | null>(null);

  // 검출 기록 로드
  const loadDetectionHistory = async () => {
    const db = await initDB();
    const transaction = db.transaction(['detections'], 'readonly');
    const store = transaction.objectStore('detections');
    const request = store.getAll();

    request.onsuccess = () => {
      setDetectionHistory(request.result.sort((a, b) =>
          new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime()
      ));
    };
  };

  useEffect(() => {
    if (urlHistory.length > 0 && !selectedItem) {
      setSelectedItem({
        ...urlHistory[0],
        detectedAt: new Date(),
        score: 0
      });
    }
    loadDetectionHistory();
  }, [urlHistory]);

  // 검출 기록 삭제 핸들러
  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const db = await initDB();
      const transaction = db.transaction(['detections'], 'readwrite');
      const store = transaction.objectStore('detections');
      const request = store.delete(id);

      request.onsuccess = () => {
        loadDetectionHistory();
        if (selectedItem?.id === id) {
          setSelectedItem(null);
        }
      };
    } catch (error) {
      console.error('삭제 실패:', error);
    }
  };

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, videoRef]);

  // handleImageClick 함수 수정
  const handleImageClick = (imageUrl: string | undefined, title: string) => {
    if (!imageUrl) return;
    setModalImage({url: imageUrl, title});
    setModalOpen(true);
  };


  return (
      <>
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent aria-describedby={undefined} className="max-w-[90vw] max-h-[90vh] p-0">
            <DialogHeader className="p-4">
              <DialogTitle>{modalImage?.title}</DialogTitle>
            </DialogHeader>
            <div
                className="relative w-full h-full flex items-center justify-center overflow-hidden">
              {modalImage?.url && (
                  <img
                      src={modalImage.url}
                      alt={modalImage.title}
                      className="max-w-full max-h-[calc(90vh-4rem)] object-contain"
                  />
              )}
            </div>
          </DialogContent>
        </Dialog>
        <div className="min-h-screen bg-background p-4">
          <Card className="w-full">
            <CardHeader className="border-b">
              <div className="flex space-x-2">
                <Button
                    variant={viewMode === 'all' ? "default" : "secondary"}
                    onClick={() => setViewMode('all')}
                    size="sm"
                >
                  현재 URL
                </Button>
                <Button
                    variant={viewMode === 'detections' ? "default" : "secondary"}
                    onClick={() => setViewMode('detections')}
                    size="sm"
                >
                  도박성 검출 ({detectionHistory.length})
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x">
                {/* Left Panel */}
                <ScrollArea className="h-[calc(100vh-200px)] p-4">
                  <div className="space-y-2">
                    {viewMode === 'all' ? (
                        urlHistory.map((item, index) => (
                            <div
                                key={`url-${index}-${item.url}`}
                                className={`p-4 rounded-lg cursor-pointer transition-all 
                        ${selectedItem === item ?
                                    'bg-primary/10 border-l-4 border-primary' :
                                    'bg-card hover:bg-accent/50'
                                }`}
                                onClick={() => setSelectedItem({
                                  ...item,
                                  detectedAt: new Date(),
                                  score: 0
                                })}
                            >
                              <h4 className="font-medium text-sm">{item.title || 'No Title'}</h4>
                              <p className="text-sm text-muted-foreground">
                                URL: {truncateUrl(item.url)}
                              </p>
                              {hasGamblingContent(item.content) && (
                                  <div className="mt-1 text-destructive text-sm flex items-center">
                                    <span>⚠️ 도박성 컨텐츠 검출</span>
                                  </div>
                              )}
                            </div>
                        ))
                    ) : (
                        detectionHistory.map((detection, index) => (
                            <div
                                key={`detection-${detection.id}-${index}`}
                                className={`p-4 rounded-lg cursor-pointer transition-all relative group
                        ${selectedItem === detection ?
                                    'bg-primary/10 border-l-4 border-primary' :
                                    'bg-card hover:bg-accent/50'
                                }`}
                                onClick={() => {
                                  const originalItem = urlHistory.find(item => item.url === detection.url);
                                  setSelectedItem(originalItem ? {
                                    ...originalItem,
                                    detectedAt: new Date(),
                                    score: 0
                                  } : detection);
                                }}
                            >
                              <div className="flex justify-between items-start">
                                <div className="flex-grow pr-8">
                                  <h4 className="font-medium text-sm">{detection.title || 'No Title'}</h4>
                                  <p className="text-sm text-muted-foreground">
                                    URL: {truncateUrl(detection.url)}
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    검출 시각: {new Date(detection.detectedAt).toLocaleString()}
                                    <span className="text-destructive ml-2">
                              score: {detection.score}
                            </span>
                                  </p>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100"
                                    onClick={(e) => handleDelete(detection.id!, e)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive"/>
                                </Button>
                              </div>
                            </div>
                        ))
                    )}
                  </div>
                </ScrollArea>

                {/* Right Panel */}
                <ScrollArea className="h-[calc(100vh-200px)] p-4">
                  {selectedItem ? (
                      <div className="space-y-2 sm:space-y-4">
                        <div className="bg-white p-2 sm:p-4 rounded">
                          <h2 className="text-lg sm:text-xl font-bold break-words">
                            {selectedItem.title}
                            {viewMode === 'detections' && (
                                <span className="text-red-400 pl-4">
                        score: {selectedItem.score}
                      </span>
                            )}
                          </h2>
                          <p className="text-xs sm:text-sm text-gray-600 break-words">{selectedItem.url}</p>
                        </div>

                        {selectedItem.screenshot && (
                            <div className="mb-4 sm:mb-6">
                              <h4 className="font-semibold mb-2 text-sm sm:text-base">
                                {viewMode === 'detections' ? '검출 스크린샷' : '스크린샷'}
                              </h4>
                              <div>
                                <div
                                    className="relative group cursor-pointer"
                                    onClick={() => selectedItem?.screenshot && handleImageClick(selectedItem?.screenshot, '도박 검출 이미지')}
                                >
                                  <img
                                      src={selectedItem.screenshot}
                                      alt={`${viewMode === 'detections' ? '검출' : ''} 스크린샷`}
                                      className="w-full sm:w-auto rounded-lg shadow-md h-[50vh]"
                                  />
                                  <div
                                      className="absolute bottom-2 right-2 text-sm text-gray-500 bg-white bg-opacity-75 px-2 py-1 rounded">
                                    클릭하여 확대
                                  </div>
                                </div>
                              </div>
                            </div>
                        )}

                        {hasGamblingContent(selectedItem.content) && (
                            <div className="bg-red-50 border-l-4 border-red-500 p-2 sm:p-4 rounded">
                    <span
                        className="text-red-700 font-semibold flex items-center gap-2 text-sm sm:text-base">
                      ⚠️ 도박성 컨텐츠 검출
                    </span>
                            </div>
                        )}

                        <details open={true}>
                          <summary
                              className="cursor-pointer py-1 sm:py-2 font-semibold hover:text-blue-500 text-sm sm:text-base">
                            URL 텍스트 내용
                          </summary>
                          <div
                              className="mt-2 p-2 sm:p-4 bg-gray-50 rounded shadow-inner"
                              style={{
                                maxHeight: '300px',
                                overflowX: 'hidden',
                                overflowY: 'auto',
                                scrollbarWidth: 'thin',
                                scrollbarColor: '#CBD5E0 #EDF2F7'
                              }}
                          >
                            <p
                                className="content-preview text-xs sm:text-sm break-words"
                                dangerouslySetInnerHTML={highlightGamblingContent(selectedItem.content)}
                            />
                          </div>
                        </details>
                      </div>
                  ) : (
                      <div
                          className="flex items-center justify-center h-full text-gray-500 text-sm sm:text-base">
                        URL을 선택해주세요.
                      </div>
                  )}
                </ScrollArea>
              </div>
            </CardContent>
          </Card>

          <video ref={videoRef} hidden playsInline className="w-[10%] h-auto"/>
        </div>
      </>
  );
}

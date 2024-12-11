"use client"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {Separator} from "@/components/ui/separator"
import {SidebarTrigger} from "@/components/ui/sidebar"
import {useScreenShare} from "@/lib/provider/screen-share-context"
import {Button} from "@/components/ui/button"
import {Loader2} from "lucide-react"
import {useEffect, useRef, useState} from "react"
import {Dialog, DialogContent, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import Link from "next/link";

export default function Home() {
  const {stream, videoRef, startScreenShare, stopScreenShare, capturedFile} = useScreenShare();
  const [isLoading, setIsLoading] = useState(false);

  // 모니터링 관련 상태
  const [detectionImage, setDetectionImage] = useState<string | null>(null);
  const [isLoadingDetection, setIsLoadingDetection] = useState(true);
  const [detectionError, setDetectionError] = useState(false);

  // Refs for optimization
  const prevDetectionImageRef = useRef<string | null>(null);
  const isInitialDetectionLoadRef = useRef(true);

  // 모달
  const [modalOpen, setModalOpen] = useState(false);
  const [modalImage, setModalImage] = useState<{ url: string; title: string } | null>(null);

  const handleScreenShare = async () => {
    setIsLoading(true);
    try {
      if (stream) {
        stopScreenShare();
      } else {
        await startScreenShare();
      }
    } catch (error) {
      console.error('Screen share failed:', error);
    }
    setIsLoading(false);
  };

  // Database functions
  const openDatabase = (dbName: string): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, 1);

      request.onerror = (event) => {
        console.error("IndexedDB error:", (event.target as IDBOpenDBRequest).error);
        reject((event.target as IDBOpenDBRequest).error);
      };

      request.onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains("images")) {
          db.createObjectStore("images", {keyPath: "id", autoIncrement: true});
        }
      };
    });
  };

  const loadImageFromDB = async (dbName: string, setError: (error: boolean) => void) => {
    try {
      const db = await openDatabase(dbName);
      const transaction = db.transaction("images", "readwrite");
      const store = transaction.objectStore("images");
      const request = store.getAll();

      return new Promise<string | null>((resolve, reject) => {
        request.onsuccess = (event) => {
          const results = (event.target as IDBRequest).result;
          if (results.length > 1000) {
            store.clear();
          }
          const latestImage = results.length > 0 ? results[results.length - 1].data : null;
          setError(results.length === 0);
          resolve(latestImage);
        };

        request.onerror = (event) => {
          console.error(`Error loading images from ${dbName}:`, (event.target as IDBRequest).error);
          setError(true);
          reject((event.target as IDBRequest).error);
        };
      });
    } catch (error) {
      console.error(`Database error in ${dbName}:`, error);
      setError(true);
      return null;
    }
  };

// handleImageClick 함수 수정
  const handleImageClick = (imageUrl: string, title: string) => {
    if (!imageUrl) return;
    setModalImage({url: imageUrl, title});
    setModalOpen(true);
  };


  // Detection image update
  useEffect(() => {
    const updateDetectionImage = async () => {
      try {
        const newImage = await loadImageFromDB("DetectionImageDB", setDetectionError);

        if (isInitialDetectionLoadRef.current || newImage !== prevDetectionImageRef.current) {
          setDetectionImage(newImage);
          prevDetectionImageRef.current = newImage;

          if (isInitialDetectionLoadRef.current) {
            isInitialDetectionLoadRef.current = false;
            setIsLoadingDetection(false);
          }
        }
      } catch (error) {
        console.error('Error loading detection images:', error);
        setDetectionError(true);
        setIsLoadingDetection(false);
      }
    };

    updateDetectionImage();
    const intervalId = setInterval(updateDetectionImage, 3000);

    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (videoRef.current) {
      if (stream) {
        videoRef.current.srcObject = stream;
      } else {
        videoRef.current.srcObject = null;
      }
    }
  }, [stream, videoRef]);

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
        <header
            className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1"/>
            <Separator orientation="vertical" className="mr-2 h-4"/>
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  홈
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block"/>
                <BreadcrumbItem>
                  <Link href="/">
                    <BreadcrumbPage>대시보드</BreadcrumbPage>
                  </Link>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="grid auto-rows-min gap-4 md:grid-cols-3">
            <div className="aspect-video rounded-xl bg-muted/50 overflow-hidden">
              <div className="text-muted-foreground font-bold text-center py-2">
                공유 화면
              </div>
              <div className="items-center flex justify-center h-[calc(100%-2.5rem)]">
                {stream ? (
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="text-sm text-muted-foreground">
                      화면 공유가 필요합니다
                    </div>
                )}
              </div>
            </div>

            {/* 캡처 이미지 카드 */}
            <div className="aspect-video rounded-xl bg-muted/50 overflow-hidden">
              <div className="h-full items-center justify-center"
                   onClick={() => capturedFile && handleImageClick(URL.createObjectURL(capturedFile), '캡처된 화면')}
                   style={{cursor: capturedFile ? 'pointer' : 'default'}}>
                <div className="text-muted-foreground font-bold text-center py-2">
                  캡처된 화면
                </div>
                <div className="items-center flex justify-center h-[calc(100%-2.5rem)]">
                  {stream ? (
                      capturedFile ? (
                          <div className="relative group h-full w-full">
                            <img
                                src={URL.createObjectURL(capturedFile)}
                                alt="Captured screen"
                                className="h-full w-full object-cover"
                            />
                            <div
                                className="absolute bottom-2 right-2 text-xs text-foreground/75 bg-background/75 px-2 py-1 rounded">
                              최근 캡처
                            </div>
                          </div>
                      ) : (
                          <div className="text-sm text-muted-foreground">
                            캡처 대기중...
                          </div>
                      )
                  ) : (
                      <div className="text-sm text-muted-foreground">
                        화면 공유가 필요합니다
                      </div>
                  )}
                </div>
              </div>
            </div>

            {/* 선정성 검출 이미지 카드 */}
            <div className="aspect-video rounded-xl bg-muted/50 overflow-hidden">
              <div className="h-full items-center justify-center"
                   onClick={() => detectionImage && handleImageClick(detectionImage, '선정성 검출 이미지')}
                   style={{cursor: detectionImage ? 'pointer' : 'default'}}>
                <div className="text-muted-foreground font-bold text-center py-2">
                  선정성 검출 이미지
                </div>
                <div className="items-center flex justify-center h-[calc(100%-2.5rem)]">
                  {isLoadingDetection ? (
                      <Loader2 className="h-8 w-8 animate-spin"/>
                  ) : detectionImage ? (
                      <div className="relative group h-full w-full">
                        <img
                            src={detectionImage}
                            alt="Detection result"
                            className="h-full w-full object-cover"
                        />
                        <div
                            className="absolute bottom-2 right-2 text-xs text-foreground/75 bg-background/75 px-2 py-1 rounded">
                          클릭하여 확대
                        </div>
                      </div>
                  ) : detectionError ? (
                      <div className="text-sm text-muted-foreground">
                        저장된 이미지가 없습니다
                      </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="h-[33vh] flex-1 rounded-xl bg-muted/50 md:min-h-min p-4">
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <Button
                  onClick={handleScreenShare}
                  variant={stream ? "secondary" : "default"}
                  disabled={isLoading}
                  className="flex items-center gap-2"
              >
                {isLoading && <Loader2 className="h-4 w-4 animate-spin"/>}
                {stream ? "화면 공유 중지" : "화면 공유 시작"}
              </Button>

              {!stream && !isLoading && (
                  <div className="text-lg text-muted-foreground animate-pulse">
                    화면 공유가 중지되었습니다
                  </div>
              )}

              {stream && (
                  <div className="flex flex-col items-center gap-2">
                    <div className="text-[40px] text-neutral-500 animate-pulse">
                      화면 공유가 실행중입니다
                    </div>
                    <div className="flex gap-1 mt-8">
                      {[...Array(5)].map((_, i) => (
                          <span
                              key={i}
                              className="animate-bounce text-primary"
                              style={{animationDelay: `${i * 0.1}s`}}
                          >
              <img width={64} src="/meer.ico"/>
            </span>
                      ))}
                    </div>
                  </div>
              )}
            </div>
          </div>
        </div>
      </>
  );
}
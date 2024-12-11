"use client";

import {useEffect, useState} from "react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {Dialog, DialogContent, DialogHeader, DialogTitle} from "@/components/ui/dialog";

interface DetectionImageData {
  id: number;
  url: string;
  title: string;
  screenshot: string;
  content: string;
  detectedAt: Date;
  timestamp: string;
  score: number;
}

const ITEMS_PER_PAGE = 10;

export default function DetectionImage() {
  const [images, setImages] = useState<DetectionImageData[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // 모달
  const [modalOpen, setModalOpen] = useState(false);
  const [modalImage, setModalImage] = useState<{ url: string; title: string } | null>(null);

  const openDatabase = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("GamblingDetectionDB", 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains("detections")) {
          const store = db.createObjectStore("detections", {
            keyPath: "id",
            autoIncrement: true
          });
          store.createIndex("timestamp", "timestamp");
        }
      };
    });
  };

  const loadImages = async (page: number) => {
    try {
      const db = await openDatabase();
      const transaction = db.transaction("detections", "readonly");
      const store = transaction.objectStore("detections");

      // 전체 아이템 수 가져오기
      const count = await new Promise<number>((resolve) => {
        const countRequest = store.count();
        countRequest.onsuccess = () => resolve(countRequest.result);
      });

      setTotalPages(Math.ceil(count / ITEMS_PER_PAGE));

      // 모든 데이터 가져오기
      const allItems = await new Promise<DetectionImageData[]>((resolve) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
      });

      // 타임스탬프 기준으로 정렬
      const sortedItems = allItems.sort((a, b) => {
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });

      // 현재 페이지에 해당하는 아이템들 선택
      const start = (page - 1) * ITEMS_PER_PAGE;
      const pageItems = sortedItems.slice(start, start + ITEMS_PER_PAGE);

      setImages(pageItems);
    } catch (error) {
      console.error("Error loading images:", error);
    }
  };
  useEffect(() => {
    loadImages(currentPage);
  }, [currentPage]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // handleImageClick 함수 수정
  const handleImageClick = (imageUrl: string, title: string) => {
    if (!imageUrl) return;
    setModalImage({url: imageUrl, title});
    setModalOpen(true);
  };
  return (
      <>
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent aria-describedby={undefined}
                         className="max-w-[90vw] max-h-[90vh] p-0">
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
        <div className="flex flex-1 flex-col gap-4 p-4">
          <div>
            {images.length === 0 ? (
                <div
                    className="flex flex-col items-center justify-center min-h-[200px] text-muted-foreground">
                  <p>저장된 이미지가 없습니다.</p>
                </div>
            ) : (
                <div
                    className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {images.map((image, index) => (
                      <div
                          key={`${image.title}-${index}`}
                          className="aspect-square rounded-xl bg-muted/50 overflow-hidden border border-border shadow-sm hover:shadow-md transition-shadow"
                          onClick={() => image.screenshot && handleImageClick(image.screenshot, '도박 검출 이미지')}
                      >
                        <div className="relative group h-full w-full">
                          <img
                              src={image.screenshot}
                              alt={`Detection ${index + 1}`}
                              className="w-full h-full object-cover object-center"
                              style={{width: "100%", height: "100%"}}
                          />
                          <div
                              className="absolute bottom-2 right-2 text-xs text-foreground/75 bg-background/75 px-2 py-1 rounded">
                            클릭하여 확대
                          </div>
                        </div>
                      </div>
                  ))}
                </div>
            )}
          </div>

          {totalPages > 1 && (
              <Pagination className="flex justify-center items-center mt-4">
                <PaginationContent className="flex flex-wrap justify-center">
                  <PaginationItem className="mx-1">
                    <PaginationPrevious
                        onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                    />
                  </PaginationItem>

                  {Array.from({length: totalPages}, (_, i) => i + 1)
                  .filter((page) => {
                    if (totalPages <= 5) {
                      return true;
                    } else if (currentPage <= 3) {
                      return page <= 5;
                    } else if (currentPage >= totalPages - 2) {
                      return page >= totalPages - 4;
                    } else {
                      return page >= currentPage - 2 && page <= currentPage + 2;
                    }
                  })
                  .map((page) => (
                      <PaginationItem key={page} className="mx-1">
                        <PaginationLink
                            onClick={() => handlePageChange(page)}
                            isActive={currentPage === page}
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                  ))}

                  {totalPages > 5 && currentPage <= totalPages - 3 && (
                      <PaginationItem className="mx-1">
                        <PaginationLink>...</PaginationLink>
                      </PaginationItem>
                  )}

                  <PaginationItem className="mx-1">
                    <PaginationNext
                        onClick={() =>
                            handlePageChange(Math.min(totalPages, currentPage + 1))
                        }
                        disabled={currentPage === totalPages}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
          )}
        </div>
      </>
  );
}

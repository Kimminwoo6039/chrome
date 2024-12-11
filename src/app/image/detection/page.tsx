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
  id?: number;
  data: string;
  timestamp?: number;
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
      const request = indexedDB.open("DetectionImageDB", 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains("images")) {
          const store = db.createObjectStore("images", {
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
      const transaction = db.transaction("images", "readonly");
      const store = transaction.objectStore("images");
      const count = await new Promise<number>((resolve) => {
        const countRequest = store.count();
        countRequest.onsuccess = () => resolve(countRequest.result);
      });

      setTotalPages(Math.ceil(count / ITEMS_PER_PAGE));

      // Get images for the current page
      const start = (page - 1) * ITEMS_PER_PAGE;
      const request = store.getAll(IDBKeyRange.bound(start, start + ITEMS_PER_PAGE - 1));

      const images = await new Promise<DetectionImageData[]>((resolve) => {
        request.onsuccess = () => resolve(request.result);
      });

      setImages(images);
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
          <div
              className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {images.map((image, i) => (
                <div
                    key={image.id}
                    className="aspect-square rounded-xl bg-muted/50 overflow-hidden border border-border shadow-sm hover:shadow-md transition-shadow"
                    onClick={() => image.data && handleImageClick(image.data, '도박 검출 이미지')}
                >
                  <div className="relative group h-full w-full">
                    <img
                        src={image.data}
                        alt={`Detection ${i + 1}`}
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

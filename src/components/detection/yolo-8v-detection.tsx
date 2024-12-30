"use client"
import React, {useCallback, useEffect, useRef} from 'react';
import * as ort from 'onnxruntime-web';
import {useScreenShare} from "@/lib/provider/screen-share-context";
import {UrlHistoryItem} from "@/lib/provider/gambling-context";

// 타입 정의
type DetectionBox = [number, number, number, number, string, number];
type NotificationType = 'adult' | 'inappropriate' | 'spam';

interface PreprocessedData {
  tensor: number[];
  originalSize: {
    width: number;
    height: number;
  };
}

interface ImageSection {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface NotificationOptions {
  title: string;
  icon: string;
}

// 상수 정의
const CONSTANTS = {
  MODEL_PATH: '/nude.onnx',
  CONF_THRESHOLD: 0.5,
  IOU_THRESHOLD: 0.3,
  INPUT_SIZE: 320,
  ALERT_COOLDOWN: 5000,
  DB_VERSION: 1,
  NUM_BOXES: 2100
};

// YOLO 클래스 정의
const YOLO_CLASSES = [
  '여성 생식기 가리기',
  '여성 얼굴',
  '둔부 노출',
  '여성 유방 노출',
  '여성 생식기 노출',
  '남성 유방 노출',
  '항문 노출',
  '발 노출',
  '배 가리기',
  '발 가리기',
  '겨드랑이 가리기',
  '겨드랑이 노출',
  '남성 얼굴',
  '배 노출',
  '남성 생식기 노출',
  '항문 가리기',
  '여성 유방 가리기',
  '둔부 가리기'
];

// '여성 얼굴',

// props 타입 정의 추가
interface YOLOv8Props {
  urlHistory?: UrlHistoryItem[];
}

const YOLOv8 = ({urlHistory = []}: YOLOv8Props) => {
  const {capturedFile} = useScreenShare();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const modelSessionRef = useRef<ort.InferenceSession | null>(null);
  const lastAlertTimeRef = useRef<number>(0);


  // 알림 전송
  const sendNotification = async (type: NotificationType, message: string) => {
    const permission = await Notification.requestPermission();

    if (permission === "granted") {
      const notificationOptions: Record<NotificationType, NotificationOptions> = {
        adult: {
          title: "🚨 성인 콘텐츠 감지",
          icon: '/meer.ico'
        },
        inappropriate: {
          title: "⚠️ 부적절 콘텐츠",
          icon: '/meer.ico'
        },
        spam: {
          title: "🚫 스팸 감지",
          icon: '/meer.ico'
        }
      };

      const options = {
        body: message,
        ...notificationOptions[type],
        tag: type,
        requireInteraction: false,
        icon: '/meer.ico'
      };

      try {
        const notification = new Notification(options.title, options);

        notification.onclick = () => {
          window.focus();
          notification.close();
        };

        setTimeout(() => notification.close(), 5000);
      } catch (error) {
        console.error('알림 생성 실패:', error);
        showFallbackAlert(message);
      }
    } else {
      showFallbackAlert(message);
    }
  };

  // 대체 알림 표시
  const showFallbackAlert = (message: string) => {
    const alert = document.createElement('div');
    alert.className = 'alert-message';
    alert.textContent = message;
    document.body.appendChild(alert);

    setTimeout(() => {
      alert.remove();
    }, 3000);
  };

  // DB 초기화
  const initializeDB = useCallback(async (dbName: string) => {
    return new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(dbName, CONSTANTS.DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains("images")) {
          db.createObjectStore("images", {keyPath: "id", autoIncrement: true});
        }
      };
    });
  }, []);

  // DB에 이미지 저장
  const saveImageToDB = async (dbName: string, imageData: string) => {
    try {
      const db = await initializeDB(dbName);
      const transaction = db.transaction("images", "readwrite");
      const store = transaction.objectStore("images");

      // 가장 최근 저장된 이미지 가져오기
      const getAllRequest = store.getAll();
      const records = await new Promise((resolve, reject) => {
        getAllRequest.onsuccess = () => resolve(getAllRequest.result);
        getAllRequest.onerror = () => reject(getAllRequest.error);
      });

      // 레코드가 있고, 마지막 저장된 이미지와 현재 이미지가 같다면 저장하지 않음
      if (records && records.length > 0) {
        const lastImage = records[records.length - 1];
        if (lastImage.data === imageData) {
          console.log('Duplicate image detected, skipping save');
          return;
        }
      }

      // 새로운 이미지 저장
      await store.add({data: imageData});
      console.log(`Image saved to ${dbName} successfully`);
    } catch (error) {
      console.error(`Failed to save image to ${dbName}:`, error);
    }
  };

  // 모델 초기화
  const initializeModel = useCallback(async () => {
    try {
      const options: ort.InferenceSession.SessionOptions = {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
        enableCpuMemArena: true,
        enableMemPattern: true,
        executionMode: 'sequential'
      };

      const session = await ort.InferenceSession.create(CONSTANTS.MODEL_PATH, options);
      modelSessionRef.current = session;
    } catch (error) {
      console.error('Model initialization failed:', error);
    }
  }, []);

  // 이미지 전처리
  const preprocessImage = useCallback(async (file: File): Promise<PreprocessedData> => {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        // 원본 이미지가 1000px을 넘는지 확인
        if (img.width <= 1000 && img.height <= 1000) {
          // 1000px 이하면 단일 처리
          const singlePreprocessed = preprocessSingleSection(img, 0, 0, img.width, img.height);
          resolve([singlePreprocessed]);
          return;
        }

        // 이미지 4등분 위치 계산
        const sections: ImageSection[] = [
          {x: 0, y: 0, width: img.width / 2, height: img.height / 2},
          {x: img.width / 2, y: 0, width: img.width / 2, height: img.height / 2},
          {x: 0, y: img.height / 2, width: img.width / 2, height: img.height / 2},
          {x: img.width / 2, y: img.height / 2, width: img.width / 2, height: img.height / 2}
        ];

        // 각 섹션 전처리
        const preprocessedSections = sections.map(section =>
            preprocessSingleSection(img, section.x, section.y, section.width, section.height)
        );

        URL.revokeObjectURL(url);
        resolve(preprocessedSections);
      };

      img.src = url;
    });
  }, []);

  const preprocessSingleSection = (
      img: HTMLImageElement,
      startX: number,
      startY: number,
      width: number,
      height: number
  ): {
    offset: { x: number; y: number };
    tensor: number[];
    originalSize: { width: number; height: number }
  } => {
    const canvas = document.createElement('canvas');
    canvas.width = CONSTANTS.INPUT_SIZE;
    canvas.height = CONSTANTS.INPUT_SIZE;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Cannot get 2D context');
    }

    // 섹션을 INPUT_SIZE로 리사이즈하여 그리기
    ctx.drawImage(
        img,
        startX, startY, width, height,
        0, 0, CONSTANTS.INPUT_SIZE, CONSTANTS.INPUT_SIZE
    );

    const imageData = ctx.getImageData(0, 0, CONSTANTS.INPUT_SIZE, CONSTANTS.INPUT_SIZE);
    const {data} = imageData;
    const [red, green, blue] = [new Array<number>(), new Array<number>(), new Array<number>()];

    for (let i = 0; i < data.length; i += 4) {
      red.push(data[i] / 255.0);
      green.push(data[i + 1] / 255.0);
      blue.push(data[i + 2] / 255.0);
    }

    return {
      tensor: [...red, ...green, ...blue],
      originalSize: {
        width: width,
        height: height
      },
      offset: {x: startX, y: startY}
    };
  };


  const drawSplitDetections = async (
      canvas: HTMLCanvasElement,
      image: File,
      allDetections: Array<{ boxes: DetectionBox[], sectionIndex: number }>
  ) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      // 섹션별 오프셋 계산
      const sectionOffsets = [
        {x: 0, y: 0},
        {x: img.width / 2, y: 0},
        {x: 0, y: img.height / 2},
        {x: img.width / 2, y: img.height / 2}
      ];

      let detectionFound = false;
      const detectedLabels: string[] = [];

      // 모든 섹션의 detection 그리기
      allDetections.forEach(({boxes, sectionIndex}) => {
        const offset = sectionOffsets[sectionIndex];

        boxes.forEach(box => {
          const [x1, y1, x2, y2, label, confidence] = box;

          // 오프셋 적용하여 좌표 보정
          const adjustedX1 = x1 + offset.x;
          const adjustedY1 = y1 + offset.y;
          const adjustedX2 = x2 + offset.x;
          const adjustedY2 = y2 + offset.y;

          // 박스 그리기
          ctx.strokeStyle = "#00FF00";
          ctx.lineWidth = 3;
          ctx.strokeRect(adjustedX1, adjustedY1, adjustedX2 - adjustedX1, adjustedY2 - adjustedY1);

          // 레이블 그리기
          ctx.fillStyle = "#00FF00";
          ctx.font = "18px serif";
          const text = `${label} ${Math.round(confidence * 100)}%`;
          const textWidth = ctx.measureText(text).width;

          ctx.fillRect(adjustedX1, adjustedY1 - 25, textWidth + 10, 25);
          ctx.fillStyle = "#000000";
          ctx.fillText(text, adjustedX1 + 5, adjustedY1 - 5);

          detectionFound = true;
          detectedLabels.push(`${label} (${Math.round(confidence * 100)}%)`);
        });
      });

      // 감지된 경우 처리
      if (detectionFound) {
        const newImageData = canvas.toDataURL('image/png');
        saveImageToDB('DetectionImageDB', newImageData);
        handleMessage();
        console.log('감지된 객체들:', detectedLabels.join(', '));
      }

      URL.revokeObjectURL(img.src);
    };

    img.src = URL.createObjectURL(image);
  };


  // 출력 처리
  const processOutputs = (output: Float32Array, imgWidth: number, imgHeight: number): DetectionBox[] => {
    let boxes: DetectionBox[] = [];

    for (let index = 0; index < 2100; index++) {
      // 클래스 수를 실제 YOLO_CLASSES 길이에 맞춤
      const [classId, prob] = [...Array(YOLO_CLASSES.length).keys()]
      .map(col => [col, output[2100 * (col + 4) + index]])
      .reduce((accum, item) => item[1] > accum[1] ? item : accum, [0, 0]);


      // 검출할 클래스 인덱스
      const targetClassIndices = [
        2,  // 둔부 노출
        3,  // 여성 유방 노출
        4,  // 여성 생식기 노출
        6,  // 항문 노출
        14  // 남성 생식기 노출
      ];

      if (prob < CONSTANTS.CONF_THRESHOLD) {
        continue;
      }


      // 지정된 클래스만 검출
      if (!targetClassIndices.includes(classId)) {
        continue;
      }


      // classId가 YOLO_CLASSES 범위를 벗어나지 않도록 확인
      if (classId >= YOLO_CLASSES.length) {
        continue;
      }

      const label = YOLO_CLASSES[classId];
      const xc = output[index];
      const yc = output[2100 + index];
      const w = output[2 * 2100 + index];
      const h = output[3 * 2100 + index];

      const x1 = (xc - w / 2) / 320 * imgWidth;
      const y1 = (yc - h / 2) / 320 * imgHeight;
      const x2 = (xc + w / 2) / 320 * imgWidth;
      const y2 = (yc + h / 2) / 320 * imgHeight;

      console.log(`Detection: ${label} (${prob.toFixed(3)}) at [${x1.toFixed(1)}, ${y1.toFixed(1)}, ${x2.toFixed(1)}, ${y2.toFixed(1)}]`);
      boxes.push([x1, y1, x2, y2, label, prob]);
    }

    // NMS 적용
    boxes = boxes.sort((box1, box2) => box2[5] - box1[5]);
    const result = [];

    while (boxes.length > 0) {
      result.push(boxes[0]);
      boxes = boxes.filter(box => calculateIoU(boxes[0], box) < CONSTANTS.IOU_THRESHOLD);
    }

    return result;
  };

  // NMS 구현
  const nonMaxSuppression = (boxes: DetectionBox[], iouThreshold: number): DetectionBox[] => {
    boxes.sort((a, b) => b[5] - a[5]);

    const selected: DetectionBox[] = [];
    const indices = new Set(boxes.map((_, idx) => idx));

    while (indices.size > 0) {
      const boxIdx = Array.from(indices)[0];
      selected.push(boxes[boxIdx]);
      indices.delete(boxIdx);

      const rest = Array.from(indices);
      for (const idx of rest) {
        if (calculateIoU(boxes[boxIdx], boxes[idx]) >= iouThreshold) {
          indices.delete(idx);
        }
      }
    }

    return selected;
  };

// IoU 계산 함수 수정
  const calculateIoU = (box1: DetectionBox, box2: DetectionBox): number => {
    const [box1_x1, box1_y1, box1_x2, box1_y2] = box1;
    const [box2_x1, box2_y1, box2_x2, box2_y2] = box2;

    const x1 = Math.max(box1_x1, box2_x1);
    const y1 = Math.max(box1_y1, box2_y1);
    const x2 = Math.min(box1_x2, box2_x2);
    const y2 = Math.min(box1_y2, box2_y2);

    if (x2 < x1 || y2 < y1) return 0;

    const intersection = (x2 - x1) * (y2 - y1);
    const box1_area = (box1_x2 - box1_x1) * (box1_y2 - box1_y1);
    const box2_area = (box2_x2 - box2_x1) * (box2_y2 - box2_y1);
    const union = box1_area + box2_area - intersection;

    return intersection / union;
  };

  // 객체 감지 실행
  const runDetection = useCallback(async (preprocessedData: PreprocessedData): Promise<DetectionBox[]> => {
    if (!modelSessionRef.current) return [];

    try {
      const inputTensor = new ort.Tensor(
          'float32',
          Float32Array.from(preprocessedData.tensor),
          [1, 3, CONSTANTS.INPUT_SIZE, CONSTANTS.INPUT_SIZE]
      );

      const outputs = await modelSessionRef.current.run({images: inputTensor});
      return processOutputs(
          outputs.output0.data as Float32Array,
          preprocessedData.originalSize.width,
          preprocessedData.originalSize.height
      );
    } catch (error) {
      console.error('Detection failed:', error);
      return [];
    }
  }, []);


  const initBlcokDB = async (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('BlockedSitesDB', 2); // 버전을 2로 증가

      request.onerror = () => {
        console.error("DB Error:", request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        console.log("DB Opened successfully");
        resolve(request.result);
      };

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        console.log("Upgrading database...");
        const db = (event.target as IDBOpenDBRequest).result;

        // 기존 스토어가 있다면 삭제
        if (db.objectStoreNames.contains('blockedSites')) {
          db.deleteObjectStore('blockedSites');
        }

        // 새 스토어 생성
        const store = db.createObjectStore('blockedSites', {
          keyPath: 'url',
          autoIncrement: false
        });

        // 인덱스 생성
        store.createIndex('blockedAt', 'blockedAt', {unique: false});
        store.createIndex('unblockTime', 'unblockTime', {unique: false});
        store.createIndex('duration', 'duration', {unique: false});

        console.log("Store created:", store);
      };
    });
  };
  const saveToBlockedSitesDB = async (url: string, duration: number) => {
    try {
      const db = await initBlcokDB();
      const transaction = db.transaction('blockedSites', 'readwrite');
      const store = transaction.objectStore('blockedSites');

      const blockedSite = {
        url,
        blockedAt: new Date(),
        unblockTime: new Date(Date.now() + duration * 60 * 1000),
        duration: duration
      };

      await store.put(blockedSite);
      console.log('Site saved to BlockedSitesDB:', blockedSite);
    } catch (error) {
      console.error('Error saving to BlockedSitesDB:', error);
    }
  };
  // 메시지 처리
  const handleMessage = async () => {
    // 쿨다운 체크
    if (Date.now() - lastAlertTimeRef.current <= CONSTANTS.ALERT_COOLDOWN) {
      console.log('쿨다운 중입니다.');
      return;
    }

    if (!urlHistory || urlHistory.length === 0) return;

    const currentUrl = urlHistory[0]?.url;
    if (!currentUrl) return;

    // 차단 메시지 전송
    // window.postMessage(
    //     {
    //       type: "block",
    //       source: "block",
    //       identifier: 'URL_HISTORY_TRACKER_f7e8d9c6b5a4',
    //       data: currentUrl,
    //       duration: '1'
    //     },
    //     "*"
    // );

    try {
      // await saveToBlockedSitesDB(currentUrl, 1); // 10분 차단

      // 성공적으로 처리된 경우에만 알림 전송 및 쿨다운 시작
      sendNotification('adult', '성인 콘텐츠가 감지되었습니다.');
      lastAlertTimeRef.current = Date.now();
      console.log('차단 처리 완료:', currentUrl);
    } catch (error) {
      console.error('Error saving to BlockedSitesDB:', error);
    }
  };

  // 결과 처리 및 박스 그리기
  const drawDetections = useCallback(async (canvas: HTMLCanvasElement, image: File, boxes: DetectionBox[]) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      let detectionFound = false;
      let detectedLabels: string[] = [];

      boxes.forEach(box => {
        const [x1, y1, x2, y2, label, confidence] = box;

        // 박스 그리기
        ctx.strokeStyle = "#00FF00";
        ctx.lineWidth = 3;
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

        // 레이블 그리기
        ctx.fillStyle = "#00FF00";
        ctx.font = "18px serif";
        const text = `${label} ${Math.round(confidence * 100)}%`;
        const textWidth = ctx.measureText(text).width;

        ctx.fillRect(x1, y1 - 25, textWidth + 10, 25);
        ctx.fillStyle = "#000000";
        ctx.fillText(text, x1 + 5, y1 - 5);

        detectionFound = true;
        detectedLabels.push(`${label} (${Math.round(confidence * 100)}%)`);
      });

      // 감지된 경우에만 handleMessage 호출
      if (detectionFound) {
        const newImageData = canvas.toDataURL('image/png');
        saveImageToDB('DetectionImageDB', newImageData);

        // 쿨다운 체크를 handleMessage 내부로 이동
        handleMessage();
        console.log('감지된 객체들:', detectedLabels.join(', '));
      }

      URL.revokeObjectURL(img.src);
    };

    img.src = URL.createObjectURL(image);
  }, [handleMessage]); // handleMessage를 의존성 배열에 추가


// handleNewImage 함수 수정
  const handleNewImage = async (file: File) => {
    try {
      const preprocessedSections = await preprocessImage(file);
      const allDetections = [];

      // 각 섹션별 감지 실행
      for (let i = 0; i < preprocessedSections.length; i++) {
        const detections = await runDetection(preprocessedSections[i]);
        if (detections.length > 0) {
          allDetections.push({
            boxes: detections,
            sectionIndex: i,
            gridPosition: preprocessedSections[i].gridPosition
          });
        }
      }

      // 결과 그리기
      if (canvasRef.current && allDetections.length > 0) {
        await drawSplitDetections(canvasRef.current, file, allDetections);
      }
    } catch (error) {
      console.error('Image processing failed:', error);
    }
  };

  // 초기화
  useEffect(() => {
    initializeModel();
    initializeDB('DetectionImageDB');
  }, [initializeModel, initializeDB]);

  // 파일 변경 감지
  useEffect(() => {
    if (capturedFile) {
      handleNewImage(capturedFile);

    }

  }, [capturedFile, handleNewImage]);

  return (
      <>
        <div className="w-full h-full flex flex-col items-center">
          <canvas
              ref={canvasRef}
              hidden
              className="w-full h-full object-contain mt-2.5"
          />
        </div>
      </>
  );
};

export default YOLOv8
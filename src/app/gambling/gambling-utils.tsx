interface GamblingDB extends IDBDatabase {
  // 필요한 추가 타입 정의
}

export const initDB = (): Promise<GamblingDB> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('GamblingDetectionDB', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      resolve(request.result as GamblingDB);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('detections')) {
        const store = db.createObjectStore('detections', {
          keyPath: 'id',
          autoIncrement: true
        });
        store.createIndex('url', 'url', {unique: true});
        store.createIndex('timestamp', 'timestamp', {unique: false});
      }
    };
  });
};

export const GAMBLING_KEYWORDS = [
  "첫충", "단폴", "다리다리", "매충", "꽁머니", "슈어맨",
  "다음드", "한폴낙", "두폴낙", "단폴", "프리벳", "카지노", "슬롯", "바카라", "블랙잭", "잭팟", "포커",
  "섯다", "화투", "홀덤", "배팅", "베팅", "토토",
  "라이브카지노", "입금보너스", "멀티베팅", "승자예상", "이벤트", "사다리", "스포츠", "충전", "지급", "도박",
  "포인트", "입출금", "게임", "토큰", "인플레이", "토너먼트",
  "캐시", "적중", "텔레그램", "복권", "레이싱", "입출금",
  "가상화폐", "폴더", "페이벡", "환전", "추천인", "배당",
  "배당율", "미성년자", "가입", "청소년"
];

export const DETECTION_SETTINGS = {
  MAX_PERCENT: 95,
  MIN_PERCENT: 20,
  MULTIPLIER: 500
};

export const highlightGamblingContent = (text: string) => {
  if (!text) return {__html: ''};
  let processedText = text;
  GAMBLING_KEYWORDS.forEach(keyword => {
    const regex = new RegExp(keyword, 'gi');
    processedText = processedText.replace(
        regex,
        `<span style="color: red; font-weight: bold;">$&</span>`
    );
  });
  return {__html: processedText};
};

export const hasGamblingContent = (text: string) => {
  if (!text) return false;
  return GAMBLING_KEYWORDS.some(keyword =>
      text.toLowerCase().includes(keyword.toLowerCase())
  );
};

/**
 * 도박 관련 키워드 검출 및 퍼센트 계산 함수
 * */
export const calculateGamblingPercent = (content: string) => {
  if (!content) return 0;

  // 텍스트에서 도박 키워드 > detectedWords 배열에 저장
  const detectedWords = content.split(/\s+/).filter(word =>
      GAMBLING_KEYWORDS.some(keyword =>
          word.toLowerCase().includes(keyword.toLowerCase())
      )
  );

  // 전체 단어 수
  const totalWords = content.split(/\s+/).length;

  // 검출된 도박 키워드가 없으면 0 반환
  const basePercent = Math.min(
      (detectedWords.length / totalWords) * DETECTION_SETTINGS.MULTIPLIER,
      DETECTION_SETTINGS.MAX_PERCENT
  );

  return detectedWords.length > 0
      ? Math.max(Math.round(basePercent), DETECTION_SETTINGS.MIN_PERCENT)
      : 0;
};
const EXTENSION_IDENTIFIER = 'URL_HISTORY_TRACKER_f7e8d9c6b5a4';

// 이전 컨텐츠를 저장할 변수
let previousContent = '';

// 컨텐츠 변경 감지 함수
// function detectContentChanges() {
//     const currentContent = document.body.innerText;
//
//     if (currentContent !== previousContent) {
//         previousContent = currentContent;
//
//         // PWA로 변경된 컨텐츠 전송
//         window.postMessage({
//             type: "CONTENT_CHANGED",
//             source: EXTENSION_IDENTIFIER,
//             data: {
//                 url: window.location.href,
//                 title: document.title,
//                 content: currentContent
//             }
//         }, "*");
//     }
// }

// // DOM 변경 감지를 위한 MutationObserver 설정
// const observer = new MutationObserver(() => {
//     detectContentChanges();
// });
//
// // Observer 시작
// observer.observe(document.body, {
//     childList: true,
//     subtree: true,
//     characterData: true
// });

// 기존 이벤트 리스너
window.addEventListener("message", (event) => {
  if (event.data.type === "REQUEST_URLS_AND_CONTENT" &&
      event.data.identifier === EXTENSION_IDENTIFIER) {
    chrome.runtime.sendMessage({type: "REQUEST_TABS_DATA"});
  }

  if (event.data.type === "SHARE" &&
      event.data.identifier === EXTENSION_IDENTIFIER) {
    chrome.runtime.sendMessage({action: "minimize_window"});
  }

  if (event.data.type === "HHH" &&
      event.data.identifier === EXTENSION_IDENTIFIER) {
    chrome.runtime.sendMessage({type: "HHH"});
  }

  if (event.data.type === "block" &&
      event.data.identifier === EXTENSION_IDENTIFIER) {
    chrome.runtime.sendMessage(
        {type: "block", data: event.data.data, duration: event.data.duration});
  }

  // unblock 리스너 추가
  if (event.data.type === "unblock" &&
      event.data.identifier === EXTENSION_IDENTIFIER) {
    chrome.runtime.sendMessage({
      type: "unblock",
      data: event.data.data
    });
  }

  return true
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "TABS_DATA_RESPONSE" &&
      message.source === EXTENSION_IDENTIFIER) {
    window.postMessage({
      type: "URLS_AND_CONTENT_FROM_EXTENSION",
      source: EXTENSION_IDENTIFIER,
      data: message.data
    }, "*");
  }

  if (message.type === "HHH" &&
      message.source === EXTENSION_IDENTIFIER) {
    window.postMessage({
      type: "HHH",
      source: EXTENSION_IDENTIFIER,
      data: message
    }, "*");
  }

  if (message.type === "block" &&
      message.source === EXTENSION_IDENTIFIER) {
    console.log(message);
  }

  // unblock 응답 리스너 추가
  if (message.type === "unblock" &&
      message.source === EXTENSION_IDENTIFIER) {
    window.postMessage({
      type: "unblock",
      source: EXTENSION_IDENTIFIER,
      data: message.data
    }, "*");
  }

  return true
});

function createPromptOverlay() {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 999999;
  `;

  const promptBox = document.createElement('div');
  promptBox.style.cssText = `
    background: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    text-align: center;
  `;

  const input = document.createElement('input');
  input.type = 'password';
  input.placeholder = '비밀번호를 입력하세요';
  input.style.cssText = `
    margin: 10px 0;
    padding: 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
    width: 200px;
  `;

  const button = document.createElement('button');
  button.textContent = '차단 해제';
  button.style.cssText = `
    background: #4CAF50;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    margin-left: 10px;
  `;

  button.onclick = async () => {
    const response = await chrome.runtime.sendMessage({
      type: "checkPassword",
      password: input.value
    });

    if (response.success) {
      overlay.remove();
      location.reload(); // 페이지 새로고침
    } else {
      alert('잘못된 비밀번호입니다.');
      input.value = '';
    }
  };

  input.onkeyup = (e) => {
    if (e.key === 'Enter') {
      button.click();
    }
  };

  promptBox.appendChild(input);
  promptBox.appendChild(button);
  overlay.appendChild(promptBox);
  document.body.appendChild(overlay);
}

document.addEventListener('DOMContentLoaded', () => {
  // ERR_BLOCKED_BY_CLIENT 메시지가 있거나 차단 페이지인 경우 프롬프트 표시
  const bodyText = document.body.textContent.toString();
  if (bodyText.includes('ERR_BLOCKED_BY_CLIENT')) {
    console.log('차단된 페이지 감지:', document.body);
    createPromptOverlay();
  }
});

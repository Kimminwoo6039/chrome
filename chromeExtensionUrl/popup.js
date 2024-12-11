const EXTENSION_IDENTIFIER = 'UURL_TRACC232';
const channel = new BroadcastChannel('url_channel');

document.getElementById('blockForm').addEventListener('submit',
    function (event) {
      event.preventDefault();

      const url = document.getElementById('url').value;
      const duration = parseInt(document.getElementById('duration').value);

      chrome.runtime.sendMessage({
        type: "block",
        data: url,
        duration: duration,
        identifier: "your_extension_identifier"
      });

      window.close();
    });

// 탭 컨텐츠 가져오기 함수
async function getTabContent(tab) {
  try {
    const results = await chrome.scripting.executeScript({
      target: {tabId: tab.id},
      function: () => {
        const text = document.body.innerText;
        const words = text.split(/\s+/).slice(0, 100000);
        return words.join(' ');
      }
    });

    if (results && results[0] && results[0].result) {
      return results[0].result;
    }
    return '내용을 가져올 수 없습니다';
  } catch (error) {
    console.error('탭 내용 가져오기 오류:', error);
    return '내용을 가져올 수 없습니다';
  }
}

// URL과 컨텐츠 정보를 PWA로 전송하는 함수
function sendUrlsAndContentToPWA(data) {
  try {
    channel.postMessage({
      type: 'URLS_AND_CONTENT_FROM_EXTENSION',
      data: data,
      source: EXTENSION_IDENTIFIER
    });
  } catch (error) {
    console.error('PWA로 데이터 전송 실패:', error);
  }
}

// 활성화된 탭의 정보 수집 함수
async function collectTabsData() {
  try {
    // 현재 활성화된 탭 정보 수집
    const tabs = await chrome.tabs.query({active: true});
    const tabsData = [];

    for (const tab of tabs) {
      const content = await getTabContent(tab);
      tabsData.push({
        url: tab.url,
        title: tab.title,
        content: content
      });
    }

    return tabsData;
  } catch (error) {
    console.error('탭 데이터 수집 실패:', error);
    return [];
  }
}

// 다운로드 기능
async function downloadTabsContent() {
  try {
    const tabsData = await collectTabsData();
    let allContent = tabsData.map(tab =>
        `URL: ${tab.url}\n\n내용:\n${tab.content}\n\n---\n\n`
    ).join('');

    const blob = new Blob([allContent], {type: 'text/plain'});
    const url = URL.createObjectURL(blob);

    const downloadId = await chrome.downloads.download({
      url: url,
      filename: 'tabs_content.txt',
      saveAs: true
    });

    console.log('다운로드 시작됨. ID:', downloadId);
  } catch (error) {
    console.error('다운로드 실패:', error);
  }
}

// UI 업데이트 함수
function updateUI(tabs) {
  const urlList = document.getElementById('urlList');
  const contentArea = document.getElementById('contentArea');

  urlList.innerHTML = '';
  contentArea.innerHTML = '';

  tabs.forEach(tab => {
    // URL 리스트 업데이트
    const li = document.createElement('li');
    li.textContent = tab.url;
    urlList.appendChild(li);

    // 컨텐츠 영역 업데이트
    const contentDiv = document.createElement('div');
    contentDiv.innerHTML = `<h3>${tab.url}</h3><p>${tab.content}</p>`;
    contentArea.appendChild(contentDiv);
  });
}

// 초기화 및 이벤트 리스너 설정
document.addEventListener('DOMContentLoaded', async () => {
  console.log("팝업 스크립트가 로드되었습니다.");

  // UI 요소 초기화
  const downloadBtn = document.getElementById('downloadBtn');
  if (downloadBtn) {
    downloadBtn.addEventListener('click', downloadTabsContent);
  }

  // PWA로부터의 메시지 처리
  channel.onmessage = async (event) => {
    if (event.data.type === 'REQUEST_URLS_AND_CONTENT') {
      const tabsData = await collectTabsData();
      sendUrlsAndContentToPWA(tabsData);
      updateUI(tabsData);
    }
  };

  // 초기 데이터 수집 및 UI 업데이트
  const initialTabsData = await collectTabsData();
  updateUI(initialTabsData);
  sendUrlsAndContentToPWA(initialTabsData);
});
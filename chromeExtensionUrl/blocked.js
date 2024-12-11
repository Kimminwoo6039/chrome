// blocked.js
document.getElementById('unlock').addEventListener('click', async () => {
  try {
    const password = document.getElementById('password').value;

    // Promise를 반환하도록 수정
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({
        type: "checkPassword",
        password: password
      }, (response) => {
        resolve(response || {success: false, error: 'No response'});
      });
    });

    if (response.success) {

    }

  } catch (error) {
    console.error('Error:', error);
    alert('오류가 발생했습니다.');
  }
});

document.getElementById('password').addEventListener('keyup', (e) => {
  if (e.key === 'Enter') {
    document.getElementById('unlock').click();
  }
});

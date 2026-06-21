function updateStats() {
  chrome.runtime.sendMessage({ action: 'GET_STATS' }, (response) => {
    if (chrome.runtime.lastError || !response) {
      console.error(chrome.runtime.lastError);
      return;
    }

    const { isConnected, totalNetwork, totalConsole } = response;

    const statusIndicator = document.getElementById('statusIndicator');
    const statusText = document.getElementById('statusText');
    const reconnectBtn = document.getElementById('reconnectBtn');
    const networkCount = document.getElementById('networkCount');
    const consoleCount = document.getElementById('consoleCount');

    if (isConnected) {
      statusIndicator.style.display = 'flex';
      reconnectBtn.style.display = 'none';
      statusIndicator.className = 'status-badge';
      statusText.textContent = 'Connected';
    } else {
      statusIndicator.style.display = 'none';
      reconnectBtn.style.display = 'block';
    }

    networkCount.textContent = totalNetwork || 0;
    consoleCount.textContent = totalConsole || 0;
  });
}

document.addEventListener('DOMContentLoaded', () => {
  updateStats();
  
  // Refresh stats every second while popup is open
  setInterval(updateStats, 1000);

  document.getElementById('refreshBtn').addEventListener('click', (e) => {
    e.preventDefault();
    updateStats();
  });

  document.getElementById('manageExtensionBtn').addEventListener('click', () => {
    chrome.tabs.create({ url: 'chrome://extensions/?id=' + chrome.runtime.id });
  });

  document.getElementById('reconnectBtn').addEventListener('click', () => {
    const btn = document.getElementById('reconnectBtn');
    btn.textContent = 'Connecting...';
    chrome.runtime.sendMessage({ action: 'RECONNECT' }, () => {
      setTimeout(() => {
        btn.textContent = 'Connect Again';
        updateStats();
      }, 500);
    });
  });

  document.getElementById('selectElementBtn').addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.runtime.sendMessage({ action: 'START_SELECTION', tabId: tabs[0].id }, () => {
          window.close();
        });
      }
    });
  });
});

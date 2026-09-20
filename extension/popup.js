// Candidate profile preset for 1-click autofill
const CANDIDATE_ACTIONS = [
  // Legal & First/Last Names
  { selector: 'input[id="cntryFields.legalFirstName"]', value: 'Om', action: 'type' },
  { selector: 'input[id="cntryFields.firstName"]', value: 'Om', action: 'type' },
  { selector: 'input[name="firstName"]', value: 'Om', action: 'type' },
  { selector: 'input[id*="firstName" i]', value: 'Om', action: 'type' },
  { selector: 'input[id="cntryFields.legalLastName"]', value: 'Salunke', action: 'type' },
  { selector: 'input[id="cntryFields.lastName"]', value: 'Salunke', action: 'type' },
  { selector: 'input[name="lastName"]', value: 'Salunke', action: 'type' },
  { selector: 'input[id*="lastName" i]', value: 'Salunke', action: 'type' },
  // Email & Phone
  { selector: 'input[id="personalInformation.email"]', value: 'salunkeom474@gmail.com', action: 'type' },
  { selector: 'input[name="email"]', value: 'salunkeom474@gmail.com', action: 'type' },
  { selector: 'input[type="email"]', value: 'salunkeom474@gmail.com', action: 'type' },
  { selector: 'input[id="phoneWidget.nationalNumber"]', value: '8390471337', action: 'type' },
  { selector: 'input[id="phoneWidget.phoneNumber"]', value: '8390471337', action: 'type' },
  { selector: 'input[type="tel"]', value: '8390471337', action: 'type' },
  { selector: 'input[name*="phone" i]', value: '8390471337', action: 'type' },
  // Address
  { selector: 'input[id="cntryFields.address1"]', value: 'Pune, Maharashtra', action: 'type' },
  { selector: 'input[id="cntryFields.addressLine1"]', value: 'Pune, Maharashtra', action: 'type' },
  { selector: 'input[id="cntryFields.city"]', value: 'Pune', action: 'type' },
  { selector: 'input[name="city"]', value: 'Pune', action: 'type' },
  { selector: 'input[id="cntryFields.postalCode"]', value: '411006', action: 'type' },
  { selector: 'input[name*="postal" i]', value: '411006', action: 'type' },
  { selector: 'select[id="cntryFields.region"]', value: 'IN-MH', action: 'select' },
  { selector: 'select[id="cntryFields.country"]', value: 'IND', action: 'select' },
  { selector: 'select[id="country"]', value: 'IND', action: 'select' },
  // Experience & Education
  { selector: 'input[id="experienceData[0].title"]', value: 'Software Developer Intern', action: 'type' },
  { selector: 'input[id="experienceData[0].company"]', value: 'ADP Private Limited', action: 'type' },
  { selector: 'input[id="experienceData[0].location"]', value: 'Pune, India', action: 'type' },
  { selector: 'select[id="educationData[0].degree"]', value: 'Degree_Bachelors', action: 'select' },
  { selector: 'select[id="educationData[0].fieldOfStudy"]', value: 'Field_Of_Study_Computer Engineering', action: 'select' },
  // Websites
  { selector: 'input[id="websites[0].website"]', value: 'https://linkedin.com/in/om_salunke0852', action: 'type' },
  { selector: 'input[id="websites[1].website"]', value: 'https://github.com/om0852', action: 'type' }
];

let isRecordingPlaywright = false;

function showToast(message, duration = 3000) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.style.display = 'block';
  setTimeout(() => {
    toast.style.display = 'none';
  }, duration);
}

function showCodeDrawer(title, content) {
  const drawer = document.getElementById('codeDrawer');
  const drawerTitle = document.getElementById('drawerTitle');
  const textarea = document.getElementById('drawerText');
  drawerTitle.textContent = title;
  textarea.value = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
  drawer.style.display = 'block';
}

function getActiveTab(callback) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs && tabs[0]) callback(tabs[0]);
  });
}

function updateStats() {
  chrome.runtime.sendMessage({ action: 'GET_STATS' }, (response) => {
    if (chrome.runtime.lastError || !response) return;

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
  setInterval(updateStats, 1000);

  // Check Playwright recording status on active tab
  getActiveTab((tab) => {
    chrome.tabs.sendMessage(tab.id, { action: 'RECORD_FLOW', subAction: 'status' }, (res) => {
      if (res && res.result && res.result.recording) {
        isRecordingPlaywright = true;
        updateRecordingBtnUI();
      }
    });
  });

  function updateRecordingBtnUI() {
    const btn = document.getElementById('recordPlaywrightBtn');
    const text = document.getElementById('recordBtnText');
    const badge = document.getElementById('recordBadge');

    if (isRecordingPlaywright) {
      btn.classList.add('recording');
      text.textContent = '⏹️ Stop & Copy Test';
      badge.textContent = 'Recording';
    } else {
      btn.classList.remove('recording');
      text.textContent = '⏺️ Record Playwright Test';
      badge.textContent = 'Start';
    }
  }

  // 1. 1-Click Profile Autofill
  document.getElementById('autofillBtn').addEventListener('click', () => {
    getActiveTab((tab) => {
      chrome.tabs.sendMessage(tab.id, { action: 'BATCH_FILL_FORM', actions: CANDIDATE_ACTIONS }, (response) => {
        if (chrome.runtime.lastError) {
          showToast('Error: Make sure page is fully loaded.');
          return;
        }
        if (response && response.result) {
          const { succeeded, total } = response.result;
          showToast(`✔ Autofilled ${succeeded} candidate fields!`);
        } else if (response && response.error) {
          showToast(`Error: ${response.error}`);
        }
      });
    });
  });

  // 2. Playwright Test Recording Toggle
  document.getElementById('recordPlaywrightBtn').addEventListener('click', () => {
    getActiveTab((tab) => {
      if (!isRecordingPlaywright) {
        // Start recording
        chrome.tabs.sendMessage(tab.id, { action: 'RECORD_FLOW', subAction: 'start' }, (res) => {
          isRecordingPlaywright = true;
          updateRecordingBtnUI();
          showToast('⏺️ Recording started! Click around in your tab.');
        });
      } else {
        // Stop recording and compile test
        chrome.tabs.sendMessage(tab.id, { action: 'RECORD_FLOW', subAction: 'stop' }, (res) => {
          isRecordingPlaywright = false;
          updateRecordingBtnUI();
          if (res && res.result) {
            const script = res.result.testScript || res.result;
            navigator.clipboard.writeText(script).then(() => {
              showToast('✔ Playwright test copied to clipboard!');
            });
            showCodeDrawer('Playwright Test Script (.spec.ts):', script);
          }
        });
      }
    });
  });

  // 3. Scrape Table / Grid to JSON
  document.getElementById('scrapeTableBtn').addEventListener('click', () => {
    getActiveTab((tab) => {
      chrome.tabs.sendMessage(tab.id, { action: 'EXTRACT_STRUCTURED_DATA', type: 'auto' }, (res) => {
        if (chrome.runtime.lastError || !res) {
          showToast('No table or structured data found on page.');
          return;
        }
        if (res.result && res.result.data) {
          const jsonStr = JSON.stringify(res.result.data, null, 2);
          navigator.clipboard.writeText(jsonStr).then(() => {
            showToast(`✔ Scraped ${res.result.count} rows & copied to clipboard!`);
          });
          showCodeDrawer(`Scraped Structured Data (${res.result.count} items):`, jsonStr);
        } else {
          showToast('Could not find structured table or card list.');
        }
      });
    });
  });

  // 4. Toggle Layout Debugger
  document.getElementById('toggleLayoutBtn').addEventListener('click', () => {
    getActiveTab((tab) => {
      chrome.tabs.sendMessage(tab.id, { action: 'TOGGLE_LAYOUT_DEBUG' }, (res) => {
        if (res && res.result) {
          showToast('✔ ' + res.result);
        }
      });
    });
  });

  // 5. Inspect Element for AI
  document.getElementById('selectElementBtn').addEventListener('click', () => {
    getActiveTab((tab) => {
      chrome.runtime.sendMessage({ action: 'START_SELECTION', tabId: tab.id }, () => {
        window.close();
      });
    });
  });

  // Drawer Actions
  document.getElementById('copyDrawerBtn').addEventListener('click', () => {
    const text = document.getElementById('drawerText').value;
    navigator.clipboard.writeText(text).then(() => {
      showToast('✔ Copied to clipboard!');
    });
  });

  document.getElementById('closeDrawerBtn').addEventListener('click', () => {
    document.getElementById('codeDrawer').style.display = 'none';
  });

  // Utilities
  document.getElementById('refreshBtn').addEventListener('click', (e) => {
    e.preventDefault();
    updateStats();
    showToast('Stats refreshed.');
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

  document.getElementById('manageExtensionBtn').addEventListener('click', () => {
    chrome.tabs.create({ url: 'chrome://extensions/?id=' + chrome.runtime.id });
  });
});

// Listen for intercepted console logs
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data && event.data.type === 'DEVPILOT_CONSOLE_LOG') {
    chrome.runtime.sendMessage({
      type: 'CONSOLE_LOG',
      data: { level: event.data.level, text: event.data.text, timestamp: event.data.timestamp }
    });
  }
});

// Respond to IDE Bridge requests
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'GET_DOM') {
    try {
      const html = document.documentElement.outerHTML;
      sendResponse({ result: html });
    } catch (e) {
      sendResponse({ error: e.message });
    }
    return true;
  }

  if (request.action === 'GET_CLEAN_DOM') {
    try {
      const clone = document.documentElement.cloneNode(true);
      
      // Remove noisy tags
      const removeTags = ['script', 'style', 'svg', 'iframe', 'noscript', 'path'];
      removeTags.forEach(tag => {
        clone.querySelectorAll(tag).forEach(el => el.remove());
      });

      // Remove bloated attributes
      const allElements = clone.querySelectorAll('*');
      allElements.forEach(el => {
        el.removeAttribute('class');
        el.removeAttribute('style');
        // Keep id, name, href, type, placeholder, value, etc.
      });

      sendResponse({ result: clone.outerHTML });
    } catch (e) {
      sendResponse({ error: e.message });
    }
    return true;
  }

  if (request.action === 'HIGHLIGHT_ELEMENT') {
    try {
      const el = document.querySelector(request.selector);
      if (el) {
        // Apply styling
        el.style.outline = '4px solid #FF5733';
        el.style.backgroundColor = 'rgba(255, 87, 51, 0.2)';
        el.style.transition = 'all 0.3s ease-in-out';
        
        // Scroll into view
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        sendResponse({ result: `Element ${request.selector} successfully highlighted.` });
      } else {
        sendResponse({ error: `Element with selector '${request.selector}' not found.` });
      }
    } catch (e) {
      sendResponse({ error: e.message });
    }
    return true;
  }
  
  if (request.action === 'WAIT_FOR_CLICK') {
    let hoveredElement = null;

    const cleanup = () => {
      document.removeEventListener('mouseover', handleMouseOver, true);
      document.removeEventListener('click', handleClick, true);
      if (hoveredElement) {
        hoveredElement.style.outline = hoveredElement.dataset.oldOutline || '';
        hoveredElement.style.backgroundColor = hoveredElement.dataset.oldBg || '';
      }
    };

    const handleMouseOver = (e) => {
      e.stopPropagation();
      if (hoveredElement) {
        hoveredElement.style.outline = hoveredElement.dataset.oldOutline || '';
        hoveredElement.style.backgroundColor = hoveredElement.dataset.oldBg || '';
      }
      hoveredElement = e.target;
      hoveredElement.dataset.oldOutline = hoveredElement.style.outline;
      hoveredElement.dataset.oldBg = hoveredElement.style.backgroundColor;
      
      hoveredElement.style.outline = '3px solid #3b82f6';
      hoveredElement.style.backgroundColor = 'rgba(59, 130, 246, 0.2)';
    };

    const handleClick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      clearTimeout(timeoutId);
      cleanup();
      
      const originalClasses = e.target.className || '';
      
      // Extract inline events (like onclick=)
      const inlineEvents = {};
      Array.from(e.target.attributes || []).forEach(attr => {
        if (attr.name.startsWith('on')) {
          inlineEvents[attr.name] = attr.value;
        }
      });

      // Extract important computed styles
      const computed = window.getComputedStyle(e.target);
      const importantStyles = [
        'display', 'position', 'width', 'height', 'margin', 'padding', 'box-sizing',
        'background-color', 'background-image', 'background',
        'color', 'font-family', 'font-size', 'font-weight', 'line-height', 'text-align',
        'border', 'border-radius', 'box-shadow', 'opacity',
        'transform', 'transition', 'animation',
        'flex-direction', 'justify-content', 'align-items', 'gap',
        'grid-template-columns', 'grid-template-rows',
        'z-index', 'cursor'
      ];
      
      const computedStyles = {};
      importantStyles.forEach(prop => {
        const val = computed.getPropertyValue(prop);
        if (val && val !== 'none' && val !== 'normal' && val !== '0px' && val !== 'rgba(0, 0, 0, 0)' && val !== 'auto' && val !== '0s') {
          computedStyles[prop] = val;
        }
      });
      // Always include some basics so we know the core layout
      ['display', 'position', 'width', 'height', 'font-family', 'font-size', 'color', 'background-color'].forEach(prop => {
        computedStyles[prop] = computed.getPropertyValue(prop);
      });

      const clone = e.target.cloneNode(true);
      
      const removeTags = ['script', 'style', 'svg', 'iframe', 'noscript', 'path'];
      removeTags.forEach(tag => {
        clone.querySelectorAll(tag).forEach(el => el.remove());
      });

      const allElements = clone.querySelectorAll('*');
      allElements.forEach(el => {
        el.removeAttribute('class');
        el.removeAttribute('style');
      });
      clone.removeAttribute('class');
      clone.removeAttribute('style');

      const payload = {
        html: clone.outerHTML,
        originalClasses: typeof originalClasses === 'string' ? originalClasses : (originalClasses.baseVal || ''),
        computedStyles,
        inlineEvents
      };

      sendResponse({ result: JSON.stringify(payload) });
    };

    const timeoutId = setTimeout(() => {
      cleanup();
      sendResponse({ error: 'Timeout waiting for user click' });
    }, 59000);

    document.addEventListener('mouseover', handleMouseOver, true);
    document.addEventListener('click', handleClick, true);

    return true;
  }
  
  if (request.action === 'CLICK_ELEMENT') {
    try {
      const el = document.querySelector(request.selector);
      if (el) {
        el.click();
        sendResponse({ result: `Element ${request.selector} clicked successfully.` });
      } else {
        sendResponse({ error: `Element not found: ${request.selector}` });
      }
    } catch (e) {
      sendResponse({ error: e.message });
    }
    return true;
  }

  if (request.action === 'TYPE_TEXT') {
    try {
      const el = document.querySelector(request.selector);
      if (el) {
        el.focus();
        el.value = request.text;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        sendResponse({ result: `Typed text into ${request.selector}` });
      } else {
        sendResponse({ error: `Element not found: ${request.selector}` });
      }
    } catch (e) {
      sendResponse({ error: e.message });
    }
    return true;
  }

  if (request.action === 'MOCK_NETWORK_RESPONSE') {
    window.postMessage({
      type: 'DEVPILOT_ADD_MOCK',
      mock: {
        urlPattern: request.urlPattern,
        responseBody: request.responseBody,
        status: request.status
      }
    }, '*');
    sendResponse({ result: `Mock registered for ${request.urlPattern}` });
    return true;
  }

  if (request.action === 'CLEAR_NETWORK_MOCKS') {
    window.postMessage({ type: 'DEVPILOT_CLEAR_MOCKS' }, '*');
    sendResponse({ result: 'All mocks cleared' });
    return true;
  }
  
  if (request.action === 'INJECT_CSS') {
    try {
      const style = document.createElement('style');
      style.className = 'devpilot-injected-css';
      style.textContent = request.cssString;
      document.head.appendChild(style);
      sendResponse({ result: 'CSS successfully injected.' });
    } catch (e) {
      sendResponse({ error: e.message });
    }
    return true;
  }

  if (request.action === 'TOGGLE_LAYOUT_DEBUG') {
    try {
      const debugId = 'devpilot-layout-debug-style';
      const existing = document.getElementById(debugId);
      if (existing) {
        existing.remove();
        sendResponse({ result: 'Layout debug mode disabled.' });
      } else {
        const style = document.createElement('style');
        style.id = debugId;
        style.textContent = '* { outline: 1px solid rgba(255, 0, 0, 0.5) !important; }';
        document.head.appendChild(style);
        sendResponse({ result: 'Layout debug mode enabled. Elements outlined in red.' });
      }
    } catch (e) {
      sendResponse({ error: e.message });
    }
    return true;
  }
  
  if (request.action === 'GET_WEB_VITALS') {
    try {
      const metrics = { LCP: null, CLS: 0, FCP: null, waterfall: [] };
      
      // Get Core Web Vitals
      const entries = performance.getEntriesByType('paint');
      entries.forEach(entry => {
        if (entry.name === 'first-contentful-paint') {
          metrics.FCP = entry.startTime;
        }
      });

      // Get Network Waterfall (Resource Timings)
      const resources = performance.getEntriesByType('resource');
      metrics.waterfall = resources.map(r => ({
        url: r.name.substring(0, 100) + (r.name.length > 100 ? '...' : ''),
        type: r.initiatorType,
        duration: Math.round(r.duration) + 'ms',
        size: r.transferSize ? Math.round(r.transferSize / 1024) + 'kb' : 'cached/unknown'
      })).filter(r => ['script', 'link', 'css', 'img'].includes(r.type));

      try {
        const observer = new PerformanceObserver((list) => {
          list.getEntries().forEach(entry => {
            if (entry.entryType === 'largest-contentful-paint') {
              metrics.LCP = entry.startTime;
            }
            if (entry.entryType === 'layout-shift' && !entry.hadRecentInput) {
              metrics.CLS += entry.value;
            }
          });
        });
        observer.observe({ type: 'largest-contentful-paint', buffered: true });
        observer.observe({ type: 'layout-shift', buffered: true });
        
        setTimeout(() => {
          observer.disconnect();
          sendResponse({ result: JSON.stringify(metrics) });
        }, 500);
      } catch (e) {
        sendResponse({ result: JSON.stringify({ error: "PerformanceObserver not supported.", metrics }) });
      }
    } catch (e) {
      sendResponse({ error: e.message });
    }
    return true;
  }

  if (request.action === 'RUN_SECURITY_AUDIT') {
    try {
      const issues = [];
      if (window.location.protocol === 'http:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        issues.push({ type: 'High', message: 'Page is served over HTTP instead of HTTPS.' });
      }
      
      const forms = document.querySelectorAll('form');
      forms.forEach(form => {
        if (!form.hasAttribute('action') || form.getAttribute('action').startsWith('http:')) {
          issues.push({ type: 'Medium', message: 'Form found with insecure or missing action attribute.' });
        }
      });

      const pwds = document.querySelectorAll('input[type="password"]');
      pwds.forEach(pwd => {
        if (!pwd.hasAttribute('autocomplete')) {
          issues.push({ type: 'Low', message: 'Password input found without autocomplete attribute.' });
        }
      });

      const checkStorage = (storage, name) => {
        for (let i = 0; i < storage.length; i++) {
          const key = storage.key(i);
          const val = storage.getItem(key);
          if (val && typeof val === 'string' && /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/.test(val)) {
            issues.push({ type: 'High', message: `Potential JWT token found in ${name} [${key}]. Vulnerable to XSS.` });
          }
          if (key.toLowerCase().includes('secret') || key.toLowerCase().includes('password')) {
            issues.push({ type: 'Medium', message: `Potential secret found in ${name} under key: ${key}.` });
          }
        }
      };
      checkStorage(window.localStorage, 'localStorage');
      checkStorage(window.sessionStorage, 'sessionStorage');

      sendResponse({ result: JSON.stringify(issues.length ? issues : [{ type: 'Info', message: 'No obvious security issues found!' }]) });
    } catch (e) {
      sendResponse({ error: e.message });
    }
    return true;
  }

  if (request.action === 'RUN_ACCESSIBILITY_AUDIT') {
    try {
      const issues = [];
      
      const images = document.querySelectorAll('img');
      images.forEach(img => {
        if (!img.hasAttribute('alt')) {
          issues.push({ element: img.outerHTML.substring(0, 100), issue: 'Missing "alt" attribute on image.' });
        }
      });

      const buttons = document.querySelectorAll('button');
      buttons.forEach(btn => {
        const text = btn.innerText || btn.textContent;
        if (!text.trim() && !btn.hasAttribute('aria-label')) {
          issues.push({ element: btn.outerHTML.substring(0, 100), issue: 'Button has no readable text and is missing an "aria-label".' });
        }
      });

      const links = document.querySelectorAll('a');
      links.forEach(a => {
        const text = a.innerText || a.textContent;
        if (!text.trim() && !a.hasAttribute('aria-label')) {
          issues.push({ element: a.outerHTML.substring(0, 100), issue: 'Link has no readable text and is missing an "aria-label".' });
        }
        if (!a.getAttribute('href') || a.getAttribute('href') === '#') {
          issues.push({ element: a.outerHTML.substring(0, 100), issue: 'Link has an empty or "#" href attribute.' });
        }
      });

      const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      let previousLevel = 0;
      headings.forEach(h => {
        const currentLevel = parseInt(h.tagName.substring(1));
        if (previousLevel !== 0 && currentLevel - previousLevel > 1) {
          issues.push({ element: h.tagName, issue: `Heading skipped a level (jumped from H${previousLevel} to H${currentLevel}).` });
        }
        previousLevel = currentLevel;
      });

      const h1s = document.querySelectorAll('h1');
      if (h1s.length === 0) {
        issues.push({ element: 'Page', issue: 'Missing an <h1> heading.' });
      } else if (h1s.length > 1) {
        issues.push({ element: 'Page', issue: 'Multiple <h1> headings found. Best practice is to have exactly one.' });
      }

      sendResponse({ result: JSON.stringify(issues.length ? issues : [{ issue: 'No obvious accessibility issues found! Great job!' }]) });
    } catch (e) {
      sendResponse({ error: e.message });
    }
    return true;
  }

  if (request.action === 'GET_STORAGE') {
    try {
      const storageData = {
        localStorage: { ...window.localStorage },
        sessionStorage: { ...window.sessionStorage },
        cookie: document.cookie
      };
      sendResponse({ result: storageData });
    } catch (e) {
      sendResponse({ error: e.message });
    }
    return true; // Keep message channel open
  }
});

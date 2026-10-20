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

// --- Helper Functions for Resilient DOM Interaction ---

function normalizeSelector(selector) {
  if (!selector) return selector;
  selector = selector.trim();
  
  // If selector is an ID that contains dots, brackets, colons, or slashes
  if (selector.startsWith('#')) {
    const id = selector.slice(1);
    if (id.includes('[') || id.includes('.') || id.includes(':') || id.includes('/') || id.includes('$')) {
      return `[id="${CSS.escape ? CSS.escape(id) : id.replace(/"/g, '\\"')}"]`;
    }
    return selector;
  }

  // If selector is already an attribute selector with '=' (e.g. input[type="text"]), keep it unchanged
  if (selector.includes('=')) {
    return selector;
  }

  // If selector starts with standard CSS prefixes or contains descendant combinators
  if (selector.startsWith('.') || selector.startsWith('[') || selector.startsWith('#') || selector.includes(' ') || selector.includes('>')) {
    return selector;
  }

  // If bare identifier containing dots or array brackets (e.g. "cntryFields.legalFirstName" or "experienceData[0].title")
  if (selector.includes('.') || /\[\d+\]/.test(selector)) {
    return `[id="${CSS.escape ? CSS.escape(selector) : selector.replace(/"/g, '\\"')}"]`;
  }

  return selector;
}

function findElement(selector, root = document) {
  if (!selector) return null;

  // 1. Try direct selector
  try {
    const el = root.querySelector(selector);
    if (el) return el;
  } catch (e) {}

  // 2. Try normalized selector
  const normalized = normalizeSelector(selector);
  if (normalized !== selector) {
    try {
      const el = root.querySelector(normalized);
      if (el) return el;
    } catch (e) {}
  }

  // 3. Try exact ID lookup directly on document
  const cleanId = selector.replace(/^#/, '');
  const byId = document.getElementById(cleanId);
  if (byId) return byId;

  // 4. Try attribute selectors for ID or name
  try {
    const byAttr = root.querySelector(`[id="${cleanId}"], [name="${cleanId}"]`);
    if (byAttr) return byAttr;
  } catch (e) {}

  // 5. Try data-automation-id or data-ph-at-id (Workday & Phenom People identifiers)
  try {
    const byData = root.querySelector(`[data-automation-id="${cleanId}"], [data-ph-at-id="${cleanId}"]`);
    if (byData) return byData;
  } catch (e) {}

  // 6. Resilient Tailwind / special-character class handler (e.g. span.ml-[10px] or button.group-hover:opacity-100)
  if (selector.includes('.') && (selector.includes('[') || selector.includes(':') || selector.includes('/'))) {
    const parts = selector.split('.');
    const tag = parts[0] || '';
    const classes = parts.slice(1);
    try {
      const attrSelector = tag + classes.map(c => `[class*="${c}"]`).join('');
      const byClasses = root.querySelector(attrSelector);
      if (byClasses) return byClasses;
    } catch (e) {}
  }

  return null;
}

function setNativeValue(element, value) {
  const isTextArea = element instanceof HTMLTextAreaElement;
  const isInput = element instanceof HTMLInputElement;
  
  element.focus();

  if (isInput || isTextArea) {
    const proto = isTextArea ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
    if (descriptor && descriptor.set) {
      descriptor.set.call(element, value);
    } else {
      element.value = value;
    }
  } else if (element instanceof HTMLSelectElement) {
    let matched = false;
    for (let i = 0; i < element.options.length; i++) {
      const opt = element.options[i];
      if (opt.value === value || opt.text.trim().toLowerCase() === String(value).trim().toLowerCase()) {
        element.selectedIndex = i;
        element.value = opt.value;
        opt.selected = true;
        matched = true;
        break;
      }
    }
    if (!matched) {
      element.value = value;
    }
  } else {
    element.textContent = value;
  }

  element.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  element.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  element.dispatchEvent(new Event('blur', { bubbles: true, composed: true }));
}

async function waitForElement(selector, timeoutMs = 3000, state = 'visible', root = document) {
  const startTime = Date.now();
  return new Promise((resolve) => {
    const check = () => {
      const el = findElement(selector, root);
      const isAttached = !!el;
      const isVisible = isAttached && (el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0 || window.getComputedStyle(el).display !== 'none');

      if (state === 'attached' && isAttached) return resolve(el);
      if (state === 'visible' && isVisible) return resolve(el);
      if (state === 'detached' && !isAttached) return resolve(true);

      if (Date.now() - startTime >= timeoutMs) {
        return resolve(null);
      }
      setTimeout(check, 100);
    };
    check();
  });
}

// --- MCP Visual Badge & Accessibility Tree Helpers ---

function ensureMcpBadge() {
  if (document.getElementById('xtradevpilot-mcp-badge')) return;
  const badge = document.createElement('div');
  badge.id = 'xtradevpilot-mcp-badge';
  badge.style.cssText = `
    position: fixed;
    top: 12px;
    right: 12px;
    z-index: 2147483647;
    background: linear-gradient(135deg, #1e1e2e, #2d2b55);
    color: #00ffcc;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 11px;
    font-weight: 600;
    padding: 6px 14px;
    border-radius: 20px;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3), 0 0 10px rgba(0, 255, 204, 0.4);
    border: 1px solid rgba(0, 255, 204, 0.5);
    display: flex;
    align-items: center;
    gap: 8px;
    pointer-events: none;
    user-select: none;
    transition: all 0.3s ease;
  `;
  badge.innerHTML = `
    <span style="width: 8px; height: 8px; background: #00ffcc; border-radius: 50%; display: inline-block; box-shadow: 0 0 8px #00ffcc; animation: devpilot-pulse 1.5s infinite;"></span>
    <span>⚡ Controlled by XtraDevPilot MCP</span>
  `;
  
  if (!document.getElementById('xtradevpilot-badge-style')) {
    const style = document.createElement('style');
    style.id = 'xtradevpilot-badge-style';
    style.textContent = `
      @keyframes devpilot-pulse {
        0% { transform: scale(0.95); opacity: 0.8; }
        50% { transform: scale(1.25); opacity: 1; }
        100% { transform: scale(0.95); opacity: 0.8; }
      }
      .xtradevpilot-interaction-ring {
        outline: 3px solid #ff007f !important;
        outline-offset: 2px !important;
        box-shadow: 0 0 15px rgba(255, 0, 127, 0.8) !important;
        transition: outline 0.2s ease, box-shadow 0.2s ease !important;
      }
    `;
    document.head.appendChild(style);
  }
  document.body.appendChild(badge);
}

function flashInteractionHighlight(element) {
  if (!element || !element.classList) return;
  ensureMcpBadge();
  element.classList.add('xtradevpilot-interaction-ring');
  setTimeout(() => {
    try { element.classList.remove('xtradevpilot-interaction-ring'); } catch(e){}
  }, 1200);
}

function buildAccessibilityTree(element = document.body, depth = 0) {
  if (!element || depth > 5) return null;
  const tag = element.tagName ? element.tagName.toLowerCase() : '';
  if (['script', 'style', 'svg', 'noscript', 'iframe'].includes(tag)) return null;

  const role = element.getAttribute('role') || tag;
  const label = element.getAttribute('aria-label') || element.getAttribute('placeholder') || element.title || (element.innerText ? element.innerText.slice(0, 30).trim() : '');
  const id = element.id ? `#${element.id}` : '';
  const isInteractive = ['button', 'input', 'select', 'textarea', 'a'].includes(tag) || element.hasAttribute('onclick') || element.hasAttribute('role');

  let children = [];
  if (element.children) {
    for (const child of Array.from(element.children)) {
      const childTree = buildAccessibilityTree(child, depth + 1);
      if (childTree) children.push(childTree);
    }
  }

  if (!isInteractive && children.length === 0 && !label) return null;

  return {
    node: `${tag}${id}`,
    role,
    label: label || undefined,
    value: element.value || undefined,
    children: children.length > 0 ? children : undefined
  };
}

// --- Mouse Controller Helper ---
function simulateMouseAction(options = {}) {
  ensureMcpBadge();
  const { action = 'click', x, y, selector, button = 'left', deltaX = 0, deltaY = 0 } = options;
  let targetEl = selector ? findElement(selector) : null;
  let clientX = x;
  let clientY = y;

  if (!targetEl && (x !== undefined && y !== undefined)) {
    targetEl = document.elementFromPoint(x, y) || document.body;
  } else if (targetEl && (x === undefined || y === undefined)) {
    const rect = targetEl.getBoundingClientRect();
    clientX = rect.left + rect.width / 2;
    clientY = rect.top + rect.height / 2;
  }

  if (!targetEl) targetEl = document.body;

  flashInteractionHighlight(targetEl);

  const buttonMap = { left: 0, middle: 1, right: 2 };
  const buttonCode = buttonMap[button] !== undefined ? buttonMap[button] : 0;
  const eventInit = {
    clientX: clientX || 100,
    clientY: clientY || 100,
    screenX: clientX || 100,
    screenY: clientY || 100,
    button: buttonCode,
    buttons: buttonCode === 0 ? 1 : (buttonCode === 2 ? 2 : 4),
    bubbles: true,
    cancelable: true,
    composed: true,
    view: window
  };

  if (action === 'move') {
    targetEl.dispatchEvent(new MouseEvent('mousemove', eventInit));
    targetEl.dispatchEvent(new PointerEvent('pointermove', eventInit));
    return { status: 'moved', x: clientX, y: clientY, target: targetEl.tagName };
  }

  if (action === 'click') {
    targetEl.dispatchEvent(new MouseEvent('mousedown', eventInit));
    targetEl.dispatchEvent(new MouseEvent('mouseup', eventInit));
    targetEl.dispatchEvent(new MouseEvent('click', eventInit));
    if (button === 'right') {
      targetEl.dispatchEvent(new MouseEvent('contextmenu', eventInit));
    }
    return { status: 'clicked', button, x: clientX, y: clientY, target: targetEl.tagName };
  }

  if (action === 'dblclick') {
    targetEl.dispatchEvent(new MouseEvent('mousedown', eventInit));
    targetEl.dispatchEvent(new MouseEvent('mouseup', eventInit));
    targetEl.dispatchEvent(new MouseEvent('click', eventInit));
    targetEl.dispatchEvent(new MouseEvent('mousedown', eventInit));
    targetEl.dispatchEvent(new MouseEvent('mouseup', eventInit));
    targetEl.dispatchEvent(new MouseEvent('click', eventInit));
    targetEl.dispatchEvent(new MouseEvent('dblclick', eventInit));
    return { status: 'double_clicked', x: clientX, y: clientY, target: targetEl.tagName };
  }

  if (action === 'drag') {
    const { endX = clientX + 100, endY = clientY + 100, steps = 10 } = options;
    targetEl.dispatchEvent(new MouseEvent('mousedown', eventInit));
    
    for (let i = 1; i <= steps; i++) {
      const curX = clientX + (endX - clientX) * (i / steps);
      const curY = clientY + (endY - clientY) * (i / steps);
      const stepInit = { ...eventInit, clientX: curX, clientY: curY, screenX: curX, screenY: curY };
      targetEl.dispatchEvent(new MouseEvent('mousemove', stepInit));
    }
    
    const dropTarget = document.elementFromPoint(endX, endY) || targetEl;
    const finalInit = { ...eventInit, clientX: endX, clientY: endY, screenX: endX, screenY: endY };
    dropTarget.dispatchEvent(new MouseEvent('mouseup', finalInit));
    return { status: 'dragged', start: { x: clientX, y: clientY }, end: { x: endX, y: endY } };
  }

  if (action === 'scroll') {
    targetEl.dispatchEvent(new WheelEvent('wheel', {
      clientX, clientY, deltaX, deltaY, bubbles: true, cancelable: true, view: window
    }));
    return { status: 'scrolled', deltaX, deltaY };
  }

  return { status: 'executed', action };
}

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
      let targetRoot = document.documentElement;
      if (request.rootSelector) {
        const customRoot = findElement(request.rootSelector);
        if (customRoot) {
          targetRoot = customRoot;
        }
      }
      const clone = targetRoot.cloneNode(true);
      
      // Remove noisy tags
      const removeTags = ['script', 'style', 'svg', 'iframe', 'noscript', 'path'];
      removeTags.forEach(tag => {
        clone.querySelectorAll(tag).forEach(el => el.remove());
      });

      // Keep crucial automation attributes while stripping styles and noisy classes
      const allElements = clone.querySelectorAll('*');
      const keepAttributes = [
        'id', 'name', 'type', 'value', 'placeholder', 'href', 'role',
        'aria-label', 'aria-describedby', 'data-ph-at-id', 'data-automation-id',
        'for', 'checked', 'selected', 'disabled', 'required'
      ];
      allElements.forEach(el => {
        const attrs = Array.from(el.attributes || []);
        attrs.forEach(attr => {
          if (!keepAttributes.includes(attr.name) && !attr.name.startsWith('data-')) {
            el.removeAttribute(attr.name);
          }
        });
      });

      sendResponse({ result: clone.outerHTML });
    } catch (e) {
      sendResponse({ error: e.message });
    }
    return true;
  }

  if (request.action === 'DOWNLOAD_PAGE_HTML') {
    try {
      let html = '';
      let selectorUsed = null;
      if (request.selector) {
        const el = findElement(request.selector);
        if (!el) {
          sendResponse({ error: `Element with selector '${request.selector}' not found.` });
          return true;
        }
        selectorUsed = request.selector;
        if (request.clean) {
          const clone = el.cloneNode(true);
          const removeTags = ['script', 'style', 'svg', 'iframe', 'noscript', 'path'];
          removeTags.forEach(tag => {
            clone.querySelectorAll(tag).forEach(item => item.remove());
          });
          html = clone.outerHTML;
        } else {
          html = el.outerHTML;
        }
      } else {
        const doctype = document.doctype ? new XMLSerializer().serializeToString(document.doctype) + '\n' : '<!DOCTYPE html>\n';
        if (request.clean) {
          const clone = document.documentElement.cloneNode(true);
          const removeTags = ['script', 'style', 'svg', 'iframe', 'noscript', 'path'];
          removeTags.forEach(tag => {
            clone.querySelectorAll(tag).forEach(item => item.remove());
          });
          html = doctype + clone.outerHTML;
        } else {
          html = doctype + document.documentElement.outerHTML;
        }
      }

      sendResponse({
        result: {
          html,
          title: document.title || 'Page',
          url: window.location.href,
          selector: selectorUsed,
          length: html.length
        }
      });
    } catch (e) {
      sendResponse({ error: `Download page HTML error: ${e.message}` });
    }
    return true;
  }

  if (request.action === 'COLLECT_SOURCE_URLS') {
    try {
      const scopeRoot = request.selector ? (findElement(request.selector) || document) : document;
      const baseUrl = window.location.href;

      // 1. Collect script URLs and inline scripts
      const scriptUrls = new Set();
      const inlineScripts = [];
      scopeRoot.querySelectorAll('script').forEach((s, idx) => {
        if (s.src) {
          try { scriptUrls.add(new URL(s.src, baseUrl).href); } catch (e) {}
        } else if (s.textContent && s.textContent.trim().length > 0) {
          inlineScripts.push({
            name: `inline-script-${idx + 1}.js`,
            content: s.textContent
          });
        }
      });

      // 2. Collect stylesheets and inline styles
      const styleUrls = new Set();
      const inlineStyles = [];
      scopeRoot.querySelectorAll('link[rel="stylesheet"], link[rel="preload"][as="style"]').forEach(l => {
        if (l.href) {
          try { styleUrls.add(new URL(l.href, baseUrl).href); } catch (e) {}
        }
      });
      scopeRoot.querySelectorAll('style').forEach((s, idx) => {
        if (s.textContent && s.textContent.trim().length > 0) {
          inlineStyles.push({
            name: `inline-style-${idx + 1}.css`,
            content: s.textContent
          });
        }
      });

      // 3. Collect images and inline SVGs
      const imageUrls = new Set();
      const inlineSvgs = [];
      scopeRoot.querySelectorAll('img').forEach(img => {
        const src = img.currentSrc || img.src || img.getAttribute('src');
        if (src && !src.startsWith('data:')) {
          try { imageUrls.add(new URL(src, baseUrl).href); } catch (e) {}
        }
      });
      scopeRoot.querySelectorAll('link[rel*="icon"]').forEach(l => {
        if (l.href && !l.href.startsWith('data:')) {
          try { imageUrls.add(new URL(l.href, baseUrl).href); } catch (e) {}
        }
      });
      scopeRoot.querySelectorAll('svg').forEach((svg, idx) => {
        if (svg.outerHTML && svg.outerHTML.length < 50000) {
          inlineSvgs.push({
            name: `inline-icon-${idx + 1}.svg`,
            content: svg.outerHTML
          });
        }
      });

      // 4. Collect font URLs
      const fontUrls = new Set();
      scopeRoot.querySelectorAll('link[rel="preload"][as="font"]').forEach(l => {
        if (l.href) {
          try { fontUrls.add(new URL(l.href, baseUrl).href); } catch (e) {}
        }
      });

      // 5. Query Resource Timing API for loaded assets (when not restricted to selector)
      if (!request.selector && window.performance && window.performance.getEntriesByType) {
        const resources = window.performance.getEntriesByType('resource');
        for (const res of resources) {
          const name = res.name;
          if (!name || name.startsWith('data:') || name.startsWith('blob:')) continue;
          try {
            const urlObj = new URL(name, baseUrl);
            const pathname = urlObj.pathname.toLowerCase();
            const initiator = res.initiatorType;
            if (initiator === 'script' || pathname.endsWith('.js') || pathname.endsWith('.mjs')) {
              scriptUrls.add(urlObj.href);
            } else if (initiator === 'css' || initiator === 'link' || pathname.endsWith('.css')) {
              styleUrls.add(urlObj.href);
            } else if (initiator === 'img' || /\.(png|jpe?g|gif|webp|ico|svg|avif)$/i.test(pathname)) {
              imageUrls.add(urlObj.href);
            } else if (initiator === 'font' || /\.(woff2?|ttf|otf|eot)$/i.test(pathname)) {
              fontUrls.add(urlObj.href);
            }
          } catch (e) {}
        }
      }

      sendResponse({
        result: {
          baseUrl,
          scripts: Array.from(scriptUrls),
          inlineScripts,
          styles: Array.from(styleUrls),
          inlineStyles,
          images: Array.from(imageUrls),
          inlineSvgs,
          fonts: Array.from(fontUrls)
        }
      });
    } catch (e) {
      sendResponse({ error: `Collect source URLs error: ${e.message}` });
    }
    return true;
  }

  if (request.action === 'GET_AX_TREE') {
    try {
      ensureMcpBadge();
      const axTree = buildAccessibilityTree(document.body);
      sendResponse({ result: axTree });
    } catch (e) {
      sendResponse({ error: e.message });
    }
    return true;
  }

  if (request.action === 'BATCH_EXECUTE') {
    (async () => {
      try {
        ensureMcpBadge();
        const actions = request.actions || [];
        const results = [];
        for (const item of actions) {
          const sel = item.selector ? findElement(item.selector) : null;
          if (sel) {
            flashInteractionHighlight(sel);
            if (item.action === 'CLICK_ELEMENT') {
              sel.click();
              results.push(`Clicked ${item.selector}`);
            } else if (item.action === 'TYPE_TEXT') {
              setNativeValue(sel, item.text || '');
              results.push(`Typed into ${item.selector}`);
            }
          }
        }
        sendResponse({ result: results });
      } catch (e) {
        sendResponse({ error: e.message });
      }
    })();
    return true;
  }

  if (request.action === 'HIGHLIGHT_ELEMENT') {
    try {
      const el = findElement(request.selector);
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
    (async () => {
      try {
        const timeoutMs = request.timeoutMs !== undefined ? request.timeoutMs : 3000;
        let el = findElement(request.selector);
        if (!el && timeoutMs > 0) {
          el = await waitForElement(request.selector, timeoutMs, 'visible');
        }
        if (el) {
          flashInteractionHighlight(el);
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.click();
          sendResponse({ result: `Element ${request.selector} clicked successfully.` });
        } else {
          sendResponse({ error: `Element not found: ${request.selector}` });
        }
      } catch (e) {
        sendResponse({ error: e.message });
      }
    })();
    return true;
  }

  if (request.action === 'TYPE_TEXT') {
    (async () => {
      try {
        const timeoutMs = request.timeoutMs !== undefined ? request.timeoutMs : 3000;
        let selector = request.selector;
        let el = null;
        if (selector) {
          el = findElement(selector);
          if (!el && timeoutMs > 0) {
            el = await waitForElement(selector, timeoutMs, 'visible');
          }
        }
        if (!el) {
          if (selector) {
            sendResponse({ error: `Element not found: ${selector}` });
            return;
          }
          el = document.activeElement || document.body;
        }
        if (el) {
          flashInteractionHighlight(el);
          if (typeof el.scrollIntoView === 'function') {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          setNativeValue(el, request.text);
          sendResponse({ result: `Typed text into ${selector || (el.tagName ? el.tagName.toLowerCase() : 'activeElement')}` });
        } else {
          sendResponse({ error: `Element not found: ${selector}` });
        }
      } catch (e) {
        sendResponse({ error: e.message });
      }
    })();
    return true;
  }

  if (request.action === 'PRESS_KEY') {
    try {
      let selector = request.selector;
      let el = selector ? findElement(selector) : (document.activeElement || document.body);
      if (el) {
        flashInteractionHighlight(el);
        const key = request.key || 'Enter';
        const keyCodeMap = {
          'Enter': 13, 'Tab': 9, 'Escape': 27, 'Backspace': 8, 'Delete': 46,
          'ArrowUp': 38, 'ArrowDown': 40, 'ArrowLeft': 37, 'ArrowRight': 39, 'Space': 32
        };
        const keyCode = keyCodeMap[key] || 13;

        const eventInit = {
          key: key,
          code: key,
          keyCode: keyCode,
          which: keyCode,
          bubbles: true,
          cancelable: true,
          composed: true,
          shiftKey: !!request.shiftKey,
          ctrlKey: !!request.ctrlKey,
          altKey: !!request.altKey
        };

        el.dispatchEvent(new KeyboardEvent('keydown', eventInit));
        el.dispatchEvent(new KeyboardEvent('keypress', eventInit));
        el.dispatchEvent(new KeyboardEvent('keyup', eventInit));

        if (key === 'Enter' && el.tagName === 'INPUT') {
          el.blur();
          if (el.form) {
            el.form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
          }
        }

        sendResponse({ result: `Key '${key}' pressed successfully.` });
      } else {
        sendResponse({ error: `Element not found: ${selector}` });
      }
    } catch (e) {
      sendResponse({ error: e.message });
    }
    return true;
  }

  if (request.action === 'MOUSE_ACTION') {
    try {
      const res = simulateMouseAction(request);
      sendResponse({ result: res });
    } catch (e) {
      sendResponse({ error: `Mouse action error: ${e.message}` });
    }
    return true;
  }

  if (request.action === 'UPLOAD_FILE') {
    try {
      const selector = request.selector || 'input[type="file"]';
      const el = findElement(selector);
      if (!el) {
        sendResponse({ error: `File input not found with selector '${selector}'.` });
        return true;
      }

      // Decode base64 to binary
      const byteCharacters = atob(request.base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const mimeType = request.mimeType || 'application/pdf';
      const fileName = request.fileName || 'document.pdf';
      const blob = new Blob([byteArray], { type: mimeType });
      const file = new File([blob], fileName, { type: mimeType, lastModified: Date.now() });

      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);

      // If it's a file input, assign files directly
      if (el.tagName.toLowerCase() === 'input' && el.type === 'file') {
        el.files = dataTransfer.files;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }

      // Also dispatch drag & drop events on the element and any surrounding dropzone container
      const dropTarget = el.closest('[data-ph-at-id*="dropzone"], .dropzone, [class*="dropzone"], [class*="upload"]') || el.parentElement || el;
      const dragOptions = { bubbles: true, cancelable: true, dataTransfer };
      dropTarget.dispatchEvent(new DragEvent('dragenter', dragOptions));
      dropTarget.dispatchEvent(new DragEvent('dragover', dragOptions));
      dropTarget.dispatchEvent(new DragEvent('drop', dragOptions));

      sendResponse({
        result: `Successfully attached file '${fileName}' (${file.size} bytes, ${mimeType}) to '${selector}'.`
      });
    } catch (e) {
      sendResponse({ error: `Upload error: ${e.message}` });
    }
    return true;
  }

  if (request.action === 'BATCH_FILL_FORM') {
    (async () => {
      try {
        const actions = request.actions || [];
        const results = [];
        let succeeded = 0;
        let failed = 0;

        for (const item of actions) {
          const selector = item.selector;
          const act = item.action || 'type';
          const waitMs = item.waitMs || 0;

          if (waitMs > 0) {
            await new Promise(r => setTimeout(r, waitMs));
          }

          let el = findElement(selector);
          if (!el) {
            el = await waitForElement(selector, 800, 'attached');
          }

          if (!el) {
            results.push({ selector, status: 'failed', error: 'Element not found' });
            failed++;
            continue;
          }

          try {
            if (act === 'type') {
              setNativeValue(el, item.value ?? '');
              results.push({ selector, status: 'succeeded', action: 'type', value: item.value });
              succeeded++;
            } else if (act === 'select') {
              if (el.tagName.toLowerCase() === 'select') {
                el.focus();
                let matched = false;
                el.value = item.value;
                if (el.value === item.value) {
                  matched = true;
                } else {
                  for (let opt of el.options) {
                    if (opt.text.trim().toLowerCase() === String(item.value).trim().toLowerCase() ||
                        opt.value.trim().toLowerCase() === String(item.value).trim().toLowerCase()) {
                      el.value = opt.value;
                      matched = true;
                      break;
                    }
                  }
                }
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                el.dispatchEvent(new Event('blur', { bubbles: true }));
                results.push({ selector, status: 'succeeded', action: 'select', value: el.value, matched });
                succeeded++;
              } else {
                setNativeValue(el, item.value ?? '');
                results.push({ selector, status: 'succeeded', action: 'fallback_type', value: item.value });
                succeeded++;
              }
            } else if (act === 'click' || act === 'check' || act === 'uncheck') {
              if (el.type === 'checkbox' || el.type === 'radio') {
                const targetState = act === 'click' ? !el.checked : (act === 'check');
                if (el.checked !== targetState) {
                  el.click();
                }
              } else {
                el.click();
              }
              results.push({ selector, status: 'succeeded', action: act });
              succeeded++;
            } else {
              results.push({ selector, status: 'failed', error: `Unsupported action: ${act}` });
              failed++;
            }
          } catch (err) {
            results.push({ selector, status: 'failed', error: err.message });
            failed++;
          }
        }

        sendResponse({
          result: {
            total: actions.length,
            succeeded,
            failed,
            details: results
          }
        });
      } catch (e) {
        sendResponse({ error: `Batch fill error: ${e.message}` });
      }
    })();
    return true;
  }

  if (request.action === 'WAIT_FOR_ELEMENT') {
    (async () => {
      try {
        const timeoutMs = request.timeoutMs || 5000;
        const state = request.state || 'visible';
        const el = await waitForElement(request.selector, timeoutMs, state);
        if (el) {
          sendResponse({ result: `Element '${request.selector}' reached state '${state}' successfully.` });
        } else {
          sendResponse({ error: `Timeout (${timeoutMs}ms) waiting for '${request.selector}' to become '${state}'.` });
        }
      } catch (e) {
        sendResponse({ error: e.message });
      }
    })();
    return true;
  }

  if (request.action === 'SMART_SELECT_COMBOBOX') {
    (async () => {
      try {
        const trigger = findElement(request.triggerSelector);
        if (!trigger) {
          sendResponse({ error: `Trigger element not found: ${request.triggerSelector}` });
          return;
        }

        trigger.focus();
        trigger.click();
        await new Promise(r => setTimeout(r, 300));

        // Type into search input (prioritize trigger itself if input, then local search)
        const queryToType = request.searchQuery || (trigger.tagName === 'INPUT' ? request.optionText : null);
        if (queryToType) {
          if (trigger.tagName === 'INPUT' || trigger.tagName === 'TEXTAREA') {
            setNativeValue(trigger, queryToType);
            await new Promise(r => setTimeout(r, 300));
          } else {
            const localSearch = trigger.querySelector('input') || 
              trigger.parentElement?.querySelector('input[type="text"], input[type="search"], input[role="combobox"]');
            if (localSearch) {
              setNativeValue(localSearch, queryToType);
              await new Promise(r => setTimeout(r, 300));
            }
          }
        }

        // Search for matching option in popup list
        const targetText = String(request.optionText).trim().toLowerCase();
        const triggerId = trigger.id || '';
        const candidateSelectors = [
          triggerId ? `div[id*="${triggerId}"][role="option"]` : null,
          'div[id*="react-select"][role="option"]',
          '[role="option"]',
          '[role="listbox"] li',
          'ul li[data-value]',
          '.dropdown-menu li',
          '.select-option',
          '[data-ph-at-id*="option"]'
        ].filter(Boolean);

        let foundOption = null;
        const allItems = [];
        for (const sel of candidateSelectors) {
          const items = document.querySelectorAll(sel);
          for (const item of items) allItems.push(item);
        }

        // Only search visible elements (uses modern checkVisibility to support position:fixed portals)
        const isVisible = (el) => {
          if (typeof el.checkVisibility === 'function') {
            return el.checkVisibility();
          }
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && getComputedStyle(el).display !== 'none';
        };
        const visibleItems = allItems.filter(isVisible);
        const searchList = visibleItems.length > 0 ? visibleItems : allItems;

        // 1. Exact match first
        for (const item of searchList) {
          const text = (item.textContent || '').trim().toLowerCase();
          if (text === targetText) {
            foundOption = item;
            break;
          }
        }

        // 2. Exact word match (e.g. "Yes", "No", "India")
        if (!foundOption) {
          const wordRegex = new RegExp(`\\b${targetText.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\b`, 'i');
          for (const item of searchList) {
            const text = (item.textContent || '').trim().toLowerCase();
            if (wordRegex.test(text)) {
              foundOption = item;
              break;
            }
          }
        }

        // 3. Fallback to startsWith only if targetText is at least 3 chars
        if (!foundOption && targetText.length >= 3) {
          for (const item of searchList) {
            const text = (item.textContent || '').trim().toLowerCase();
            if (text.startsWith(targetText)) {
              foundOption = item;
              break;
            }
          }
        }

        // 4. Fallback to substring
        if (!foundOption) {
          for (const item of searchList) {
            const text = (item.textContent || '').trim().toLowerCase();
            if (text.includes(targetText)) {
              foundOption = item;
              break;
            }
          }
        }

        if (foundOption) {
          foundOption.scrollIntoView({ block: 'nearest' });
          foundOption.click();
          sendResponse({ result: `Selected option '${foundOption.textContent.trim()}' for combobox '${request.triggerSelector}'.` });
        } else {
          sendResponse({ error: `Could not find dropdown option matching '${request.optionText}' after opening combobox.` });
        }
      } catch (e) {
        sendResponse({ error: `Smart select combobox error: ${e.message}` });
      }
    })();
    return true;
  }

  if (request.action === 'EXTRACT_JOB_DETAILS') {
    try {
      const url = window.location.href;
      const host = window.location.hostname.toLowerCase();
      
      // Determine ATS Platform
      let platform = 'Unknown';
      if (host.includes('myworkdayjobs.com')) platform = 'Workday';
      else if (host.includes('greenhouse.io') || document.querySelector('[data-qa="job-description"]') || window.gh_jid) platform = 'Greenhouse';
      else if (host.includes('lever.co')) platform = 'Lever';
      else if (host.includes('smartrecruiters.com')) platform = 'SmartRecruiters';
      else if (host.includes('keka.com')) platform = 'Keka';
      else if (host.includes('darwinbox.in')) platform = 'Darwinbox';
      else if (host.includes('linkedin.com')) platform = 'LinkedIn';
      else if (document.querySelector('[data-ph-at-id]') || host.includes('phenom')) platform = 'Phenom People';

      // Title extraction
      let title = '';
      const titleSelectors = [
        'h1',
        '[data-automation-id="jobPostingHeader"]',
        '[data-ph-at-id="job-title"]',
        '.job-title',
        '.top-card-layout__title',
        '.app-title'
      ];
      for (const sel of titleSelectors) {
        const el = document.querySelector(sel);
        if (el && el.textContent.trim()) {
          title = el.textContent.trim();
          break;
        }
      }

      // Company extraction
      let company = '';
      const companySelectors = [
        '[data-automation-id="companyName"]',
        '[data-ph-at-id="company-name"]',
        '.topcard__flavor--bullet',
        '.sub-nav-title',
        'meta[property="og:site_name"]'
      ];
      for (const sel of companySelectors) {
        const el = document.querySelector(sel);
        if (el) {
          company = el.getAttribute('content') || el.textContent.trim();
          if (company) break;
        }
      }
      if (!company) {
        const parts = document.title.split(/[-|–·]/);
        if (parts.length > 1) company = parts[parts.length - 1].trim();
      }

      // Location extraction
      let location = '';
      const locationSelectors = [
        '[data-automation-id="locations"]',
        '[data-ph-at-id="job-location"]',
        '.location',
        '.top-card-layout__first-subline',
        '[data-automation-id="jobPostingLocation"]'
      ];
      for (const sel of locationSelectors) {
        const el = document.querySelector(sel);
        if (el && el.textContent.trim()) {
          location = el.textContent.trim();
          break;
        }
      }

      // Requisition / Job ID
      let jobId = '';
      const jobIdMatch = url.match(/(R-\d+|JR[_-]?\d+|\b\d{6,12}\b|jobSeqNo=\d+)/i) || 
                         document.body.innerText.match(/Requisition\s*ID:?\s*([A-Za-z0-9_-]+)/i);
      if (jobIdMatch) jobId = jobIdMatch[1] || jobIdMatch[0];

      // Description extraction (clean text)
      let descEl = document.querySelector('[data-automation-id="jobPostingDescription"], [data-ph-at-id="job-description"], #job-description, .description, .job-details, main');
      let descriptionText = '';
      if (descEl) {
        const clone = descEl.cloneNode(true);
        clone.querySelectorAll('script, style, svg, nav, header, footer').forEach(e => e.remove());
        descriptionText = clone.innerText.replace(/\n\s*\n/g, '\n').trim().substring(0, 4000);
      } else {
        descriptionText = document.body.innerText.substring(0, 3000);
      }

      // Apply Button / Link
      let applyUrl = '';
      const applyBtn = document.querySelector('a[data-ph-at-id="apply-link"], a[data-automation-id="applyButton"], a[href*="/apply"], a[href*="jobs.lever.co"][href*="/apply"]');
      if (applyBtn && applyBtn.href) {
        applyUrl = applyBtn.href;
      }

      sendResponse({
        result: {
          url,
          platform,
          title,
          company,
          location,
          jobId,
          applyUrl: applyUrl || url,
          descriptionSnippet: descriptionText
        }
      });
    } catch (e) {
      sendResponse({ error: `Job extraction failed: ${e.message}` });
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
    return true;
  }

  if (request.action === 'EXECUTE_SCRIPT') {
    const execId = 'exec_' + Math.random().toString(36).substring(2, 9);
    const timeout = setTimeout(() => {
      window.removeEventListener('message', handleResult);
      sendResponse({ error: 'Timeout waiting for script execution to complete (10000ms)' });
    }, 10000);

    const handleResult = (event) => {
      if (event.source !== window || !event.data || event.data.type !== 'DEVPILOT_EXEC_RESULT' || event.data.execId !== execId) return;
      clearTimeout(timeout);
      window.removeEventListener('message', handleResult);
      if (event.data.error) {
        sendResponse({ error: event.data.error });
      } else {
        sendResponse({ result: event.data.result });
      }
    };

    window.addEventListener('message', handleResult);
    window.postMessage({ type: 'DEVPILOT_EXEC_SCRIPT', execId, script: request.script }, '*');
    return true;
  }

  if (request.action === 'SCROLL_PAGE') {
    try {
      let target = window;
      let isWindow = true;
      if (request.containerSelector) {
        const container = findElement(request.containerSelector);
        if (container) {
          target = container;
          isWindow = false;
        }
      }

      if (request.scrollToSelector) {
        const el = findElement(request.scrollToSelector);
        if (!el) {
          sendResponse({ error: `Scroll target '${request.scrollToSelector}' not found.` });
          return true;
        }
        el.scrollIntoView({ behavior: request.smooth !== false ? 'smooth' : 'auto', block: 'center' });
        sendResponse({ result: `Scrolled to element '${request.scrollToSelector}'` });
        return true;
      }

      const amount = request.amount || 500;
      const direction = request.direction || 'down';
      const behavior = request.smooth !== false ? 'smooth' : 'auto';

      if (isWindow) {
        if (direction === 'down') window.scrollBy({ top: amount, behavior });
        else if (direction === 'up') window.scrollBy({ top: -amount, behavior });
        else if (direction === 'bottom') window.scrollTo({ top: document.body.scrollHeight, behavior });
        else if (direction === 'top') window.scrollTo({ top: 0, behavior });
      } else {
        if (direction === 'down') target.scrollTop += amount;
        else if (direction === 'up') target.scrollTop -= amount;
        else if (direction === 'bottom') target.scrollTop = target.scrollHeight;
        else if (direction === 'top') target.scrollTop = 0;
      }

      sendResponse({
        result: {
          direction,
          scrollX: isWindow ? window.scrollX : target.scrollLeft,
          scrollY: isWindow ? window.scrollY : target.scrollTop,
          maxScrollY: isWindow ? document.body.scrollHeight : target.scrollHeight
        }
      });
    } catch (e) {
      sendResponse({ error: `Scroll error: ${e.message}` });
    }
    return true;
  }

  if (request.action === 'EXTRACT_STRUCTURED_DATA') {
    try {
      const root = request.targetSelector ? findElement(request.targetSelector) : document;
      if (!root) {
        sendResponse({ error: `Target selector '${request.targetSelector}' not found.` });
        return true;
      }

      let data = [];
      const table = root.tagName && root.tagName.toLowerCase() === 'table' ? root : root.querySelector('table');

      if (table && request.type !== 'cards' && request.type !== 'list') {
        const headers = [];
        const headerEls = table.querySelectorAll('thead th, tr:first-child th, tr:first-child td');
        headerEls.forEach((th, idx) => {
          headers.push(th.textContent.trim() || `column_${idx + 1}`);
        });

        const rowEls = table.querySelectorAll('tbody tr, tr:not(:first-child)');
        rowEls.forEach(tr => {
          const cells = tr.querySelectorAll('td, th');
          if (cells.length > 0) {
            const rowObj = {};
            cells.forEach((td, idx) => {
              const key = headers[idx] || `column_${idx + 1}`;
              const link = td.querySelector('a');
              rowObj[key] = td.textContent.trim();
              if (link && link.href) {
                rowObj[key + '_url'] = link.href;
              }
            });
            data.push(rowObj);
          }
        });
      } else {
        const items = root.querySelectorAll(request.itemSelector || 'li, .card, [class*="item"], [class*="card"], [class*="row"]');
        items.forEach((item, idx) => {
          if (idx > 100) return;
          const heading = item.querySelector('h1, h2, h3, h4, h5, h6, [class*="title"], strong, a');
          const link = item.querySelector('a');
          const text = item.textContent.replace(/\s+/g, ' ').trim();
          if (text) {
            data.push({
              title: heading ? heading.textContent.trim() : `Item ${idx + 1}`,
              text: text.substring(0, 300),
              url: link ? link.href : null
            });
          }
        });
      }

      sendResponse({ result: { count: data.length, data } });
    } catch (e) {
      sendResponse({ error: `Structured data extraction failed: ${e.message}` });
    }
    return true;
  }

  if (request.action === 'ASSERT_ELEMENT_STATE') {
    try {
      const el = findElement(request.selector);
      let condition = (request.condition || '').toLowerCase().trim();
      
      // Normalize aliases
      if (condition === 'visible') condition = 'is_visible';
      else if (condition === 'hidden') condition = 'is_hidden';
      else if (condition === 'enabled') condition = 'is_enabled';
      else if (condition === 'disabled') condition = 'is_disabled';
      else if (condition === 'checked') condition = 'is_checked';
      else if (condition === 'text_contains') condition = 'contains_text';
      else if (condition === 'text_equals') condition = 'equals_text';
      else if (condition === 'exists') condition = 'is_attached';
      else if (condition === 'not_exists') condition = 'is_detached';

      let passed = false;
      let actual = null;

      const isAttached = !!el;
      const isVisible = isAttached && (el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0) && window.getComputedStyle(el).display !== 'none' && window.getComputedStyle(el).visibility !== 'hidden';

      switch (condition) {
        case 'is_visible':
          passed = isVisible;
          actual = isVisible ? 'visible' : 'hidden';
          break;
        case 'is_hidden':
          passed = !isVisible;
          actual = isVisible ? 'visible' : 'hidden';
          break;
        case 'is_enabled':
          passed = isAttached && !el.disabled && el.getAttribute('aria-disabled') !== 'true';
          actual = passed ? 'enabled' : 'disabled';
          break;
        case 'is_disabled':
          passed = isAttached && (!!el.disabled || el.getAttribute('aria-disabled') === 'true');
          actual = passed ? 'disabled' : 'enabled';
          break;
        case 'is_checked':
          passed = isAttached && !!el.checked;
          actual = passed ? 'checked' : 'unchecked';
          break;
        case 'contains_text':
          actual = isAttached ? el.textContent.trim() : null;
          passed = isAttached && String(actual).toLowerCase().includes(String(request.expected).toLowerCase());
          break;
        case 'equals_text':
          actual = isAttached ? el.textContent.trim() : null;
          passed = isAttached && String(actual).toLowerCase() === String(request.expected).toLowerCase();
          break;
        case 'is_attached':
          passed = isAttached;
          actual = isAttached ? 'attached' : 'detached';
          break;
        case 'is_detached':
          passed = !isAttached;
          actual = isAttached ? 'attached' : 'detached';
          break;
        case 'has_value':
          actual = isAttached ? el.value : null;
          passed = isAttached && String(actual) === String(request.expected);
          break;
        case 'has_attribute':
          actual = isAttached ? el.getAttribute(request.expected) : null;
          passed = isAttached && actual !== null;
          break;
        default:
          sendResponse({ error: `Unsupported assertion condition: ${condition}` });
          return true;
      }

      sendResponse({
        result: {
          passed,
          condition,
          selector: request.selector,
          actual,
          expected: request.expected !== undefined ? request.expected : true
        }
      });
    } catch (e) {
      sendResponse({ error: `Assertion error: ${e.message}` });
    }
    return true;
  }

  if (request.action === 'RECORD_FLOW') {
    try {
      if (request.subAction === 'start') {
        window.__DEVPILOT_RECORDING__ = {
          events: [],
          startTime: Date.now(),
          startUrl: window.location.href
        };

        const captureListener = (e) => {
          if (!window.__DEVPILOT_RECORDING__) return;
          const target = e.target;
          let selector = '';
          if (target.id) selector = `#${target.id}`;
          else if (target.getAttribute('data-testid')) selector = `[data-testid="${target.getAttribute('data-testid')}"]`;
          else if (target.name) selector = `[name="${target.name}"]`;
          else if (target.className && typeof target.className === 'string') {
            const rawClasses = target.className.trim().split(/\s+/).filter(Boolean);
            const cleanClass = rawClasses.find(c => !c.includes(':') && !c.includes('[') && !c.includes('/'));
            if (cleanClass) {
              selector = `${target.tagName.toLowerCase()}.${cleanClass}`;
            } else if (rawClasses.length > 0) {
              selector = `${target.tagName.toLowerCase()}[class*="${rawClasses[0]}"]`;
            }
          }
          if (!selector) selector = target.tagName.toLowerCase();

          if (e.type === 'click') {
            window.__DEVPILOT_RECORDING__.events.push({
              type: 'click',
              selector,
              timestamp: Date.now()
            });
          } else if (e.type === 'change' || (e.type === 'input' && target.tagName.toLowerCase() === 'textarea')) {
            window.__DEVPILOT_RECORDING__.events.push({
              type: 'type',
              selector,
              value: target.value,
              timestamp: Date.now()
            });
          }
        };

        document.addEventListener('click', captureListener, true);
        document.addEventListener('change', captureListener, true);
        window.__DEVPILOT_RECORDING_LISTENER__ = captureListener;

        sendResponse({ result: 'Interaction recording started. Perform actions in the browser tab.' });
      } else if (request.subAction === 'status' || request.subAction === 'get_steps') {
        const count = window.__DEVPILOT_RECORDING__?.events?.length || 0;
        const events = window.__DEVPILOT_RECORDING__?.events || [];
        sendResponse({ result: { recording: !!window.__DEVPILOT_RECORDING__, count, events } });
      } else if (request.subAction === 'stop') {
        const rec = window.__DEVPILOT_RECORDING__;
        if (window.__DEVPILOT_RECORDING_LISTENER__) {
          document.removeEventListener('click', window.__DEVPILOT_RECORDING_LISTENER__, true);
          document.removeEventListener('change', window.__DEVPILOT_RECORDING_LISTENER__, true);
        }
        window.__DEVPILOT_RECORDING__ = null;

        if (!rec || rec.events.length === 0) {
          sendResponse({ result: '// No interactions were recorded.' });
          return true;
        }

        let script = `import { test, expect } from '@playwright/test';\n\n`;
        script += `test('recorded user flow', async ({ page }) => {\n`;
        script += `  await page.goto('${rec.startUrl}');\n\n`;

        for (const evt of rec.events) {
          if (evt.type === 'click') {
            script += `  await page.click('${evt.selector}');\n`;
          } else if (evt.type === 'type') {
            script += `  await page.fill('${evt.selector}', '${evt.value.replace(/'/g, "\\'")}');\n`;
          }
        }
        script += `});\n`;

        sendResponse({ result: { totalActions: rec.events.length, testScript: script } });
      }
    } catch (e) {
      sendResponse({ error: `Record flow error: ${e.message}` });
    }
    return true;
  }

  if (request.action === 'GET_CANVAS_SNAPSHOT') {
    try {
      const canvas = document.querySelector('canvas[data-testid="gpu-canvas"]') || document.querySelector('canvas');
      if (canvas) {
        const dataUrl = canvas.toDataURL('image/png');
        sendResponse({ result: dataUrl });
      } else {
        const c = document.createElement('canvas');
        c.width = Math.max(window.innerWidth || 1200, 800);
        c.height = Math.max(window.innerHeight || 800, 600);
        const ctx = c.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#141218';
          ctx.fillRect(0, 0, c.width, c.height);
          ctx.fillStyle = '#cfbcff';
          ctx.font = 'bold 22px system-ui, sans-serif';
          ctx.fillText(document.title || 'Browser Viewport', 32, 50);
          ctx.fillStyle = '#cbc4d2';
          ctx.font = '14px monospace';
          ctx.fillText(`URL: ${window.location.href}`, 32, 85);
          ctx.fillStyle = '#948e9c';
          ctx.fillText(`Dimensions: ${c.width}x${c.height} • Captured: ${new Date().toISOString()}`, 32, 115);
        }
        const dataUrl = c.toDataURL('image/png');
        sendResponse({ result: dataUrl });
      }
    } catch (e) {
      sendResponse({ error: `Canvas snapshot error: ${e.message}` });
    }
    return true;
  }

  if (request.action === 'MANAGE_STORAGE') {
    try {
      const storageType = request.storageType === 'session' ? window.sessionStorage : window.localStorage;
      const op = request.operation;
      if (op === 'set') {
        storageType.setItem(request.key, request.value);
        sendResponse({ result: `Storage item '${request.key}' set successfully.` });
      } else if (op === 'get') {
        const val = storageType.getItem(request.key);
        sendResponse({ result: { key: request.key, value: val } });
      } else if (op === 'remove') {
        storageType.removeItem(request.key);
        sendResponse({ result: `Storage item '${request.key}' removed.` });
      } else if (op === 'get_all') {
        const all = {};
        for (let i = 0; i < storageType.length; i++) {
          const k = storageType.key(i);
          all[k] = storageType.getItem(k);
        }
        sendResponse({ result: all });
      } else if (op === 'clear') {
        storageType.clear();
        sendResponse({ result: `Storage cleared.` });
      } else {
        sendResponse({ error: `Unknown storage operation: ${op}` });
      }
    } catch (e) {
      sendResponse({ error: `Storage operation failed: ${e.message}` });
    }
    return true;
  }
});

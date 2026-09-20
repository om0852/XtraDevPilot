(function () {
  const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info
  };

  function sendLog(level, args) {
    try {
      const text = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
      window.postMessage({ type: 'DEVPILOT_CONSOLE_LOG', level, text, timestamp: Date.now() }, '*');
    } catch (e) { }
  }

  console.log = function (...args) { sendLog('log', args); originalConsole.log.apply(console, args); };
  console.warn = function (...args) { sendLog('warn', args); originalConsole.warn.apply(console, args); };
  console.error = function (...args) { sendLog('error', args); originalConsole.error.apply(console, args); };
  console.info = function (...args) { sendLog('info', args); originalConsole.info.apply(console, args); };

  let activeMocks = [];
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const url = typeof args[0] === 'string' ? args[0] : (args[0] instanceof Request ? args[0].url : String(args[0]));
    const mock = activeMocks.find(m => url.includes(m.urlPattern));
    if (mock) {
      originalConsole.info(`[DevPilot] Intercepted and mocked fetch request to: ${url}`);
      return new Response(mock.responseBody, {
        status: mock.status || 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return originalFetch.apply(this, args);
  };

  window.addEventListener('message', async (event) => {
    if (event.source !== window) return;
    if (event.data && event.data.type === 'DEVPILOT_ADD_MOCK') {
      activeMocks.push(event.data.mock);
      originalConsole.info(`[DevPilot] Added mock for: ${event.data.mock.urlPattern}`);
    }
    if (event.data && event.data.type === 'DEVPILOT_CLEAR_MOCKS') {
      activeMocks = [];
      originalConsole.info(`[DevPilot] Cleared all network mocks`);
    }
    if (event.data && event.data.type === 'DEVPILOT_EXEC_SCRIPT') {
      const { execId, script } = event.data;
      try {
        const cleanScript = (script || '').trim();
        let fn;
        if (/^\s*return\b/m.test(cleanScript)) {
          fn = new Function(`return (async () => { ${cleanScript} })()`);
        } else {
          try {
            fn = new Function(`return (async () => { return (${cleanScript}); })()`);
          } catch {
            fn = new Function(`return (async () => { ${cleanScript} })()`);
          }
        }
        const result = await fn();
        window.postMessage({ type: 'DEVPILOT_EXEC_RESULT', execId, result: result !== undefined ? result : null }, '*');
      } catch (err) {
        window.postMessage({ type: 'DEVPILOT_EXEC_RESULT', execId, error: err.message }, '*');
      }
    }
  });

  window.addEventListener('error', function (event) {
    sendLog('error', ['Uncaught Error:', event.message, 'at', event.filename + ':' + event.lineno]);
  });

  window.addEventListener('unhandledrejection', function (event) {
    sendLog('error', ['Uncaught (in promise) Error:', event.reason]);
  });
})();

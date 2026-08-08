import { launch, DevPilotError } from '../index.js';

async function runWebSocketAutomation() {
  console.log('⚡ Connecting SDK via Direct WebSocket to persistent XtraDevPilot bridge...');

  // Connect to an ALREADY RUNNING MCP Server / Chrome Bridge (port 42819)
  const browser = await launch({
    transport: 'websocket', // Uses direct WebSocket mode
    wsHost: '127.0.0.1',
    wsPort: 42819,
    timeoutMs: 15000,
    logger: { level: 'info' }
  });

  const page = browser.page();

  try {
    console.log('\n--- Step 1: Inspect DOM on Active Chrome Tab ---');
    const dom = await page.getCleanDomSnapshot();
    console.log(`✅ Active DOM Snapshot Length: ${dom.length} characters`);

    console.log('\n--- Step 2: Extract Core Web Vitals ---');
    const vitals = await page.getWebVitals();
    console.log('Web Vitals:', vitals);

    console.log('\n--- Step 3: Capture Viewport Screenshot ---');
    const screenshot = await page.screenshot({ path: 'live_browser_tab.png' });
    console.log(`✅ Screenshot saved to: ${screenshot}`);

    console.log('\n🎉 Automation executed live on persistent Chrome tab!');
  } catch (error: any) {
    if (error instanceof DevPilotError) {
      console.error(`❌ DevPilot Error [${error.code}]:`, error.message);
    } else {
      console.error('❌ Error:', error);
    }
  } finally {
    // Closes only the client WebSocket connection, leaving the server and Chrome connected!
    await browser.close();
    console.log('👋 SDK Client disconnected. Server and Chrome remain connected!');
    process.exit(0);
  }
}

runWebSocketAutomation();

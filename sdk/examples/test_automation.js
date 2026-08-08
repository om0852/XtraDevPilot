import { XtraDevPilot } from '../index.js';

async function main() {
  console.log('🚀 Initializing Xtra DevPilot Automation Test...');
  const pilot = new XtraDevPilot();

  try {
    // Connect to MCP Server & Chrome Extension
    await pilot.connect();
    console.log('✅ Connected to Xtra DevPilot server.');

    // 1. Fetch clean DOM snapshot
    console.log('\n--- Step 1: DOM Inspection ---');
    const dom = await pilot.getCleanDomSnapshot();
    console.log('DOM Snapshot fetched (Length:', typeof dom === 'string' ? dom.length : JSON.stringify(dom).length, 'chars)');

    // 2. Perform interactive steps (Example: searching or clicking)
    console.log('\n--- Step 2: Form Interaction ---');
    try {
      console.log('Typing query into input...');
      await pilot.type('input[type="text"], input[type="search"]', 'Xtra DevPilot Test');
      console.log('Clicking submit/button...');
      await pilot.click('button, input[type="submit"]');
    } catch (e) {
      console.log('Interactive element note:', e.message);
    }

    // 3. Perform Web Vitals & Security Audit
    console.log('\n--- Step 3: Audits ---');
    const vitals = await pilot.getWebVitals();
    console.log('Web Vitals:', vitals);

    const secAudit = await pilot.runSecurityAudit();
    console.log('Security Audit Summary:', secAudit);

    // 4. Capture Viewport Screenshot
    console.log('\n--- Step 4: Screenshot ---');
    const screenshot = await pilot.captureScreenshot();
    console.log('Screenshot output:', screenshot);

    console.log('\n🎉 Test Automation completed successfully!');
  } catch (error) {
    console.error('❌ Automation Error:', error);
  } finally {
    await pilot.disconnect();
    console.log('👋 Disconnected.');
    process.exit(0);
  }
}

main();

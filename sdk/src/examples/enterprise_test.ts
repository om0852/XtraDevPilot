import { launch, DevPilotError } from '../index.js';

async function runEnterpriseTestSuite() {
  console.log('🏢 Starting Enterprise Browser Automation Suite...');

  // Launch browser session using high-speed direct WebSocket or Stdio
  const browser = await launch({
    transport: 'websocket', // Uses WebSocket transport so background server and Chrome stay connected 24/7!
    timeoutMs: 15000,
    logger: { level: 'info' }
  });

  const page = browser.page();

  try {
    console.log('\n--- Step 1: Responsive Viewport Configuration ---');
    await page.setViewport(1280, 800);

    console.log('\n--- Step 2: DOM & Layout Verification ---');
    const dom = await page.getCleanDomSnapshot();
    console.log(`DOM structure captured (${dom.length} bytes)`);

    console.log('\n--- Step 3: Interactive Form Flow ---');
    try {
      await page.type('input[type="text"]', 'Enterprise DevPilot Test');
      await page.click('button[type="submit"]', { highlight: true });
    } catch (err: any) {
      console.log(`[Flow Note] Interactive step detail: ${err.message}`);
    }

    console.log('\n--- Step 4: Network Interception / Mocking ---');
    await page.route('/api/v1/user', { id: 101, role: 'admin', status: 'active' }, 200);
    console.log('Mocked route /api/v1/user');
    await page.unrouteAll();

    console.log('\n--- Step 5: Audits & Quality Control ---');
    const vitals = await page.getWebVitals();
    console.log('Core Web Vitals:', JSON.stringify(vitals, null, 2));

    const security = await page.runSecurityAudit();
    console.log('Security Audit Summary:', JSON.stringify(security, null, 2));

    const a11y = await page.runAccessibilityAudit();
    console.log('Accessibility Audit Summary:', JSON.stringify(a11y, null, 2));

    console.log('\n--- Step 6: Artifact Capture ---');
    const screenshot = await page.screenshot({ path: '.enterprise-test-screenshot.png' });
    console.log(`Screenshot generated: ${screenshot}`);

    console.log('\n✅ Enterprise Test Suite Executed Successfully!');
  } catch (error: any) {
    if (error instanceof DevPilotError) {
      console.error(`❌ DevPilot Enterprise Error [${error.code}]:`, error.message);
    } else {
      console.error('❌ Unexpected Error:', error);
    }
  } finally {
    await browser.close();
    console.log('👋 Session closed cleanly.');
    process.exit(0);
  }
}

runEnterpriseTestSuite();

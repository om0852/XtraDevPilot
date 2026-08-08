"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("../index.js");
async function openWebsiteDemo() {
    console.log('🌐 Opening a new website tab in Chrome via XtraDevPilot SDK...\n');
    const browser = await (0, index_js_1.launch)({
        transport: 'websocket',
        logger: { level: 'info' }
    });
    try {
        const targetUrl = process.argv[2] || 'https://github.com';
        console.log(`🚀 Step 1: Navigating to ${targetUrl}...`);
        // Open new tab with URL or navigate
        const page = await browser.newPage(targetUrl);
        console.log('✅ Tab created & navigated!');
        // Wait a brief moment for page to load
        await new Promise((r) => setTimeout(r, 2000));
        // Fetch live metadata of the newly loaded page
        console.log('\n📌 Step 2: Retrieving Loaded Page Information...');
        const info = await page.getTabInfo();
        console.log(`   • Page Title: ${info?.title || 'Unknown'}`);
        console.log(`   • Page URL:   ${info?.url || targetUrl}`);
        // Capture screenshot of the website
        console.log('\n📸 Step 3: Capturing Viewport Screenshot...');
        const screenshot = await page.screenshot({ path: 'loaded_website.png' });
        console.log(`   • Screenshot saved to: ${screenshot}`);
        console.log('\n🎉 Website loaded and automated successfully!');
    }
    catch (error) {
        if (error instanceof index_js_1.DevPilotError) {
            console.error(`❌ DevPilot Error [${error.code}]:`, error.message);
        }
        else {
            console.error('❌ Error:', error);
        }
    }
    finally {
        await browser.close();
        process.exit(0);
    }
}
openWebsiteDemo();
//# sourceMappingURL=open_website_demo.js.map
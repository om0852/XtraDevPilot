"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("../index.js");
async function fetchTabInformation() {
    console.log('🔍 Fetching live Chrome active tab information via XtraDevPilot SDK...\n');
    const browser = await (0, index_js_1.launch)({
        transport: 'websocket',
        logger: { level: 'info' }
    });
    const page = browser.page();
    try {
        // 1. Fetch tab metadata
        const tabInfo = await page.getTabInfo();
        console.log('📌 ACTIVE TAB METADATA:');
        console.log(`   • Title:      ${tabInfo?.title || 'Unknown'}`);
        console.log(`   • URL:        ${tabInfo?.url || 'Unknown'}`);
        console.log(`   • Status:     ${tabInfo?.status || 'loaded'}`);
        console.log(`   • Dimensions: ${tabInfo?.width || 'N/A'} x ${tabInfo?.height || 'N/A'} px`);
        console.log(`   • Favicon:    ${tabInfo?.favIconUrl || 'None'}`);
        // 2. Fetch DOM HTML structure snippet
        console.log('\n🌐 DOM STRUCTURE SUMMARY:');
        const cleanDom = await page.getCleanDomSnapshot();
        const domStr = typeof cleanDom === 'string' ? cleanDom : JSON.stringify(cleanDom || '');
        const snippet = domStr.slice(0, 300).replace(/\s+/g, ' ');
        console.log(`   • Clean DOM Total Bytes: ${domStr.length} characters`);
        console.log(`   • Preview Snippet: ${snippet}...`);
        // 3. Fetch storage state
        console.log('\n💾 TAB STORAGE STATE:');
        try {
            const storage = await page.getStorage();
            console.log(`   • LocalStorage Keys: ${Object.keys(storage?.localStorage || {}).length}`);
            console.log(`   • SessionStorage Keys: ${Object.keys(storage?.sessionStorage || {}).length}`);
        }
        catch {
            console.log('   • Storage: (Requires active HTTP/HTTPS webpage)');
        }
        // 4. Capture screenshot
        console.log('\n📸 SCREENSHOT CAPTURE:');
        const screenshot = await page.screenshot({ path: 'active_tab_snapshot.png' });
        console.log(`   • Viewport Screenshot Saved To: ${screenshot}`);
        console.log('\n✅ Active Tab Information Retrieved Successfully!');
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
fetchTabInformation();
//# sourceMappingURL=get_active_tab_info.js.map
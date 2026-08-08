# `@xtradevpilot/sdk`

> Enterprise-grade Node.js & TypeScript Automation SDK for **Xtra DevPilot**.

Connect your Node.js scripts directly to live Google Chrome browser tabs using a Playwright/Puppeteer-inspired API. Preserves logged-in sessions, cookies, active state, local storage, and real visual UI interaction.

---

## 📦 Installation

```bash
npm install @xtradevpilot/sdk
```

---

## 🚀 Quick Start

```typescript
import { launch } from '@xtradevpilot/sdk';

async function main() {
  // Launch browser automation instance (Connects via MCP Stdio or WebSocket bridge)
  const browser = await launch({
    transport: 'stdio', // 'stdio' | 'websocket'
    timeoutMs: 15000,
    logger: { level: 'info' }
  });

  const page = browser.page();

  // 1. Set viewport size
  await page.setViewport(1280, 800);

  // 2. Perform step-by-step UI actions
  await page.type('input[name="email"]', 'user@company.com');
  await page.click('button[type="submit"]', { highlight: true });

  // 3. Inspect page state & capture screenshot
  const dom = await page.getCleanDomSnapshot();
  const screenshotPath = await page.screenshot({ path: './screenshot.png' });

  // 4. Run automated audits
  const securityReport = await page.runSecurityAudit();
  const a11yReport = await page.runAccessibilityAudit();

  console.log('Security score:', securityReport.passed);
  console.log('Accessibility violations:', a11yReport.violationsCount);

  // Clean disconnect
  await browser.close();
}

main();
```

---

## ⚡ Transports

| Transport | Description | Best For |
|---|---|---|
| `stdio` (Default) | Spawns and manages local `xtradevpilot-mcp` server process via JSON-RPC. | IDE integration, agent workflows, standard automation scripts. |
| `websocket` | Connects directly to Chrome Extension WebSocket server (`ws://127.0.0.1:42819`). | Ultra-high performance, low-latency testing suites. |

---

## 📘 API Reference

### `Browser`
- `launch(options?: ClientOptions): Promise<Browser>`
- `browser.page(): Page`
- `browser.close(): Promise<void>`

### `Page`
- `click(selector: string, options?: ClickOptions): Promise<void>`
- `type(selector: string, text: string, options?: TypeOptions): Promise<void>`
- `waitForSelector(selector: string, options?: WaitOptions): Promise<boolean>`
- `getCleanDomSnapshot(): Promise<string>`
- `getDomSnapshot(): Promise<string>`
- `screenshot(options?: ScreenshotOptions): Promise<string>`
- `route(urlPattern: string, responseBody: any, status?: number): Promise<void>`
- `unrouteAll(): Promise<void>`
- `injectStyle(cssString: string): Promise<void>`
- `getConsoleLogs(): Promise<ConsoleLogEntry[]>`
- `getNetworkLogs(): Promise<NetworkLogEntry[]>`
- `getStorage(): Promise<StorageData>`
- `getWebVitals(): Promise<WebVitalsReport>`
- `runSecurityAudit(): Promise<SecurityAuditReport>`
- `runAccessibilityAudit(): Promise<AccessibilityAuditReport>`
- `setViewport(width: number, height: number): Promise<ViewportSize>`

---

## 🚨 Error Handling

The SDK provides typed error classes:

```typescript
import { 
  DevPilotError, 
  ConnectionError, 
  TimeoutError, 
  ElementNotFoundError 
} from '@xtradevpilot/sdk';

try {
  await page.click('#non-existent-element');
} catch (error) {
  if (error instanceof ElementNotFoundError) {
    console.error(`Missing element: ${error.selector}`);
  } else if (error instanceof TimeoutError) {
    console.error(`Operation timed out: ${error.message}`);
  }
}
```

---

## 📄 License

MIT © XtraDevPilot Team

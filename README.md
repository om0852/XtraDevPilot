# Xtra DevPilot

<p align="center">
  <img src="assets/android-chrome-512x512.png" alt="Xtra DevPilot Logo" width="128" height="128" />
</p>

An open-source **AI Browser Bridge** for your IDE. Connect Google Chrome directly to any Model Context Protocol (MCP) compatible AI assistant (such as Cursor Composer, Windsurf, or Claude Desktop) so it can inspect the live DOM, capture screenshots, intercept network requests, read console logs, and interact with the page—all without you leaving your editor.

---

## 🚀 Key Features

* 🌐 **AI Browser Bridge**: Gives your IDE agent "eyes and hands" inside Google Chrome.
* 🛡️ **Local-First & Secure**: Runs entirely on a local loopback network (`127.0.0.1:42819`). Your source code and browser data never leave your device.
* 📸 **Visual Debugging**: Allows your agent to request viewport screenshots and extract LLM-friendly DOM snapshots.
* 🖱️ **Full Element Interaction**: Supports click simulation, keyboard typing, scrolling, and custom JavaScript execution.
* 🩺 **Console Hooks**: Directly reports browser logs and exceptions to assist in real-time debugging.

---

## 📐 Architecture Overview

Xtra DevPilot uses a three-part local architecture to establish a secure link between Chrome and your editor:

```
+--------------------------+                 +--------------------------+
|                          |    WebSocket    |                          |
|     Chrome Extension     |<--------------->|     Local MCP Server     |
| (Inspects DOM & console) |  (Port 42819)   |   (Stdio MCP Transport)  |
|                          |                 |                          |
+--------------------------+                 +--------------------------+
                                                          ^
                                                          | stdio (JSON-RPC)
                                                          v
                                             +--------------------------+
                                             |                          |
                                             |     IDE / MCP Client     |
                                             |  (Cursor, Claude, etc.)  |
                                             |                          |
                                             +--------------------------+
```

---

## 🛠️ Quick Start

### Prerequisites
* **Node.js** v18.0.0 or higher.
* **Google Chrome** (or any Chromium-based browser like Brave or Edge).
* An **MCP-compatible client** (e.g., Cursor, Claude Desktop).

---

### Step 1: Install the Chrome Extension

1. Clone this repository to your local machine:
   ```bash
   git clone https://github.com/om0852/XtraDevPilot.git
   ```
2. Open Chrome and navigate to: `chrome://extensions/`
3. In the top-right corner, toggle **Developer mode** to **ON**.
4. In the top-left corner, click **Load unpacked**.
5. Select the `extension/` folder inside your cloned `XtraDevPilot` directory.
6. The Xtra DevPilot extension icon will now appear in your browser toolbar. We recommend pinning it for easy access.

---

### Step 2: Start the MCP Server

The server acts as the Stdio bridge. You can run the server directly from NPM using `npx`:

```bash
npx xtradevpilot-mcp
```

*Alternatively, if running from source:*
```bash
cd mcp-server
npm install
npm start
```

---

### Step 3: Configure your IDE / Client

Add the local MCP server command to your client configurations.

#### 1. Cursor IDE Setup
1. Open **Cursor Settings** and select the **Features** tab.
2. Scroll down to the **MCP** section.
3. Click **+ Add New MCP Server**.
4. Enter the configuration:
   * **Name**: `Xtra DevPilot`
   * **Type**: `command`
   * **Command**: `npx -y xtradevpilot-mcp`
5. Click **Save**.

#### 2. Claude Desktop Setup
Open your Claude Desktop config file (located at `%appdata%\Claude\claude_desktop_config.json` on Windows or `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS) and add:

```json
{
  "mcpServers": {
    "xtra-devpilot": {
      "command": "npx",
      "args": ["-y", "xtradevpilot-mcp"]
    }
  }
}
```

---

## 🧰 Available MCP Tools

Once connected, Xtra DevPilot provides your AI agent with these capabilities:

| Tool Name | Parameters | Description |
|---|---|---|
| `get_dom_snapshot` | None | Returns a condensed, LLM-friendly structural snapshot of the active page DOM. |
| `capture_screenshot` | None | Captures a high-resolution base64 screenshot of the active browser viewport. |
| `interact_with_page` | `action` ("click" / "type" / "scroll"), `selector`, `text` | Simulates user inputs like clicks, scrolling, and entering values on page elements. |
| `evaluate_javascript` | `code` | Evaluates custom JavaScript in the context of the active webpage and returns output. |

---

## 💡 Example Prompt Instructions

Try using these prompts inside Cursor Composer or your agent window:
* > "Inspect the DOM of my current webpage and tell me why the submit button isn't clickable."
* > "Click the login link, then type my email into the input field."
* > "Evaluate `window.performance.timing` on my current tab and report the metrics."
* > "Check the active page console and summarize any warnings or errors."

---

## 🤖 Node.js Automation SDK

You can also use Xtra DevPilot as a programmatic browser automation SDK to run step-by-step test scripts directly in Node.js.

### Quick Start

```javascript
import { XtraDevPilot } from './sdk/index.js';

const pilot = new XtraDevPilot();

// Connect to Chrome extension via MCP bridge
await pilot.connect();

// Perform browser automation steps sequentially
await pilot.type('#email-input', 'test@example.com');
await pilot.click('#submit-btn');

// Capture screenshot & DOM
const dom = await pilot.getCleanDomSnapshot();
const screenshot = await pilot.captureScreenshot();

// Run security & a11y checks
const secReport = await pilot.runSecurityAudit();

await pilot.disconnect();
```

To run the bundled example automation test script:
```bash
node sdk/examples/test_automation.js
```


## 🔧 Troubleshooting

* **Extension shows red status**: Check that the server process is running and WebSocket port `42819` is free. Try clicking **Reconnect** in the extension popup.
* **WSL / Containers**: If running your IDE inside WSL, you may need to forward port `42819` to your Windows host so the extension can connect.
* **Permission issues**: Make sure the Chrome extension has permission to access your active tab pages.

---

## 🤝 Contributing

We welcome open-source contributions!
1. Fork the repo and create your feature branch: `git checkout -b feature/my-new-feature`.
2. Commit your changes: `git commit -am 'Add some feature'`.
3. Push to the branch: `git push origin feature/my-new-feature`.
4. Submit a Pull Request.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

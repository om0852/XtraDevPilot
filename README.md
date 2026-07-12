# Xtra DevPilot

AI Browser Bridge for your IDE. Connect Chrome to an MCP-enabled AI assistant so it can inspect the live DOM, console, and network without leaving your editor.

## Product

- Specializes in: browser-to-IDE automation, prompted web debugging, and AI-assisted QA
- Supports: Cursor, Claude Desktop, and compatible MCP clients
- Model: local relay bridge; browser data stays on-device

## What it does

- Reads live DOM and extracts an LLM-friendly view
- Captures browser screenshots
- Watches console logs and network requests
- Interacts with page elements: click, type, evaluate
- Mocks responses for frontend testing without a backend

## Tech stack

- Node.js runtime
- Chrome extension with injected scripts
- WebSocket bridge
- MCP protocol integration

## Repo structure

```
assets/                  Logos and image assets
demo/                   Demo static files
  index.html
  style1.css
  style2.css
extension/             Chrome extension
  background.js
  content.js
  injected.js
  popup.js
  devtools.html
  devtools.js
  panel.html
  manifest.json
  icon.png
mcp-server/            MCP server and bridge
  index.js
  get_dom.js
  package.json
README.md              You are here
```

## Requirements

- Node.js
- Chrome or Chromium browser
- An MCP-compatible IDE or client

## Setup

1. Install dependencies in `mcp-server/`.
2. Open Chrome and load the `extension/` folder as an unpacked extension.
3. Start the MCP server.
4. Add the server to your IDE/client MCP configuration.

## Usage ideas

- Debug a failing UI by asking the IDE to check console and network
- Capture the current page before reporting a bug
- Test UI flows by simulating clicks and form inputs
- Mock APIs to work offline

## Contributing

Improvements are welcome. Please update docs, add tests, and keep changes small and reviewable.

## License

MIT

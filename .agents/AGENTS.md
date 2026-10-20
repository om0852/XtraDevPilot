# Project-Scoped Agent Rules

## Architecture Decision Logging
When making significant architectural decisions, you MUST automatically log them to the XtraContext MCP server using the `call_mcp_tool` tool with `ServerName: xtracontext` and `ToolName: append_memory`.
Target Thread ID for logging: `e6947f22-bd07-4589-99a9-42012ad19236`

## Xtra DevPilot Browser Bridge Rules
- **Tool Availability**: The **Xtra DevPilot MCP Server** connects directly to the user's real, authenticated Google Chrome browser via a local WebSocket bridge (`ws://127.0.0.1:42819`).
- **When to Use**: Whenever the user asks to interact with, test, automate, scrape, inspect, or debug any web application, page, or localhost URL, use the Xtra DevPilot MCP tools.
- **Skill Activation**: For full workflows, detailed tool arguments, and operational recipes, refer to the [xtradevpilot](file:///c:/Users/salun/OneDrive%20-%20smarttech/Desktop/D%20folder/xtradevpilot/.agents/skills/xtradevpilot/SKILL.md) skill.
- **Key Operational Directives**:
  1. **Token Efficiency**: Always prefer `get_clean_dom_snapshot` (with `rootSelector` if possible) over `get_dom_snapshot` to save up to 94% tokens.
  2. **Form Automation**: Use `batch_fill_form` for filling forms rapidly in a single roundtrip (<200ms) with React/Vue-compatible setters.
  3. **Complex Comboboxes**: Use `smart_select_combobox` for modern searchable custom dropdowns (Workday, Greenhouse, ARIA comboboxes).
  4. **File Uploads**: Use `upload_file` for attaching local files (resumes, documents, images) to inputs or dropzones.
  5. **State & Store Inspection**: Use `execute_script` to evaluate runtime JavaScript in the page's MAIN execution context (e.g. `window.__REDUX_STORE__?.getState()`, Zustand, Pinia).
  6. **Visual Debugging**: Use `toggle_layout_debug_mode` for high-contrast red outlines and `inject_css` to preview CSS fixes without reload.
  7. **QA & Testing**: Use `assert_element_state` for deterministic pass/fail checks and `record_user_flow` to generate Playwright test scripts.

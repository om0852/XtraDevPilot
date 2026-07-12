# Project-Scoped Agent Rules

## Architecture Decision Logging
When making significant architectural decisions, you MUST automatically log them to the XtraContext MCP server using the `call_mcp_tool` tool with `ServerName: xtracontext` and `ToolName: append_memory`.
Target Thread ID for logging: `e6947f22-bd07-4589-99a9-42012ad19236`

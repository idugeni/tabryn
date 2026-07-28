# MCP Configuration

## Claude Code

Add Tabryn to Claude Code:

```bash
claude mcp add tabryn -- node /path/to/tabryn/dist/mcp/index.js
```

Or manually edit your MCP config:

```json
{
  "mcpServers": {
    "tabryn": {
      "command": "node",
      "args": ["/path/to/tabryn/dist/mcp/index.js"]
    }
  }
}
```

## Other MCP Clients

### OpenCode

Add to your MCP configuration:

```json
{
  "mcpServers": {
    "tabryn": {
      "command": "node",
      "args": ["/path/to/tabryn/dist/mcp/index.js"]
    }
  }
}
```

### Custom Integration

Tabryn uses stdio transport, compatible with any MCP client:

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "node",
  args: ["/path/to/tabryn/dist/mcp/index.js"],
});

const client = new Client({ name: "my-app", version: "1.0.0" });
await client.connect(transport);

// List tools
const tools = await client.listTools();

// Call a tool
const result = await client.callTool({
  name: "list_tabs",
  arguments: {},
});
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TABRYN_PORT` | `18766` | TCP port for MCP server ↔ Bridge communication |

## Troubleshooting

### "Not connected to Chrome"

1. Ensure Chrome is running
2. Ensure Tabryn extension is installed and enabled
3. Run `tabryn doctor` to diagnose

### "Tool not found"

1. Ensure MCP server is up to date
2. Check tool name spelling

### Connection timeout

1. Check if port 18766 is in use
2. Try setting `TABRYN_PORT` to a different port
3. Restart Chrome and MCP server

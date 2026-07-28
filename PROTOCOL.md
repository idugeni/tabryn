# Tabryn Protocol

## Overview

This document defines the typed, versioned protocol for communication between Tabryn components: MCP Server, Bridge (Native Messaging Host), and Chrome Extension.

## Protocol Version

Current version: `0.1.0`

Version format: `MAJOR.MINOR.PATCH`

- **MAJOR**: Breaking changes in message format or tool signatures
- **MINOR**: New tools or optional fields
- **PATCH**: Bug fixes, behavior corrections

## Message Format

All messages are JSON objects with required fields:

```typescript
interface BaseMessage {
  id: string;        // Unique message identifier
  type: string;      // Message type discriminator
  timestamp: number; // Unix timestamp in milliseconds
}
```

## Message Types

### tool_request

Sent from MCP Server → Bridge → Extension to execute a tool.

```typescript
interface ToolRequest extends BaseMessage {
  type: "tool_request";
  tool: string;               // Tool name (e.g., "list_tabs")
  args: Record<string, unknown>; // Tool arguments
}
```

### tool_response

Sent from Extension → Bridge → MCP Server with tool results.

```typescript
interface ToolResponse extends BaseMessage {
  type: "tool_response";
  tool: string;  // Tool name that was executed
  result: {
    content: Array<{
      type: "text";        // or "image"
      text?: string;       // For text results
      data?: string;       // Base64 for image results
      mimeType?: string;   // MIME type for images
    }>;
  };
}
```

### tool_error

Sent from Extension → Bridge → MCP Server when a tool fails.

```typescript
interface ToolErrorMessage extends BaseMessage {
  type: "tool_error";
  tool: string;  // Tool name that failed
  error: string; // Human-readable error message
  code?: string; // Optional error code
}
```

### heartbeat

Keep-alive messages sent periodically.

```typescript
interface HeartbeatMessage extends BaseMessage {
  type: "heartbeat";
}
```

### connect

Capability negotiation on initial connection.

```typescript
interface ConnectMessage extends BaseMessage {
  type: "connect";
  protocolVersion: string;
}
```

### disconnect

Connection closure notification.

```typescript
interface DisconnectMessage extends BaseMessage {
  type: "disconnect";
  reason?: string;
}
```

## Transport Protocols

### MCP Server ↔ Bridge (TCP)

- **Port**: 18766 (configurable via `TABRYN_PORT`)
- **Format**: Newline-delimited JSON
- **Host**: localhost only (127.0.0.1)

```
{"id":"msg_123","type":"tool_request","tool":"list_tabs","args":{},"timestamp":1234567890}\n
```

### Bridge ↔ Extension (Native Messaging)

Chrome's Native Messaging protocol:

```
[4 bytes: length (LE)] [JSON payload]
```

- **Max size (host → extension)**: 1 MB
- **Max size (extension → host)**: 64 MB

## Tool Definitions

### list_tabs

List all open Chrome tabs.

**Arguments:**
```typescript
{
  url_pattern?: string;    // Filter by URL (substring)
  title_pattern?: string;  // Filter by title (substring)
}
```

**Response:**
```typescript
{
  content: [{
    type: "text",
    text: JSON.stringify([{
      id: number,
      title: string,
      url: string,
      active: boolean,
      windowId: number,
      index: number
    }])
  }]
}
```

### navigate

Navigate a tab to a URL.

**Arguments:**
```typescript
{
  tab_id: number;
  url: string;  // URL or "back" / "forward"
}
```

### screenshot

Capture a screenshot of a tab.

**Arguments:**
```typescript
{
  tab_id: number;
  format?: "png" | "jpeg";
  quality?: number;  // 1-100 for JPEG
  region?: [number, number, number, number]; // [x, y, width, height]
}
```

**Response:**
```typescript
{
  content: [{
    type: "image",
    data: string,  // Base64 encoded
    mimeType: "image/png" | "image/jpeg"
  }]
}
```

### click

Click at coordinates on the page.

**Arguments:**
```typescript
{
  tab_id: number;
  x: number;
  y: number;
  button?: "left" | "right" | "middle";
  count?: number;  // 1=single, 2=double, 3=triple
  modifiers?: string[];  // ["ctrl"], ["shift"], etc.
}
```

### type

Type text into the focused element.

**Arguments:**
```typescript
{
  tab_id: number;
  text: string;
  delay?: number;  // ms between keystrokes
}
```

### read_page

Read the page accessibility tree.

**Arguments:**
```typescript
{
  tab_id: number;
  depth?: number;        // Max tree depth (default: 8)
  max_chars?: number;    // Max output chars (default: 30000)
  filter?: "interactive" | "all";
  ref_id?: string;       // Focus on specific element
}
```

### execute_js

Execute JavaScript in page context.

**Arguments:**
```typescript
{
  tab_id: number;
  expression: string;
}
```

### read_console

Read console messages.

**Arguments:**
```typescript
{
  tab_id: number;
  level?: "log" | "info" | "warn" | "error" | "debug";
  pattern?: string;  // Regex filter
  limit?: number;    // Max messages (default: 50)
  clear?: boolean;
}
```

### read_network

Read network requests.

**Arguments:**
```typescript
{
  tab_id: number;
  url_pattern?: string;
  method?: string;
  limit?: number;
  clear?: boolean;
}
```

## Connection Lifecycle

1. **Extension starts** → Calls `chrome.runtime.connectNative()` → Chrome launches Bridge
2. **Bridge starts** → Connects to MCP server via TCP
3. **MCP server starts** → Registers tools, waits for agent connection
4. **Agent connects** → Sends tool requests via stdio
5. **Requests flow**: Agent → MCP → Bridge → Extension → Chrome
6. **Responses flow**: Chrome → Extension → Bridge → MCP → Agent

## Reconnection

- Bridge automatically reconnects to MCP server on disconnect
- Exponential backoff: 1s, 2s, 4s, 8s, ... (max 30s)
- Max 30 reconnect attempts
- Extension re-launches Bridge on next `connectNative()` call

## Version Negotiation

On initial connection, components exchange protocol versions:

```json
{"type": "connect", "protocolVersion": "0.1.0"}
```

Compatibility: Same MAJOR version = compatible.

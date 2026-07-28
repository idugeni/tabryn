# Tabryn Security Model

## Trust Boundaries

Tabryn operates across three trust boundaries:

```
┌─────────────────────────────────────────────────────────────┐
│                     Untrusted Zone                          │
│  AI Agent / MCP Client                                      │
│  • May be a third-party tool                                │
│  • Receives only sanitized data                             │
└─────────────────────┬───────────────────────────────────────┘
                      │ MCP Protocol (stdio)
                      │ Validated, typed messages only
┌─────────────────────▼───────────────────────────────────────┐
│                     Tabryn Zone                              │
│  MCP Server + Bridge                                        │
│  • Validates all inputs                                     │
│  • Enforces tool permissions                                │
│  • No credential access                                     │
└─────────────────────┬───────────────────────────────────────┘
                      │ Native Messaging
                      │ Localhost only
┌─────────────────────▼───────────────────────────────────────┐
│                     Trusted Zone                             │
│  Chrome Extension + Browser                                 │
│  • Has access to browser APIs                               │
│  • Controls what data is exposed                            │
│  • User's authenticated sessions                            │
└─────────────────────────────────────────────────────────────┘
```

## Security Principles

### 1. No Credential Exposure

Tabryn NEVER exposes:
- Cookies
- Passwords
- Session tokens
- API keys
- Browser authentication data

The extension only returns:
- Tab metadata (title, URL)
- Page content (DOM, text)
- Screenshots (visual representation)
- Console messages
- Network request metadata (URLs, methods, status codes — no headers with auth tokens)

### 2. Local-Only Communication

All communication happens on localhost:
- MCP Server ↔ Bridge: TCP on 127.0.0.1:18766
- Bridge ↔ Extension: Chrome Native Messaging (localhost only)

No external network access is required or performed.

### 3. Input Validation

All messages are validated before processing:
- JSON schema validation via Zod
- Type checking on all fields
- Tool argument validation
- Rate limiting on tool calls

### 4. Permission Boundaries

Users control what Tabryn can access:
- Only tabs the user can see are listed
- Extension requires explicit installation
- Native Messaging host requires user approval
- No silent background operation

## Threat Model

### T1: Malicious MCP Client

**Risk**: A malicious AI agent tries to extract sensitive data.

**Mitigation**:
- Tabryn only returns sanitized data (no cookies/tokens)
- Network requests show URLs but not auth headers
- Page content is text/DOM, not raw HTTP responses
- Tool calls are logged and auditable

### T2: Network Interception

**Risk**: An attacker intercepts communication between components.

**Mitigation**:
- All communication on localhost (127.0.0.1)
- TCP connection requires local process
- Native Messaging is OS-level IPC
- No external network ports exposed

### T3: Extension Compromise

**Risk**: A malicious extension replaces Tabryn.

**Mitigation**:
- Extension requires manual installation
- User must explicitly load unpacked extension
- Extension ID is recorded in manifest
- Users should verify extension source

### T4: Bridge Process Injection

**Risk**: A malicious process connects to the TCP port.

**Mitigation**:
- Bridge only accepts connections from localhost
- TCP port is not exposed externally
- Process runs with user permissions only
- No privileged operations performed

## Data Flow Security

### Tool Request Flow

```
1. Agent sends tool_request (via stdio)
2. MCP server validates message schema
3. MCP server validates tool name exists
4. MCP server validates tool arguments
5. Request forwarded to Bridge via TCP
6. Bridge forwards to Extension via Native Messaging
7. Extension validates and executes
8. Response flows back through same chain
```

### Data Sanitization

| Data Type | Source | What's Exposed | What's Hidden |
|-----------|--------|----------------|---------------|
| Tabs | chrome.tabs | id, title, url, windowId | None (public info) |
| Page DOM | accessibility tree | Structure, text, refs | Raw HTML hidden |
| Console | CDP Runtime | Log messages | No stack traces unless requested |
| Network | CDP Network | URL, method, status | Auth headers, cookies, body |
| Screenshot | CDP Page | Visual image | No page data |

## Audit Trail

Tabryn logs:
- Tool calls (name, arguments, timestamp)
- Connection events
- Errors

Logs go to stderr of the MCP server process, visible to the agent.

## Recommendations

1. **Verify extension source** — Only install from trusted sources
2. **Review tool permissions** — Understand what each tool can do
3. **Monitor tool calls** — Watch for unexpected browser interactions
4. **Use in development** — Tabryn is designed for dev/testing, not production browsing
5. **Restart Chrome after install** — Ensures Native Messaging registration

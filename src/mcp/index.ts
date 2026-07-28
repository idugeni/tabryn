#!/usr/bin/env node

/**
 * Tabryn MCP Server
 *
 * Entry point for the MCP server process. Started by AI agents via stdio.
 * Communicates with the Chrome Extension via the Bridge (Native Messaging Host)
 * over a TCP connection on localhost.
 *
 * Architecture:
 *   AI Agent ←stdio→ MCP Server ←TCP→ Bridge ←Native Messaging→ Extension ←→ Chrome
 *
 * @module mcp
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { TOOLS, getToolDefinition } from "./tools.js";
import { BridgeClient } from "./bridge-client.js";
import { PROTOCOL_VERSION, DEFAULT_PORT, TOOL_TIMEOUT_MS } from "../shared/constants.js";

// ─── State ──────────────────────────────────────────────────────────

let server: McpServer;
let bridge: BridgeClient;
let connected = false;

// ─── Cleanup ────────────────────────────────────────────────────────

function exitClean(code = 0): void {
  try {
    if (bridge) bridge.disconnect();
  } catch {
    // ignore
  }
  process.exit(code);
}

process.on("SIGTERM", () => exitClean(0));
process.on("SIGINT", () => exitClean(0));
process.stdin.on("end", () => exitClean(0));
process.stdin.resume();

// ─── Bridge Connection ──────────────────────────────────────────────

async function connectToBridge(): Promise<void> {
  const port = parseInt(process.env.TABRYN_PORT || "", 10) || DEFAULT_PORT;

  bridge = new BridgeClient(port);

  bridge.on("connected", () => {
    connected = true;
    process.stderr.write(`[tabryn] Bridge connected on port ${port}\n`);
  });

  bridge.on("disconnected", () => {
    connected = false;
    process.stderr.write("[tabryn] Bridge disconnected\n");
  });

  bridge.on("error", (err: Error) => {
    process.stderr.write(`[tabryn] Bridge error: ${err.message}\n`);
  });

  await bridge.connect();
}

// ─── Tool Handler ───────────────────────────────────────────────────

function coerceArgs(args: Record<string, unknown>): Record<string, unknown> {
  if (!args || typeof args !== "object") return args;

  // Coerce stringified numbers that MCP clients may send
  const numericFields = ["tab_id", "depth", "max_chars", "quality", "amount", "limit", "timeout_ms", "delay"];
  for (const field of numericFields) {
    if (typeof args[field] === "string") {
      const num = Number(args[field]);
      if (!isNaN(num)) args[field] = num;
    }
  }

  // Coerce stringified arrays
  const arrayFields = ["region", "modifiers"];
  for (const field of arrayFields) {
    if (typeof args[field] === "string") {
      try {
        args[field] = JSON.parse(args[field] as string);
      } catch {
        // keep as-is
      }
    }
  }

  // Coerce coordinate pair
  if (typeof args.coordinate === "string") {
    try {
      args.coordinate = JSON.parse(args.coordinate as string);
    } catch {
      // keep as-is
    }
  }

  return args;
}

async function handleToolCall(
  name: string,
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: "text"; text: string } | { type: "image"; data: string; mimeType: string }> }> {
  if (!connected || !bridge) {
    return {
      content: [
        {
          type: "text" as const,
          text: "Error: Not connected to Chrome. Ensure the Tabryn extension is installed and Chrome is running. Run 'tabryn doctor' for diagnostics.",
        },
      ],
    };
  }

  const toolDef = getToolDefinition(name);
  if (!toolDef) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Error: Unknown tool '${name}'. Available tools: ${TOOLS.map((t) => t.name).join(", ")}`,
        },
      ],
    };
  }

  const coerced = coerceArgs(args);

  try {
    const result = await bridge.callTool(name, coerced, TOOL_TIMEOUT_MS);

    if (typeof result === "string") {
      return { content: [{ type: "text" as const, text: result }] };
    }

    if (result && typeof result === "object" && "content" in result) {
      const r = result as { content: Array<{ type: string; text?: string; data?: string; mimeType?: string }> };
      return {
        content: r.content.map((c) => {
          if (c.type === "text") {
            return { type: "text" as const, text: c.text || "" };
          }
          if (c.type === "image") {
            return { type: "image" as const, data: c.data || "", mimeType: c.mimeType || "image/png" };
          }
          return { type: "text" as const, text: JSON.stringify(c) };
        }),
      };
    }

    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text" as const, text: `Error: ${message}` }],
    };
  }
}

// ─── Main ───────────────────────────────────────────────────────────

async function main(): Promise<void> {
  process.stderr.write(`[tabryn] Starting MCP server (v${PROTOCOL_VERSION})\n`);

  // Connect to bridge
  try {
    await connectToBridge();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[tabryn] Failed to connect to bridge: ${message}\n`);
    process.stderr.write("[tabryn] Make sure Chrome is running with the Tabryn extension.\n");
    process.stderr.write("[tabryn] Run 'tabryn doctor' for diagnostics.\n");
    exitClean(1);
  }

  // Create MCP server
  server = new McpServer({
    name: "tabryn",
    version: PROTOCOL_VERSION,
  });

  // Register tools
  for (const tool of TOOLS) {
    server.tool(
      tool.name,
      tool.description,
      tool.inputSchema.shape,
      async (args: Record<string, unknown>) => handleToolCall(tool.name, args)
    );
  }

  // Connect via stdio
  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.stderr.write("[tabryn] MCP server ready\n");
}

main().catch((err) => {
  process.stderr.write(`[tabryn] Fatal: ${err.message}\n`);
  exitClean(1);
});

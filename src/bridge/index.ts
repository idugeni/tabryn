#!/usr/bin/env node

/**
 * Tabryn Bridge (Native Messaging Host)
 *
 * Runs as a Native Messaging Host process launched by Chrome when the
 * extension calls chrome.runtime.connectNative(). Bridges between:
 *   - Chrome Extension (Native Messaging: stdin/stdout with 4-byte LE length prefix)
 *   - MCP Server (TCP on localhost)
 *
 * Architecture:
 *   AI Agent ←stdio→ MCP Server ←TCP→ Bridge (this) ←Native Messaging→ Extension ←→ Chrome
 *
 * @module bridge
 */

import net from "node:net";
import { DEFAULT_PORT, ERROR_CODES } from "../shared/constants.js";
import { decodeNativeMessages, createToolErrorMessage } from "../shared/protocol.js";
import type { AnyMessage, ToolRequest } from "../shared/types.js";

// ─── State ──────────────────────────────────────────────────────────

let tcpSocket: net.Socket | null = null;
let tcpBuffer = "";
let reconnectTimer: ReturnType<typeof setInterval> | null = null;

// ─── Native Messaging (stdin/stdout) ────────────────────────────────

let stdinBuffer: Buffer<ArrayBufferLike> = Buffer.alloc(0);

function writeNativeMessage(msg: AnyMessage): void {
  const json = JSON.stringify(msg);
  const jsonBuffer = Buffer.from(json, "utf-8");
  const header = Buffer.alloc(4);
  header.writeUInt32LE(jsonBuffer.length, 0);
  process.stdout.write(header);
  process.stdout.write(jsonBuffer);
}

process.stdin.on("data", (chunk: Buffer) => {
  stdinBuffer = Buffer.concat([stdinBuffer, chunk]);
  const { messages, remainder } = decodeNativeMessages(stdinBuffer);
  stdinBuffer = remainder;

  for (const msg of messages) {
    handleNativeMessage(msg);
  }
});

process.stdin.on("end", () => {
  if (tcpSocket) tcpSocket.destroy();
  process.exit(0);
});

// ─── TCP Connection to MCP Server ───────────────────────────────────

function connectTcp(): void {
  if (tcpSocket) return;

  const port = parseInt(process.env.TABRYN_PORT || "", 10) || DEFAULT_PORT;

  tcpSocket = new net.Socket();

  tcpSocket.connect(port, "127.0.0.1", () => {
    if (reconnectTimer) {
      clearInterval(reconnectTimer);
      reconnectTimer = null;
    }
  });

  tcpSocket.on("data", (chunk: Buffer) => {
    tcpBuffer += chunk.toString("utf-8");

    let newlineIdx: number;
    while ((newlineIdx = tcpBuffer.indexOf("\n")) !== -1) {
      const line = tcpBuffer.substring(0, newlineIdx).trim();
      tcpBuffer = tcpBuffer.substring(newlineIdx + 1);

      if (!line) continue;

      try {
        const msg = JSON.parse(line) as AnyMessage;
        writeNativeMessage(msg);
      } catch {
        // Skip malformed
      }
    }
  });

  tcpSocket.on("error", () => {
    tcpSocket = null;
  });

  tcpSocket.on("close", () => {
    tcpSocket = null;
    if (!reconnectTimer) {
      reconnectTimer = setInterval(() => {
        if (!tcpSocket) connectTcp();
      }, 1500);
    }
  });
}

// ─── Message Handling ───────────────────────────────────────────────

function handleNativeMessage(msg: AnyMessage): void {
  if (msg.type === "heartbeat") return;

  // Forward tool requests to MCP server via TCP
  if (msg.type === "tool_request") {
    const toolMsg = msg as ToolRequest;
    if (tcpSocket && !tcpSocket.destroyed) {
      tcpSocket.write(JSON.stringify(msg) + "\n");
    } else {
      // No TCP connection — send error back to extension
      writeNativeMessage(
        createToolErrorMessage(
          toolMsg.id,
          toolMsg.tool,
          "Tabryn MCP server is not connected. Start it with: tabryn mcp",
          ERROR_CODES.CONNECTION_FAILED
        )
      );
    }
    return;
  }

  // Forward responses from MCP server to extension
  if (msg.type === "tool_response" || msg.type === "tool_error") {
    writeNativeMessage(msg);
    return;
  }
}

// ─── Main ───────────────────────────────────────────────────────────

process.stderr.write("[tabryn-bridge] Starting\n");
connectTcp();

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
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { DEFAULT_PORT, ERROR_CODES } from "../shared/constants.js";
import { decodeNativeMessages, createToolErrorMessage } from "../shared/protocol.js";
import type { AnyMessage, ToolRequest, RegisterMessage } from "../shared/types.js";

const NATIVE_HOST_NAME = "io.tabryn.native_host";

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

  // Handle extension registration (auto-configure)
  if (msg.type === "register") {
    const registerMsg = msg as RegisterMessage;
    handleExtensionRegister(registerMsg.extensionId);
    return;
  }

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

// ─── Extension Registration (Auto-Configure) ────────────────────────

function handleExtensionRegister(extensionId: string): void {
  process.stderr.write(`[tabryn-bridge] Extension registered: ${extensionId}\n`);

  // Get manifest path
  const manifestDir = getNativeHostManifestPath();
  const manifestPath = path.join(manifestDir, `${NATIVE_HOST_NAME}.json`);

  if (!fs.existsSync(manifestPath)) {
    process.stderr.write(`[tabryn-bridge] Manifest not found: ${manifestPath}\n`);
    return;
  }

  // Read and update manifest
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));

    // Check if already configured
    if (manifest.allowed_origins?.some((o: string) => o.includes(extensionId))) {
      process.stderr.write(`[tabryn-bridge] Extension ID already configured\n`);
      return;
    }

    // Update manifest with actual Extension ID
    manifest.allowed_origins = [`chrome-extension://${extensionId}/`];
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    process.stderr.write(`[tabryn-bridge] Manifest updated with Extension ID: ${extensionId}\n`);
    process.stderr.write(`[tabryn-bridge] Reload extension to apply changes\n`);

    // Send confirmation to extension
    writeNativeMessage({
      id: `reg_${Date.now()}`,
      type: "registered",
      success: true,
      extensionId,
      timestamp: Date.now(),
    } as AnyMessage);
  } catch (err) {
    process.stderr.write(`[tabryn-bridge] Failed to update manifest: ${err}\n`);
  }
}

function getNativeHostManifestPath(): string {
  const platform = process.platform;

  switch (platform) {
    case "win32":
      return path.join(os.homedir(), "AppData", "Local", "Tabryn", "native_hosts");
    case "darwin":
      return path.join(
        os.homedir(),
        "Library",
        "Application Support",
        "Google",
        "Chrome",
        "NativeMessagingHosts"
      );
    case "linux":
      return path.join(os.homedir(), ".config", "google-chrome", "NativeMessagingHosts");
    default:
      return "";
  }
}

// ─── Main ───────────────────────────────────────────────────────────

process.stderr.write("[tabryn-bridge] Starting\n");
connectTcp();

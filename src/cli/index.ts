#!/usr/bin/env node

/**
 * Tabryn CLI
 *
 * Command-line interface for managing Tabryn:
 *   tabryn install  — Set up the native messaging host
 *   tabryn mcp      — Start the MCP server
 *   tabryn doctor   — Diagnose connection issues
 *
 * @module cli
 */

import { Command } from "commander";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import net from "node:net";
import { PROTOCOL_VERSION, DEFAULT_PORT } from "../shared/constants.js";

const NATIVE_HOST_NAME = "io.tabryn.native_host";
const EXTENSION_DIR = path.resolve(import.meta.dirname || __dirname, "../../extension");

// ─── Platform Helpers ───────────────────────────────────────────────

function getPlatform() {
  return process.platform as "win32" | "darwin" | "linux";
}

function getChromePaths(): string[] {
  const platform = getPlatform();

  switch (platform) {
    case "win32": {
      const localAppData = process.env.LOCALAPPDATA || "";
      const programFiles = process.env["PROGRAMFILES"] || "C:\\Program Files";
      const programFilesX86 = process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)";
      return [
        path.join(localAppData, "Google", "Chrome", "Application", "chrome.exe"),
        path.join(programFiles, "Google", "Chrome", "Application", "chrome.exe"),
        path.join(programFilesX86, "Google", "Chrome", "Application", "chrome.exe"),
      ];
    }
    case "darwin":
      return ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"];
    case "linux":
      return ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium-browser"];
    default:
      return [];
  }
}

function getNativeHostManifestPath(): string {
  const platform = getPlatform();

  switch (platform) {
    case "win32":
      // On Windows, Native Messaging hosts are registered in the Windows Registry
      // We'll create a .reg file and a JSON manifest
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

function getHostExecutablePath(): string {
  // The native host is a Node.js script
  const bridgePath = path.resolve(import.meta.dirname || __dirname, "../../dist/bridge/index.js");
  return `node "${bridgePath}"`;
}

// ─── Commands ───────────────────────────────────────────────────────

const program = new Command();

program
  .name("tabryn")
  .description("The Browser Runtime for AI Agents")
  .version(PROTOCOL_VERSION);

// ─── tabryn install ─────────────────────────────────────────────────

program
  .command("install")
  .description("Set up the native messaging host and extension")
  .action(async () => {
    console.log("Tabryn Installer");
    console.log("================\n");

    // 1. Check Node.js
    const nodeVersion = process.version;
    const major = parseInt(nodeVersion.slice(1).split(".")[0] || "0", 10);
    if (major < 18) {
      console.error(`Error: Node.js v18+ required (found ${nodeVersion})`);
      process.exit(1);
    }
    console.log(`[OK] Node.js ${nodeVersion}`);

    // 2. Check Chrome
    const chromePaths = getChromePaths();
    const chromePath = chromePaths.find((p) => fs.existsSync(p));
    if (chromePath) {
      console.log(`[OK] Chrome found: ${chromePath}`);
    } else {
      console.log("[WARN] Chrome not found in default locations. Ensure Chrome is installed.");
    }

    // 3. Build the project
    console.log("\nBuilding project...");
    try {
      execSync("npm run build", { cwd: path.resolve(import.meta.dirname || __dirname, "../.."), stdio: "inherit" });
      console.log("[OK] Build complete");
    } catch {
      console.error("[ERROR] Build failed. Run 'npm run build' manually to see errors.");
      process.exit(1);
    }

    // 4. Create native messaging host manifest
    const manifestDir = getNativeHostManifestPath();
    fs.mkdirSync(manifestDir, { recursive: true });

    const manifest = {
      name: NATIVE_HOST_NAME,
      description: "Tabryn Native Messaging Host",
      path: getHostExecutablePath(),
      type: "stdio",
      allowed_origins: ["chrome-extension://PLACEHOLDER_EXTENSION_ID/"],
    };

    const manifestPath = path.join(manifestDir, `${NATIVE_HOST_NAME}.json`);
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`[OK] Native host manifest created: ${manifestPath}`);

    // 5. Register on Windows (Registry)
    if (getPlatform() === "win32") {
      try {
        const regPath = `HKCU\\SOFTWARE\\Google\\Chrome\\NativeMessagingHosts\\${NATIVE_HOST_NAME}`;
        execSync(`reg add "${regPath}" /ve /t REG_SZ /d "${manifestPath.replace(/\\/g, "\\\\")}" /f`, {
          stdio: "pipe",
        });
        console.log("[OK] Registered in Windows Registry");
      } catch {
        console.log("[WARN] Could not register in Windows Registry. You may need to run as administrator.");
        console.log(`       Manual: Add key HKCU\\SOFTWARE\\Google\\Chrome\\NativeMessagingHosts\\${NATIVE_HOST_NAME}`);
        console.log(`       Value: ${manifestPath}`);
      }
    }

    // 6. Instructions
    console.log("\n================");
    console.log("Installation Steps:");
    console.log("================");
    console.log("\n1. Load the extension:");
    console.log("   - Open chrome://extensions");
    console.log("   - Enable 'Developer mode'");
    console.log("   - Click 'Load unpacked'");
    console.log(`   - Select: ${EXTENSION_DIR}`);
    console.log("   - Copy the Extension ID shown");
    console.log(`\n2. Update manifest with your Extension ID:`);
    console.log(`   Edit: ${manifestPath}`);
    console.log('   Replace "PLACEHOLDER_EXTENSION_ID" with your actual Extension ID');
    console.log("\n3. Reload the extension in chrome://extensions (click 🔄 icon)");
    console.log("\n4. Add Tabryn to your MCP client:");
    console.log("   For Claude Code:");
    console.log(`     claude mcp add tabryn -- node "${path.resolve(import.meta.dirname || __dirname, "../../dist/mcp/index.js")}"`);
    console.log("   For other MCP clients, add to your MCP config:");
    console.log(`     command: node`);
    console.log(`     args: ["${path.resolve(import.meta.dirname || __dirname, "../../dist/mcp/index.js")}"`);
    console.log("\n5. Run 'tabryn doctor' to verify setup");
  });

// ─── tabryn mcp ─────────────────────────────────────────────────────

program
  .command("mcp")
  .description("Start the MCP server (stdio transport)")
  .action(async () => {
    // Dynamically import and start the MCP server
    await import("../mcp/index.js");
  });

// ─── tabryn doctor ──────────────────────────────────────────────────

program
  .command("doctor")
  .description("Diagnose Tabryn setup and connection issues")
  .action(async () => {
    console.log("Tabryn Doctor");
    console.log("=============\n");

    let issues = 0;

    // 1. Node.js version
    const nodeVersion = process.version;
    const major = parseInt(nodeVersion.slice(1).split(".")[0] || "0", 10);
    if (major >= 18) {
      console.log(`[OK] Node.js ${nodeVersion}`);
    } else {
      console.log(`[ERROR] Node.js v18+ required (found ${nodeVersion})`);
      issues++;
    }

    // 2. Chrome detection
    const chromePaths = getChromePaths();
    const chromePath = chromePaths.find((p) => fs.existsSync(p));
    if (chromePath) {
      console.log(`[OK] Chrome found: ${chromePath}`);
    } else {
      console.log("[WARN] Chrome not found in default locations");
      issues++;
    }

    // 3. Native host manifest
    const manifestDir = getNativeHostManifestPath();
    const manifestPath = path.join(manifestDir, `${NATIVE_HOST_NAME}.json`);
    if (fs.existsSync(manifestPath)) {
      console.log(`[OK] Native host manifest: ${manifestPath}`);
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      if (manifest.allowed_origins?.some((o: string) => o !== "chrome-extension://PLACEHOLDER_EXTENSION_ID/")) {
        console.log("[OK] Extension ID configured in manifest");
      } else {
        console.log("[WARN] Extension ID not configured in manifest. Run 'tabryn install' first.");
        issues++;
      }
    } else {
      console.log("[WARN] Native host manifest not found. Run 'tabryn install' first.");
      issues++;
    }

    // 4. Build output
    const distPath = path.resolve(import.meta.dirname || __dirname, "../../dist");
    if (fs.existsSync(distPath)) {
      console.log("[OK] Build output exists");
    } else {
      console.log("[WARN] Build output not found. Run 'npm run build' first.");
      issues++;
    }

    // 5. Extension directory
    if (fs.existsSync(EXTENSION_DIR) && fs.existsSync(path.join(EXTENSION_DIR, "manifest.json"))) {
      console.log(`[OK] Extension directory: ${EXTENSION_DIR}`);
    } else {
      console.log("[ERROR] Extension directory not found");
      issues++;
    }

    // 6. MCP port availability
    const port = parseInt(process.env.TABRYN_PORT || "", 10) || DEFAULT_PORT;
    const portInUse = await new Promise<boolean>((resolve) => {
      const server = net.createServer();
      server.once("error", () => resolve(true));
      server.once("listening", () => {
        server.close(() => resolve(false));
      });
      server.listen(port, "127.0.0.1");
    });

    if (!portInUse) {
      console.log(`[OK] Port ${port} available`);
    } else {
      console.log(`[INFO] Port ${port} in use (Tabryn server may be running)`);
    }

    // 7. Extension files check
    const requiredFiles = ["manifest.json", "background.js"];
    const missingFiles = requiredFiles.filter((f) => !fs.existsSync(path.join(EXTENSION_DIR, f)));
    if (missingFiles.length === 0) {
      console.log("[OK] Extension files present");
    } else {
      console.log(`[ERROR] Missing extension files: ${missingFiles.join(", ")}`);
      issues++;
    }

    // Summary
    console.log("\n=============");
    if (issues === 0) {
      console.log("All checks passed! Tabryn is ready.");
      console.log("\nNext steps:");
      console.log("  1. Load the extension in Chrome");
      console.log("  2. Add Tabryn to your MCP client");
      console.log("  3. Start using Tabryn!");
    } else {
      console.log(`Found ${issues} issue(s). Check above for details.`);
    }
  });

// ─── Parse ──────────────────────────────────────────────────────────

program.parse();

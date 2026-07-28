/**
 * Tabryn Constants
 *
 * Shared constants used across all components.
 *
 * @module shared/constants
 */

import { PROTOCOL_VERSION } from "./types.js";

// ─── Network ────────────────────────────────────────────────────────

/** Default TCP port for MCP server <-> Bridge communication */
export const DEFAULT_PORT = 18766;

/** Maximum message size in bytes (1 MB) */
export const MAX_MESSAGE_SIZE = 1024 * 1024;

// ─── Timeouts ───────────────────────────────────────────────────────

/** Default tool execution timeout in milliseconds */
export const TOOL_TIMEOUT_MS = 60_000;

/** Heartbeat interval in milliseconds */
export const HEARTBEAT_INTERVAL_MS = 15_000;

/** Connection timeout in milliseconds */
export const CONNECTION_TIMEOUT_MS = 10_000;

/** Reconnect base delay in milliseconds */
export const RECONNECT_BASE_DELAY_MS = 1_000;

/** Maximum reconnect attempts */
export const MAX_RECONNECT_ATTEMPTS = 30;

// ─── Protocol ───────────────────────────────────────────────────────

export { PROTOCOL_VERSION };

/** Protocol version compatibility range */
export const PROTOCOL_VERSION_RANGE = {
  min: "0.1.0",
  max: "0.1.0",
};

// ─── Error Codes ────────────────────────────────────────────────────

export const ERROR_CODES = {
  CONNECTION_FAILED: "CONNECTION_FAILED",
  CONNECTION_TIMEOUT: "CONNECTION_TIMEOUT",
  CONNECTION_CLOSED: "CONNECTION_CLOSED",
  TOOL_NOT_FOUND: "TOOL_NOT_FOUND",
  TOOL_TIMEOUT: "TOOL_TIMEOUT",
  TOOL_EXECUTION_FAILED: "TOOL_EXECUTION_FAILED",
  PROTOCOL_ERROR: "PROTOCOL_ERROR",
  PROTOCOL_VERSION_MISMATCH: "PROTOCOL_VERSION_MISMATCH",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  BROWSER_NOT_CONNECTED: "BROWSER_NOT_CONNECTED",
  TAB_NOT_FOUND: "TAB_NOT_FOUND",
  TAB_CREATION_FAILED: "TAB_CREATION_FAILED",
  NAVIGATION_FAILED: "NAVIGATION_FAILED",
  JS_EXECUTION_FAILED: "JS_EXECUTION_FAILED",
  SCREENSHOT_FAILED: "SCREENSHOT_FAILED",
  PERMISSION_DENIED: "PERMISSION_DENIED",
  INVALID_REQUEST: "INVALID_REQUEST",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

// ─── Chrome Extension ───────────────────────────────────────────────

/** Extension name for Native Messaging host */
export const NATIVE_HOST_NAME = "io.tabryn.native_host";

/** Native Messaging message size limits */
export const NATIVE_MSG_LIMITS = {
  /** Max message size from host to extension (1 MB) */
  hostToExtension: 1024 * 1024,
  /** Max message size from extension to host (64 MB) */
  extensionToHost: 64 * 1024 * 1024,
};

// ─── Platform Paths ─────────────────────────────────────────────────

export const CONFIG_DIR_NAME = "tabryn";

export const PLATFORM_PATHS = {
  win32: {
    nativeHostsDir: () => "Registry",
    configDir: () => {
      const appData = process.env.APPDATA || "";
      return appData ? `${appData}\\tabryn` : undefined;
    },
  },
  darwin: {
    nativeHostsDir: (browser: string) => {
      const home = process.env.HOME || "";
      const browserPath =
        browser === "chrome"
          ? "Google/Chrome"
          : browser === "brave"
            ? "BraveSoftware/Brave-Browser"
            : "Microsoft Edge";
      return `${home}/Library/Application Support/${browserPath}/NativeMessagingHosts`;
    },
    configDir: () => {
      const home = process.env.HOME || "";
      return `${home}/.config/tabryn`;
    },
  },
  linux: {
    nativeHostsDir: (browser: string) => {
      const home = process.env.HOME || "";
      const browserPath =
        browser === "chrome"
          ? "google-chrome"
          : browser === "brave"
            ? "brave-browser"
            : "microsoft-edge";
      return `${home}/.config/${browserPath}/NativeMessagingHosts`;
    },
    configDir: () => {
      const home = process.env.HOME || "";
      return `${home}/.config/tabryn`;
    },
  },
} as const;

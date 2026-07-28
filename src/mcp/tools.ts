/**
 * Tabryn MCP Tool Definitions
 *
 * Defines all tools exposed via MCP with schemas and descriptions.
 *
 * @module mcp/tools
 */

import { z } from "zod";
import type { ToolName } from "../shared/types.js";

// ─── Tool Definition Type ───────────────────────────────────────────

export interface ToolDefinition {
  name: ToolName;
  description: string;
  inputSchema: z.ZodObject<z.ZodRawShape>;
}

// ─── Tool Definitions ───────────────────────────────────────────────

export const TOOLS: ToolDefinition[] = [
  {
    name: "list_tabs",
    description:
      "List all open Chrome tabs with their IDs, titles, and URLs. Use this to find the tab you want to work with. Supports filtering by URL or title pattern.",
    inputSchema: z.object({
      url_pattern: z.string().optional().describe("Filter by URL pattern (substring match)"),
      title_pattern: z.string().optional().describe("Filter by title pattern (substring match)"),
    }),
  },
  {
    name: "select_tab",
    description:
      "Activate/select a specific Chrome tab by its ID. The tab will be focused and brought to the foreground.",
    inputSchema: z.object({
      tab_id: z.number().describe("Tab ID to select (from list_tabs)"),
    }),
  },
  {
    name: "create_tab",
    description: "Create a new Chrome tab. Returns the new tab's ID.",
    inputSchema: z.object({
      url: z.string().optional().describe("URL to open (defaults to about:blank)"),
      active: z.boolean().optional().describe("Whether the tab should be focused"),
    }),
  },
  {
    name: "close_tab",
    description: "Close a Chrome tab by its ID.",
    inputSchema: z.object({
      tab_id: z.number().describe("Tab ID to close"),
    }),
  },
  {
    name: "navigate",
    description:
      "Navigate a tab to a URL, or go back/forward in history. Use tab_id from list_tabs or select_tab.",
    inputSchema: z.object({
      tab_id: z.number().describe("Tab ID to navigate"),
      url: z.string().describe('URL to navigate to, or "back" / "forward"'),
    }),
  },
  {
    name: "read_page",
    description:
      "Read the accessibility tree / page structure of a tab. Returns a compact representation of visible elements with reference IDs for interaction. Use filter='interactive' to only get clickable/typable elements.",
    inputSchema: z.object({
      tab_id: z.number().describe("Tab ID to read"),
      depth: z.number().optional().describe("Max tree depth (default: 8)"),
      max_chars: z.number().optional().describe("Max output characters (default: 30000)"),
      filter: z
        .enum(["interactive", "all"])
        .optional()
        .describe('"interactive" for inputs/buttons/links, "all" for everything'),
      ref_id: z.string().optional().describe("Focus on a specific element by reference ID"),
    }),
  },
  {
    name: "screenshot",
    description:
      "Take a screenshot of the current state of a tab. Returns a base64-encoded PNG image. Optionally capture a specific region.",
    inputSchema: z.object({
      tab_id: z.number().describe("Tab ID to screenshot"),
      format: z.enum(["png", "jpeg"]).optional().describe("Image format (default: png)"),
      quality: z.number().optional().describe("JPEG quality 1-100"),
      region: z
        .tuple([z.number(), z.number(), z.number(), z.number()])
        .optional()
        .describe("Region [x, y, width, height] to capture"),
    }),
  },
  {
    name: "click",
    description:
      "Click at specific coordinates on the page. Use screenshot or read_page to determine coordinates first.",
    inputSchema: z.object({
      tab_id: z.number().describe("Tab ID"),
      x: z.number().describe("X coordinate"),
      y: z.number().describe("Y coordinate"),
      button: z.enum(["left", "right", "middle"]).optional().describe("Mouse button"),
      count: z.number().optional().describe("Click count: 1=single, 2=double, 3=triple"),
      modifiers: z.array(z.string()).optional().describe('Modifier keys: ["ctrl"], ["shift"], etc'),
    }),
  },
  {
    name: "type",
    description: "Type text into the currently focused element on a tab.",
    inputSchema: z.object({
      tab_id: z.number().describe("Tab ID"),
      text: z.string().describe("Text to type"),
      delay: z.number().optional().describe("Delay between keystrokes in ms"),
    }),
  },
  {
    name: "scroll",
    description: "Scroll the page in a tab in the specified direction.",
    inputSchema: z.object({
      tab_id: z.number().describe("Tab ID"),
      direction: z.enum(["up", "down", "left", "right"]).describe("Scroll direction"),
      amount: z.number().optional().describe("Number of scroll ticks (default: 3)"),
      x: z.number().optional().describe("X coordinate to scroll at"),
      y: z.number().optional().describe("Y coordinate to scroll at"),
    }),
  },
  {
    name: "form_input",
    description:
      "Set the value of a form element using its reference ID from read_page. Works with text inputs, checkboxes, selects, etc.",
    inputSchema: z.object({
      tab_id: z.number().describe("Tab ID"),
      ref: z.string().describe("Element reference ID from read_page"),
      value: z.union([z.string(), z.number(), z.boolean()]).describe("Value to set"),
    }),
  },
  {
    name: "execute_js",
    description:
      "Execute JavaScript in the page context of a tab. The expression is evaluated and its result returned. Use for reading DOM state, calling page functions, etc.",
    inputSchema: z.object({
      tab_id: z.number().describe("Tab ID"),
      expression: z.string().describe("JavaScript expression to evaluate"),
    }),
  },
  {
    name: "read_console",
    description:
      "Read console messages (log, error, warn, etc.) from a tab. Useful for debugging. Supports filtering by level and pattern.",
    inputSchema: z.object({
      tab_id: z.number().describe("Tab ID"),
      level: z.enum(["log", "info", "warn", "error", "debug"]).optional().describe("Filter by level"),
      pattern: z.string().optional().describe("Regex pattern to filter messages"),
      limit: z.number().optional().describe("Max messages to return (default: 50)"),
      clear: z.boolean().optional().describe("Clear messages after reading"),
    }),
  },
  {
    name: "read_network",
    description:
      "Read HTTP network requests from a tab. Useful for debugging API calls and monitoring network activity.",
    inputSchema: z.object({
      tab_id: z.number().describe("Tab ID"),
      url_pattern: z.string().optional().describe("Filter by URL substring"),
      method: z.string().optional().describe("Filter by HTTP method"),
      limit: z.number().optional().describe("Max requests to return (default: 50)"),
      clear: z.boolean().optional().describe("Clear requests after reading"),
    }),
  },
  {
    name: "reload",
    description: "Reload a tab. Optionally bypass cache.",
    inputSchema: z.object({
      tab_id: z.number().describe("Tab ID"),
      ignore_cache: z.boolean().optional().describe("Bypass cache on reload"),
    }),
  },
  {
    name: "wait",
    description: "Wait for a condition on a tab before proceeding.",
    inputSchema: z.object({
      tab_id: z.number().describe("Tab ID"),
      condition: z
        .enum(["load", "idle", "dom_ready", "network_idle"])
        .describe("Condition to wait for"),
      timeout_ms: z.number().optional().describe("Max wait time in ms (default: 10000)"),
    }),
  },
];

// ─── Lookup ─────────────────────────────────────────────────────────

export function getToolDefinition(name: string): ToolDefinition | undefined {
  return TOOLS.find((t) => t.name === name);
}

export function getToolNames(): ToolName[] {
  return TOOLS.map((t) => t.name);
}

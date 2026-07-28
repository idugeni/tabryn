/**
 * Tabryn Protocol Types
 *
 * Defines the typed contract between MCP Server, Bridge (Native Host),
 * and Chrome Extension. All communication uses these types.
 *
 * @module shared/types
 */

// ─── Protocol Version ───────────────────────────────────────────────

export const PROTOCOL_VERSION = "0.1.0";

// ─── Message Types ──────────────────────────────────────────────────

export type MessageType =
  | "tool_request"
  | "tool_response"
  | "tool_error"
  | "connect"
  | "disconnect"
  | "heartbeat"
  | "error"
  | "register"
  | "registered";

// ─── Core Messages ──────────────────────────────────────────────────

export interface TabrynMessage {
  id: string;
  type: MessageType;
  timestamp: number;
}

export interface ConnectMessage extends TabrynMessage {
  type: "connect";
  protocolVersion: string;
}

export interface DisconnectMessage extends TabrynMessage {
  type: "disconnect";
  reason?: string;
}

export interface HeartbeatMessage extends TabrynMessage {
  type: "heartbeat";
}

export interface ErrorMessage extends TabrynMessage {
  type: "error";
  error: string;
  code?: string;
}

export interface RegisterMessage extends TabrynMessage {
  type: "register";
  extensionId: string;
}

export interface RegisteredMessage extends TabrynMessage {
  type: "registered";
  success: boolean;
  extensionId: string;
}

// ─── Tool Messages ──────────────────────────────────────────────────

export interface ToolRequest extends TabrynMessage {
  type: "tool_request";
  tool: string;
  args: Record<string, unknown>;
}

export interface ToolResponse extends TabrynMessage {
  type: "tool_response";
  tool: string;
  result: ToolResult;
}

export interface ToolErrorMessage extends TabrynMessage {
  type: "tool_error";
  tool: string;
  error: string;
  code?: string;
}

// ─── Tab ────────────────────────────────────────────────────────────

export interface TabInfo {
  id: number;
  title: string;
  url: string;
  favIconUrl?: string;
  active: boolean;
  windowId: number;
  index: number;
  status?: string;
  width?: number;
  height?: number;
}

// ─── Tool Names ─────────────────────────────────────────────────────

export type ToolName =
  | "list_tabs"
  | "select_tab"
  | "create_tab"
  | "close_tab"
  | "navigate"
  | "read_page"
  | "screenshot"
  | "click"
  | "type"
  | "scroll"
  | "form_input"
  | "execute_js"
  | "read_console"
  | "read_network"
  | "reload"
  | "wait";

// ─── Tool Arguments ─────────────────────────────────────────────────

export interface ListTabsArgs {
  /** Filter by URL pattern (substring match) */
  url_pattern?: string;
  /** Filter by title pattern (substring match) */
  title_pattern?: string;
}

export interface SelectTabArgs {
  /** Tab ID to select/activate */
  tab_id: number;
}

export interface CreateTabArgs {
  /** URL to open in the new tab. Defaults to about:blank */
  url?: string;
  /** Whether the tab should be active (focused) */
  active?: boolean;
}

export interface CloseTabArgs {
  /** Tab ID to close */
  tab_id: number;
}

export interface NavigateArgs {
  /** Tab ID to navigate */
  tab_id: number;
  /** URL to navigate to, or "back" / "forward" */
  url: string;
}

export interface ReadPageArgs {
  /** Tab ID to read */
  tab_id: number;
  /** Maximum depth for accessibility tree traversal */
  depth?: number;
  /** Maximum characters for output */
  max_chars?: number;
  /** Filter: "interactive" for inputs/buttons/links only, "all" for everything */
  filter?: "interactive" | "all";
  /** Reference ID of a parent element to focus on */
  ref_id?: string;
}

export interface ScreenshotArgs {
  /** Tab ID to capture */
  tab_id: number;
  /** Format: "png" or "jpeg" */
  format?: "png" | "jpeg";
  /** Quality for JPEG (1-100) */
  quality?: number;
  /** Region to capture: [x, y, width, height] */
  region?: [number, number, number, number];
}

export interface ClickArgs {
  /** Tab ID */
  tab_id: number;
  /** X coordinate */
  x: number;
  /** Y coordinate */
  y: number;
  /** Click type */
  button?: "left" | "right" | "middle";
  /** Click count (1=single, 2=double, 3=triple) */
  count?: number;
  /** Modifier keys */
  modifiers?: string[];
}

export interface TypeArgs {
  /** Tab ID */
  tab_id: number;
  /** Text to type */
  text: number;
  /** Delay between keystrokes in ms */
  delay?: number;
}

export interface ScrollArgs {
  /** Tab ID */
  tab_id: number;
  /** Scroll direction */
  direction: "up" | "down" | "left" | "right";
  /** Number of scroll ticks */
  amount?: number;
  /** X coordinate to scroll at */
  x?: number;
  /** Y coordinate to scroll at */
  y?: number;
}

export interface FormInputArgs {
  /** Tab ID */
  tab_id: number;
  /** Element reference ID from read_page */
  ref: string;
  /** Value to set */
  value: string | number | boolean;
}

export interface ExecuteJsArgs {
  /** Tab ID */
  tab_id: number;
  /** JavaScript code to execute */
  expression: string;
}

export interface ReadConsoleArgs {
  /** Tab ID */
  tab_id: number;
  /** Filter by log level */
  level?: "log" | "info" | "warn" | "error" | "debug";
  /** Regex pattern to filter messages */
  pattern?: string;
  /** Maximum messages to return */
  limit?: number;
  /** Clear messages after reading */
  clear?: boolean;
}

export interface ReadNetworkArgs {
  /** Tab ID */
  tab_id: number;
  /** URL pattern to filter (substring match) */
  url_pattern?: string;
  /** Filter by HTTP method */
  method?: string;
  /** Maximum requests to return */
  limit?: number;
  /** Clear requests after reading */
  clear?: boolean;
}

export interface ReloadArgs {
  /** Tab ID */
  tab_id: number;
  /** Whether to bypass cache */
  ignore_cache?: boolean;
}

export interface WaitArgs {
  /** Tab ID */
  tab_id: number;
  /** Condition to wait for */
  condition: "load" | "idle" | "dom_ready" | "network_idle";
  /** Maximum time to wait in milliseconds */
  timeout_ms?: number;
}

// ─── Tool Results ───────────────────────────────────────────────────

export interface ToolResult {
  content: ToolResultContent[];
}

export type ToolResultContent =
  | TextResult
  | ImageResult
  | ErrorResult;

export interface TextResult {
  type: "text";
  text: string;
}

export interface ImageResult {
  type: "image";
  data: string; // base64
  mimeType: string;
}

export interface ErrorResult {
  type: "error";
  error: string;
  code?: string;
}

// ─── Capability Negotiation ─────────────────────────────────────────

export interface CapabilityRequest {
  protocolVersion: string;
  tools: ToolName[];
}

export interface CapabilityResponse {
  protocolVersion: string;
  supportedTools: ToolName[];
  browser?: string;
  browserVersion?: string;
}

// ─── Union Types ────────────────────────────────────────────────────

export type AnyMessage =
  | ConnectMessage
  | DisconnectMessage
  | HeartbeatMessage
  | ErrorMessage
  | RegisterMessage
  | RegisteredMessage
  | ToolRequest
  | ToolResponse
  | ToolErrorMessage;

export type ToolArgs =
  | ListTabsArgs
  | SelectTabArgs
  | CreateTabArgs
  | CloseTabArgs
  | NavigateArgs
  | ReadPageArgs
  | ScreenshotArgs
  | ClickArgs
  | TypeArgs
  | ScrollArgs
  | FormInputArgs
  | ExecuteJsArgs
  | ReadConsoleArgs
  | ReadNetworkArgs
  | ReloadArgs
  | WaitArgs;

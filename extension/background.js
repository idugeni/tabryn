/**
 * Tabryn Extension — Background Service Worker
 *
 * Connects to the Tabryn Bridge via Native Messaging and handles
 * tool requests for browser automation using Chrome DevTools Protocol.
 *
 * @module extension/background
 */

// ─── Native Messaging Connection ────────────────────────────────────

const NATIVE_HOST_NAME = "io.tabryn.native_host";
let nativePort = null;
let reconnectTimer = null;
const RECONNECT_INTERVAL = 2000;
let isRegistered = false;

// ─── CDP State ──────────────────────────────────────────────────────

const debuggerState = new Map(); // tabId -> { attached: boolean }
const consoleMessages = new Map(); // tabId -> message[]
const networkRequests = new Map(); // tabId -> request[]

// ─── Keep-Alive ─────────────────────────────────────────────────────

chrome.alarms.create("keepalive", { periodInMinutes: 0.4 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "keepalive") {
    // Keep the service worker alive
  }
});

// ─── Native Messaging ───────────────────────────────────────────────

function connectNative() {
  if (nativePort) return;

  try {
    nativePort = chrome.runtime.connectNative(NATIVE_HOST_NAME);

    nativePort.onMessage.addListener((msg) => {
      handleBridgeMessage(msg);
    });

    nativePort.onDisconnect.addListener(() => {
      console.warn("[Tabryn] Native host disconnected:", chrome.runtime.lastError?.message);
      nativePort = null;
      isRegistered = false;
      scheduleReconnect();
    });

    // Auto-register: send extension ID on first connection
    if (!isRegistered) {
      sendToBridge({
        type: "register",
        extensionId: chrome.runtime.id,
        timestamp: Date.now(),
      });
    }
  } catch (err) {
    console.error("[Tabryn] Failed to connect native host:", err);
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectNative();
  }, RECONNECT_INTERVAL);
}

function sendToBridge(msg) {
  if (nativePort) {
    nativePort.postMessage(msg);
  }
}

// ─── Message Router ─────────────────────────────────────────────────

async function handleBridgeMessage(msg) {
  if (!msg || !msg.type) return;

  switch (msg.type) {
    case "tool_request":
      await handleToolRequest(msg);
      break;
    case "heartbeat":
      // Respond to keep alive
      sendToBridge({ id: msg.id, type: "heartbeat", timestamp: Date.now() });
      break;
    case "registered":
      // Extension ID was registered successfully
      if (msg.success) {
        isRegistered = true;
        console.log(`[Tabryn] Extension registered with ID: ${msg.extensionId}`);
      }
      break;
  }
}

// ─── Tool Request Handler ───────────────────────────────────────────

async function handleToolRequest(msg) {
  const { id, tool, args } = msg;

  try {
    let result;

    switch (tool) {
      case "list_tabs":
        result = await toolListTabs(args);
        break;
      case "select_tab":
        result = await toolSelectTab(args);
        break;
      case "create_tab":
        result = await toolCreateTab(args);
        break;
      case "close_tab":
        result = await toolCloseTab(args);
        break;
      case "navigate":
        result = await toolNavigate(args);
        break;
      case "read_page":
        result = await toolReadPage(args);
        break;
      case "screenshot":
        result = await toolScreenshot(args);
        break;
      case "click":
        result = await toolClick(args);
        break;
      case "type":
        result = await toolType(args);
        break;
      case "scroll":
        result = await toolScroll(args);
        break;
      case "form_input":
        result = await toolFormInput(args);
        break;
      case "execute_js":
        result = await toolExecuteJs(args);
        break;
      case "read_console":
        result = await toolReadConsole(args);
        break;
      case "read_network":
        result = await toolReadNetwork(args);
        break;
      case "reload":
        result = await toolReload(args);
        break;
      case "wait":
        result = await toolWait(args);
        break;
      default:
        throw new Error(`Unknown tool: ${tool}`);
    }

    sendToBridge({ id, type: "tool_response", tool, result, timestamp: Date.now() });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    sendToBridge({ id, type: "tool_error", tool, error, timestamp: Date.now() });
  }
}

// ─── CDP Helpers ────────────────────────────────────────────────────

async function ensureDebugger(tabId) {
  if (debuggerState.has(tabId) && debuggerState.get(tabId).attached) {
    return;
  }

  return new Promise((resolve, reject) => {
    chrome.debugger.attach({ tabId }, "1.1", () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      debuggerState.set(tabId, { attached: true });

      // Enable console capture
      chrome.debugger.sendCommand({ tabId }, "Console.enable", {}, () => {
        // Enable network capture
        chrome.debugger.sendCommand({ tabId }, "Network.enable", {}, () => {
          // Listen for console messages
          chrome.debugger.onEvent.addListener((source, method, params) => {
            if (source.tabId !== tabId) return;

            if (method === "Runtime.consoleAPICalled") {
              if (!consoleMessages.has(tabId)) consoleMessages.set(tabId, []);
              consoleMessages.get(tabId).push({
                level: params.type,
                text: params.args?.map((a) => a.value ?? a.description ?? "").join(" ") ?? "",
                timestamp: Date.now(),
              });
              // Keep only last 200 messages
              const msgs = consoleMessages.get(tabId);
              if (msgs.length > 200) msgs.splice(0, msgs.length - 200);
            }

            if (method === "Network.requestWillBeSent") {
              if (!networkRequests.has(tabId)) networkRequests.set(tabId, []);
              networkRequests.get(tabId).push({
                url: params.request.url,
                method: params.request.method,
                requestId: params.requestId,
                timestamp: Date.now(),
                type: params.type,
              });
              // Keep only last 100 requests
              const reqs = networkRequests.get(tabId);
              if (reqs.length > 100) reqs.splice(0, reqs.length - 100);
            }

            if (method === "Network.responseReceived") {
              const reqs = networkRequests.get(tabId) || [];
              const req = reqs.find((r) => r.requestId === params.requestId);
              if (req) {
                req.status = params.response.status;
                req.statusText = params.response.statusText;
                req.headers = params.response.headers;
              }
            }
          });

          resolve();
        });
      });
    });
  });
}

function detachDebugger(tabId) {
  if (debuggerState.has(tabId)) {
    chrome.debugger.detach({ tabId }, () => {
      debuggerState.delete(tabId);
    });
  }
}

async function cdpCommand(tabId, method, params = {}) {
  await ensureDebugger(tabId);
  return new Promise((resolve, reject) => {
    chrome.debugger.sendCommand({ tabId }, method, params, (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(result);
    });
  });
}

// ─── Tool Implementations ───────────────────────────────────────────

async function toolListTabs(args) {
  const tabs = await chrome.tabs.query({});
  let filtered = tabs.map((t) => ({
    id: t.id,
    title: t.title || "",
    url: t.url || "",
    favIconUrl: t.favIconUrl,
    active: t.active,
    windowId: t.windowId,
    index: t.index,
    status: t.status,
    width: t.width,
    height: t.height,
  }));

  if (args.url_pattern) {
    const pattern = args.url_pattern.toLowerCase();
    filtered = filtered.filter((t) => t.url.toLowerCase().includes(pattern));
  }

  if (args.title_pattern) {
    const pattern = args.title_pattern.toLowerCase();
    filtered = filtered.filter((t) => t.title.toLowerCase().includes(pattern));
  }

  return { content: [{ type: "text", text: JSON.stringify(filtered, null, 2) }] };
}

async function toolSelectTab(args) {
  await chrome.tabs.update(args.tab_id, { active: true });
  const tab = await chrome.tabs.get(args.tab_id);
  if (tab.windowId) {
    await chrome.windows.update(tab.windowId, { focused: true });
  }
  return { content: [{ type: "text", text: `Tab ${args.tab_id} selected: ${tab.title}` }] };
}

async function toolCreateTab(args) {
  const tab = await chrome.tabs.create({
    url: args.url || "about:blank",
    active: args.active !== false,
  });
  return { content: [{ type: "text", text: JSON.stringify({ id: tab.id, url: tab.url }) }] };
}

async function toolCloseTab(args) {
  await chrome.tabs.remove(args.tab_id);
  return { content: [{ type: "text", text: `Tab ${args.tab_id} closed` }] };
}

async function toolNavigate(args) {
  if (args.url === "back") {
    await chrome.tabs.goBack(args.tab_id);
  } else if (args.url === "forward") {
    await chrome.tabs.goForward(args.tab_id);
  } else {
    await chrome.tabs.update(args.tab_id, { url: args.url });
  }
  // Wait for navigation to complete
  await waitForTabLoad(args.tab_id);
  const tab = await chrome.tabs.get(args.tab_id);
  return { content: [{ type: "text", text: `Navigated to: ${tab.url}\nTitle: ${tab.title}` }] };
}

async function toolReadPage(args) {
  const tabId = args.tab_id;
  const maxChars = args.max_chars || 30000;
  const depth = args.depth || 8;
  const filter = args.filter || "all";

  // Use chrome.scripting to inject and get accessibility info
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: (maxChars, depth, filter) => {
      function getElementInfo(el, currentDepth) {
        if (currentDepth > depth) return null;
        if (!el || !el.tagName) return null;

        const rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0 && el.tagName !== "SCRIPT") return null;

        const tag = el.tagName.toLowerCase();
        const isInteractive = ["a", "button", "input", "select", "textarea", "details", "summary"].includes(tag) ||
          el.getAttribute("role") === "button" ||
          el.getAttribute("role") === "link" ||
          el.getAttribute("role") === "tab" ||
          el.tabIndex >= 0;

        if (filter === "interactive" && !isInteractive) {
          // Still recurse to find interactive children
          const children = [];
          for (const child of el.children) {
            const info = getElementInfo(child, currentDepth + 1);
            if (info) children.push(info);
          }
          return children.length > 0 ? { tag, children } : null;
        }

        const info = {
          tag,
          ref: `ref_${Math.random().toString(36).slice(2, 8)}`,
          role: el.getAttribute("role") || undefined,
          text: el.childNodes.length === 1 && el.childNodes[0].nodeType === 3
            ? el.childNodes[0].textContent?.trim().slice(0, 100)
            : undefined,
          ariaLabel: el.getAttribute("aria-label") || undefined,
          placeholder: el.getAttribute("placeholder") || undefined,
          href: el.getAttribute("href") || undefined,
          type: el.getAttribute("type") || undefined,
          name: el.getAttribute("name") || undefined,
          value: el.tagName === "INPUT" ? el.value : undefined,
          checked: el.tagName === "INPUT" ? el.checked : undefined,
          disabled: el.disabled || undefined,
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };

        // Assign ref to element for later use
        if (isInteractive || el.getAttribute("role")) {
          el.setAttribute("data-tabryn-ref", info.ref);
          window.__tabryn_refs = window.__tabryn_refs || {};
          window.__tabryn_refs[info.ref] = el;
        }

        const children = [];
        for (const child of el.children) {
          const childInfo = getElementInfo(child, currentDepth + 1);
          if (childInfo) children.push(childInfo);
        }
        if (children.length > 0) info.children = children;

        return info;
      }

      const body = document.body;
      if (!body) return "No body element found";

      const tree = getElementInfo(body, 0);
      const output = JSON.stringify(tree, null, 2);

      if (output.length > maxChars) {
        return output.slice(0, maxChars) + "\n... (truncated)";
      }
      return output;
    },
    args: [maxChars, depth, filter],
  });

  const text = results?.[0]?.result || "No content";
  return { content: [{ type: "text", text }] };
}

async function toolScreenshot(args) {
  const format = args.format || "png";
  const quality = args.quality;

  const options = { format };
  if (format === "jpeg" && quality) options.quality = quality;

  let dataUrl;

  if (args.region) {
    // Capture visible area then crop
    dataUrl = await cdpCommand(args.tab_id, "Page.captureScreenshot", {
      format,
      quality,
      clip: {
        x: args.region[0],
        y: args.region[1],
        width: args.region[2],
        height: args.region[3],
        scale: 1,
      },
    });
  } else {
    dataUrl = await cdpCommand(args.tab_id, "Page.captureScreenshot", {
      format,
      quality,
    });
  }

  const data = dataUrl?.data || "";
  const mimeType = format === "jpeg" ? "image/jpeg" : "image/png";

  return { content: [{ type: "image", data, mimeType }] };
}

async function toolClick(args) {
  const { tab_id, x, y, button = "left", count = 1, modifiers = [] } = args;

  // Parse modifiers
  const modifierMask = modifiers.reduce((mask, mod) => {
    switch (mod.toLowerCase()) {
      case "alt": return mask | 1;
      case "ctrl": return mask | 2;
      case "meta": case "cmd": return mask | 4;
      case "shift": return mask | 8;
      default: return mask;
    }
  }, 0);

  const buttonMap = { left: "left", middle: "middle", right: "right" };

  for (let i = 0; i < count; i++) {
    await cdpCommand(tab_id, "Input.dispatchMouseEvent", {
      type: "mousePressed",
      x,
      y,
      button: buttonMap[button] || "left",
      clickCount: 1,
      modifiers: modifierMask,
    });
    await cdpCommand(tab_id, "Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x,
      y,
      button: buttonMap[button] || "left",
      clickCount: 1,
      modifiers: modifierMask,
    });

    if (i < count - 1) await sleep(50);
  }

  return { content: [{ type: "text", text: `Clicked at (${x}, ${y})` }] };
}

async function toolType(args) {
  const { tab_id, text, delay = 0 } = args;

  for (const char of text) {
    await cdpCommand(tab_id, "Input.dispatchKeyEvent", {
      type: "keyDown",
      text: char,
    });
    await cdpCommand(tab_id, "Input.dispatchKeyEvent", {
      type: "keyUp",
      text: char,
    });

    if (delay > 0) await sleep(delay);
  }

  return { content: [{ type: "text", text: `Typed ${text.length} characters` }] };
}

async function toolScroll(args) {
  const { tab_id, direction, amount = 3, x = 400, y = 300 } = args;

  const scrollMap = {
    up: { deltaX: 0, deltaY: -100 * amount },
    down: { deltaX: 0, deltaY: 100 * amount },
    left: { deltaX: -100 * amount, deltaY: 0 },
    right: { deltaX: 100 * amount, deltaY: 0 },
  };

  const scroll = scrollMap[direction];

  await cdpCommand(tab_id, "Input.dispatchMouseEvent", {
    type: "mouseWheel",
    x,
    y,
    deltaX: scroll.deltaX,
    deltaY: scroll.deltaY,
  });

  return { content: [{ type: "text", text: `Scrolled ${direction} ${amount} ticks` }] };
}

async function toolFormInput(args) {
  const { tab_id, ref, value } = args;

  const results = await chrome.scripting.executeScript({
    target: { tab_id },
    func: (ref, value) => {
      const el = window.__tabryn_refs?.[ref] || document.querySelector(`[data-tabryn-ref="${ref}"]`);
      if (!el) throw new Error(`Element not found: ${ref}`);

      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
        el.value = value;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      } else if (el.tagName === "SELECT") {
        el.value = value;
        el.dispatchEvent(new Event("change", { bubbles: true }));
      } else if (el.getAttribute("role") === "checkbox") {
        el.setAttribute("aria-checked", String(value));
        el.click();
      }
    },
    args: [ref, value],
  });

  return { content: [{ type: "text", text: `Set value on ${ref}` }] };
}

async function toolExecuteJs(args) {
  const { tab_id, expression } = args;

  const results = await chrome.scripting.executeScript({
    target: { tab_id },
    func: (expr) => {
      try {
        return String(eval(expr));
      } catch (e) {
        return `Error: ${e.message}`;
      }
    },
    args: [expression],
  });

  const result = results?.[0]?.result ?? "undefined";
  return { content: [{ type: "text", text: result }] };
}

async function toolReadConsole(args) {
  const { tab_id, level, pattern, limit = 50, clear = false } = args;

  let msgs = consoleMessages.get(tab_id) || [];

  if (level) {
    msgs = msgs.filter((m) => m.level === level);
  }

  if (pattern) {
    try {
      const re = new RegExp(pattern, "i");
      msgs = msgs.filter((m) => re.test(m.text));
    } catch {
      msgs = msgs.filter((m) => m.text.includes(pattern));
    }
  }

  msgs = msgs.slice(-limit);

  if (clear) {
    consoleMessages.set(tab_id, []);
  }

  return { content: [{ type: "text", text: JSON.stringify(msgs, null, 2) }] };
}

async function toolReadNetwork(args) {
  const { tab_id, url_pattern, method, limit = 50, clear = false } = args;

  let reqs = networkRequests.get(tab_id) || [];

  if (url_pattern) {
    reqs = reqs.filter((r) => r.url.includes(url_pattern));
  }

  if (method) {
    reqs = reqs.filter((r) => r.method.toUpperCase() === method.toUpperCase());
  }

  reqs = reqs.slice(-limit);

  if (clear) {
    networkRequests.set(tab_id, []);
  }

  return { content: [{ type: "text", text: JSON.stringify(reqs, null, 2) }] };
}

async function toolReload(args) {
  const { tab_id, ignore_cache = false } = args;
  await chrome.tabs.reload(tab_id, { bypassCache: ignore_cache });
  await waitForTabLoad(tab_id);
  return { content: [{ type: "text", text: "Page reloaded" }] };
}

async function toolWait(args) {
  const { tab_id, condition = "load", timeout_ms = 10000 } = args;

  const startTime = Date.now();

  while (Date.now() - startTime < timeout_ms) {
    const tab = await chrome.tabs.get(tab_id);

    switch (condition) {
      case "load":
        if (tab.status === "complete") {
          return { content: [{ type: "text", text: "Page loaded" }] };
        }
        break;
      case "idle":
        // Check if there are active network requests
        const activeReqs = (networkRequests.get(tab_id) || []).filter(
          (r) => !r.status
        );
        if (activeReqs.length === 0 && tab.status === "complete") {
          return { content: [{ type: "text", text: "Page idle" }] };
        }
        break;
      case "dom_ready":
        if (tab.status === "complete") {
          return { content: [{ type: "text", text: "DOM ready" }] };
        }
        break;
      case "network_idle":
        const pending = (networkRequests.get(tab_id) || []).filter(
          (r) => !r.status
        );
        if (pending.length === 0 && tab.status === "complete") {
          return { content: [{ type: "text", text: "Network idle" }] };
        }
        break;
    }

    await sleep(200);
  }

  return { content: [{ type: "text", text: `Wait timed out after ${timeout_ms}ms` }] };
}

// ─── Helpers ────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForTabLoad(tabId) {
  return new Promise((resolve) => {
    const listener = (tid, changeInfo) => {
      if (tid === tabId && changeInfo.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);

    // Timeout after 30s
    setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }, 30000);
  });
}

// ─── Start ──────────────────────────────────────────────────────────

console.log("[Tabryn] Extension background starting...");
connectNative();

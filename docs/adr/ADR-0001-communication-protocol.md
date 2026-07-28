# ADR-0001: Communication Protocol between MCP Server and Chrome Extension

- Status: Accepted
- Date: 2026-07-29
- Type: Tipe 1 (pintu satu arah)
- Deciders: Tabryn maintainers

## Context

Tabryn needs to communicate between an MCP server (Node.js process) and a Chrome Extension. The MCP server is started by AI agents via stdio, while the Chrome Extension runs in the browser. We need a reliable, secure, and maintainable communication mechanism.

## Forces

| Force | Nilai | Sumber |
|---|---|---|
| Latency requirement | < 100ms per tool call | Peryataan user |
| Security | No external network exposure | Design requirement |
| Cross-platform | Windows, macOS, Linux | Design requirement |
| Installation complexity | Minimal user steps | Design requirement |
| Service worker lifecycle | Auto-shutdown after 30s idle | Chrome MV3 constraint |
| Reconnection reliability | Must handle disconnects | Design requirement |

## Opsi yang dipertimbangkan

### Opsi 0 — WebSocket (localhost)

MCP server runs a WebSocket server. Extension connects via `new WebSocket("ws://localhost:PORT")`.

Keuntungan: Simple setup, no OS-level registration, works immediately.
Rugyi: Service worker lifecycle issues (WebSocket dies when worker sleeps), need keep-alive mechanisms, non-standard for Chrome extension communication.

### Opsi 1 — Native Messaging + TCP Bridge

Extension calls `chrome.runtime.connectNative()` to launch a Bridge process. Bridge connects to MCP server via TCP.

Keuntungan: Chrome's standard extension-to-native communication, service worker stays alive while native port is open, proven pattern from production extensions.
Rugyi: Requires OS-level manifest registration, slightly more complex installation.

### Opsi 2 — CDP directly (Chrome launched with --remote-debugging-port)

MCP server connects directly to Chrome's DevTools Protocol port.

Keuntungan: No extension needed, direct access to CDP.
Rugyi: Requires Chrome to be launched with specific flags, can't use existing Chrome session, no extension for permission management, security concerns with remote debugging port.

## Matriks keputusan

| Dimensi | Bobot | Opsi 0 | Opsi 1 | Opsi 2 |
|---|---|---|---|---|
| Security | 3 | 4 | 5 | 2 |
| Reliability | 3 | 3 | 5 | 3 |
| Installation ease | 2 | 5 | 3 | 2 |
| Service worker compat | 3 | 2 | 5 | 5 |
| Cross-platform | 2 | 5 | 4 | 3 |
| Maintainability | 2 | 4 | 4 | 3 |
| **Total tertimbang** | | 54 | 70 | 50 |

## Keputusan

Kami memilih **Opsi 1: Native Messaging + TCP Bridge** karena reliability dan compatibility dengan Chrome's service worker lifecycle. Native Messaging memastikan service worker tetap hidup saat koneksi terbuka, dan TCP bridge memungkinkan multiple MCP server instances berbagi satu extension.

## Konsekuensi

- Jadi lebih mudah: Service worker lifecycle ter-manage oleh Chrome
- Jadi lebih sulit: Installasi perlu OS-level manifest registration
- Utang yang sengaja diambil: Extension harus di-load manual (unpackaged)

## Rencana bertahap

| # | Langkah | Bisa di-merge sendiri | Cara verifikasi |
|---|---|---|---|
| 1 | Implement TCP server in MCP | ya | Unit test |
| 2 | Implement Native Messaging Host | ya | Unit test |
| 3 | Implement Extension connection | ya | Manual test with Chrome |
| 4 | Create install script | ya | Fresh install test |

## Blast radius

- `src/mcp/` — MCP server implementation
- `src/bridge/` — Native Messaging Host
- `extension/` — Chrome Extension
- `src/shared/protocol.ts` — Protocol types

## Kriteria pembatalan

Kami menyatakan keputusan ini salah jika:
- Native Messaging reliability proves insufficient for production use
- Installation complexity causes significant user friction
- Chrome changes Native Messaging API incompatibly

Tinjau ulang jika Chrome MV4 introduces fundamental changes to extension-native communication.

## Pertanyaan terbuka

- Haruskan kita support WebSocket sebagai fallback untuk environments yang tidak support Native Messaging?
- Bagaimana handle multiple Chrome profiles?

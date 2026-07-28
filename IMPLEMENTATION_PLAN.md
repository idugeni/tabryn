# Tabryn Implementation Plan

## v0.1.0 — MVP (Current)

### Status: In Progress

### Core Features

- [x] MCP Server with stdio transport
- [x] 16 browser tools
- [x] Chrome Extension (Manifest V3)
- [x] Native Messaging Bridge
- [x] Typed protocol with version negotiation
- [x] CLI: install, mcp, doctor
- [x] Cross-platform support
- [x] Unit tests (61 tests)
- [x] Documentation (README, ARCHITECTURE, PROTOCOL, SECURITY)

### Remaining for v0.1.0

- [ ] Fresh-install validation on real Chrome
- [ ] E2E test with real browser
- [ ] Extension icon refinement
- [ ] Security audit
- [ ] GitHub repository creation
- [ ] v0.1.0 release tag

## v0.2.0 — Enhanced Interaction

### Planned Features

- [ ] Element reference tracking (click by ref)
- [ ] Improved accessibility tree output
- [ ] Multiple tab selection
- [ ] Tab grouping
- [ ] Screenshot comparison/diffing
- [ ] Network request body capture
- [ ] Console message filtering improvements

## v0.3.0 — Developer Experience

### Planned Features

- [ ] `tabryn logs` command for viewing extension logs
- [ ] `tabryn config` command for managing settings
- [ ] Auto-detection of running Chrome instances
- [ ] Extension auto-update mechanism
- [ ] VS Code extension integration
- [ ] Improved error messages with suggestions

## v0.4.0 — Advanced Features

### Planned Features

- [ ] WebSocket fallback for environments without Native Messaging
- [ ] Multi-browser support (Edge, Brave)
- [ ] Recording and replay of browser sessions
- [ ] Performance metrics collection
- [ ] Custom tool definitions
- [ ] Plugin system for extending tools

## v1.0.0 — Production Ready

### Planned Features

- [ ] Full test coverage (>90%)
- [ ] Production-grade error handling
- [ ] Comprehensive documentation
- [ ] Security audit completion
- [ ] Performance optimization
- [ ] Community contributions welcome

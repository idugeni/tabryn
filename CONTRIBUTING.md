# Contributing to Tabryn

## Development Setup

### Prerequisites

- Node.js v18+
- npm
- Google Chrome

### Setup

```bash
git clone https://github.com/tabryn/tabryn.git
cd tabryn
npm install
npm run build
```

### Development

```bash
# Watch mode
npm run dev

# Run tests
npm test

# Type check
npm run typecheck

# Lint
npm run lint

# Format
npm run format
```

## Project Structure

```
tabryn/
├── src/
│   ├── shared/        # Types, constants, protocol, errors
│   ├── mcp/           # MCP server and bridge client
│   ├── bridge/        # Native Messaging Host
│   └── cli/           # CLI commands
├── extension/         # Chrome Extension
├── tests/             # Test files
├── docs/              # Documentation
└── scripts/           # Build scripts
```

## Adding a New Tool

1. Define the tool in `src/mcp/tools.ts`
2. Add types in `src/shared/types.ts`
3. Implement in `extension/background.js`
4. Add tests in `tests/`
5. Update documentation

## Testing

```bash
# Unit tests
npm test

# With coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## Code Style

- TypeScript strict mode
- ESLint for linting
- Prettier for formatting
- No comments unless necessary

## Pull Requests

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Ensure all tests pass
6. Submit a pull request

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

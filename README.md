# Claude Code Snapshot

A community-led reconstruction of a Claude Code-style terminal coding agent.

This project is rebuilding a large TypeScript CLI into a usable open development project with:

- a terminal-first coding workflow
- a recoverable command and tool runtime
- multi-provider model support
- a `models.dev`-backed model registry

## Why This Exists

The goal is simple:

- make the recovered codebase easier to run
- make the architecture easier to study
- make it practical for contributors to keep restoring and extending

This repository is aimed at:

- project users who want to inspect or experiment with the CLI
- contributors who want to help restore missing behavior

## Current Status

This project is **experimental**.

Available now:

- recovered source tree
- installable root project metadata
- Bun-based CLI entrypoint
- early provider support for `Anthropic`, `OpenAI`, and `Gemini`
- local `models.dev` snapshot and cache scaffolding

Still in progress:

- full type convergence
- complete subsystem restoration
- stable end-to-end command execution
- full multi-provider execution inside the main query loop

If you are evaluating this like a production-ready CLI, it is not there yet.

## Quick Start

### Requirements

- `Node.js >= 18`
- `npm`
- `Bun`

### Install

```bash
npm install --legacy-peer-deps --no-package-lock
```

### Start The CLI

```bash
bun run src/entrypoints/cli.tsx
```

Or:

```bash
npm run start
```

### Type Check

```bash
npx tsc --noEmit
```

Type checking is still expected to fail while reconstruction is ongoing.

## Development

### Common Commands

```bash
npm run start
npm run typecheck
npm run build
```

### Good Contribution Areas

- protocol and type cleanup
- missing runtime restoration
- MCP and bridge recovery
- provider execution integration
- architecture notes and documentation

### Current Priorities

1. reduce compatibility shims and temporary `@ts-nocheck` usage
2. finish message and protocol type convergence
3. restore bridge, MCP, task, and UI behavior
4. complete provider-neutral execution for Anthropic, OpenAI, and Gemini

## Architecture At A Glance

### Runtime Core

- [`src/main.tsx`](./src/main.tsx): top-level startup and orchestration
- [`src/entrypoints/cli.tsx`](./src/entrypoints/cli.tsx): CLI bootstrap
- [`src/QueryEngine.ts`](./src/QueryEngine.ts): session/query execution engine
- [`src/query.ts`](./src/query.ts): main conversation loop

### Tools And Commands

- [`src/tools.ts`](./src/tools.ts): tool registry
- [`src/Tool.ts`](./src/Tool.ts): shared tool contracts
- [`src/tools/`](./src/tools): tool implementations
- [`src/commands/`](./src/commands): slash commands and local flows

### Models And Providers

- [`src/providers/`](./src/providers): provider registry and auth lookup
- [`src/models/`](./src/models): `models.dev` snapshot and cache layer
- [`src/utils/model/`](./src/utils/model): aliases, options, validation, provider-facing helpers

### UI And Integration

- [`src/components/`](./src/components): terminal UI components
- [`src/screens/`](./src/screens): full-screen views
- [`src/services/mcp/`](./src/services/mcp): MCP integration
- [`src/bridge/`](./src/bridge): bridge and remote control
- [`src/services/oauth/`](./src/services/oauth): auth and token handling

## Repository Layout

```text
src/
├── entrypoints/   # CLI and SDK/bootstrap entrypoints
├── tools/         # Tool implementations
├── commands/      # Slash commands and local command flows
├── components/    # Ink/React UI components
├── screens/       # Full-screen terminal views
├── services/      # API, MCP, OAuth, analytics, compact, plugins
├── providers/     # Provider registry and connection logic
├── models/        # models.dev snapshot and cache integration
├── utils/         # Shared runtime helpers
├── bridge/        # Bridge and remote-control transport
├── remote/        # Remote session handling
├── state/         # App state and selectors
└── types/         # Compatibility and domain types
```

## Provider Direction

The reconstruction currently targets:

- `Anthropic`
- `OpenAI`
- `Gemini`

The intended flow is:

1. resolve a model from alias or `provider/model`
2. load credentials from env/settings
3. read capability and listing data from `models.dev`
4. dispatch execution through a provider adapter

Today, model listing and validation are ahead of full provider execution.

## Limitations

- many internal behaviors are still represented by compatibility shims
- some large recovered files still use temporary type suppression
- not every command or screen is stable
- private/internal original behaviors are sometimes replaced with open equivalents

## Roadmap

- stabilize the CLI startup path
- complete protocol and transcript type convergence
- restore bridge and MCP behavior end to end
- make the main query loop provider-neutral
- bring OpenAI and Gemini execution closer to Anthropic parity

## Tech Stack

- TypeScript
- Bun
- React
- Ink
- Zod
- MCP SDK
- Anthropic SDK
- AI SDK provider integrations

## License

See [LICENSE.md](./LICENSE.md).

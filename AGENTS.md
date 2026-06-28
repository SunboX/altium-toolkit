# AGENTS

## Project Overview

- Repository: `Altium Toolkit` JavaScript library.
- Source is in `src/`.
- Tests are in `tests/`.
- Specifications are in `spec/`.
- Documentation is in `docs/`.
- The package contains Altium parsing and non-interactive render utilities only.

## Build, Run, Test

- Install: `npm install`
- Test: `npm test`
- Format: `npm run format`
- Check formatting: `npm run check:format`

## Coding Style & Naming Conventions

- Prettier settings are in `.prettierrc.json`: 4-space indent, single quotes,
  no semicolons, no trailing commas.
- Keep files under 1000 lines; split modules/classes when they grow.
- Add JSDoc for every function/method, including private helpers.
- Add inline comments only where non-obvious behavior needs context.
- Utility modules should use class-based organization with static methods when
  appropriate.
- For single-class modules, name the `.mjs` file in CamelCase to match the
  class name.
- For private internals, use ECMAScript private elements.
- Prefer `async/await` for naturally asynchronous operations.

## Library Scope

- Include parser, OLE/binary helpers, schematic SVG rendering, PCB SVG
  rendering, BOM HTML rendering, selected-part library export adapters, 3D
  scene-description builders, and static 3D summary rendering.
- Do not add host app interaction to this library: no pan/zoom controllers, DOM
  event orchestration, OrbitControls runtime, picking, download UI, or app state.
- Keep parser and renderer fixes universal. Never special-case a specific file
  name, project identifier, fixture helper, or source-derived phrase.

## Fix Quality Rules

- Fixes must always address the general behavior, not a specific example,
  fixture, file, project, or test case.
- Do not implement workarounds, cheats, allowlists, hard-coded example handling,
  or special-case logic to make one sample pass.
- When you encounter existing workaround code, cheating behavior, or
  example-specific handling, rewrite it into general-purpose behavior
  immediately when it is in scope for the change.
- Keep fixes universal and structural: derive behavior from the underlying data
  model, format, protocol, or UI contract instead of matching known sample text,
  filenames, labels, or project identifiers.
- After fixing code, run the appropriate repo-owned tests and do not modify tests
  just to make a workaround pass.

## Testing Guidelines

- Use repo scripts only: `npm test`.
- For every feature/fix/behavior change, add or update tests in `tests/`.
- Keep tests focused on observable parser output and deterministic renderer
  markup.
- Tests must use repo-owned fake schematics and fake PCB samples only; never
  depend on or mention real customer, vendor, or project identifiers.
- Do not add native provided `.SchDoc` or `.PcbDoc` files under tests or any
  similar path.
- Fixture helper APIs, fixture file names, embedded labels, and assertions must
  stay obfuscated and non-source-descriptive.

## Commit & Pull Request Guidelines

- Commit messages start with a prefix like `fix:`, `feature:`, or `chore:`
  plus a short imperative summary.
- Keep pull request summaries concise and include test results.

## Security & Configuration Tips

- Keep secrets out of Git.
- Treat parsed documents as untrusted input.
- Prefer local-first defaults and document any outbound network behavior
  explicitly.

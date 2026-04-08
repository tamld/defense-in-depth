# CLI Reference

`defense-in-depth` operates primarily through git hooks, but also provides manual CLI commands for verification and diagnostics.

| Command | Description |
|:---|:---|
| `npx defense-in-depth init` | Install hooks + create config |
| `npx defense-in-depth init --scaffold` | Also create `.agents/` ecosystem (for agentic projects) |
| `npx defense-in-depth verify` | Run all enabled guards manually |
| `npx defense-in-depth verify --files a.md b.ts` | Target specific files |
| `npx defense-in-depth doctor` | Health check (config, hooks, custom guards) |

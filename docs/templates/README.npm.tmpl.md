# {{NAME}}

> {{TAGLINE}}

[![npm](https://img.shields.io/npm/v/{{INSTALL_NAME}}.svg)](https://www.npmjs.com/package/{{INSTALL_NAME}})
[![license](https://img.shields.io/npm/l/{{INSTALL_NAME}}.svg)](./LICENSE)

## Install

```bash
npm i {{INSTALL_NAME}}
# or
pnpm add {{INSTALL_NAME}}
# or run directly (CLIs only)
npx {{INSTALL_NAME}} --help
```

## Quick start

```ts
{{QUICK_START_CODE}}
```

## API

{{API_LINKS}}

<!-- BYOK env vars — only for AI-tool packages. Delete this section otherwise. -->
## BYOK env vars

This package brings your own API key. Looks up keys in this order:

| Var | Notes |
|---|---|
| `BILKO_<TOOL>_API_KEY` | Most specific. Set if you use multiple Bilko BYOK tools and want to scope a key per tool. |
| `<PROVIDER>_API_KEY` | E.g. `GEMINI_API_KEY`, `OPENAI_API_KEY`. The standard for that provider. |
| `--<provider>-key=<key>` | CLI flag. Overrides env. |

If none are set and you run interactively, the CLI prompts.

## Changelog

See [CHANGELOG.md](./CHANGELOG.md).

## License

MIT — see [LICENSE](./LICENSE).

---

Built by [Bilko](https://bilko.run). Free, ad-free, no signup.
[Repo]({{REPO_URL}}) · [Issues]({{REPO_URL}}/issues)

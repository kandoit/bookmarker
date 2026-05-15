# Bookmarker — Developer Notes

## Stack

pnpm monorepo → `packages/shared` (types, GitHub storage, Claude client) · `apps/web` (React SPA, GitHub Pages) · `apps/extension` (Chrome MV3)

```
pnpm install          # install all workspaces
pnpm dev              # web app dev server
pnpm build            # production build of web app
pnpm build:ext        # build Chrome extension → apps/extension/dist/
```

## Architecture

- **Storage**: bookmarks stored as JSON in a user-owned GitHub repo (`data/bookmarks.json`, `data/workspaces.json`) via GitHub Contents API. No backend.
- **AI**: Claude API called directly from the browser (`dangerouslyAllowBrowser: true`). Key stored in localStorage.
- **Routing**: HashRouter (`/#/`) — required for GitHub Pages (no server-side routing).
- **State**: Zustand with localStorage persistence. GitHub is source of truth; sync on load + debounced push on write.

## Deployment (GitHub Pages)

Push to `main` triggers `.github/workflows/deploy.yml` → builds `apps/web` → deploys via `actions/deploy-pages`.

One-time manual setup in the repo:
1. **Settings → Pages → Source → GitHub Actions**
2. **Settings → Environments → github-pages → Deployment branches → No restriction**

## Lessons Learnt

### pnpm version — one source of truth only

`pnpm/action-setup@v4` throws `ERR_PNPM_BAD_PM_VERSION` if it detects pnpm version from **more than one** source simultaneously. Ubuntu GitHub runners ship with corepack, which exposes any `packageManager` field in `package.json` as a second version declaration.

**Do not set both.** Pick exactly one:

```yaml
# ✅ workflow only (what we use)
- uses: pnpm/action-setup@v4
  with:
    version: 9.0.0
# package.json has NO "packageManager" field
```

```yaml
# ✅ package.json only (alternative)
- uses: pnpm/action-setup@v4
# package.json: "packageManager": "pnpm@9.0.0"
# runner must NOT have corepack pre-activating pnpm
```

```yaml
# ❌ both — always fails on ubuntu-latest
- uses: pnpm/action-setup@v4
  with:
    version: 9.0.0          # source 1
# package.json: "packageManager": "pnpm@9.0.0"  ← source 2
```

### Re-running vs new run

Clicking **Re-run** on a failed GitHub Actions job re-executes the workflow YAML **from that job's original commit**, not the current HEAD. Always trigger a **new** run (push a commit or use Actions → Run workflow) after fixing the workflow file.

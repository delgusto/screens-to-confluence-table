# Project: Screens → Confluence Table

## Commit workflow

After making code changes that pass `npm run typecheck` and `npm run build`:

1. Show a one-line summary of what changed
2. Ask the user: **"Commit and push? (y/n)"**
3. On **y** (or "yes", "ok", thumbs-up, etc.): `git add -A`, commit with a descriptive message in present tense ("Add X", "Fix Y", "Refactor Z"), then `git push`
4. On **n** (or "no", "wait", "not yet"): leave the working tree uncommitted

Don't ask after read-only operations or in-progress edits — only when there's a coherent change worth shipping.

When updating `dist/` for a code change, include both the source and the rebuilt `dist/` in the same commit (the work-laptop install relies on dist being current in GitHub).

## Repo

- GitHub: https://github.com/delgusto/screens-to-confluence-table
- Default branch: `main`
- `dist/` is committed (intentionally — see [.gitignore](.gitignore)) so the work laptop can install without running `npm`

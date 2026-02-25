---
name: Bump Node Version
description: Bump the project's Node.js version to the latest LTS. Updates .nvmrc, Dockerfile, package.json, package-lock.json, CI workflows, and node-related packages.
---

# Bump Node Version

Use this skill when the user wants to update the project's Node.js version to the latest LTS release.

## Steps

### 1. Install the latest LTS Node version

nvm is a shell function that must be sourced before use. **Important:** sourcing nvm may exit with a non-zero code (e.g. exit code 3) even when it loads successfully. Use `|| true` to prevent this from aborting your command chain.

```sh
source /usr/local/share/nvm/nvm.sh 2>&1 || true; nvm install --lts
```

Use this same `source ... || true;` prefix for all subsequent `nvm` or `node`/`npm` commands that need the newly installed version.

If this fails (e.g. nvm is not found at that path), ask the user to run `nvm install --lts` in their terminal and provide the output (specifically the new version number).

### 2. Note the current version

Read `.nvmrc` to get the current (old) version string. You'll need this to search for occurrences to replace.

### 3. Verify the Docker image exists

Before making any changes, confirm the corresponding Docker image is available on Docker Hub. Check by fetching:

```
https://hub.docker.com/v2/repositories/library/node/tags?name=<NEW_VERSION>-alpine
```

Look for a tag matching `<NEW_VERSION>-alpine` (e.g. `24.13.1-alpine`). If the image does not exist yet, **stop and inform the user** — the node version bump cannot proceed until the Docker image is published.

### 4. Update `.nvmrc`

Run `node --version > .nvmrc` and verify the diff shows the expected version change.

### 5. Search for the old version

Search the entire codebase for the old version number (without the `v` prefix, e.g. `24.13.0`). Typical locations include:

- `Dockerfile` — base image tag (e.g. `FROM node:24.13.0-alpine`)
- `package.json` — `engines.node` field
- `package-lock.json` — `engines.node` field
- `.github/workflows/*.yml` / `.yaml` — `NODE_VERSION` env var

### 6. Spot-check and replace

Review each occurrence to confirm it is actually a Node.js version reference and not an unrelated package version. Then update each one to the new version.

**Do not use a blind find-and-replace.** Inspect each match individually.

### 7. Update node-related packages

First run `npm ci` to ensure `node_modules` is up to date with the lockfile before checking for outdated packages.

Then run `npm outdated` **without any package name filters** and scan the full output for packages strongly tied to the Node.js version, such as:

- `@types/node`
- `@tsconfig/nodeXX` (where XX is the major version)

Update these with `npm update <package>`.

### 8. Validate

Run the following commands in sequence and confirm each passes:

1. `npm ci` — clean install from lockfile
2. `npm run build` — TypeScript compilation
3. `npm t` — test suite

If any step fails, investigate and fix before proceeding.

### 9. Prepare the commit

Use the `commit-message-guidelines` skill to write a commit message in the format:

```
Bumped to latest node version (v<old> -> v<new>)
```

For example: `Bumped to latest node version (v24.13.0 -> v24.13.1)`

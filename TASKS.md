# TASKS — Migrate CI/CD to the semver variant of `danielemery/github-release-actions`

Plan to replace the current **manual-tag-push** release model with the **semver, label-driven**
release flow from [`danielemery/github-release-actions`](https://github.com/danielemery/github-release-actions),
following the project's *Recommended semver consumer pipeline* (the "ships a deployable artifact"
shape), pinned to the latest release **`v0.5.1`**.

---

## 1. Background — current vs. target

### Current model (to be removed)

| Workflow | Trigger | Does |
| --- | --- | --- |
| `validate-pr.yaml` | `pull_request` → main | node build (job 1); lint + unit tests + Codecov (job 2) |
| `main.yml` | `push` → main | lint + tests + Codecov (coverage badge / PR base) |
| `publish.yml` | `push` tag `v[0-9]+.[0-9]+.[0-9]+*` | build → docker push → helm publish → sentry sourcemaps |

Releasing today = a human manually creates & pushes a `vX.Y.Z` (stable) or `vX.Y.Z-…` (prerelease)
tag. `publish.yml` reacts to the tag and uses `nowsprinting/check-version-format-action` to derive
`full` + `is_stable`, which drives docker `:latest`, helm version/appVersion, and the sentry
environment (`prod` vs `stg`).

### Target model

PRs carry exactly one `semver:major|minor|patch` label. Merging to `main` automatically cuts and
**deploys an `rc` prerelease to staging**. Promotion to stable is a manual `workflow_dispatch`
that **retags the already-built prerelease image** (never rebuilds) and publishes the GitHub release.

Five workflows (per the recommended consumer pipeline):

| Workflow | Trigger | Purpose |
| --- | --- | --- |
| `validate-pr.yml` | `pull_request` (label events) | Gate every PR on exactly one `semver:*` label. |
| `ci.yml` | `pull_request` | Lint + unit tests + Codecov (node build). |
| `docker-build.yml` | `pull_request` | Build the image with `push: false` so Dockerfile breakage surfaces at PR time. |
| `release-candidate.yml` | `pull_request: closed` (merged) → main | Build & push the `vX.Y.Z-rc.N` artifacts (docker + helm + sentry stg), then **tag last** via `create-prerelease`. |
| `release-stable.yml` | `workflow_dispatch` | Promote a chosen prerelease → stable: **retag** image, republish helm at stable, sentry `prod`, publish + cleanup the release. |

---

## 2. Decisions already made

These are settled (confirmed with the repo owner + the recommended-pipeline doc); the tasks below
assume them.

- **D1 — Prerelease identifier:** `rc` (e.g. `v1.2.3-rc.0`). The recommended app-consumer doc uses
  `unstable`, but this repo standardises on `rc` (matching GRA-self).
- **D2 — Artifact build lives inline in `release-candidate`**, and stable promotion **retags, never
  rebuilds**. (This supersedes the earlier "reusable `publish.yml`" idea — the doc's
  build-inline-then-retag pattern is the one to copy. `publish.yml` is deleted, not refactored.)
- **D3 — Every merge to `main` builds & deploys the prerelease to staging** (docker push + helm
  prerelease + sentry `stg`).
- **D4 — Pin all four actions to `@v0.5.1`** (latest release). Renovate (`config:recommended`)
  already manages GitHub Action versions, so it will keep them current after adoption.
- **D5 — "Tag last":** `create-prerelease` `needs:` every artifact job, so a tag never points at a
  commit whose artifacts failed to publish.

---

## 3. The three-artifact mapping (the one real deviation from the doc)

The recommended doc covers a **single** container image. This repo ships **three** artifacts. Each
becomes its own build/push job; `create-prerelease` `needs:` all of them. Promotion handling per
artifact:

| Artifact | Candidate (on merge) | Stable (on promote) | Notes |
| --- | --- | --- | --- |
| **Docker image** (ghcr) | build + push `:<full version>` (e.g. `1.2.3-rc.0`) | **retag** prerelease image → `:<stable>` + `:latest` via `docker buildx imagetools create` (no checkout, no rebuild) | Pure doc pattern. Frozen bits. |
| **Helm chart** (s3 `helm.demery.net`) | publish chart `version`/`appVersion` = full prerelease | **republish** chart at stable version from the prerelease commit | Helm charts can't be "retagged" in an s3 repo. Re-packaging from the same commit is hermetic (no deps, just templates), so drift risk is ~nil — acceptable deviation from "never rebuild." |
| **Sentry release** | release name = **`full rc`** (`1.2.3-rc.N`), upload sourcemaps, add `stg` deploy; **persist `dist` as an asset on the rc release** | **re-upload** the persisted rc sourcemaps under the **stable** release (`1.2.3`), add a **`prod` deploy** | This repo's bundle carries **no debug IDs** (plain `tsc` — no esbuild Sentry plugin / `sourcemaps inject`), so Sentry resolves sourcemaps **only by exact release-name match**. Staging runs the rc and reports the full rc (C2); prod reports bare `base-version` (C1). Those are two different release strings, so the maps must exist under **both** — hence per-rc upload + re-upload at promote. |

> **Why not one `base-version` release with multiple deploys (the original §5.1 plan)?** That model
> assumed release-name matching tolerates the `-rc` suffix; it does not. With no debug IDs, a staging
> event tagged `1.2.3-rc.N` would never find sourcemaps uploaded under `1.2.3`. The chosen re-upload
> model is the doc's "Alternative" — heavier (persists `dist`, re-uploads at promote) but correct for
> both environments. **The cleaner long-term fix is debug-ID injection at build time** (then release
> name stops mattering for sourcemaps); deferred as out of scope for this migration.

---

## 4. Tasks

### Phase A — PR-gating workflows

- [x] **A1. Add `validate-pr.yml`** (semver label gate). Replaces the build/test responsibilities of
      the current `validate-pr.yaml` (those move to A2/A3).
  ```yml
  name: Validate PR
  on:
    pull_request:
      types: [opened, reopened, labeled, unlabeled, synchronize]
  jobs:
    validate-semver-label:
      runs-on: ubuntu-latest
      steps:
        - name: Validate semver label
          uses: danielemery/github-release-actions/validate-semver-label@v0.5.1
          with:
            github-token: ${{ secrets.GITHUB_TOKEN }}
  ```
- [x] **A2. Add `ci.yml`** — move the lint + unit tests + Codecov job out of the old `validate-pr.yaml`,
      triggered on `pull_request` (keep `NODE_VERSION: 24.16.0`, `actions/setup-node`, `npm ci`,
      `npm run lint`, `npm run test:ci`, `codecov/codecov-action`).
- [x] **A3. Add `docker-build.yml`** — `pull_request`, `docker/build-push-action` with `push: false`,
      `context: .` (build the node app first if the Dockerfile needs `dist/`, mirroring the
      candidate build). Surfaces Dockerfile breakage at PR time.
- [x] **A4. Delete the old `validate-pr.yaml`** once A1–A3 cover its responsibilities.
- [x] **A5. Decide `main.yml`'s fate.** The recommended pipeline says PR-time CI is sufficient and no
      `push: main` trigger is needed for releases. But `main.yml` exists for the **Codecov badge /
      base coverage**, which is independent of releasing. **Recommend: keep `main.yml` as-is.**
      (Optional: drop it if PR coverage + branch protection is enough for you.)
- [x] **A6. Auto-label Renovate PRs.** Add `"labels": ["semver:patch"]` to `renovate.json` so every
      Renovate PR carries exactly one semver label (which is what `validate-semver-label` requires).
      Patch is the right default — the app's semver tracks the app's API, not the dependency's; a
      human relabels the rare dep bump that actually changes app behaviour.
  ```json
  {
    "$schema": "https://docs.renovatebot.com/renovate-schema.json",
    "extends": ["config:recommended", ":prConcurrentLimitNone"],
    "labels": ["semver:patch"]
  }
  ```
- [x] **A7. Auto-label Dependabot security PRs.** The repo also gets Dependabot **security-update**
      PRs (no `dependabot.yml` today). Add one so those PRs carry `semver:patch`. Use
      **`open-pull-requests-limit: 0`** so Dependabot does **not** start opening version-update PRs
      (Renovate owns those) — security updates still run and honour the `labels`.
  ```yml
  version: 2
  updates:
    - package-ecosystem: npm
      directory: "/"
      schedule:
        interval: weekly
      open-pull-requests-limit: 0   # disable version updates; keep+label security updates
      labels:
        - "semver:patch"
  ```
  > Verify in the smoke test (G3) that a real Dependabot security PR actually receives the label —
  > security-update labelling via `dependabot.yml` is less battle-tested than version-update
  > labelling. If it doesn't take, fall back to a bot-PR auto-label workflow.

### Phase B — Release-candidate workflow (on merge → staging)

- [x] **B1. Add `release-candidate.yml`**, `on: pull_request: [closed]` → `main`,
      `if: github.event.pull_request.merged == true`, `concurrency: { group: "main" }`,
      `permissions: { contents: write, packages: write }`.
- [x] **B2. `version` job** — run `calculate-prerelease-version@v0.5.1` with
      `prerelease-identifier: rc`; expose `version`, `tag`, `base-version` as job outputs for
      downstream jobs.
- [x] **B3. `build` job** — `npm ci` + `npm run build`; upload `build-artifacts` (`dist`, `prisma`,
      `prisma.config.ts`, `Dockerfile`, `.dockerignore`, `package*.json`) and `helm-chart` (mirror
      current `publish.yml` build job).
- [x] **B4. `docker-publish` job** (`needs: [version, build]`) — GHCR login, `docker/build-push-action`
      `push: true`, `tags: ghcr.io/${{ github.repository }}:${{ needs.version.outputs.version }}`,
      `build-args: IMAGE_VERSION=${{ needs.version.outputs.base-version }}` (see C1 for why
      base-version).
- [x] **B5. `helm-publish` job** (`needs: [version, build]`) — AWS creds + `helm-release-action`
      (keep current SHA pin) with `version`/`appVersion` = `needs.version.outputs.version` (full
      prerelease).
- [x] **B6. `sentry` job** (`needs: [version, build]`) — `getsentry/action-release` with
      `release: ${{ needs.version.outputs.version }}` (the **full rc**, via the `release` input, **not**
      the deprecated `version` input), `environment: stg`, `sourcemaps: ./dist`, `url_prefix: '/app'`.
      Full rc (not base-version) so the staging runtime's `QUIZLORD_VERSION` (C2) matches by
      release name — see §3 for why release-name matching forces this.
- [x] **B7. `create-prerelease` job** (`needs: [version, build, docker-publish, helm-publish, sentry]`
      — **tag last**) — `create-prerelease@v0.5.1` with `release-version: ${{ needs.version.outputs.tag }}`.
- [x] **B8. Persist sourcemaps for promotion.** In the `create-prerelease` job (after the release
      exists), download `build-artifacts`, `tar` up `dist`, and `gh release upload` it as a
      `sourcemaps.tar.gz` asset on the rc release. `release-stable` re-uploads these under the stable
      release (D5) so prod resolves sourcemaps too.

### Phase C — App self-reported version (Dockerfile + runtime)

- [x] **C1. Bake `base-version` as the image default.** Build the image with
      `IMAGE_VERSION=<base-version>` (B4) so `QUIZLORD_VERSION` defaults to a clean `X.Y.Z`
      (self-hosters on `:latest` get a clean version with zero config). Dockerfile already wires
      `ARG IMAGE_VERSION` → `ENV QUIZLORD_VERSION`; `src/config/config.ts` reads
      `QUIZLORD_VERSION` (default `development`). No app code change needed.
- [ ] **C2. Runtime override for exact version in controlled envs.** In the staging deploy (helm
      values / env), set `QUIZLORD_VERSION` = the **full** prerelease (`1.2.3-rc.N`) so
      staging reports the exact build. Production keeps the baked `base-version`. This is a
      `quizlord-stack` / deploy-config change — track/file it there (out of this repo's scope, but
      note it).

### Phase D — Release-stable workflow (manual promotion)

- [x] **D1. Add `release-stable.yml`**, `on: workflow_dispatch` with input
      `prerelease_version` (e.g. `v1.2.3-rc.2`), `concurrency: { group: "prod-deployment" }`,
      `permissions: { contents: write, packages: write }`.
- [x] **D2. `pre_release` job** — `perform-pre-release@v0.5.1` with
      `release-version: ${{ inputs.prerelease_version }}`, `promote-to-stable: 'true'`. Capture
      outputs `release-id`, `release-version` (bare stable, e.g. `1.2.3`), `release-tag`.
- [x] **D3. `retag-image` job** (`needs: pre_release`) — GHCR login, then **retag, do not rebuild**:
  ```sh
  RC="${RC_TAG#v}"
  docker buildx imagetools create \
    --tag "ghcr.io/${{ github.repository }}:${STABLE}" \
    --tag "ghcr.io/${{ github.repository }}:latest" \
    "ghcr.io/${{ github.repository }}:${RC}"
  # RC_TAG = inputs.prerelease_version ; STABLE = pre_release.outputs.release-version
  ```
- [x] **D4. `helm-stable` job** (`needs: pre_release`) — `actions/checkout` pinned to the rc ref
      (`with: { ref: ${{ inputs.prerelease_version }} }`) so the chart is packaged from the exact
      promoted commit, AWS creds, `helm-release-action` with `version`/`appVersion` = stable
      (`pre_release.outputs.release-version`). Hermetic re-package (see §3).
- [x] **D5. `sentry-stable` job** (`needs: pre_release`) — `gh release download` the rc's
      `sourcemaps.tar.gz` asset (B8) by `inputs.prerelease_version`, `tar -xzf` it, then
      `getsentry/action-release` with `release` = stable (`pre_release.outputs.release-version`),
      `environment: prod`, `sourcemaps: ./dist`, `url_prefix: '/app'`, `set_commits: skip` (no
      checkout in this job). Re-uploading the rc's own maps under the stable release means promoting
      any rc is correct — this removes the old "must promote the latest rc for sourcemaps" rule.
- [x] **D6. `post_release` job** (`needs: [retag-image, helm-stable, sentry-stable]`) —
      `perform-post-release@v0.5.1` with `release-id: ${{ needs.pre_release.outputs.release-id }}`.
      Publishes the stable release and cleans up the intermediate `-rc.N` releases/tags.

### Phase E — Remove the old tag-push pipeline

- [x] **E1. Delete `publish.yml`** (replaced by `release-candidate.yml` + `release-stable.yml`).
- [x] **E2. Remove `nowsprinting/check-version-format-action`** usage (versions now come from
      `calculate-prerelease-version` / `perform-pre-release` outputs).
- [x] **E3. Confirm no remaining `push: tags` triggers** and no manual-tag instructions linger.

### Phase F — Repo settings & labels (cannot be done from code — needs GitHub admin)

> `gh` is unavailable in this dev container; do these in the GitHub UI / via an authenticated `gh`
> elsewhere.

- [ ] **F1. Create the three labels:** `semver:major`, `semver:minor`, `semver:patch`.
- [ ] **F2. Branch protection on `main`:** block direct pushes, and make **required status checks**:
      `ci`, `docker-build`, and the `validate-semver-label` job. This is load-bearing —
      `release-candidate` trusts PR-time CI and does **not** re-test the merge commit. (Optionally
      enable "require branches up to date before merging" to close the two-green-PRs gap.)
- [ ] **F3. Verify `GITHUB_TOKEN`/Actions permissions** allow `contents: write` + `packages: write`,
      and that the GHCR package still grants the workflow write access (the note in the old
      `publish.yml` about Manage Actions access still applies).
- [ ] **F4. Confirm existing secrets/vars are present:** `CODECOV_TOKEN`, `HELM_DEPLOY_ACCESS_KEY`,
      `HELM_DEPLOY_SECRET`, `HELM_DEPLOY_REGION`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`,
      `SENTRY_PROJECT`.
- [ ] **F5. Pre-adoption cleanup:** delete the stray `v1.10.8-rc.0` GitHub release **and** its git
      tag (leftover from a manual prerelease). Harmless to `calculate-prerelease-version` but tidies
      the release list before the automated `rc` flow takes over (§5.5).

### Phase G — Docs & rollout

- [ ] **G1. Update `README.md` "Deployment"** to describe the label → merge → staging prerelease →
      manual promote-to-stable flow (replacing "manually push a tag").
- [ ] **G2. (Optional) Add a `CONTRIBUTING.md` "Releasing" section** documenting how to label PRs and
      how to run the `Release Stable` dispatch. **Must state the operator rules:** always promote the
      **latest** rc for a base-version (§5.1, §5.4), and pinned/hosted infra deploys exact `vX.Y.Z`,
      never `:latest`.
- [ ] **G3. Smoke test on a throwaway PR:** confirm the label gate blocks/passes, merge produces a
      `vX.Y.Z-rc.0` release + staging deploy, then dispatch `Release Stable` and confirm the
      image is retagged (not rebuilt), `:latest` moves, helm + sentry `prod` update, and the
      `-rc.*` releases are cleaned up. **Also confirm bot self-labelling (A6/A7):** the next Renovate
      PR carries `semver:patch`, and verify a Dependabot security PR does too (fall back to an
      auto-label workflow if not).

---

## 5. Open questions / risks to validate during implementation

1. **✅ RESOLVED — Sentry promotion (B6/B8/D5).** The original plan (one `base-version` release +
   multiple deploys, no re-upload) was **wrong**: this bundle has **no debug IDs** (plain `tsc`), so
   Sentry resolves sourcemaps **only by exact release-name match**, which does *not* tolerate the
   `-rc` suffix. Staging reports the full rc (C2) and prod reports bare `base-version` (C1) — two
   different release strings — so the maps must live under both. **Chosen model:** candidate uploads
   sourcemaps under the **full rc** (B6) and persists `dist` as an rc-release asset (B8); promotion
   **re-uploads** those maps under the **stable** release (D5). Notes:
   - **Modernize:** use the `release` input, not the deprecated `version` input, in B6 and D5.
   - **No latest-rc constraint for sourcemaps:** promotion re-uploads the *specific* rc's own maps
     under stable, so promoting any rc is sourcemap-correct (the old constraint is gone; #4 below now
     concerns only the `:latest` docker tag).
   - **Future cleanup:** inject debug IDs at build time and this whole release-name dance disappears.
2. **✅ RESOLVED — Helm promotion (D4).** Re-package from the rc commit: `release-stable` checks out
   the rc tag and runs `helm-release-action` with `version`/`appVersion` = stable. Chart packaging
   is hermetic (no deps/build step — 3 templates + `Chart.yaml`/`values.yaml`), so the result is
   bit-identical to the rc chart bar the version string. The rc chart (`1.2.3-rc.N`) is left in s3;
   prune out of band if desired.
3. **✅ RESOLVED — `actions/checkout` map.** Candidate: `build` and `helm-publish` jobs check out
   `HEAD`. Stable: only `helm-stable` (D4) checks out, pinned to the rc ref
   (`ref: ${{ inputs.prerelease_version }}`). The `retag-image` (D3), `sentry-stable` (D5),
   `pre_release` (D2) and `post_release` (D6) jobs need **no** checkout (API/registry-only).
4. **✅ RESOLVED — Monotonic promotion (document only, no guard).** Promoting the newest rc is an
   operator rule, not enforced by `release-stable`. Only the `:latest` docker tag depends on it (it
   regresses if an older rc is promoted after a newer stable); Sentry sourcemaps no longer do (#1).
   Hosted/pinned infra must deploy exact `vX.Y.Z` and **not** rely on `:latest`. Document this in
   `CONTRIBUTING.md`/`README.md` (G1/G2).
5. **✅ RESOLVED — First release after adoption.** Latest stable on the remote is **`v1.10.12`**, so
   the first rc is computed from it: `semver:patch` → `v1.10.13-rc.0`, `minor` → `v1.11.0-rc.0`,
   `major` → `v2.0.0-rc.0`. A stray **`v1.10.8-rc.0`** prerelease (tag + release) remains from a
   manual one-off; its base (`1.10.8`) is below the latest stable so clamp-up won't be triggered and
   the first rc is unaffected — but delete it as pre-adoption cleanup (F5) for tidiness.

---

## 7. Commit & rollout sequence

The phases group into **3 commits across 2 PRs**, not one commit per phase. The organizing
principle is that **every merge leaves `main` working and never double-publishing** — not tidiness.

Two hard constraints drive the grouping:

- **The release swap is atomic.** `release-candidate` creates tags that the old tag-triggered
  `publish.yml` would also react to (→ double publish), and adding `release-candidate` (B) without
  `release-stable` (D) leaves rcs that can't be promoted. So **B + D + E land together**.
- **Phase C has no code in this repo** (C1 is just the build-arg inside `release-candidate`/B4; C2
  is a `quizlord-stack` change), and **Phase F is GitHub admin** + **G3 is a smoke test** — none of
  these are commits; they're interleaved operational steps.

| Commit | Phases | Contents | Notes |
| --- | --- | --- | --- |
| **PR 1** | A | `validate-pr.yml` (label gate) + `ci.yml` + `docker-build.yml`; delete old `validate-pr.yaml`; keep `main.yml`; **bot self-labelling** (`renovate.json` + new `dependabot.yml`) | Pure PR-gating; independent of releasing. Bot labels must land **before** F2 makes the gate required, else every bot PR is blocked. |
| **PR 2 · commit 1** | B + C + E | Add `release-candidate.yml` (incl. base-version build-arg); **delete `publish.yml`** + `check-version-format` usage | Atomic with commit 2. |
| **PR 2 · commit 2** | D | Add `release-stable.yml` | Atomic with commit 1. |
| **PR 2 · commit 3** | G | `README.md` + `CONTRIBUTING.md` (flow + operator rules) | Fold into commit 1 if fatter commits preferred. |

PR 2's commits keep the diff reviewable (candidate / stable / docs read separately) while the
**merge** stays atomic — the PR is the unit of safety, the commits are the unit of review.

**Rollout order** (admin steps gate the merges):

```
0. Commit TASKS.md (this plan)
1. F1: create semver:{major,minor,patch} labels         (admin)
2. Merge PR 1   (PR-gating workflows)
3. F2: make ci / docker-build / label-gate required      (admin)
   F3/F4: confirm GHCR write access + secrets            (admin)
   F5: delete stray v1.10.8-rc.0 tag + release           (admin)
4. Merge PR 2   (release swap + docs) — needs a semver label itself
5. G3: smoke test — labelled PR → rc → dispatch Release Stable
```

> **First-rc nuance:** `release-candidate` triggers on `pull_request: closed` using the **base
> branch's** workflow file, so merging PR 2 does **not** trigger it on its own merge — the first rc
> is cut by the *next* labelled merge after PR 2 lands.

---

## 8. Reference

- Actions (pin `@v0.5.1`): `validate-semver-label`, `calculate-prerelease-version`,
  `create-prerelease`, `perform-pre-release`, `perform-post-release`.
- Latest release: **`v0.5.1`** (published 2026-06-12).
- Recommended consumer pipeline (the blueprint this plan adapts) + per-action docs in the
  `danielemery/github-release-actions` repo.
</content>
</invoke>

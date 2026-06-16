# Contributing

## Releasing

Releases are **semver, label-driven** — the version comes from PR labels, not from manually pushed
tags. The flow is implemented with [`danielemery/github-release-actions`](https://github.com/danielemery/github-release-actions).

### Labelling a PR

Every PR must carry **exactly one** semver label:

| Label | Bump | Use for |
| --- | --- | --- |
| `semver:major` | `X`.0.0 | Breaking API changes. |
| `semver:minor` | x.`Y`.0 | Backwards-compatible features. |
| `semver:patch` | x.y.`Z` | Fixes, chores, dependency bumps. |

The `Validate PR` check fails until exactly one is present. Renovate and Dependabot PRs auto-label
`semver:patch`; relabel the rare dependency bump that actually changes the app's API.

### Cutting a release candidate

Merging a labelled PR to `main` automatically:

- calculates the next version from the label (e.g. a `semver:minor` merge after `v1.2.4` → `v1.3.0-rc.0`);
- builds & pushes the docker image, helm chart and Sentry release (sourcemaps under the **full rc**
  version, e.g. `1.3.0-rc.0`);
- deploys the candidate to **staging**;
- tags the prerelease (only after every artifact published — "tag last").

Each subsequent merge produces the next `-rc.N`.

### Promoting to stable

Run the **Release Stable** workflow from the Actions tab (`workflow_dispatch`), passing the
`prerelease_version` to promote (e.g. `v1.3.0-rc.2`). It does **not** rebuild — it:

- retags the already-built rc image to `:<stable>` and `:latest`;
- republishes the helm chart at the stable version from the exact rc commit;
- re-uploads the rc's sourcemaps under the stable Sentry release and adds a `prod` deploy;
- publishes the stable GitHub release and cleans up the intermediate `-rc.N` releases.

### Operator rules

These are **not** enforced by the workflows — follow them when promoting:

1. **Always promote the _latest_ rc of a base version.** Promoting an older rc would regress the
   `:latest` docker tag (it would point back at older bits). Sourcemaps are unaffected (each promote
   re-uploads that specific rc's maps under the stable release), but `:latest` is not.
2. **Hosted/pinned infrastructure must deploy an exact `vX.Y.Z`, never `:latest`.** `:latest` is a
   convenience tag for self-hosters and can move backwards if rule 1 is broken; controlled
   environments must pin the exact version they intend to run.

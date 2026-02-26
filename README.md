# Quizlord API

Graphql api for sharing newspaper quizzes between friends, including results and statistics

Follows the [GraphQL Cursor Connections Specification](https://relay.dev/graphql/connections.htm).

[![codecov](https://codecov.io/gh/danielemery/quizlord-api/graph/badge.svg?token=5N2X0OK5OX)](https://codecov.io/gh/danielemery/quizlord-api)

# Deployment

The api is packaged in docker and deployed with github actions to the [github registry](https://github.com/danielemery/quizlord-api/pkgs/container/quizlord-api).
A helm template is also deployed with a github action to https://helm.demery.net.

See [quizlord-stack](https://github.com/danielemery/quizlord-stack) for further details about deployment and for the terraform module.

# Local Development

Doppler is used to provide access to secrets, in order to run the app you first need to run

- `doppler login`
- `doppler setup`

## Using Nix

If using nixos a flake file is provided to load a shell with all the required dependencies.

```sh
nix develop
```

### Upgrade Flake

The following can be run to upgrade the flake.lock file

```sh
nix flake update
```

Afterwards rerun `nix develop` and check the new versions installed by the flake match.

```sh
node --version
prisma --version
```

The node and prisma versions **may** need to be updated to match.

- Prisma: Just the `package.json` version
- Node: The `package.json` engine entry, the `Dockerfile` `FROM` and the `.nvmrc` file

## Bootstrap project

```sh
docker compose up -d
npm ci
npm run db:dev:migrate
```

## Run project

```sh
npm start
```

## Create Migrations

Prisma migrations can be created with the following command:

```sh
npm run db:dev:migrate
```

## Test Docker Image Locally

```sh
# Perform a local production build
npm run build
# Build a local image tagged with local
docker build -t quizlord-api:local .
# Run local build using the env file (connect to the docker-compose postgres network)
# Note: network name depends on the docker-compose project name (directory name by default).
# Verify with `docker network ls` and adjust if your directory is not named "api".
docker run -p 4000:80 --rm \
  --env-file <(doppler secrets download --no-file --format docker) \
  -e QUIZLORD_VERSION=local \
  -e DB_CONNECTION_STRING="postgresql://postgres:local@quizlord-postgres:5432/quizlord?schema=public" \
  --network api_default \
  --name=quizlord-api quizlord-api:local
# Cleanup
docker image rm quizlord-api:local
```

## Test Helm Locally

1. You first to have a local k8s cluster running.
2. Ensure doppler is setup with `doppler setup`
3. Install the doppler operator as described https://docs.doppler.com/docs/kubernetes-operator
4. Create the doppler token secret
   ```sh
   kubectl create secret generic doppler-token-quizlord-api-secret \
   --namespace doppler-operator-system \
   --from-literal=serviceToken=$(doppler configs tokens create doppler-kubernetes-operator --plain)
   ```
5. Create the destination namespace with `kubectl create namespace quizlord`
6. Create the doppler secret with `kubectl apply -f .k8s/doppler-secret.yaml`
7. Create the registry pull secret `kubectl create secret docker-registry registry-github-quizlord --docker-server=ghcr.io --docker-username=danielemery --docker-password=REPLACE_ME --docker-email="danielremery@gmail.com" -n quizlord`
8. Install using local chart
   ```sh
   helm install -n quizlord quizlord-api ./helm
   ```
9. Cleanup
   ```sh
   helm uninstall -n quizlord quizlord-api
   ```

# QuizLord API

Graphql api for sharing newspaper quizzes between friends, including results and statistics

Follows the [GraphQL Cursor Connections Specification](https://relay.dev/graphql/connections.htm).

## Local Development

Doppler is used to provide access to secrets, in order to run the app you first need to run

- `doppler login`
- `doppler setup`

### Test Docker Image Locally

```sh
# Perform a local production build
npm run build
# Build a local image tagged with local
docker build -t quizlord-api:local .
# Run local build using the env file
docker run -p 4000:80 --env-file <(doppler secrets download --no-file --format docker) --name=quizlord-api quizlord-api:local
# Cleanup
docker rm quizlord-api && docker image rm quizlord-api:local
```

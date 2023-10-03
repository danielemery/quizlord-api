import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { Role } from '@prisma/client';
import bodyParser from 'body-parser';
import cors from 'cors';
import express from 'express';
import { GraphQLScalarType, Kind } from 'graphql';
import http from 'http';
import * as Sentry from '@sentry/node';

import { verifyToken } from './auth';
import config from './config';
import typeDefs from './gql';
import { persistence } from './persistence/persistence';
import { createQuiz, quiz, quizzes, completeQuiz } from './resolvers/quizResolvers';
import { me, users } from './resolvers/userResolvers';
import { subscribeToFileUploads } from './sqs';

const QUIZLORD_VERSION_HEADER = 'X-Quizlord-Api-Version';

const dateScalar = new GraphQLScalarType({
  name: 'Date',
  description: 'Date custom scalar type',
  serialize(value) {
    return (value as Date).toISOString();
  },
  parseValue(value) {
    return new Date(value as string); // Convert incoming ISO string to Date
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.STRING) {
      return new Date(ast.value);
    }
    return null; // Invalid hard-coded value (not a string)
  },
});

const resolvers = {
  Date: dateScalar,
  Query: {
    quizzes,
    quiz,
    users,
    me,
  },
  Mutation: {
    createQuiz,
    completeQuiz,
  },
};

export interface QuizlordContext {
  email: string;
  userId: string;
  userName?: string;
  roles: Role[];
}

async function initialise() {
  await persistence.connect();

  // Required logic for integrating with Express
  const app = express();
  // Our httpServer handles incoming requests to our Express app.
  // Below, we tell Apollo Server to "drain" this httpServer,
  // enabling our servers to shut down gracefully.
  const httpServer = http.createServer(app);

  const server = new ApolloServer({
    typeDefs,
    resolvers,
    csrfPrevention: true,
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
    formatError(formattedError, error) {
      if (formattedError.extensions?.code === 'INTERNAL_SERVER_ERROR') {
        Sentry.captureException(error);
      }
      return formattedError;
    },
  });

  Sentry.init({
    dsn: config.SENTRY_DSN,
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new Sentry.Integrations.Express({ app }),
      new Sentry.Integrations.Postgres(),
      new Sentry.Integrations.Prisma({ client: persistence.getPrismaClient() }),
      new Sentry.Integrations.Apollo(),
    ],
    tracesSampleRate: 1.0,
    profilesSampleRate: 1.0,
    environment: config.DOPPLER_CONFIG,
    release: config.QUIZLORD_VERSION,
  });

  await server.start();

  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.tracingHandler());

  app.use(
    '/',
    cors<cors.CorsRequest>({
      origin: [config.CLIENT_URL, 'https://studio.apollographql.com'],
      credentials: true,
      exposedHeaders: [QUIZLORD_VERSION_HEADER],
    }),
    // 50mb is the limit that `startStandaloneServer` uses, but you may configure this to suit your needs
    bodyParser.json({ limit: '50mb' }),
    (_req, res, next) => {
      res.set(QUIZLORD_VERSION_HEADER, config.QUIZLORD_VERSION);
      next();
    },
    // expressMiddleware accepts the same arguments:
    // an Apollo Server instance and optional configuration options
    expressMiddleware(server, {
      context: async ({ req }) => {
        const token = req.headers.authorization || '';

        const sanitisedToken = token.replace('Bearer ', '');

        const jwt = await verifyToken(sanitisedToken);

        /* eslint-disable @typescript-eslint/no-explicit-any */
        const email = (jwt as any)[`${config.CLIENT_URL}/email`] as string;
        const name = (jwt as any)[`${config.CLIENT_URL}/name`] as string | undefined;
        /* eslint-enable @typescript-eslint/no-explicit-any */

        const { roles, id } = await persistence.loadUserDetailsAndUpdateIfNecessary(email, name);

        const context: QuizlordContext = {
          email,
          userId: id,
          userName: name,
          roles,
        };

        return context;
      },
    }),
  );
  app.use(Sentry.Handlers.errorHandler());

  subscribeToFileUploads();
  await new Promise<void>((resolve) => httpServer.listen({ port: 4000 }, resolve));

  console.log(`🚀 Server ready at http://localhost:4000/`);
}

initialise()
  .then(() => {
    console.log('Server initialised sucessfully.');
  })
  .catch((err) => {
    console.error('Server encountered error initialising and had to shut down');
    console.error(err);
    process.exit(1);
  });

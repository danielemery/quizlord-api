// sort-imports-ignore (Sentry instrumentation must be the first import)
import './instrument.js';

import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import * as Sentry from '@sentry/node';
import bodyParser from 'body-parser';
import cors from 'cors';
import express from 'express';
import { GraphQLScalarType, Kind } from 'graphql';
import http from 'http';

import { activityChildren, activityQueries } from './activity/activity.gql.js';
import config from './config/config.js';
import typeDefs from './gql.js';
import { quizMutations, quizQueries } from './quiz/quiz.gql.js';
import { sentryApolloPlugin } from './sentry-apollo-plugin.js';
import { authenticationService, prismaService, queueService, userService } from './service.locator.js';
import { statisticsQueries } from './statistics/statistics.gql.js';
import { Role } from './user/user.dto.js';
import { userMutations, userQueries } from './user/user.gql.js';

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
    ...quizQueries,
    ...userQueries,
    ...statisticsQueries,
    ...activityQueries,
  },
  Mutation: {
    ...quizMutations,
    ...userMutations,
  },
  RecentActivityItem: activityChildren,
};

export interface QuizlordContext {
  email: string;
  userId: string;
  userName?: string;
  roles: Role[];
}

async function initialise() {
  await prismaService.connect();

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
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer }), sentryApolloPlugin],
  });

  await server.start();

  // Health check endpoint for uptime monitoring
  app.get('/', (_req, res) => {
    res.send('OK');
  });

  // 404 for any other non-GraphQL routes (GraphQL uses POST to /, OPTIONS for CORS preflight)
  app.use((req, res, next) => {
    if (req.path !== '/' || (req.method !== 'POST' && req.method !== 'OPTIONS')) {
      res.status(404).send('Not Found');
      return;
    }
    next();
  });

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
    (req, res, next) => {
      // Skip validation for CORS preflight requests
      if (req.method === 'OPTIONS') {
        next();
        return;
      }
      if (!req.body || typeof req.body.query !== 'string') {
        res.status(400).send('Bad Request: GraphQL query required');
        return;
      }
      next();
    },
    // expressMiddleware accepts the same arguments:
    // an Apollo Server instance and optional configuration options
    expressMiddleware(server, {
      context: async ({ req }) => {
        const token = req.headers.authorization || '';

        const sanitisedToken = token.replace('Bearer ', '');

        const jwt = await authenticationService.verifyToken(sanitisedToken);

        const email = (jwt as any)[`${config.CLIENT_URL}/email`] as string;
        const name = (jwt as any)[`${config.CLIENT_URL}/name`] as string | undefined;

        const { roles, id } = await userService.loadUserDetailsAndUpdateIfNecessary(email, name);

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

  // Sentry error handler must be after all routes/middleware
  Sentry.setupExpressErrorHandler(app);

  void queueService.subscribeToFileUploads();
  void queueService.subscribeToAiProcessing();
  await new Promise<void>((resolve) => httpServer.listen({ port: 4000 }, resolve));

  console.log(`🚀 Server ready at http://localhost:4000/`);

  // Graceful shutdown: drain Sentry events before closing
  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}, shutting down gracefully...`);
    queueService.shutdown();
    try {
      await Sentry.close(2000);
    } catch (e) {
      console.error('Error closing Sentry:', e);
    }

    const serverClose = new Promise<'closed'>((resolve) => httpServer.close(() => resolve('closed')));
    const timeout = new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 10000));

    const result = await Promise.race([serverClose, timeout]);
    if (result === 'timeout') {
      console.error('Forcing exit after timeout waiting for connections to close');
      process.exit(1);
    }

    console.log('HTTP server closed');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
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

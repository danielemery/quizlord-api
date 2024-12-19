import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import * as Sentry from '@sentry/node';
import bodyParser from 'body-parser';
import cors from 'cors';
import express from 'express';
import { GraphQLScalarType, Kind } from 'graphql';
import http from 'http';

import { activityQueries, activityChildren } from './activity/activity.gql';
import config from './config/config';
import typeDefs from './gql';
import './instrument';
import { quizMutations, quizQueries } from './quiz/quiz.gql';
import { authenticationService, prismaService, queueService, userService } from './service.locator';
import { statisticsQueries } from './statistics/statistics.gql';
import { Role } from './user/user.dto';
import { userQueries } from './user/user.gql';

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
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
    formatError(formattedError, error) {
      if (formattedError.extensions?.code === 'INTERNAL_SERVER_ERROR') {
        console.error(error);
        Sentry.captureException(error);
      }
      return formattedError;
    },
  });

  await server.start();

  Sentry.setupExpressErrorHandler(app);

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

  queueService.subscribeToFileUploads();
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

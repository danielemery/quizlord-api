import type { ApolloServerPlugin } from '@apollo/server';
import * as Sentry from '@sentry/node';

import type { QuizlordContext } from './index';

export const sentryApolloPlugin: ApolloServerPlugin<QuizlordContext> = {
  async requestDidStart({ request }) {
    // Set transaction name to include operation name for better tracing
    if (request.operationName) {
      Sentry.getCurrentScope().setTransactionName(`POST / (${request.operationName})`);
    }

    return {
      async didEncounterErrors(ctx) {
        // Skip if we couldn't parse the operation
        if (!ctx.operation) {
          return;
        }

        for (const error of ctx.errors) {
          // Skip client errors (validation, bad input, etc.)
          if (error.extensions?.code && error.extensions.code !== 'INTERNAL_SERVER_ERROR') {
            continue;
          }

          Sentry.withScope((scope) => {
            // Set user context if available
            if (ctx.contextValue.userId) {
              scope.setUser({
                id: ctx.contextValue.userId,
                email: ctx.contextValue.email,
                username: ctx.contextValue.userName,
              });
            }

            // Add GraphQL-specific tags
            scope.setTag('graphql.operation', ctx.operation?.operation);
            scope.setTag('graphql.operationName', ctx.operationName ?? 'anonymous');

            // Add GraphQL context
            scope.setContext('graphql', {
              query: ctx.request.query,
              variables: ctx.request.variables,
              errorPath: error.path,
            });

            Sentry.captureException(error.originalError ?? error);
          });
        }
      },
    };
  },
};

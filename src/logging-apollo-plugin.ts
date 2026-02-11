import type { ApolloServerPlugin } from '@apollo/server';

import type { QuizlordContext } from './index';
import { logger } from './util/logger';

export const loggingApolloPlugin: ApolloServerPlugin<QuizlordContext> = {
  async requestDidStart({ request }) {
    const startTime = Date.now();
    const operationName = request.operationName ?? 'anonymous';

    logger.info('GraphQL request started', {
      type: 'graphql_request',
      operationName,
    });

    return {
      async willSendResponse(ctx) {
        const durationMs = Date.now() - startTime;
        const hasErrors = ctx.errors && ctx.errors.length > 0;

        logger.info('GraphQL request completed', {
          type: 'graphql_request',
          operation: ctx.operation?.operation ?? 'unknown',
          operationName: ctx.operationName ?? operationName,
          userId: ctx.contextValue?.userId,
          durationMs,
          status: hasErrors ? 'error' : 'success',
          ...(hasErrors && { errorCount: ctx.errors?.length }),
        });
      },
    };
  },
};

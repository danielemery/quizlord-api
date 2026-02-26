import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

import config from '../config/config.js';

export class SQSQueuePublisherService {
  #client: SQSClient;

  constructor() {
    this.#client = new SQSClient({ region: config.AWS_REGION });
  }

  async queueAiProcessing(quizId: string) {
    await this.#client.send(
      new SendMessageCommand({
        QueueUrl: config.AWS_AI_PROCESSING_SQS_QUEUE_URL,
        MessageBody: JSON.stringify({ quizId }),
      }),
    );
  }
}

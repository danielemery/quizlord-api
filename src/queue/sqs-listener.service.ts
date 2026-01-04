import { SQSClient, ReceiveMessageCommand, Message, DeleteMessageCommand } from '@aws-sdk/client-sqs';

import config from '../config/config';
import { QuizService } from '../quiz/quiz.service';
import { logger } from '../util/logger';

/** The number of seconds for sqs to wait until a message is available. */
const SQS_LONG_POLLING_TIMEOUT_SECONDS = 10;
/** The number of seconds to wait between polling for file upload events. */
const FILE_UPLOAD_POLLING_SLEEP_INTERVAL_SECONDS = 0;
/** The number of seconds to wait between polling for AI processing events. */
const AI_PROCESSING_POLLING_SLEEP_INTERVAL_SECONDS = 60;

interface S3MessageContent {
  Records?: S3MessageContentRecord[];
}

interface S3MessageContentRecord {
  eventTime: string;
  eventName: string;
  s3: {
    object: {
      key: string;
      size: number;
    };
  };
}

export class SQSQueueListenerService {
  #client: SQSClient;
  #quizService: QuizService;

  constructor(quizService: QuizService) {
    this.#client = new SQSClient({ region: config.AWS_REGION });
    this.#quizService = quizService;
  }

  async subscribeToFileUploads() {
    // todo exit this loop when app entering shutdown state.

    while (true) {
      logger.info('Polling for file upload messages', { queue: config.AWS_FILE_UPLOADED_SQS_QUEUE_URL });
      const result = await this.#client.send(
        new ReceiveMessageCommand({
          QueueUrl: config.AWS_FILE_UPLOADED_SQS_QUEUE_URL,
          WaitTimeSeconds: SQS_LONG_POLLING_TIMEOUT_SECONDS,
        }),
      );
      if (result.Messages) {
        await Promise.all(result.Messages.map((message) => this.processMessage(message)));
      }
      await sleep(FILE_UPLOAD_POLLING_SLEEP_INTERVAL_SECONDS);
    }
  }

  async subscribeToAiProcessing() {
    // todo exit this loop when app entering shutdown state.

    while (true) {
      logger.info('Polling for AI processing messages', { queue: config.AWS_AI_PROCESSING_SQS_QUEUE_URL });
      const result = await this.#client.send(
        new ReceiveMessageCommand({
          QueueUrl: config.AWS_AI_PROCESSING_SQS_QUEUE_URL,
          WaitTimeSeconds: SQS_LONG_POLLING_TIMEOUT_SECONDS,
        }),
      );
      if (result.Messages) {
        await Promise.all(result.Messages.map((message) => this.processAiProcessingMessage(message)));
      }
      await sleep(AI_PROCESSING_POLLING_SLEEP_INTERVAL_SECONDS);
    }
  }

  async processMessage(message: Message) {
    if (message.Body) {
      const messageBody = JSON.parse(message.Body);
      if (messageBody.Message) {
        const messageData: S3MessageContent = JSON.parse(messageBody.Message);
        if (messageData.Records) {
          await Promise.all(messageData.Records.map((record) => this.processUploadedItem(record)));
        }
      } else {
        logger.warn('Unexpected empty inner message body', { messageId: message.MessageId });
      }
    } else {
      logger.warn('Unexpected empty message body', { messageId: message.MessageId });
    }

    await this.#client.send(
      new DeleteMessageCommand({
        QueueUrl: config.AWS_FILE_UPLOADED_SQS_QUEUE_URL,
        ReceiptHandle: message.ReceiptHandle,
      }),
    );
  }

  async processUploadedItem(record: S3MessageContentRecord) {
    const key = record.s3.object.key;
    logger.info('Processing uploaded item', { key, eventName: record.eventName });
    if (record.eventName !== 'ObjectCreated:Put') {
      logger.warn('Unexpected event name', { eventName: record.eventName, key });
    }
    try {
      await this.#quizService.markQuizImageReady(key);
    } catch (err) {
      logger.error('Error marking quiz image ready', {
        key,
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
    }
  }

  async processAiProcessingMessage(message: Message) {
    if (message.Body) {
      const messageBody = JSON.parse(message.Body);
      if (messageBody.quizId) {
        try {
          await this.#quizService.aiProcessQuiz(messageBody.quizId);
          await this.#client.send(
            new DeleteMessageCommand({
              QueueUrl: config.AWS_AI_PROCESSING_SQS_QUEUE_URL,
              ReceiptHandle: message.ReceiptHandle,
            }),
          );
        } catch (err) {
          logger.error('Error processing AI quiz', {
            quizId: messageBody.quizId,
            error: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
          });
        }
      } else {
        logger.warn('Unexpected AI processing message body', { messageId: message.MessageId });
      }
    }
  }
}

async function sleep(seconds: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, seconds * 1000);
  });
}

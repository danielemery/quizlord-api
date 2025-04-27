import { SQSClient, ReceiveMessageCommand, Message, DeleteMessageCommand } from '@aws-sdk/client-sqs';

import config from '../config/config';
import { QuizService } from '../quiz/quiz.service';

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
    // eslint-disable-next-line no-constant-condition
    while (true) {
      console.log(`Polling ${config.AWS_FILE_UPLOADED_SQS_QUEUE_URL} for messages`);
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
    // eslint-disable-next-line no-constant-condition
    while (true) {
      console.log(`Polling ${config.AWS_AI_PROCESSING_SQS_QUEUE_URL} for messages`);
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
        console.warn(`Unexpected empty inner message body`, message);
      }
    } else {
      console.warn(`Unexpected empty message body`, message);
    }

    await this.#client.send(
      new DeleteMessageCommand({
        QueueUrl: config.AWS_FILE_UPLOADED_SQS_QUEUE_URL,
        ReceiptHandle: message.ReceiptHandle,
      }),
    );
  }

  async processUploadedItem(record: S3MessageContentRecord) {
    console.log('Processing uploaded item');
    if (record.eventName !== 'ObjectCreated:Put') {
      console.warn(`Unexpected event name <${record.eventName}>`);
    }
    const key = record.s3.object.key;
    try {
      await this.#quizService.markQuizImageReady(key);
    } catch (err) {
      console.error(`Error marking quiz image ready at key: ${key}`, err);
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
          console.error(`Error processing quiz id: ${messageBody.quizId}`, err);
        }
      } else {
        console.warn(`Unexpected message body`, message);
      }
    }
  }
}

async function sleep(seconds: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, seconds * 1000);
  });
}

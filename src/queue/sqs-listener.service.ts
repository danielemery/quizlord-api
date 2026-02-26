import { SQSClient, ReceiveMessageCommand, Message, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import * as Sentry from '@sentry/node';

import config from '../config/config.js';
import { QuizService } from '../quiz/quiz.service.js';

/** The number of seconds for sqs to wait until a message is available. */
const SQS_LONG_POLLING_TIMEOUT_SECONDS = 10;
/** The number of seconds to wait between polling for file upload events. */
const FILE_UPLOAD_POLLING_SLEEP_INTERVAL_SECONDS = 0;
/** The number of seconds to wait between polling for AI processing events. */
const AI_PROCESSING_POLLING_SLEEP_INTERVAL_SECONDS = 60;
/** Initial backoff sleep in seconds after a polling loop error. */
const INITIAL_ERROR_SLEEP_SECONDS = 5;
/** Maximum backoff sleep in seconds after repeated polling loop errors. */
const MAX_ERROR_SLEEP_SECONDS = 60;

const FILE_UPLOAD_MONITOR_SLUG = 'sqs-file-upload-poll';
const AI_PROCESSING_MONITOR_SLUG = 'sqs-ai-processing-poll';

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
  #abortController = new AbortController();

  constructor(quizService: QuizService) {
    this.#client = new SQSClient({ region: config.AWS_REGION });
    this.#quizService = quizService;
  }

  shutdown() {
    this.#abortController.abort();
  }

  async subscribeToFileUploads() {
    let consecutiveErrors = 0;
    const monitorConfig = {
      schedule: { type: 'interval' as const, value: 1, unit: 'minute' as const },
      checkinMargin: 2,
      maxRuntime: 2,
    };
    /** Check in every Nth iteration (~6 * 10s long-poll = ~60s). */
    const CHECKIN_EVERY_N_ITERATIONS = 6;
    let iterationsSinceCheckin = 0;
    let activeCheckInId: string | undefined;
    while (!this.#abortController.signal.aborted) {
      const shouldCheckin = iterationsSinceCheckin === 0;
      if (shouldCheckin) {
        activeCheckInId = Sentry.captureCheckIn(
          { monitorSlug: FILE_UPLOAD_MONITOR_SLUG, status: 'in_progress' },
          monitorConfig,
        );
      }
      iterationsSinceCheckin = (iterationsSinceCheckin + 1) % CHECKIN_EVERY_N_ITERATIONS;
      try {
        console.log(`Polling ${config.AWS_FILE_UPLOADED_SQS_QUEUE_URL} for messages`);
        const result = await this.#client.send(
          new ReceiveMessageCommand({
            QueueUrl: config.AWS_FILE_UPLOADED_SQS_QUEUE_URL,
            WaitTimeSeconds: SQS_LONG_POLLING_TIMEOUT_SECONDS,
          }),
          { abortSignal: this.#abortController.signal },
        );
        if (result.Messages) {
          await Promise.all(result.Messages.map((message) => this.processMessage(message)));
        }
        consecutiveErrors = 0;
        if (shouldCheckin && activeCheckInId) {
          Sentry.captureCheckIn({ checkInId: activeCheckInId, monitorSlug: FILE_UPLOAD_MONITOR_SLUG, status: 'ok' });
          activeCheckInId = undefined;
        }
        await sleep(FILE_UPLOAD_POLLING_SLEEP_INTERVAL_SECONDS, this.#abortController.signal);
      } catch (err) {
        if (this.#abortController.signal.aborted) {
          if (activeCheckInId) {
            Sentry.captureCheckIn({ checkInId: activeCheckInId, monitorSlug: FILE_UPLOAD_MONITOR_SLUG, status: 'ok' });
          }
          break;
        }
        consecutiveErrors++;
        const backoff = errorBackoffSeconds(consecutiveErrors);
        console.error(`Error in file upload polling loop, retrying in ${backoff}s`, err);
        Sentry.captureException(err, { tags: { queue: 'file-upload' } });
        if (activeCheckInId) {
          Sentry.captureCheckIn({ checkInId: activeCheckInId, monitorSlug: FILE_UPLOAD_MONITOR_SLUG, status: 'error' });
          activeCheckInId = undefined;
        }
        await sleep(backoff, this.#abortController.signal);
      }
    }
    console.log('File upload polling loop stopped');
  }

  async subscribeToAiProcessing() {
    let consecutiveErrors = 0;
    const monitorConfig = {
      schedule: { type: 'interval' as const, value: 2, unit: 'minute' as const },
      checkinMargin: 2,
      maxRuntime: 5,
    };
    while (!this.#abortController.signal.aborted) {
      const checkInId = Sentry.captureCheckIn(
        { monitorSlug: AI_PROCESSING_MONITOR_SLUG, status: 'in_progress' },
        monitorConfig,
      );
      try {
        console.log(`Polling ${config.AWS_AI_PROCESSING_SQS_QUEUE_URL} for messages`);
        const result = await this.#client.send(
          new ReceiveMessageCommand({
            QueueUrl: config.AWS_AI_PROCESSING_SQS_QUEUE_URL,
            WaitTimeSeconds: SQS_LONG_POLLING_TIMEOUT_SECONDS,
          }),
          { abortSignal: this.#abortController.signal },
        );
        if (result.Messages) {
          await Promise.all(result.Messages.map((message) => this.processAiProcessingMessage(message)));
        }
        consecutiveErrors = 0;
        Sentry.captureCheckIn({ checkInId, monitorSlug: AI_PROCESSING_MONITOR_SLUG, status: 'ok' });
        await sleep(AI_PROCESSING_POLLING_SLEEP_INTERVAL_SECONDS, this.#abortController.signal);
      } catch (err) {
        if (this.#abortController.signal.aborted) {
          Sentry.captureCheckIn({ checkInId, monitorSlug: AI_PROCESSING_MONITOR_SLUG, status: 'ok' });
          break;
        }
        consecutiveErrors++;
        const backoff = errorBackoffSeconds(consecutiveErrors);
        console.error(`Error in AI processing polling loop, retrying in ${backoff}s`, err);
        Sentry.captureException(err, { tags: { queue: 'ai-processing' } });
        Sentry.captureCheckIn({ checkInId, monitorSlug: AI_PROCESSING_MONITOR_SLUG, status: 'error' });
        await sleep(backoff, this.#abortController.signal);
      }
    }
    console.log('AI processing polling loop stopped');
  }

  async processMessage(message: Message) {
    try {
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
    } catch (err) {
      console.error('Error processing file upload message, leaving in queue for retry', err);
      Sentry.captureException(err, { tags: { queue: 'file-upload' } });
    }
  }

  async processUploadedItem(record: S3MessageContentRecord) {
    console.log('Processing uploaded item');
    if (record.eventName !== 'ObjectCreated:Put') {
      console.warn(`Unexpected event name <${record.eventName}>`);
    }
    const key = record.s3.object.key;
    await this.#quizService.markQuizImageReady(key);
  }

  async processAiProcessingMessage(message: Message) {
    try {
      if (message.Body) {
        const messageBody = JSON.parse(message.Body);
        if (messageBody.quizId) {
          await this.#quizService.aiProcessQuiz(messageBody.quizId);
        } else {
          console.warn(`Unexpected message body`, message);
        }
      } else {
        console.warn(`Unexpected empty message body`, message);
      }

      await this.#client.send(
        new DeleteMessageCommand({
          QueueUrl: config.AWS_AI_PROCESSING_SQS_QUEUE_URL,
          ReceiptHandle: message.ReceiptHandle,
        }),
      );
    } catch (err) {
      console.error('Error processing AI message, leaving in queue for retry', err);
      Sentry.captureException(err, { tags: { queue: 'ai-processing' } });
    }
  }
}

async function sleep(seconds: number, signal?: AbortSignal) {
  if (signal?.aborted) return;
  return new Promise<void>((resolve) => {
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, seconds * 1000);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export function errorBackoffSeconds(consecutiveErrors: number) {
  return Math.min(INITIAL_ERROR_SLEEP_SECONDS * 2 ** (consecutiveErrors - 1), MAX_ERROR_SLEEP_SECONDS);
}

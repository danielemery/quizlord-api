import {
  SQSClient,
  ReceiveMessageCommand,
  Message,
  DeleteMessageCommand,
} from "@aws-sdk/client-sqs";

import { persistence } from "./persistence";

const client = new SQSClient({ region: process.env.AWS_REGION });

export async function subscribeToFileUploads() {
  while (true) {
    console.log(
      `Polling ${process.env.AWS_FILE_UPLOADED_SQS_QUEUE_URL} for messages`
    );
    const result = await client.send(
      new ReceiveMessageCommand({
        QueueUrl: process.env.AWS_FILE_UPLOADED_SQS_QUEUE_URL,
        WaitTimeSeconds: 10,
      })
    );
    if (result.Messages) {
      await Promise.all(
        result.Messages.map((message) => processMessage(message))
      );
    }
  }
}

interface S3MessageContent {
  Records: S3MessageContentRecord[];
  Event: string;
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

async function processMessage(message: Message) {
  if (message.Body) {
    const messageBody = JSON.parse(message.Body);
    if (messageBody.Message) {
      const messageData: S3MessageContent = JSON.parse(messageBody.Message);
      if (messageData.Event === "ObjectCreated:Put") {
        await Promise.all(
          messageData.Records.map((record) => processUploadedItem(record))
        );
      } else {
        console.warn("Unexpected inner message body type");
      }
    } else {
      console.warn(`Unexpected empty inner message body`, message);
    }
  } else {
    console.warn(`Unexpected empty message body`, message);
  }

  await client.send(
    new DeleteMessageCommand({
      QueueUrl: process.env.AWS_FILE_UPLOADED_SQS_QUEUE_URL,
      ReceiptHandle: message.ReceiptHandle,
    })
  );
}

async function processUploadedItem(record: S3MessageContentRecord) {
  console.log("Processing uploaded item");
  const key = record.s3.object.key;
  const quiz = await persistence.getQuizByImageKey(key);
  if (quiz) {
    await persistence.markQuizReady(quiz.id);
  } else {
    console.error(`Invalid file upload at key: ${key}`);
  }
}

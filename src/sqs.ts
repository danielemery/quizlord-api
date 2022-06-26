import {
  SQSClient,
  ReceiveMessageCommand,
  Message,
  DeleteMessageCommand,
} from "@aws-sdk/client-sqs";

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
  console.log(`Processing message`);
  console.log(message.Body);

  if (message.Body) {
    const messageBody = JSON.parse(message.Body);
    if (messageBody.Message) {
      const messageData: S3MessageContent = JSON.parse(messageBody.Message);
      await Promise.all(
        messageData.Records.map((record) => processUploadedItem(record))
      );
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
  console.log(record);
}

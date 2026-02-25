import { SQSQueueListenerService, errorBackoffSeconds } from './sqs-listener.service';

const mockSend = jest.fn();
jest.mock('@aws-sdk/client-sqs', () => ({
  SQSClient: jest.fn(() => ({ send: mockSend })),
  ReceiveMessageCommand: jest.fn(),
  DeleteMessageCommand: jest.fn((...args: unknown[]) => ({ _type: 'DeleteMessageCommand', args })),
}));

jest.mock('@sentry/node', () => ({
  captureException: jest.fn(),
}));

jest.mock('../config/config', () => ({
  default: {
    AWS_REGION: 'us-east-1',
    AWS_FILE_UPLOADED_SQS_QUEUE_URL: 'https://sqs.test/file-uploads',
    AWS_AI_PROCESSING_SQS_QUEUE_URL: 'https://sqs.test/ai-processing',
  },
}));

const mockQuizService = {
  markQuizImageReady: jest.fn(),
  aiProcessQuiz: jest.fn(),
};

describe('sqs-listener.service', () => {
  let sut: SQSQueueListenerService;

  beforeEach(() => {
    jest.clearAllMocks();
    sut = new SQSQueueListenerService(mockQuizService as never);
  });

  describe('errorBackoffSeconds', () => {
    it('must return 5s for the first error', () => {
      expect(errorBackoffSeconds(1)).toBe(5);
    });

    it('must double for each consecutive error', () => {
      expect(errorBackoffSeconds(2)).toBe(10);
      expect(errorBackoffSeconds(3)).toBe(20);
      expect(errorBackoffSeconds(4)).toBe(40);
    });

    it('must cap at 60s', () => {
      expect(errorBackoffSeconds(5)).toBe(60);
      expect(errorBackoffSeconds(6)).toBe(60);
      expect(errorBackoffSeconds(100)).toBe(60);
    });
  });

  describe('processMessage', () => {
    const makeMessage = (body: string) => ({
      Body: body,
      ReceiptHandle: 'test-receipt-handle',
    });

    it('must delete the message after successful processing', async () => {
      const s3Event = {
        Message: JSON.stringify({
          Records: [{ eventName: 'ObjectCreated:Put', s3: { object: { key: 'test-key', size: 100 } } }],
        }),
      };
      const message = makeMessage(JSON.stringify(s3Event));
      mockQuizService.markQuizImageReady.mockResolvedValue(undefined);
      mockSend.mockResolvedValue({});

      await sut.processMessage(message);

      expect(mockQuizService.markQuizImageReady).toHaveBeenCalledWith('test-key');
      expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ _type: 'DeleteMessageCommand' }));
    });

    it('must not delete the message when processing fails', async () => {
      const s3Event = {
        Message: JSON.stringify({
          Records: [{ eventName: 'ObjectCreated:Put', s3: { object: { key: 'test-key', size: 100 } } }],
        }),
      };
      const message = makeMessage(JSON.stringify(s3Event));
      mockQuizService.markQuizImageReady.mockRejectedValue(new Error('processing failed'));

      await sut.processMessage(message);

      expect(mockSend).not.toHaveBeenCalled();
    });

    it('must not delete the message when JSON.parse fails on malformed body', async () => {
      const message = makeMessage('not valid json');

      await sut.processMessage(message);

      expect(mockSend).not.toHaveBeenCalled();
    });

    it('must not throw when processing fails', async () => {
      const s3Event = {
        Message: JSON.stringify({
          Records: [{ eventName: 'ObjectCreated:Put', s3: { object: { key: 'test-key', size: 100 } } }],
        }),
      };
      const message = makeMessage(JSON.stringify(s3Event));
      mockQuizService.markQuizImageReady.mockRejectedValue(new Error('processing failed'));

      await expect(sut.processMessage(message)).resolves.not.toThrow();
    });
  });

  describe('processAiProcessingMessage', () => {
    const makeMessage = (body: string) => ({
      Body: body,
      ReceiptHandle: 'test-receipt-handle',
    });

    it('must delete the message after successful processing', async () => {
      const message = makeMessage(JSON.stringify({ quizId: 'quiz-123' }));
      mockQuizService.aiProcessQuiz.mockResolvedValue(undefined);
      mockSend.mockResolvedValue({});

      await sut.processAiProcessingMessage(message);

      expect(mockQuizService.aiProcessQuiz).toHaveBeenCalledWith('quiz-123');
      expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ _type: 'DeleteMessageCommand' }));
    });

    it('must not delete the message when processing fails', async () => {
      const message = makeMessage(JSON.stringify({ quizId: 'quiz-123' }));
      mockQuizService.aiProcessQuiz.mockRejectedValue(new Error('ai failed'));

      await sut.processAiProcessingMessage(message);

      expect(mockSend).not.toHaveBeenCalled();
    });

    it('must not delete the message when JSON.parse fails on malformed body', async () => {
      const message = makeMessage('not valid json');

      await sut.processAiProcessingMessage(message);

      expect(mockSend).not.toHaveBeenCalled();
    });

    it('must not throw when processing fails', async () => {
      const message = makeMessage(JSON.stringify({ quizId: 'quiz-123' }));
      mockQuizService.aiProcessQuiz.mockRejectedValue(new Error('ai failed'));

      await expect(sut.processAiProcessingMessage(message)).resolves.not.toThrow();
    });
  });
});

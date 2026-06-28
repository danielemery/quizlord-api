import { GeminiService } from './gemini.service.js';

const mockUpload = vi.fn();
const mockGet = vi.fn();
const mockDelete = vi.fn();
const mockGenerateContent = vi.fn();
const mockCreatePartFromUri = vi.fn((uri: string, mimeType: string) => ({ fileData: { fileUri: uri, mimeType } }));

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn(function () {
    return {
      files: { upload: mockUpload, get: mockGet, delete: mockDelete },
      models: { generateContent: mockGenerateContent },
    };
  }),
  createPartFromUri: (uri: string, mimeType: string) => mockCreatePartFromUri(uri, mimeType),
  FileState: { STATE_UNSPECIFIED: 'STATE_UNSPECIFIED', PROCESSING: 'PROCESSING', ACTIVE: 'ACTIVE', FAILED: 'FAILED' },
}));

const mockAxiosGet = vi.fn();
vi.mock('axios', () => ({ default: { get: (...args: unknown[]) => mockAxiosGet(...args) } }));

// Streaming the image to disk is irrelevant to the unit under test; stub the filesystem touchpoints.
vi.mock('node:stream/promises', () => ({ pipeline: vi.fn().mockResolvedValue(undefined) }));
vi.mock('node:fs', () => ({ createWriteStream: vi.fn(() => ({})) }));
const mockUnlink = vi.fn().mockResolvedValue(undefined);
vi.mock('node:fs/promises', () => ({ unlink: (...args: unknown[]) => mockUnlink(...args) }));

const validResponse = JSON.stringify({
  questions: [{ questionNumber: 1, question: 'What is the capital of France?', answer: '1. Paris' }],
  confidence: 95,
  notes: null,
});

const combinedImage = [
  { quizImageUrl: 'https://files.test/quiz/qanda.jpg', mimeType: 'image/jpeg', type: 'QUESTION_AND_ANSWER' as const },
];

describe('gemini.service', () => {
  let sut: GeminiService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAxiosGet.mockResolvedValue({ data: { pipe: vi.fn() } });
    mockUpload.mockResolvedValue({
      name: 'files/abc',
      uri: 'https://generativelanguage.test/files/abc',
      mimeType: 'image/jpeg',
      state: 'ACTIVE',
    });
    mockDelete.mockResolvedValue(undefined);
    mockGenerateContent.mockResolvedValue({ text: validResponse });
    sut = new GeminiService('test-api-key');
  });

  describe('extractQuizQuestions', () => {
    it('must return the validated and sanitized result with the model name', async () => {
      const result = await sut.extractQuizQuestions(1, combinedImage);

      expect(result.confidence).toBe(95);
      expect(result.model).toBe('gemini-3-flash-preview');
      // Leading "1. " numbering must be stripped from the answer.
      expect(result.questions).toEqual([
        { questionNumber: 1, question: 'What is the capital of France?', answer: 'Paris' },
      ]);
    });

    it('must download by streaming rather than buffering the whole image', async () => {
      await sut.extractQuizQuestions(1, combinedImage);

      expect(mockAxiosGet).toHaveBeenCalledWith(
        combinedImage[0].quizImageUrl,
        expect.objectContaining({ responseType: 'stream' }),
      );
    });

    it('must upload each image by reference and pass the file uris to the model', async () => {
      await sut.extractQuizQuestions(1, combinedImage);

      expect(mockUpload).toHaveBeenCalledWith({ file: expect.any(String), config: { mimeType: 'image/jpeg' } });
      expect(mockCreatePartFromUri).toHaveBeenCalledWith('https://generativelanguage.test/files/abc', 'image/jpeg');
      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          contents: expect.arrayContaining([
            { fileData: { fileUri: 'https://generativelanguage.test/files/abc', mimeType: 'image/jpeg' } },
          ]),
        }),
      );
    });

    it('must upload images sequentially (only one in flight at a time)', async () => {
      const separateImages = [
        { quizImageUrl: 'https://files.test/q.jpg', mimeType: 'image/jpeg', type: 'QUESTION' as const },
        { quizImageUrl: 'https://files.test/a.jpg', mimeType: 'image/jpeg', type: 'ANSWER' as const },
      ];
      let inFlight = 0;
      let maxInFlight = 0;
      mockUpload.mockImplementation(async () => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await Promise.resolve();
        inFlight--;
        return { name: 'files/x', uri: 'https://files.test/x', mimeType: 'image/jpeg', state: 'ACTIVE' };
      });

      await sut.extractQuizQuestions(2, separateImages);

      expect(mockUpload).toHaveBeenCalledTimes(2);
      expect(maxInFlight).toBe(1);
    });

    it('must poll until the uploaded file becomes active before generating', async () => {
      vi.useFakeTimers();
      try {
        mockUpload.mockResolvedValue({
          name: 'files/abc',
          uri: 'https://files.test/abc',
          mimeType: 'image/jpeg',
          state: 'PROCESSING',
        });
        mockGet
          .mockResolvedValueOnce({
            name: 'files/abc',
            uri: 'https://files.test/abc',
            mimeType: 'image/jpeg',
            state: 'PROCESSING',
          })
          .mockResolvedValueOnce({
            name: 'files/abc',
            uri: 'https://files.test/abc',
            mimeType: 'image/jpeg',
            state: 'ACTIVE',
          });

        const promise = sut.extractQuizQuestions(1, combinedImage);
        // Advance through both poll intervals without waiting on real time.
        await vi.advanceTimersByTimeAsync(2000);
        const result = await promise;

        expect(mockGet).toHaveBeenCalledTimes(2);
        expect(result.confidence).toBe(95);
      } finally {
        vi.useRealTimers();
      }
    });

    it('must throw when the uploaded file fails processing', async () => {
      mockUpload.mockResolvedValue({
        name: 'files/abc',
        uri: 'https://files.test/abc',
        mimeType: 'image/jpeg',
        state: 'FAILED',
      });

      await expect(sut.extractQuizQuestions(1, combinedImage)).rejects.toThrow(/failed processing/);
      // The remote file was created before activation failed, so it must still be cleaned up.
      expect(mockDelete).toHaveBeenCalledWith({ name: 'files/abc' });
    });

    it('must delete uploaded files after a successful extraction', async () => {
      await sut.extractQuizQuestions(1, combinedImage);

      expect(mockDelete).toHaveBeenCalledWith({ name: 'files/abc' });
    });

    it('must delete uploaded files even when generation fails', async () => {
      mockGenerateContent.mockRejectedValue(new Error('model exploded'));

      await expect(sut.extractQuizQuestions(1, combinedImage)).rejects.toThrow('model exploded');
      expect(mockDelete).toHaveBeenCalledWith({ name: 'files/abc' });
    });

    it('must remove the temporary file even when upload fails', async () => {
      mockUpload.mockRejectedValue(new Error('upload failed'));

      await expect(sut.extractQuizQuestions(1, combinedImage)).rejects.toThrow('upload failed');
      expect(mockUnlink).toHaveBeenCalledTimes(1);
    });

    it('must throw when the model returns no text', async () => {
      mockGenerateContent.mockResolvedValue({ text: undefined });

      await expect(sut.extractQuizQuestions(1, combinedImage)).rejects.toThrow('No text response from model');
    });
  });
});

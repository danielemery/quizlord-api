import axios from 'axios';
// PromptType is not used in this file, removed from import.
import { GeminiService } from './gemini.service';
import { QuizImageType } from '../quiz/quiz.dto';
import { GoogleGenAI } from '@google/genai'; // Will be mocked
import { ExpectedAIExtractAnswersResult } from './ai-results.schema';

// Mock @google/genai. Jest replaces the actual module with a mock.
jest.mock('@google/genai');

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Cast the imported (now mocked) GoogleGenAI to its mock type
const MockedGoogleGenAI = GoogleGenAI as jest.MockedClass<typeof GoogleGenAI>;

describe('GeminiService', () => {
  let geminiService: GeminiService;
  const apiKey = 'test-api-key';

  // These will hold the specific mock functions we need to control per test
  let mockGenerateContentFn: jest.Mock;
  let mockGetGenerativeModelFn: jest.Mock;

  beforeEach(() => {
    // Reset the main constructor mock
    MockedGoogleGenAI.mockClear();

    // Create new specific function mocks for each test
    mockGenerateContentFn = jest.fn();
    mockGetGenerativeModelFn = jest.fn(() => ({
      generateContent: mockGenerateContentFn,
    }));

    // Configure the constructor mock (MockedGoogleGenAI) to return an instance
    // that uses our specific function mocks (mockGetGenerativeModelFn)
    MockedGoogleGenAI.mockImplementation(() => {
      return {
        getGenerativeModel: mockGetGenerativeModelFn,
      } as any; // Use 'as any' or a more specific mock type for the instance
    });

    geminiService = new GeminiService(apiKey);
  });

  describe('constructor', () => {
    it('should initialize GoogleGenAI with the provided API key', () => {
      // Check if the constructor (MockedGoogleGenAI) was called
      expect(MockedGoogleGenAI).toHaveBeenCalledWith({ apiKey });
    });
  });

  describe('extractQuizQuestions', () => {
    const mockQuizImagesCombined = [{ quizImageUrl: 'http://example.com/combined.jpg', mimeType: 'image/jpeg', type: 'QUESTION_AND_ANSWER' as QuizImageType }];
    const mockQuizImagesSeparate = [
      { quizImageUrl: 'http://example.com/questions.jpg', mimeType: 'image/jpeg', type: 'QUESTION' as QuizImageType },
      { quizImageUrl: 'http://example.com/answers.jpg', mimeType: 'image/jpeg', type: 'ANSWER' as QuizImageType },
    ];
    const expectedQuestionCount = 2;

    const mockSuccessResponseText = JSON.stringify({
      questions: [
        { questionNumber: 1, question: 'What is 1+1?', answer: '2' },
        { questionNumber: 2, question: 'What is 2+2?', answer: '4' },
      ],
      confidence: 95,
      notes: 'Looks good.',
    });

    const mockSanitizedQuestions = [
      { questionNumber: 1, question: 'What is 1+1?', answer: '2' },
      { questionNumber: 2, question: 'What is 2+2?', answer: '4' },
    ];

    const mockExpectedSuccessResult: ExpectedAIExtractAnswersResult = {
        questions: mockSanitizedQuestions,
        confidence: 95,
        notes: 'Looks good.',
    };

    beforeEach(() => {
      // Mock axios.get for image fetching
      mockedAxios.get.mockResolvedValue({ data: Buffer.from('fake-image-data') });
      // Default mock for generateContent using the new mockGenerateContentFn
      mockGenerateContentFn.mockResolvedValue({
        response: { text: () => mockSuccessResponseText },
      });
    });

    it('should successfully extract for COMBINED_QUESTION_AND_ANSWER type', async () => {
      const result = await geminiService.extractQuizQuestions(expectedQuestionCount, mockQuizImagesCombined);
      expect(mockGetGenerativeModelFn).toHaveBeenCalledWith({ model: 'models/gemini-1.5-flash' });
      expect(mockGenerateContentFn).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockExpectedSuccessResult);
      // Check that the prompt was generated correctly (simplified check)
      const generateContentArgs = mockGenerateContentFn.mock.calls[0][0];
      expect(generateContentArgs.contents[0].text).toContain('Attached should be a single image');
    });

    it('should successfully extract for SEPARATE_QUESTION_AND_ANSWER type', async () => {
      const result = await geminiService.extractQuizQuestions(expectedQuestionCount, mockQuizImagesSeparate);
      expect(mockGetGenerativeModelFn).toHaveBeenCalledWith({ model: 'models/gemini-1.5-flash' });
      expect(mockGenerateContentFn).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockExpectedSuccessResult);
      // Check that the prompt was generated correctly (simplified check)
      const generateContentArgs = mockGenerateContentFn.mock.calls[0][0];
      expect(generateContentArgs.contents[0].text).toContain('Attached should be two images');
    });

    it('should handle JSON backticks in model response', async () => {
      const responseWithBackticks = '```json\n' + mockSuccessResponseText + '\n```';
      mockGenerateContentFn.mockResolvedValue({
        response: { text: () => responseWithBackticks },
      });
      const result = await geminiService.extractQuizQuestions(expectedQuestionCount, mockQuizImagesCombined);
      expect(result).toEqual(mockExpectedSuccessResult);
    });

    it('should correctly sanitize answers starting with numbers and periods', async () => {
      const responseWithUnsanitizedAnswers = JSON.stringify({
        questions: [
          { questionNumber: 1, question: 'Q1', answer: '1. Answer1' },
          { questionNumber: 2, question: 'Q2', answer: '2. Answer2' },
        ],
        confidence: 90,
        notes: null,
      });
      mockGenerateContentFn.mockResolvedValue({ // Replaced capturedMockGenerateContent
        response: { text: () => responseWithUnsanitizedAnswers },
      });
      const result = await geminiService.extractQuizQuestions(2, mockQuizImagesCombined);
      expect(result.questions).toEqual([
        { questionNumber: 1, question: 'Q1', answer: 'Answer1' },
        { questionNumber: 2, question: 'Q2', answer: 'Answer2' },
      ]);
    });

    it('should handle null questions array in model response', async () => {
      const nullQuestionsResponse = JSON.stringify({
        questions: null,
        confidence: 70,
        notes: 'No questions found.',
      });
      mockGenerateContentFn.mockResolvedValue({ // Replaced capturedMockGenerateContent
        response: { text: () => nullQuestionsResponse },
      });
      const expectedResult: ExpectedAIExtractAnswersResult = {
        questions: null,
        confidence: 70,
        notes: 'No questions found.',
      };
      const result = await geminiService.extractQuizQuestions(expectedQuestionCount, mockQuizImagesCombined);
      expect(result).toEqual(expectedResult);
    });

    it('should throw an error for invalid JSON response', async () => {
      mockGenerateContentFn.mockResolvedValue({ // Replaced capturedMockGenerateContent
        response: { text: () => 'this is not json' },
      });
      await expect(geminiService.extractQuizQuestions(expectedQuestionCount, mockQuizImagesCombined))
        .rejects.toThrow(SyntaxError); // Or a more specific JSON parse error message if possible
    });

    it('should throw an error if JSON does not conform to schema', async () => {
      const nonConformingResponse = JSON.stringify({
        someOtherField: 'data',
        // missing questions, confidence
      });
      mockGenerateContentFn.mockResolvedValue({ // Replaced capturedMockGenerateContent
        response: { text: () => nonConformingResponse },
      });
      // The exact error message comes from Joi
      await expect(geminiService.extractQuizQuestions(expectedQuestionCount, mockQuizImagesCombined))
        .rejects.toThrow(/\"questions\" is required/);
    });

    it('should throw an error for unsupported quizImageTypes combinations (e.g. only QUESTION)', async () => {
        const unsupportedImages = [{ quizImageUrl: 'http://example.com/q.jpg', mimeType: 'image/jpeg', type: 'QUESTION' as QuizImageType }];
        await expect(geminiService.extractQuizQuestions(expectedQuestionCount, unsupportedImages))
          .rejects.toThrow('Unsupported quiz image type combinations, cannot process');
    });

    it('should throw an error for unsupported quizImageTypes combinations (e.g. two QUESTION_AND_ANSWER)', async () => {
        const unsupportedImages = [
            { quizImageUrl: 'http://example.com/qa1.jpg', mimeType: 'image/jpeg', type: 'QUESTION_AND_ANSWER' as QuizImageType },
            { quizImageUrl: 'http://example.com/qa2.jpg', mimeType: 'image/jpeg', type: 'QUESTION_AND_ANSWER' as QuizImageType }
        ];
        await expect(geminiService.extractQuizQuestions(expectedQuestionCount, unsupportedImages))
          .rejects.toThrow('Unsupported quiz image type combinations, cannot process');
    });

     it('should correctly pass image data to generateContent', async () => {
      const mockImageDataBuffer = Buffer.from('fake-image-data-specific-test');
      mockedAxios.get.mockResolvedValue({ data: mockImageDataBuffer });

      await geminiService.extractQuizQuestions(expectedQuestionCount, mockQuizImagesCombined);

      expect(mockedAxios.get).toHaveBeenCalledWith(mockQuizImagesCombined[0].quizImageUrl, { responseType: 'arraybuffer' });

      const generateContentArgs = mockGenerateContentFn.mock.calls[0][0]; // Replaced capturedMockGenerateContent
      expect(generateContentArgs.contents.length).toBe(2); // 1 text prompt, 1 image
      expect(generateContentArgs.contents[1]).toEqual({
        inlineData: {
          data: mockImageDataBuffer.toString('base64'),
          mimeType: mockQuizImagesCombined[0].mimeType,
        },
      });
    });
  });
});

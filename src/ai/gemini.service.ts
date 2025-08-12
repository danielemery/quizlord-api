import { GoogleGenAI } from '@google/genai';

import { QuizImageType } from '../quiz/quiz.dto';
import { ExpectedAIExtractAnswersResult, expectedResultFormat } from './ai-results.schema';

export type PromptType = 'SEPARATE_QUESTION_AND_ANSWER' | 'COMBINED_QUESTION_AND_ANSWER';
const MODEL_NAME = 'gemini-2.0-flash-lite';

export interface ExtractQuizQuestionsResult extends ExpectedAIExtractAnswersResult {
  model: string;
}

interface GenerativePart {
  inlineData: {
    data: string;
    mimeType: string;
  };
}

export class GeminiService {
  #ai: GoogleGenAI;

  constructor(googleAIApiKey: string) {
    this.#ai = new GoogleGenAI({ apiKey: googleAIApiKey });
  }

  async extractQuizQuestions(
    expectedQuestionCount: number,
    quizImages: { quizImageUrl: string; mimeType: string; type: QuizImageType }[],
  ): Promise<ExtractQuizQuestionsResult> {
    const promptType = this.#determinePromptType(quizImages.map(({ type }) => type));
    const prompt = this.#generatePrompt({
      expectedQuestionCount,
      promptType,
    });
    const quizImageParts = await this.#prepareGenerativeParts(quizImages, promptType);

    console.log(`Calling generative model with prompt: ${prompt}`);

    const result = await this.#ai.models.generateContent({
      model: MODEL_NAME,
      contents: [
        ...quizImageParts,
        {
          text: prompt,
        },
      ],
    });

    if (!result?.text) {
      throw new Error('No text response received from the model');
    }

    console.log(`Raw response from model: ${result.text}`);
    const jsonParsed = JSON.parse(this.#sanitizeGeminiResponse(result.text));
    console.log('Successfully parsed response to JSON');
    const validatedResult = expectedResultFormat.validate(jsonParsed);
    if (validatedResult.error) {
      throw new Error(validatedResult.error.message);
    }
    console.log('Response conforms to expected schema');
    const sanitized = this.#sanitizeGeminiParsedResult(validatedResult.value);
    return {
      ...sanitized,
      model: MODEL_NAME,
    };
  }

  #sanitizeGeminiParsedResult(result: ExpectedAIExtractAnswersResult): ExpectedAIExtractAnswersResult {
    return {
      ...result,
      questions: result.questions
        ? result.questions.map((question) => ({
            ...question,
            answer: question.answer.replace(/^\d+\.\s*/, ''),
          }))
        : null,
    };
  }

  #sanitizeGeminiResponse(response: string) {
    return response.replaceAll('```json', '').replaceAll('```', '');
  }

  async #prepareGenerativeParts(
    quizImages: { quizImageUrl: string; mimeType: string; type: QuizImageType }[],
    promptType: PromptType,
  ): Promise<GenerativePart[]> {
    switch (promptType) {
      case 'COMBINED_QUESTION_AND_ANSWER': {
        if (quizImages.length !== 1) {
          throw new Error('Expected exactly one image for combined question and answer prompt type');
        }
        return [await this.#fileToGenerativePart(quizImages[0].quizImageUrl, quizImages[0].mimeType)];
      }
      case 'SEPARATE_QUESTION_AND_ANSWER': {
        if (quizImages.length !== 2) {
          throw new Error('Expected exactly two images for separate question and answer prompt type');
        }
        const questionImage = quizImages.find((image) => image.type === 'QUESTION');
        const answerImage = quizImages.find((image) => image.type === 'ANSWER');
        if (!questionImage || !answerImage) {
          throw new Error('Expected one question and one answer image for separate question and answer prompt type');
        }
        return [
          await this.#fileToGenerativePart(questionImage.quizImageUrl, questionImage.mimeType),
          await this.#fileToGenerativePart(answerImage.quizImageUrl, answerImage.mimeType),
        ];
      }
      default:
        throw new Error(`Unsupported prompt type: ${promptType}`);
    }
  }

  async #fileToGenerativePart(fileUrl: string, mimeType: string): Promise<GenerativePart> {
    const response = await fetch(fileUrl);
    const imageArrayBuffer = await response.arrayBuffer();
    const base64ImageData = Buffer.from(imageArrayBuffer).toString('base64');
    return {
      inlineData: {
        data: base64ImageData,
        mimeType,
      },
    };
  }

  #generatePrompt({ expectedQuestionCount, promptType }: { expectedQuestionCount: number; promptType: PromptType }) {
    switch (promptType) {
      case 'COMBINED_QUESTION_AND_ANSWER':
        return `
        Attached should be a single image of a newspaper snippet containing both the questions and answers.
        Can you please collect the questions and answers from the given image and provide them as a JSON object string.

        Step 1: Identify the questions and answers in the image.

        Collect the questions and answers from the image. The questions are usually numbered and the answers are often upside down below the questions.
        Focus on collecting the questions and answers exactly as they appear in the image, without any additional formatting or interpretation.
        The quiz is expected to contain ${expectedQuestionCount} questions based on its type.

        Step 2: Format the output as a JSON object string.

        The resulting string should be parsable using \`JSON.parse\` without modification.
        The object should have the following fields:
         - questions: An array containing objects with the fields 'questionNumber', 'question' and 'answer'. In cases where the questions could not be read, this should be set to null. The number does not need to be repeated in the questions and answers text.
         - confidence: A number between 1 and 100 indicating the confidence level of reading the questions. This should be based on the quality of the image.
         - notes: Any additional notes or comments you have about parsing of the quiz, in most cases this can be set to null. An example of a useful note is when an answer was not found for a question or when the image did not contain the expected data.
        `;
      case 'SEPARATE_QUESTION_AND_ANSWER':
        return `
        Attached should be two images of newspaper snippets, one containing the questions and the other containing the answers.
        Can you please collect the questions and answers from the given images and provide them as a JSON object string.

        Step 1: Identify the questions and answers in the images.

        Collect the questions from the first image and the answers from the second image.
        Both the questions and answers are numbered. So you can match the questions and answers based on their numbers.
        The quiz is expected to contain ${expectedQuestionCount} questions based on its type.

        Step 2: Format the output as a JSON object string.

        The resulting string should be parsable using \`JSON.parse\` without modification.
        The object should have the following fields:
         - questions: An array containing objects with the fields 'questionNumber', 'question' and 'answer'. In cases where the questions could not be read, this should be set to null. The number does not need to be repeated in the questions and answers text.
         - confidence: A number between 1 and 100 indicating the confidence level of reading the questions. This should be based on the quality of the images.
         - notes: Any additional notes or comments you have about parsing of the quiz, in most cases this can be set to null. An example of a useful note is when an answer was not found for a question or when the image did not contain the expected data.
        `;
    }
  }

  #determinePromptType(quizImageTypes: QuizImageType[]): PromptType {
    if (quizImageTypes.length === 1 && quizImageTypes[0] === 'QUESTION_AND_ANSWER') {
      return 'COMBINED_QUESTION_AND_ANSWER';
    }
    if (quizImageTypes.length === 2 && quizImageTypes.includes('QUESTION') && quizImageTypes.includes('ANSWER')) {
      return 'SEPARATE_QUESTION_AND_ANSWER';
    }
    throw new Error('Unsupported quiz image type combinations, cannot process');
  }
}

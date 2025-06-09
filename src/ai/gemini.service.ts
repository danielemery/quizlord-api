import { GoogleGenAI } from '@google/genai';

import { QuizImageType } from '../quiz/quiz.dto';
import { ExpectedAIExtractAnswersResult, expectedResultFormat } from './ai-results.schema';

export type PromptType = 'SEPARATE_QUESTION_AND_ANSWER' | 'COMBINED_QUESTION_AND_ANSWER';
const MODEL_NAME = 'gemini-2.0-flash-lite';

export interface ExtractQuizQuestionsResult extends ExpectedAIExtractAnswersResult {
  model: string;
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
    const prompt = this.#generatePrompt({
      expectedQuestionCount,
      quizImageTypes: quizImages.map(({ type }) => type),
    });
    console.log(`Calling generative model with prompt: ${prompt}`);
    const quizImageParts = await Promise.all(
      quizImages.map(async ({ quizImageUrl, mimeType }) => {
        return await this.#fileToGenerativePart(quizImageUrl, mimeType);
      }),
    );

    const result = await this.#ai.models.generateContent({
      model: MODEL_NAME,
      contents: [
        {
          text: prompt,
        },
        ...quizImageParts,
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

  async #fileToGenerativePart(fileUrl: string, mimeType: string) {
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

  #generatePrompt({
    expectedQuestionCount,
    quizImageTypes,
  }: {
    expectedQuestionCount: number;
    quizImageTypes: QuizImageType[];
  }) {
    const promptType = this.#determinePromptType(quizImageTypes);
    switch (promptType) {
      case 'COMBINED_QUESTION_AND_ANSWER':
        return `
        Can you please extract the questions and answers from the given image and provide them as a JSON object string. The resulting string should be parsable using \`JSON.parse\` without modification.
        Attached should be a single image of a newspaper snippet containing both the questions and answers. The answers are usually upside down underneath the quiz.
        The object should have the following fields:
         - questions: An array containing objects with the fields 'questionNumber', 'question' and 'answer'. In cases where the questions could not be read, this should be set to null. The number does not need to be repeated in the questions and answers text.
         - confidence: A number between 1 and 100 indicating the confidence level of reading the questions. This should be based on the quality of the image.
         - notes: Any additional notes or comments you have about parsing of the quiz, in most cases this can be set to null. An example of a useful note is when an answer was not found for a question or when the image did not contain the expected data.
        The quiz is expected to contain ${expectedQuestionCount} questions based on its type.
        `;
      case 'SEPARATE_QUESTION_AND_ANSWER':
        return `
        Can you please extract the questions and answers from the given images and provide them as a JSON object string. The resulting string should be parsable using \`JSON.parse\` without modification.
        Attached should be two images of newspaper snippets, one containing the questions and the other containing the answers.
        The object should have the following fields:
         - questions: An array containing objects with the fields 'questionNumber', 'question' and 'answer'. In cases where the questions could not be read, this should be set to null. The number does not need to be repeated in the questions and answers text.
         - confidence: A number between 1 and 100 indicating the confidence level of reading the questions. This should be based on the quality of the images.
         - notes: Any additional notes or comments you have about parsing of the quiz, in most cases this can be set to null. An example of a useful note is when an answer was not found for a question or when the image did not contain the expected data.
        The quiz is expected to contain ${expectedQuestionCount} questions based on its type.
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

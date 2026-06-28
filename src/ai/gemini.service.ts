import { createPartFromUri, type File as GenAIFile, FileState, GoogleGenAI } from '@google/genai';
import axios from 'axios';
import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';

import { QuizImageType } from '../quiz/quiz.dto.js';
import { logger } from '../util/logger.js';
import { ExpectedAIExtractAnswersResult, expectedResultFormat } from './ai-results.schema.js';

export type PromptType = 'SEPARATE_QUESTION_AND_ANSWER' | 'COMBINED_QUESTION_AND_ANSWER';
const MODEL_NAME = 'gemini-3-flash-preview';
/** How long to wait between polls while an uploaded file is still processing. */
const FILE_ACTIVE_POLL_INTERVAL_MS = 1000;
/** Maximum number of polls before giving up on a file becoming active. */
const FILE_ACTIVE_MAX_ATTEMPTS = 30;
/** Hard ceiling on a single image download so a stalled host cannot hang processing indefinitely. */
const IMAGE_DOWNLOAD_TIMEOUT_MS = 30_000;

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
    logger.info('Calling generative model', {
      model: MODEL_NAME,
      expectedQuestionCount,
      imageCount: quizImages.length,
    });
    // Upload images sequentially rather than concurrently so that only a single image is ever held
    // in flight at a time. Each image is streamed from storage straight to a temp file and uploaded
    // by reference, keeping the full image (and its base64 expansion) out of the process heap.
    const uploadedFiles: GenAIFile[] = [];
    try {
      for (const { quizImageUrl, mimeType } of quizImages) {
        uploadedFiles.push(await this.#uploadImageFromUrl(quizImageUrl, mimeType));
      }
      const imageParts = uploadedFiles.map((file) => createPartFromUri(file.uri!, file.mimeType!));

      const result = await this.#ai.models.generateContent({
        model: MODEL_NAME,
        contents: [prompt, ...imageParts],
      });
      const text = result.text;
      if (!text) {
        throw new Error('No text response from model');
      }
      logger.info('Received response from model', { model: MODEL_NAME, responseLength: text.length });
      const jsonParsed = JSON.parse(this.#sanitizeGeminiResponse(text));
      const validatedResult = expectedResultFormat.validate(jsonParsed);
      if (validatedResult.error) {
        throw new Error(validatedResult.error.message);
      }
      logger.info('Successfully validated AI response', {
        model: MODEL_NAME,
        confidence: validatedResult.value.confidence,
      });
      const sanitized = this.#sanitizeGeminiParsedResult(validatedResult.value);
      return {
        ...sanitized,
        model: MODEL_NAME,
      };
    } finally {
      await Promise.all(uploadedFiles.map((file) => this.#safeDeleteUploadedFile(file.name)));
    }
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

  /**
   * Streams the image at the given url to a temporary file and uploads it to the Gemini Files API,
   * returning the uploaded file once it has become active. The temporary file is always removed,
   * and the image is never fully materialised in the process heap.
   */
  async #uploadImageFromUrl(fileUrl: string, mimeType: string): Promise<GenAIFile> {
    const tempPath = join(tmpdir(), `quizlord-ai-${randomUUID()}`);
    try {
      const response = await axios.get(fileUrl, {
        responseType: 'stream',
        signal: AbortSignal.timeout(IMAGE_DOWNLOAD_TIMEOUT_MS),
      });
      await pipeline(response.data, createWriteStream(tempPath));
      const uploaded = await this.#ai.files.upload({ file: tempPath, config: { mimeType } });
      try {
        return await this.#waitForFileActive(uploaded);
      } catch (err) {
        // Activation failed, timed out, or polling errored: delete the now-orphaned remote file
        // before rethrowing, since it never makes it into the caller's cleanup list.
        await this.#safeDeleteUploadedFile(uploaded.name);
        throw err;
      }
    } finally {
      await this.#safeUnlink(tempPath);
    }
  }

  /** Polls the Files API until the uploaded file becomes active, throwing if it fails or times out. */
  async #waitForFileActive(file: GenAIFile): Promise<GenAIFile> {
    let current = file;
    // Evaluate state at the top of every iteration, including after the final refresh, so a file
    // that only becomes active (or fails) on the last allowed poll is still handled correctly.
    for (let attempt = 0; ; attempt++) {
      if (current.state === FileState.ACTIVE) {
        return current;
      }
      if (current.state === FileState.FAILED) {
        throw new Error(`Uploaded file ${current.name} failed processing`);
      }
      if (attempt >= FILE_ACTIVE_MAX_ATTEMPTS) {
        throw new Error(`Timed out waiting for uploaded file ${file.name} to become active`);
      }
      await sleep(FILE_ACTIVE_POLL_INTERVAL_MS);
      current = await this.#ai.files.get({ name: current.name! });
    }
  }

  /** Best-effort removal of an uploaded file; failures are logged but never thrown. */
  async #safeDeleteUploadedFile(name: string | undefined) {
    if (!name) {
      return;
    }
    try {
      await this.#ai.files.delete({ name });
    } catch (err) {
      logger.warn('Failed to delete uploaded file from Gemini', { name, exception: err });
    }
  }

  /** Best-effort removal of a temp file; failures are logged but never thrown. */
  async #safeUnlink(tempPath: string) {
    try {
      await unlink(tempPath);
    } catch (err) {
      logger.warn('Failed to delete temporary image file', { tempPath, exception: err });
    }
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

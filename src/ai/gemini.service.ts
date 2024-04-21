import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import axios from 'axios';

export class GeminiService {
  #ai: GoogleGenerativeAI;
  #model: GenerativeModel;

  constructor(googleAIApiKey: string) {
    this.#ai = new GoogleGenerativeAI(googleAIApiKey);
    this.#model = this.#ai.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });
  }

  async extractQuizQuestions(expectedQuestionCount: number, quizImageUrl: string, mimeType: string) {
    const prompt = `Can you please extract the ${expectedQuestionCount} questions and answers from the image and provide them as a JSON array containing objects with the fields 'questionNumber', 'question' and 'answer'?`;
    const quizImage = await this.#fileToGenerativePart(quizImageUrl, mimeType);

    const result = await this.#model.generateContent([prompt, quizImage]);
    const response = await result.response;
    const text = response.text();
    console.log(text);
  }

  async #fileToGenerativePart(fileUrl: string, mimeType: string) {
    const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data, 'utf-8');
    return {
      inlineData: {
        data: buffer.toString('base64'),
        mimeType,
      },
    };
  }
}

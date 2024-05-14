import Anthropic from '@anthropic-ai/sdk';
import axios from 'axios';

export class ClaudeService {
  #ai: Anthropic;

  constructor(claudeApiKey: string) {
    this.#ai = new Anthropic({
      apiKey: claudeApiKey,
    });
  }

  async extractQuizQuestions(expectedQuestionCount: number, quizImageUrl: string, mimeType: string) {
    const prompt = `Can you please extract the ${expectedQuestionCount} questions and answers from the image and provide them as a JSON array containing objects with the fields 'questionNumber', 'question' and 'answer'?`;
    const quizImage = await this.#fileToClaudeMessage(quizImageUrl, mimeType);

    const claudeResult = await this.#ai.messages.create({
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image',
              source: {
                data: quizImage.base64encodedData,
                media_type: quizImage.mimeType,
                type: 'base64',
              },
            },
          ],
        },
      ],
      model: 'claude-3-opus-20240229',
    });

    console.log(JSON.stringify(claudeResult));
  }

  async #fileToClaudeMessage(fileUrl: string, mimeType: string) {
    if (!isValidMimeType(mimeType)) {
      throw new Error(`Invalid mime type: ${mimeType}`);
    }
    const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data, 'utf-8');
    return {
      mimeType: mimeType,
      base64encodedData: buffer.toString('base64'),
    };
  }
}

const VALID_CLAUDE_MIME_TYPES = [`image/jpeg`, `image/png`, `image/gif`, `image/webp`] as const;
type ValidClaudeMimeType = (typeof VALID_CLAUDE_MIME_TYPES)[number];

function isValidMimeType(mimeType: string): mimeType is ValidClaudeMimeType {
  return VALID_CLAUDE_MIME_TYPES.includes(mimeType as ValidClaudeMimeType);
}

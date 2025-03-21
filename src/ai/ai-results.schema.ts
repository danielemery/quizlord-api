import Joi from 'joi';

export interface ExpectedAIExtractAnswersResult {
  questions:
    | {
        questionNumber: number;
        question: string;
        answer: string;
      }[]
    | null;
  confidence: number;
  notes: string | null;
}

export const expectedResultFormat = Joi.object<ExpectedAIExtractAnswersResult>({
  questions: Joi.array()
    .items(
      Joi.object({
        questionNumber: Joi.number().required(),
        question: Joi.string().required(),
        answer: Joi.string().required(),
      }),
    )
    .allow(null)
    .required(),
  confidence: Joi.number().required(),
  notes: Joi.string().allow(null).required(),
});

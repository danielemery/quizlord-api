import { GeminiService } from '../src/ai/gemini.service';

const gemini = new GeminiService(process.env.GOOGLE_AI_API_KEY as unknown as string);

async function main() {
  await gemini.extractQuizQuestions(
    20,
    'https://prod-uploads.quizlord.net/4794057e-cc19-45aa-a833-cc0622e5c2f5/IMG_20240514_133548.jpg',
    'image/jpeg',
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .then(() => process.exit(0));

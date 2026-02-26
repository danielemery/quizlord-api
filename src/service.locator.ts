import { ActivityService } from './activity/activity.service.js';
import { GeminiService } from './ai/gemini.service.js';
import { AuthenticationService } from './auth/authentication.service.js';
import { AuthorisationService } from './auth/authorisation.service.js';
import config from './config/config.js';
import { PrismaService } from './database/prisma.service.js';
import { S3FileService } from './file/s3.service.js';
import { SQSQueueListenerService as SQSListenerService } from './queue/sqs-listener.service.js';
import { SQSQueuePublisherService } from './queue/sqs-publisher.service.js';
import { QuizPersistence } from './quiz/quiz.persistence.js';
import { QuizService } from './quiz/quiz.service.js';
import { StatisticsService } from './statistics/statistics.service.js';
import { UserPersistence } from './user/user.persistence.js';
import { UserService } from './user/user.service.js';
import { MemoryCache } from './util/cache.js';

const memoryCache = new MemoryCache();

// auth
export const authenticationService = new AuthenticationService(config.AUTH0_DOMAIN, config.AUTH0_AUDIENCE);
export const authorisationService = new AuthorisationService();

// prisma
export const prismaService = new PrismaService();

// file
export const fileService = new S3FileService(config.AWS_REGION, config.AWS_BUCKET_NAME, config.FILE_ACCESS_BASE_URL);

// ai
export const geminiService = new GeminiService(config.GOOGLE_AI_API_KEY);

// user
export const userPersistence = new UserPersistence(prismaService);
export const userService = new UserService(userPersistence);

// queue publisher
export const queuePublisherService = new SQSQueuePublisherService();

// quiz
export const quizPersistence = new QuizPersistence(prismaService);
export const quizService = new QuizService(
  quizPersistence,
  fileService,
  userService,
  geminiService,
  queuePublisherService,
);

// queue listener
export const queueService = new SQSListenerService(quizService);

// statistics
export const statisticsService = new StatisticsService(userService, quizService, memoryCache);

// activity
export const activityService = new ActivityService(quizService);

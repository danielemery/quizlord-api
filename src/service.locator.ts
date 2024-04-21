import { ActivityService } from './activity/activity.service';
import { GeminiService } from './ai/gemini.service';
import { AuthenticationService } from './auth/authentication.service';
import { AuthorisationService } from './auth/authorisation.service';
import config from './config/config';
import { PrismaService } from './database/prisma.service';
import { S3FileService } from './file/s3.service';
import { SQSQueueService } from './queue/sqs.service';
import { QuizPersistence } from './quiz/quiz.persistence';
import { QuizService } from './quiz/quiz.service';
import { StatisticsService } from './statistics/statistics.service';
import { UserPersistence } from './user/user.persistence';
import { UserService } from './user/user.service';
import { MemoryCache } from './util/cache';

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

// quiz
export const quizPersistence = new QuizPersistence(prismaService);
export const quizService = new QuizService(quizPersistence, fileService, userService, geminiService);

// queue
export const queueService = new SQSQueueService(quizService);

// statistics
export const statisticsService = new StatisticsService(userService, quizService, memoryCache);

// activity
export const activityService = new ActivityService(quizService);

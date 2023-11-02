import { AuthenticationService } from './auth/authentication.service';
import { AuthorisationService } from './auth/authorisation.service';
import { PrismaService } from './database/prisma.service';
import { S3FileService } from './file/s3.service';
import { SQSQueueService } from './queue/sqs.service';
import { QuizPersistence } from './quiz/quiz.persistence';
import { QuizService } from './quiz/quiz.service';
import { UserPersistence } from './user/user.persistence';
import { UserService } from './user/user.service';

// auth
export const authenticationService = new AuthenticationService();
export const authorisationService = new AuthorisationService();

// prisma
export const prismaService = new PrismaService();

// file
export const fileService = new S3FileService();

// queue
export const queueService = new SQSQueueService();

// quiz
export const quizPersistence = new QuizPersistence(prismaService);
export const quizService = new QuizService(quizPersistence);

// user
export const userPersistence = new UserPersistence(prismaService);
export const userService = new UserService(userPersistence);

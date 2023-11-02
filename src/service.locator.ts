import { AuthenticationService } from './auth/authentication.service';
import { AuthorisationService } from './auth/authorisation.service';
import { S3FileService } from './file/s3.service';
import { SQSQueueService } from './queue/sqs.service';
import { QuizService } from './quiz/quiz.service';
import { UserService } from './user/user.service';

// auth
export const authenticationService = new AuthenticationService();
export const authorisationService = new AuthorisationService();

// file
export const fileService = new S3FileService();

// queue
export const queueService = new SQSQueueService();

// quiz
export const quizService = new QuizService();

// user
export const userService = new UserService();

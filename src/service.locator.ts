import { AuthenticationService } from './auth/authentication.service';
import { AuthorisationService } from './auth/authorisation.service';
import { S3FileService } from './file/s3.service';
import { SQSQueueService } from './queue/sqs.service';

// auth
export const authenticationService = new AuthenticationService();
export const authorisationService = new AuthorisationService();

// file
export const fileService = new S3FileService();

// queue
export const queueService = new SQSQueueService();

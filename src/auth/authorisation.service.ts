import { Role } from '../generated/prisma/client.js';
import { QuizlordContext } from '../index.js';
import { UnauthorisedError } from './authorisation.errors.js';

export class AuthorisationService {
  requireUserRole(context: QuizlordContext, role: Role) {
    if (!context.roles.includes(role)) {
      throw new UnauthorisedError('You are not authorised to perform this action');
    }
  }
}

import { Role } from '@prisma/client';
import { QuizlordContext } from '..';
import { UnauthorisedError } from './authorisation.errors';

export class AuthorisationService {
  requireUserRole(context: QuizlordContext, role: Role) {
    if (!context.roles.includes(role)) {
      throw new UnauthorisedError('You are not authorised to perform this action');
    }
  }
}

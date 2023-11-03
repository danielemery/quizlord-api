import { Role } from '@prisma/client';
import { QuizlordContext } from '..';

export class AuthorisationService {
  requireUserRole(context: QuizlordContext, role: Role) {
    if (!context.roles.includes(role)) {
      throw new Error('You are not authorised to perform this action');
    }
  }
}

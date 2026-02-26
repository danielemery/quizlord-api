import { QuizlordContext } from '../index.js';
import { UnauthorisedError } from './authorisation.errors.js';
import { AuthorisationService } from './authorisation.service.js';

describe('authorisation', () => {
  describe('authorisation.service', () => {
    const sut = new AuthorisationService();
    describe('requireUserRole', () => {
      it('must do nothing if the user has the required role', () => {
        const context = {
          roles: ['USER', 'ADMIN'],
        } as QuizlordContext;
        sut.requireUserRole(context, 'ADMIN');
      });
      it('must throw an error if the user does not have the required role', () => {
        const context = {
          roles: ['USER'],
        } as QuizlordContext;
        expect(() => sut.requireUserRole(context, 'ADMIN')).toThrow(UnauthorisedError);
      });
    });
  });
});

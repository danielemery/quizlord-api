import { QuizlordContext } from '..';
import { AuthorisationService } from './authorisation.service';

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
        expect(() => sut.requireUserRole(context, 'ADMIN')).toThrow('You are not authorised to perform this action');
      });
    });
  });
});

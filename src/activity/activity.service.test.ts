import { UnhandledError } from '../util/common.errors';
import { ActivityService } from './activity.service';

const sut = new ActivityService();
describe('activity', () => {
  describe('activity.service', () => {
    describe('userListToString', () => {
      it('must throw an error if the user list is empty', () => {
        expect(() => sut.userListToString([])).toThrow(UnhandledError);
      });
      it('must just return the name or email of a single user', () => {
        expect(sut.userListToString([{ name: 'John', email: 'john@quizlord.net' }])).toEqual('John');
        expect(sut.userListToString([{ email: 'john@quizlord.net' }])).toEqual('john@quizlord.net');
      });
      it('must return names separated by & for two users', () => {
        expect(
          sut.userListToString([
            { name: 'Jack', email: 'jack@quizlord.net' },
            { name: 'Jill', email: 'jill@quizlord.net' },
          ]),
        ).toEqual('Jack & Jill');
      });
      it('must return names separated by commas and & for three or more users', () => {
        expect(
          sut.userListToString([
            { name: 'Jack', email: 'jack@quizlord.net' },
            { name: 'Jill', email: 'jill@quizlord.net' },
            { name: 'Bob', email: 'bob@quizlord.net' },
            { email: 'nabbs@quizlord.net' },
          ]),
        ).toEqual('Jack, Jill, Bob & nabbs@quizlord.net');
      });
    });
  });
});

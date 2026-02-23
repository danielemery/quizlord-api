import { v4 as uuidv4, Version4Options } from 'uuid';

import { UserNotFoundError } from './user.errors';
import { UserPersistence } from './user.persistence';
import { UserService } from './user.service';

jest.mock('uuid');

// We need to cast here to the specific overload on the uuidv4 we are using, otherwise typescript selects the wrong overload.
const mockedUUIDv4 = jest.mocked(uuidv4 as (options?: Version4Options, buf?: undefined, offset?: number) => string);
const fakeUserPersistence = {
  createNewUser: jest.fn(),
  getUserByEmail: jest.fn(),
  getUserById: jest.fn(),
  updateUserName: jest.fn(),
  getUsersForQuizCompletion: jest.fn(),
  getUserForQuizUpload: jest.fn(),
  getPendingUsers: jest.fn(),
  getRejectedUsers: jest.fn(),
  approveUser: jest.fn(),
  rejectUser: jest.fn(),
};

describe('user', () => {
  describe('user.service', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      jest.restoreAllMocks();
    });
    const sut = new UserService(fakeUserPersistence as unknown as UserPersistence);
    describe('loadUserDetailsAndUpdateIfNecessary', () => {
      it('must return existing user with roles if it exists already with correct name', async () => {
        fakeUserPersistence.getUserByEmail.mockResolvedValueOnce({
          id: 'fake-id',
          name: 'Joe Blogs',
          roles: [{ role: 'ADMIN' }],
        });

        const actual = await sut.loadUserDetailsAndUpdateIfNecessary('joe@quizlord.net', 'Joe Blogs');

        expect(fakeUserPersistence.getUserByEmail).toHaveBeenCalledTimes(1);
        expect(fakeUserPersistence.getUserByEmail).toHaveBeenCalledWith('joe@quizlord.net');

        expect(fakeUserPersistence.createNewUser).not.toHaveBeenCalled();
        expect(fakeUserPersistence.updateUserName).not.toHaveBeenCalled();

        expect(actual).toEqual({
          id: 'fake-id',
          roles: ['ADMIN'],
        });
      });
      it('must create the user if it does not exist', async () => {
        fakeUserPersistence.getUserByEmail.mockResolvedValueOnce(undefined);
        mockedUUIDv4.mockReturnValueOnce('fake-id');

        const actual = await sut.loadUserDetailsAndUpdateIfNecessary('joe@quizlord.net', 'Joe Blogs');

        expect(fakeUserPersistence.getUserByEmail).toHaveBeenCalledTimes(1);
        expect(fakeUserPersistence.getUserByEmail).toHaveBeenCalledWith('joe@quizlord.net');

        expect(fakeUserPersistence.createNewUser).toHaveBeenCalledTimes(1);
        expect(fakeUserPersistence.createNewUser).toHaveBeenCalledWith('fake-id', 'joe@quizlord.net', 'Joe Blogs');

        expect(fakeUserPersistence.updateUserName).not.toHaveBeenCalled();

        expect(actual).toEqual({
          id: 'fake-id',
          roles: [],
        });
      });
      it('must update the name if it is different', async () => {
        fakeUserPersistence.getUserByEmail.mockResolvedValueOnce({
          id: 'fake-id',
          name: 'Joe Biggs',
          roles: [{ role: 'ADMIN' }],
        });

        const actual = await sut.loadUserDetailsAndUpdateIfNecessary('joe@quizlord.net', 'Joe Blogs');

        expect(fakeUserPersistence.getUserByEmail).toHaveBeenCalledTimes(1);
        expect(fakeUserPersistence.getUserByEmail).toHaveBeenCalledWith('joe@quizlord.net');

        expect(fakeUserPersistence.createNewUser).not.toHaveBeenCalled();

        expect(fakeUserPersistence.updateUserName).toHaveBeenCalledTimes(1);
        expect(fakeUserPersistence.updateUserName).toHaveBeenCalledWith('fake-id', 'Joe Blogs');

        expect(actual).toEqual({
          id: 'fake-id',
          roles: ['ADMIN'],
        });
      });
      it("must set the name if it doesn't exist", async () => {
        fakeUserPersistence.getUserByEmail.mockResolvedValueOnce({
          id: 'fake-id',
          roles: [{ role: 'ADMIN' }],
        });

        const actual = await sut.loadUserDetailsAndUpdateIfNecessary('joe@quizlord.net', 'Joe Blogs');

        expect(fakeUserPersistence.getUserByEmail).toHaveBeenCalledTimes(1);
        expect(fakeUserPersistence.getUserByEmail).toHaveBeenCalledWith('joe@quizlord.net');

        expect(fakeUserPersistence.createNewUser).not.toHaveBeenCalled();

        expect(fakeUserPersistence.updateUserName).toHaveBeenCalledTimes(1);
        expect(fakeUserPersistence.updateUserName).toHaveBeenCalledWith('fake-id', 'Joe Blogs');

        expect(actual).toEqual({
          id: 'fake-id',
          roles: ['ADMIN'],
        });
      });
    });
    describe('getUser', () => {
      it("must throw if user doesn't exist", async () => {
        fakeUserPersistence.getUserById.mockResolvedValueOnce(null);

        await expect(() => sut.getUser('fake-id')).rejects.toThrow(UserNotFoundError);

        expect(fakeUserPersistence.getUserById).toHaveBeenCalledTimes(1);
        expect(fakeUserPersistence.getUserById).toHaveBeenCalledWith('fake-id');
      });
      it('must return transformed user', async () => {
        fakeUserPersistence.getUserById.mockResolvedValueOnce({ id: 'fake-id', email: 'fake@quizlord.net' });

        const actual = await sut.getUser('fake-id');

        expect(actual).toEqual({
          id: 'fake-id',
          email: 'fake@quizlord.net',
        });
      });
    });
    describe('getPendingUsers', () => {
      it('must return transformed pending users', async () => {
        fakeUserPersistence.getPendingUsers.mockResolvedValueOnce([
          { id: 'user-1', email: 'alice@quizlord.net', name: 'Alice' },
          { id: 'user-2', email: 'bob@quizlord.net', name: null },
        ]);

        const actual = await sut.getPendingUsers();

        expect(fakeUserPersistence.getPendingUsers).toHaveBeenCalledTimes(1);
        expect(actual).toEqual([
          { id: 'user-1', email: 'alice@quizlord.net', name: 'Alice' },
          { id: 'user-2', email: 'bob@quizlord.net' },
        ]);
      });

      it('must return empty array when no pending users', async () => {
        fakeUserPersistence.getPendingUsers.mockResolvedValueOnce([]);

        const actual = await sut.getPendingUsers();

        expect(actual).toEqual([]);
      });
    });

    describe('getRejectedUsers', () => {
      it('must return transformed rejected users with rejector details', async () => {
        const rejectedAt = new Date('2026-01-15');
        fakeUserPersistence.getRejectedUsers.mockResolvedValueOnce([
          {
            id: 'user-1',
            email: 'rejected@quizlord.net',
            name: 'Rejected User',
            rejectedAt,
            rejectedByUser: { id: 'admin-1', email: 'admin@quizlord.net', name: 'Admin' },
          },
        ]);

        const actual = await sut.getRejectedUsers();

        expect(fakeUserPersistence.getRejectedUsers).toHaveBeenCalledTimes(1);
        expect(actual).toEqual([
          {
            id: 'user-1',
            email: 'rejected@quizlord.net',
            name: 'Rejected User',
            rejectedAt,
            rejectedByUser: { id: 'admin-1', email: 'admin@quizlord.net', name: 'Admin' },
          },
        ]);
      });

      it('must throw if rejected user is missing rejectedByUser', async () => {
        const rejectedAt = new Date('2026-01-15');
        fakeUserPersistence.getRejectedUsers.mockResolvedValueOnce([
          {
            id: 'user-1',
            email: 'rejected@quizlord.net',
            name: null,
            rejectedAt,
            rejectedByUser: null,
          },
        ]);

        await expect(() => sut.getRejectedUsers()).rejects.toThrow('Rejected user user-1 is missing rejectedByUser');
      });
    });

    describe('approveUser', () => {
      it('must throw when no roles provided', async () => {
        await expect(() => sut.approveUser('user-1', [])).rejects.toThrow('At least one role must be provided');

        expect(fakeUserPersistence.approveUser).not.toHaveBeenCalled();
      });

      it('must call persistence and return success', async () => {
        fakeUserPersistence.approveUser.mockResolvedValueOnce({
          id: 'user-1',
          email: 'user@quizlord.net',
          name: 'User',
          roles: [{ role: 'USER' }],
        });

        const actual = await sut.approveUser('user-1', ['USER']);

        expect(fakeUserPersistence.approveUser).toHaveBeenCalledTimes(1);
        expect(fakeUserPersistence.approveUser).toHaveBeenCalledWith('user-1', ['USER']);
        expect(actual).toEqual({ success: true });
      });
    });

    describe('rejectUser', () => {
      it('must call persistence with correct args', async () => {
        fakeUserPersistence.rejectUser.mockResolvedValueOnce(undefined);

        const actual = await sut.rejectUser('user-1', 'admin-1');

        expect(fakeUserPersistence.rejectUser).toHaveBeenCalledTimes(1);
        expect(fakeUserPersistence.rejectUser).toHaveBeenCalledWith('user-1', 'admin-1');
        expect(actual).toEqual({ success: true });
      });
    });

    describe('getUsersForActivity', () => {
      it('must return empty list for unknown action type', async () => {
        const actual = await sut.getUsersForActivity({
          actionType: 'UNKNOWN' as 'QUIZ_UPLOADED',
          date: new Date(),
          resourceId: 'fake-id',
          text: 'fake-text',
        });

        expect(actual).toEqual([]);
      });
      it('must return users for quiz completion', async () => {
        const expected = [{ id: 'fake-user-id', email: 'fake-email@domain.com', name: 'fake-name' }];

        fakeUserPersistence.getUsersForQuizCompletion.mockResolvedValueOnce(expected);

        const actual = await sut.getUsersForActivity({
          actionType: 'QUIZ_COMPLETED',
          date: new Date(),
          resourceId: 'fake-completion-id',
          text: 'fake-text',
        });

        expect(fakeUserPersistence.getUsersForQuizCompletion).toHaveBeenCalledTimes(1);
        expect(fakeUserPersistence.getUsersForQuizCompletion).toHaveBeenCalledWith('fake-completion-id');

        expect(actual).toEqual(expected);
      });
      it('must return user for quiz upload', async () => {
        const fakeUser = { id: 'fake-user-id', email: 'fake-email@domain.com', name: 'fake-name' };

        fakeUserPersistence.getUserForQuizUpload.mockResolvedValueOnce(fakeUser);

        const actual = await sut.getUsersForActivity({
          actionType: 'QUIZ_UPLOADED',
          date: new Date(),
          resourceId: 'fake-quiz-id',
          text: 'fake-text',
        });

        expect(fakeUserPersistence.getUserForQuizUpload).toHaveBeenCalledTimes(1);
        expect(fakeUserPersistence.getUserForQuizUpload).toHaveBeenCalledWith('fake-quiz-id');

        expect(actual).toEqual([fakeUser]);
      });
    });
  });
});

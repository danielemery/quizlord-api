import { v4 as uuidv4 } from 'uuid';

import { UserPersistence } from './user.persistence';
import { UserService } from './user.service';
import { UserNotFoundError } from './user.errors';

jest.mock('uuid');

const mockedUUIDv4 = jest.mocked(uuidv4);
const fakeUserPersistence = {
  createNewUser: jest.fn(),
  getUserByEmail: jest.fn(),
  getUserById: jest.fn(),
  updateUserName: jest.fn(),
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
  });
});

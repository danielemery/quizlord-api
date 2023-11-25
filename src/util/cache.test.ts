import { MemoryCache } from './cache';

describe('util', () => {
  beforeEach(() => {
    jest.useRealTimers();
  });
  describe('cache', () => {
    it('must return undefined if the key does not exist', async () => {
      const sut = new MemoryCache();
      const actual = await sut.getItem('key');
      expect(actual).toBeUndefined();
    });
    it('must return the value if the key exists', async () => {
      const sut = new MemoryCache();
      await sut.setItem('key', 'value', 1000);

      const actual = await sut.getItem('key');

      expect(actual).toBe('value');
    });
    it('must return undefined if the key has expired', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2020-01-01'));
      const sut = new MemoryCache();

      await sut.setItem('key', 'value', 1000);
      expect(await sut.getItem('key')).toBe('value');

      jest.advanceTimersByTime(1001);
      expect(await sut.getItem('key')).toBeUndefined();
    });
    it('must return undefined if the key has been expired manually', async () => {
      const sut = new MemoryCache();
      await sut.setItem('key', 'value', 1000);
      await sut.expireItem('key');
      expect(await sut.getItem('key')).toBeUndefined();
    });
  });
});

/**
 * Cache interface defining the methods that must be implemented by a cache.
 */
export interface Cache {
  /**
   * Get an item from the cache.
   *
   * A generic argument is required to specify the expected type of the item.
   * Note that there is no guarantee that the item will be of this type.
   *
   * @param key The key to get the item for.
   * @returns The item if it exists, otherwise undefined.
   */
  getItem<T>(key: string): Promise<T | undefined>;

  /**
   * Set an item in the cache. If the item already exists, it will be overwritten and the expiry updated.
   *
   * A generic argument is required to specify the type of the item being stored.
   *
   * @param key The key to set the item for.
   * @param value The value to set.
   * @param expiresInMillis The number of milliseconds until the item expires.
   */
  setItem<T>(key: string, value: T, expiresInMillis: number): Promise<void>;

  /**
   * Manually expire an item in the cache.
   * @param key The key to expire.
   */
  expireItem(key: string): Promise<void>;
}

/**
 * Placeholder cache implementation that just stores values in memory.
 * Will be replaced with a Redis implementation in the future.
 */
export class MemoryCache implements Cache {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  #values: Map<string, { value: any; expiresAt?: Date }> = new Map();
  getItem<T>(key: string): Promise<T | undefined> {
    const record = this.#values.get(key);
    if (!record || (record.expiresAt && new Date().getTime() > record.expiresAt.getTime())) {
      return Promise.resolve(undefined);
    }
    return Promise.resolve(record.value);
  }
  setItem<T>(key: string, value: T, expiresInMillis: number): Promise<void> {
    const expiresAt = new Date(new Date().getTime() + expiresInMillis);
    this.#values.set(key, {
      value,
      expiresAt,
    });
    return Promise.resolve();
  }
  expireItem(key: string): Promise<void> {
    this.#values.delete(key);
    return Promise.resolve();
  }
}

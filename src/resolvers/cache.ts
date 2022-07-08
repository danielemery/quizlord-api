export interface Cache {
  getItem(key: string): Promise<string | undefined>;
  setItem(key: string, value: string, expiresInSeconds: number): Promise<void>;
  expireItem(key: string): Promise<void>;
}

export class MemoryCache implements Cache {
  #values: Map<string, { value: string; expiresAt?: Date }> = new Map();
  getItem(key: string): Promise<string | undefined> {
    const record = this.#values.get(key);
    if (
      !record ||
      (record.expiresAt && new Date().getTime() > record.expiresAt.getTime())
    ) {
      return Promise.resolve(undefined);
    }
    return Promise.resolve(record.value);
  }
  setItem(key: string, value: string, expiresInSeconds: number): Promise<void> {
    const expiresAt = new Date(new Date().getTime() + expiresInSeconds * 1000);
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

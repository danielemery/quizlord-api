import { PrismaClient } from '@prisma/client';
import { types } from 'pg';

import { logger } from '../util/logger';

export interface PersistenceResult<T> {
  data: T[];
  hasMoreRows: boolean;
}

const DATE_OID = 1082;
const parseDate = (value: string) => {
  return new Date(value);
};
types.setTypeParser(DATE_OID, parseDate);

export class PrismaService {
  #prisma?: PrismaClient;

  client() {
    if (this.#prisma === undefined) {
      throw new Error('Error attempting to use database before connecting');
    }
    return this.#prisma;
  }

  async connect() {
    if (!this.#prisma) {
      logger.info('Connecting to database');
      this.#prisma = new PrismaClient();
      try {
        await this.#prisma.$queryRaw`SELECT 1`;
      } catch (err) {
        logger.error('Failed to connect to database', { exception: err });
        process.exit(1);
      }
      logger.info('Connected to database successfully');
    }
  }
}

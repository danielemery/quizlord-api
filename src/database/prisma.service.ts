import { PrismaPg } from '@prisma/adapter-pg';
import { types } from 'pg';

import { PrismaClient } from '../generated/prisma/client.js';
import { logger } from '../util/logger.js';

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
      const adapter = new PrismaPg({ connectionString: process.env.DB_CONNECTION_STRING });
      this.#prisma = new PrismaClient({ adapter });
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

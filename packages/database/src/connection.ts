import { MongoClient, type Db } from 'mongodb';

import { ensureDatabaseIndexes } from './indexes.js';

export interface DatabaseConfig {
  uri: string;
  databaseName: string;
}

export class DatabaseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatabaseConfigError';
  }
}

export function readDatabaseConfig(
  environment: Record<string, string | undefined> = process.env,
): DatabaseConfig {
  const uri = environment.MONGODB_URI?.trim();
  const databaseName = environment.MONGODB_DATABASE?.trim() || 'interview_prep';

  if (!uri) {
    throw new DatabaseConfigError('MONGODB_URI is required.');
  }

  return { uri, databaseName };
}

export interface DatabaseConnection {
  client: MongoClient;
  database: Db;
  close: () => Promise<void>;
}

export async function connectDatabase(config: DatabaseConfig): Promise<DatabaseConnection> {
  const client = new MongoClient(config.uri);

  try {
    await client.connect();
    const database = client.db(config.databaseName);
    await ensureDatabaseIndexes(database);

    return {
      client,
      database,
      close: () => client.close(),
    };
  } catch (error) {
    await client.close();
    throw error;
  }
}

import { describe, expect, it } from 'vitest';

import { DatabaseConfigError, readDatabaseConfig } from './connection.js';

describe('readDatabaseConfig', () => {
  it('reads a configured MongoDB URI and database name', () => {
    expect(
      readDatabaseConfig({
        MONGODB_URI: ' mongodb://localhost:27017 ',
        MONGODB_DATABASE: ' prep_test ',
      }),
    ).toEqual({
      uri: 'mongodb://localhost:27017',
      databaseName: 'prep_test',
    });
  });

  it('uses the documented default database name', () => {
    expect(readDatabaseConfig({ MONGODB_URI: 'mongodb://localhost:27017' }).databaseName).toBe(
      'interview_prep',
    );
  });

  it('fails clearly when MONGODB_URI is missing', () => {
    expect(() => readDatabaseConfig({})).toThrowError(DatabaseConfigError);
  });
});

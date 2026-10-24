import { ChildProcess, spawn } from 'child_process';
import 'dotenv/config';
import { createConnection } from 'mysql2/promise';
import { join } from 'path';

// The e2e tests start the compiled server (dist/main.js) as a separate
// process, on its own database. Jest can't load the NestJS packages
// directly because some of them are ESM only.

export const E2E_DB = process.env.E2E_DB_NAME ?? 'catalog_digital_test';
const PORT = Number(process.env.E2E_PORT ?? 3199);
export const API_URL = `http://localhost:${PORT}/api`;

// the database is dropped and created again, so refuse anything that
// does not look like a test database
async function recreateDatabase() {
  if (!E2E_DB.endsWith('_test')) {
    throw new Error(`E2E_DB_NAME must end with "_test" (got "${E2E_DB}")`);
  }
  const conn = await createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });
  await conn.query(`DROP DATABASE IF EXISTS \`${E2E_DB}\``);
  await conn.query(
    `CREATE DATABASE \`${E2E_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
  await conn.end();
}

async function waitUntilReady(server: ChildProcess, output: () => string) {
  for (let i = 0; i < 120; i++) {
    if (server.exitCode !== null) {
      throw new Error(`The server stopped while starting:\n${output()}`);
    }
    try {
      // any answer means the server is listening (this slug does not exist)
      await fetch(`${API_URL}/schools/by-slug/e2e-ping`);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error(`The server did not start in time:\n${output()}`);
}

export async function startTestServer(): Promise<() => Promise<void>> {
  await recreateDatabase();

  let log = '';
  const server = spawn(process.execPath, ['dist/main.js'], {
    cwd: join(__dirname, '..', '..'),
    env: {
      ...process.env,
      DB_NAME: E2E_DB,
      PORT: String(PORT),
      NODE_ENV: 'development',
      DB_MIGRATIONS_RUN: 'true',
      THROTTLE_LIMIT: '10000',
      // the tests need a lesson "now", also when they run on a weekend
      TIMETABLE_WEEKEND: 'true',
    },
  });
  server.stdout?.on('data', (chunk: Buffer) => (log += chunk.toString()));
  server.stderr?.on('data', (chunk: Buffer) => (log += chunk.toString()));

  await waitUntilReady(server, () => log);

  return async () => {
    server.kill();
    await new Promise((resolve) => server.once('exit', resolve));
  };
}

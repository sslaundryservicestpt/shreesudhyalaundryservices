import './env';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(import.meta.url),
  url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith('_test'))
  throw Error(
    'Set an isolated TEST_DATABASE_URL ending in _test. Application database tests are forbidden.',
  );
const migration = spawnSync(
  process.execPath,
  [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'],
  { stdio: 'inherit', env: { ...process.env, DATABASE_URL: url } },
);
if (migration.status !== 0) process.exitCode = 1;
else {
  const result = spawnSync(
    process.execPath,
    [
      path.join(path.dirname(require.resolve('vitest/package.json')), 'vitest.mjs'),
      'run',
      '--config',
      'vitest.integration.config.ts',
    ],
    { stdio: 'inherit', env: { ...process.env, DATABASE_URL: url } },
  );
  process.exitCode = result.status ?? 1;
}

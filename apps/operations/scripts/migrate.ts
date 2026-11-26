import './env';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
if (!process.env.DATABASE_URL) throw Error('Set DATABASE_URL in .env.local.');
const result = spawnSync(
  process.execPath,
  [
    require.resolve('prisma/build/index.js'),
    'migrate',
    process.argv.includes('--status') ? 'status' : 'deploy',
  ],
  { stdio: 'inherit', env: process.env },
);
process.exitCode = result.status ?? 1;

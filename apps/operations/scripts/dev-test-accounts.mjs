import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import process from 'node:process';

const require = createRequire(import.meta.url);
const server = spawn(
  process.execPath,
  [
    require.resolve('next/dist/bin/next'),
    'dev',
    '--webpack',
    '--hostname',
    '127.0.0.1',
    '--port',
    '3002',
  ],
  { env: { ...process.env, OPERATIONS_LOOPBACK_TEST_SERVER: '1' }, stdio: 'inherit' },
);
server.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
server.on('error', () => {
  console.error('The local test sign-in server could not start.');
  process.exitCode = 1;
});

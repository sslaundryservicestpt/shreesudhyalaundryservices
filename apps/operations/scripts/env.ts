import fs from 'node:fs';
// CLI-only: Next loads .env.local itself; Prisma and worker processes do not.
if (fs.existsSync('.env.local'))
  for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && process.env[m[1]] === undefined)
      process.env[m[1]] = m[2].trim().replace(/^(["'])(.*)\1$/, '$2');
  }

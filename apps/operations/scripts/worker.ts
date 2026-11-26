import fs from 'node:fs';
const file = '.env.local';
if (fs.existsSync(file))
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^(["'])(.*)\1$/, '$2');
  }
const { runJob, purgeExpiredExports } = await import('../src/server/jobs');
const { purgeExpiredWhatsApp } = await import('../src/server/whatsapp');
const watch = process.argv.includes('--watch');
let stopping = false;
process.on('SIGINT', () => {
  stopping = true;
});
process.on('SIGTERM', () => {
  stopping = true;
});
do {
  await purgeExpiredExports();
  await purgeExpiredWhatsApp();
  let count = 0;
  while (!stopping && count < 100 && (await runJob())) count++;
  console.log(`Worker processed ${count} jobs.`);
  if (!watch || stopping) break;
  await new Promise((resolve) => setTimeout(resolve, 5000));
} while (!stopping);
const { database } = await import('../src/server/db');
await database().$disconnect();

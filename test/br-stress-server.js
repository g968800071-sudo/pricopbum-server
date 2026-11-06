// Throwaway process for the battle-royale stress test. Not part of npm test by itself.
import { startServer } from '../server/server.js';

const server = await startServer(0);
const port = server.address().port;
console.log('PORT ' + port);
setInterval(() => {
  const m = process.memoryUsage();
  console.log('MEM ' + m.rss + ' ' + m.heapUsed);
}, 400);

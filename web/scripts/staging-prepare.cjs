const { spawnSync } = require('node:child_process');
const { assertStagingEnvironment } = require('./staging-guard.cjs');
assertStagingEnvironment();
// This isolated database starts empty. Never allow destructive schema changes.
const result = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), 'db', 'push', '--skip-generate'], { stdio: 'inherit', env: process.env });
if (result.error || result.status !== 0) process.exit(result.status || 1);

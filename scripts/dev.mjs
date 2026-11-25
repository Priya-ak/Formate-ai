// Watch-build all three bundles into dist/.
import { spawn } from 'node:child_process';
const run = (cfg) => spawn('npx', ['vite', 'build', '--watch', ...(cfg ? ['-c', cfg] : [])], { stdio: 'inherit', shell: true });
run(); run('vite.content.config.ts'); run('vite.background.config.ts');

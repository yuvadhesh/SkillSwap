import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Starting dev servers...');

// Spawn Express backend server on port 5000.
// We set shell: false to avoid space-in-path issues on Windows.
const server = spawn('node', [path.join(__dirname, 'server/index.cjs')], {
  stdio: 'inherit',
  shell: false
});

// Spawn Vite frontend server.
// We set shell: true because npx is a script/wrapper on Windows.
const vite = spawn('npx', ['vite'], {
  stdio: 'inherit',
  shell: true
});

// Terminate both processes when either closes or on process interruption
function cleanup() {
  try {
    server.kill();
  } catch (e) {}
  try {
    vite.kill();
  } catch (e) {}
  process.exit();
}

server.on('close', (code) => {
  console.log(`Express server exited with code ${code}`);
  cleanup();
});

vite.on('close', (code) => {
  console.log(`Vite server exited with code ${code}`);
  cleanup();
});

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);

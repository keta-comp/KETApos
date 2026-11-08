import { spawn } from 'node:child_process';
import process from 'node:process';
import electronPath from 'electron';

const url = 'http://localhost:5173';

const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js'], {
  stdio: 'inherit',
  env: process.env,
});

let ready = false;
for (let i = 0; i < 120; i++) {
  try {
    const res = await fetch(url);
    if (res.ok) {
      ready = true;
      break;
    }
  } catch {}
  await new Promise((r) => setTimeout(r, 500));
}

if (!ready) {
  console.error('Vite server ishga tushmadi');
  vite.kill();
  process.exit(1);
}

const electron = spawn(electronPath, ['.'], {
  stdio: 'inherit',
  env: { ...process.env, VITE_DEV_SERVER_URL: url },
});

electron.on('exit', (code) => {
  vite.kill();
  process.exit(code ?? 0);
});

vite.on('exit', () => {
  electron.kill();
  process.exit(0);
});

process.on('SIGINT', () => {
  electron.kill();
  vite.kill();
  process.exit(0);
});
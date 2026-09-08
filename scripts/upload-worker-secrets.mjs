import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parse } from 'dotenv';

// Values travel only over stdin to Wrangler. Never put credentials into shell
// arguments, console output, the frontend build, or the checked-in config.
const root = fileURLToPath(new URL('../', import.meta.url));
const devVars = parse(readFileSync(new URL('../.dev.vars', import.meta.url)));
const names = ['MONGODB_URI', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'SESSION_SECRET', 'SMTP_USER', 'SMTP_PASS'];
const secrets = {};
for (const name of names) {
  if (!devVars[name]) throw new Error(`Missing ${name} in .dev.vars.`);
  secrets[name] = devVars[name];
}
if (secrets.SESSION_SECRET.length < 32) throw new Error('SESSION_SECRET must contain at least 32 characters.');

const wrangler = fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url));
const child = spawn(process.execPath, [wrangler, 'secret', 'bulk', '--name', 'suryansh-portfolio'], {
  cwd: root, stdio: ['pipe', 'inherit', 'inherit'], windowsHide: true,
});
child.stdin.end(JSON.stringify(secrets));
child.on('error', () => { console.error('Could not start Wrangler.'); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });

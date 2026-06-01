const { spawn } = require('child_process');
const child = spawn('npx', ['node', 'build/server.js'], {
  env: { ...process.env, PORT: '8080', NODE_ENV: 'production' }
});
child.stdout.on('data', d => console.log('OUT:', d.toString()));
child.stderr.on('data', d => console.log('ERR:', d.toString()));
child.on('exit', code => { console.log('Exited with', code); process.exit(0); });
setTimeout(() => { child.kill(); process.exit(0); }, 5000);

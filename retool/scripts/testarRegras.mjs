// Executa os testes das regras do Firestore no emulador oficial:
//   npm run test:rules
//
// No Windows, `firebase emulators:exec` pode deixar o processo Java do
// emulador vivo ao terminar (a porta fica ocupada para a próxima execução).
// Este runner encerra somente o emulador que ele mesmo iniciou,
// identificado pelo jar do Firestore e pela porta definida no firebase.json.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const porta = JSON.parse(readFileSync(new URL('../firebase.json', import.meta.url), 'utf8')).emulators.firestore.port;

const resultado = spawnSync(
  'npx firebase emulators:exec --only firestore --project demo-retool "jest --config jest.rules.config.cjs"',
  { stdio: 'inherit', shell: true }
);

if (process.platform === 'win32') {
  const filtro = `$_.CommandLine -like '*cloud-firestore-emulator*' -and $_.CommandLine -like '*--port ${porta} *'`;
  spawnSync('powershell', [
    '-NoProfile', '-Command',
    `Get-CimInstance Win32_Process -Filter "Name='java.exe'" | Where-Object { ${filtro} } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }`
  ], { stdio: 'inherit' });
}

process.exit(resultado.status ?? 1);

// Emuladores oficiais do Firebase para desenvolvimento e testes locais
// (projeto "demo-retool": nenhum dado ou conta real é tocado).
//
//   npm run emuladores    -> sobe auth, firestore e storage (dev)
//   npm run test:rules    -> testes das regras do Firestore
//   npm run test:e2e      -> testes de navegador (Playwright) contra o app
//
// No Windows, o processo Java do emulador do Firestore pode sobreviver ao
// encerramento (a porta fica ocupada para a próxima execução). Ao final,
// este runner encerra somente o emulador que ele mesmo iniciou,
// identificado pelo jar do Firestore e pela porta do firebase.json.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const MODOS = {
  iniciar: { emuladores: 'auth,firestore,storage' },
  regras: { emuladores: 'firestore', testes: 'jest --config jest.rules.config.cjs src/tests/rules' },
  e2e: { emuladores: 'auth,firestore,storage', testes: 'playwright test' },
};

const modo = MODOS[process.argv[2]];
if (!modo) {
  console.error(`Uso: node scripts/emuladores.mjs <${Object.keys(MODOS).join('|')}>`);
  process.exit(1);
}

const executar = (comando) => spawnSync(comando, { stdio: 'inherit', shell: true });

const porta = JSON.parse(readFileSync(new URL('../firebase.json', import.meta.url), 'utf8')).emulators.firestore.port;

const resultado = modo.testes
  ? executar(`npx firebase emulators:exec --only ${modo.emuladores} --project demo-retool "${modo.testes}"`)
  : executar(`npx firebase emulators:start --only ${modo.emuladores} --project demo-retool`);

if (process.platform === 'win32') {
  const filtro = `$_.CommandLine -like '*cloud-firestore-emulator*' -and $_.CommandLine -like '*--port ${porta} *'`;
  spawnSync('powershell', [
    '-NoProfile', '-Command',
    `Get-CimInstance Win32_Process -Filter "Name='java.exe'" | Where-Object { ${filtro} } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }`
  ], { stdio: 'inherit' });
}

process.exit(resultado.status ?? 1);

// Emuladores oficiais do Firebase para desenvolvimento e testes locais
// (projeto "demo-retool": nenhum dado ou conta real é tocado).
//
//   npm run emuladores    -> sobe auth, firestore, functions e storage (dev)
//   npm run test:rules    -> testes das regras do Firestore
//   npm run test:funcoes  -> testes das Cloud Functions
//
// No Windows, o processo Java do emulador do Firestore pode sobreviver ao
// encerramento (a porta fica ocupada para a próxima execução). Ao final,
// este runner encerra somente o emulador que ele mesmo iniciou,
// identificado pelo jar do Firestore e pela porta do firebase.json.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const MODOS = {
  iniciar: { emuladores: 'auth,firestore,functions,storage' },
  regras: { emuladores: 'firestore', testes: 'src/tests/rules' },
  funcoes: { emuladores: 'auth,firestore,functions', testes: 'src/tests/funcoes' },
};

const modo = MODOS[process.argv[2]];
if (!modo) {
  console.error(`Uso: node scripts/emuladores.mjs <${Object.keys(MODOS).join('|')}>`);
  process.exit(1);
}

// A descoberta das funções concorre com a subida dos demais emuladores (e com
// pastas sincronizadas, como OneDrive); o limite padrão de 10 s é curto.
const env = { ...process.env, FUNCTIONS_DISCOVERY_TIMEOUT: process.env.FUNCTIONS_DISCOVERY_TIMEOUT || '60' };
const executar = (comando) => spawnSync(comando, { stdio: 'inherit', shell: true, env });

if (modo.emuladores.includes('functions')) {
  if (!existsSync(new URL('../functions/node_modules', import.meta.url))) {
    if (executar('npm --prefix functions install').status !== 0) process.exit(1);
  }
  if (executar('npm --prefix functions run build').status !== 0) process.exit(1);
}

const porta = JSON.parse(readFileSync(new URL('../firebase.json', import.meta.url), 'utf8')).emulators.firestore.port;

const resultado = modo.testes
  ? executar(`npx firebase emulators:exec --only ${modo.emuladores} --project demo-retool "jest --config jest.rules.config.cjs ${modo.testes}"`)
  : executar(`npx firebase emulators:start --only ${modo.emuladores} --project demo-retool`);

if (process.platform === 'win32') {
  const filtro = `$_.CommandLine -like '*cloud-firestore-emulator*' -and $_.CommandLine -like '*--port ${porta} *'`;
  spawnSync('powershell', [
    '-NoProfile', '-Command',
    `Get-CimInstance Win32_Process -Filter "Name='java.exe'" | Where-Object { ${filtro} } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }`
  ], { stdio: 'inherit' });
}

process.exit(resultado.status ?? 1);

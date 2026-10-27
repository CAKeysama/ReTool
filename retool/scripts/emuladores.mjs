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
//
// Banco fallback: o projeto de fallback está no plano Spark, que não tem
// Cloud Storage. Quando ele é o banco em uso (VITE_USE_FALLBACK_DB=true na
// variável de ambiente, como no CI, ou no .env local), os testes que
// dependem do Storage são pulados: regras do Storage e E2E de imagens.
import { spawnSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';

function usaBancoFallback() {
  const doAmbiente = (process.env.VITE_USE_FALLBACK_DB || '').trim();
  if (doAmbiente) return doAmbiente.toLowerCase() === 'true';
  try {
    const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
    return /^\s*VITE_USE_FALLBACK_DB\s*=\s*["']?true["']?\s*$/im.test(env);
  } catch {
    return false; // sem .env (CI, clone novo): banco principal
  }
}

const semStorage = usaBancoFallback();
if (semStorage) {
  // Lido por jest.rules.config.cjs e e2e/imagens.spec.ts.
  process.env.RETOOL_SEM_STORAGE = '1';
  const aviso = 'Banco fallback em uso (plano Spark, sem Cloud Storage): testes de regras do Storage e E2E de imagens pulados.';
  console.log(`\n[emuladores] ${aviso}\n`);
  if (process.env.GITHUB_ACTIONS) {
    console.log(`::notice title=Banco fallback::${aviso}`);
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `> ${aviso}\n`);
  }
}

const MODOS = {
  iniciar: { emuladores: 'auth,firestore,storage' },
  // Storage junto: as regras do Storage consultam o perfil no Firestore.
  // Sem Storage (banco fallback), só o Firestore sobe.
  regras: { emuladores: semStorage ? 'firestore' : 'firestore,storage', testes: 'jest --config jest.rules.config.cjs src/tests/rules' },
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

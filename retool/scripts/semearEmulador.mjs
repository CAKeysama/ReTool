// Semeia os emuladores locais do Firebase com contas de demonstração.
// NUNCA aponta para produção: usa apenas o projeto "demo-retool" local.
//
//   npm run emuladores          (terminal 1)
//   node scripts/semearEmulador.mjs
//   npm run dev:emuladores      (terminal 2)
//
// Credenciais exclusivas do ambiente de demonstração local:
const SENHA_DEMO = 'Demo!Retool2026';
const CONTAS = [
  { email: 'admin@retool.test', nome: 'Administradora Demo', perfil: 'admin' },
  { email: 'engenharia@retool.test', nome: 'Engenharia Demo', perfil: 'engenharia' },
];

const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
const FIRESTORE = 'http://127.0.0.1:8181/v1/projects/demo-retool/databases/(default)/documents';

function campos(obj) {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [
    k, typeof v === 'boolean' ? { booleanValue: v } : { stringValue: String(v) }
  ]));
}

for (const conta of CONTAS) {
  const r = await fetch(`${AUTH}/accounts:signUp?key=demo-api-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: conta.email, password: SENHA_DEMO, returnSecureToken: true })
  });
  const dados = await r.json();
  if (!r.ok) {
    console.log(`- ${conta.email}: ${dados.error?.message || r.status} (já existe?)`);
    continue;
  }
  const uid = dados.localId;
  // "Bearer owner" ignora as regras — disponível somente no emulador.
  const w = await fetch(`${FIRESTORE}/users/${uid}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify({
      fields: campos({
        uid, email: conta.email, nome: conta.nome, perfil: conta.perfil,
        ativo: true, statusAprovacao: 'aprovado', criadoEm: new Date().toISOString()
      })
    })
  });
  console.log(`+ ${conta.email} (${conta.perfil}) ${w.ok ? 'criado' : `falhou: ${w.status}`}`);
}

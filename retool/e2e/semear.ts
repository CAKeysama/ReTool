// Semeia as contas de demonstração antes dos testes (idempotente).
import { execFileSync } from 'node:child_process';

export default function semear() {
  execFileSync(process.execPath, ['scripts/semearEmulador.mjs'], { stdio: 'inherit' });
}

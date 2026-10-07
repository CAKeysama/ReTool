import { initializeApp, FirebaseApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { getAuth, connectAuthEmulator, Auth } from 'firebase/auth';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

const configFromEnv = (prefix: string) => ({
  apiKey: import.meta.env[`${prefix}_API_KEY`],
  authDomain: import.meta.env[`${prefix}_AUTH_DOMAIN`],
  projectId: import.meta.env[`${prefix}_PROJECT_ID`],
  storageBucket: import.meta.env[`${prefix}_STORAGE_BUCKET`],
  messagingSenderId: import.meta.env[`${prefix}_MESSAGING_SENDER_ID`],
  appId: import.meta.env[`${prefix}_APP_ID`],
  measurementId: import.meta.env[`${prefix}_MEASUREMENT_ID`]
});

const primaryConfig = configFromEnv('VITE_FIREBASE');
const fallbackConfig = configFromEnv('VITE_FIREBASE_FALLBACK');

const useFallback = import.meta.env.VITE_USE_FALLBACK_DB === 'true';

// Desenvolvimento local contra os emuladores (`npm run dev:emuladores`):
// nenhum dado ou conta real é tocado. Projeto "demo-" dispensa credenciais.
const usarEmuladores = import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true';
const emulatorConfig = {
  apiKey: 'demo-api-key',
  authDomain: 'demo-retool.firebaseapp.com',
  projectId: 'demo-retool',
  storageBucket: 'demo-retool.appspot.com',
  appId: 'demo-retool'
};

const activeConfig = usarEmuladores ? emulatorConfig : useFallback ? fallbackConfig : primaryConfig;

function conectarAuthAoEmulador(instancia: Auth): Auth {
  if (usarEmuladores) connectAuthEmulator(instancia, 'http://127.0.0.1:9099', { disableWarnings: true });
  return instancia;
}

const app = initializeApp(activeConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = conectarAuthAoEmulador(getAuth(app));
// Mesma região declarada em functions/src/index.ts.
export const functions = getFunctions(app, 'southamerica-east1');

if (usarEmuladores) {
  connectFirestoreEmulator(db, '127.0.0.1', 8181);
  connectStorageEmulator(storage, '127.0.0.1', 9199);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
}

// Instância secundária do Firebase App dedicada à criação de contas pela
// Administração. `createUserWithEmailAndPassword` troca a sessão ativa da
// instância em que é chamado; usando um app separado, a administradora
// permanece logada enquanto provisiona novos colaboradores.
let secondaryAppInstance: FirebaseApp | null = null;
export function getSecondaryAuthApp(): FirebaseApp {
  if (!secondaryAppInstance) {
    secondaryAppInstance = initializeApp(activeConfig, 'retool-user-provisioning');
    conectarAuthAoEmulador(getAuth(secondaryAppInstance));
  }
  return secondaryAppInstance;
}

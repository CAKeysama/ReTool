import { initializeApp, FirebaseApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth } from 'firebase/auth';

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
const activeConfig = useFallback ? fallbackConfig : primaryConfig;

const app = initializeApp(activeConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);

// Instância secundária do Firebase App dedicada à criação de contas pela
// Administração. `createUserWithEmailAndPassword` troca a sessão ativa da
// instância em que é chamado; usando um app separado, a administradora
// permanece logada enquanto provisiona novos colaboradores.
let secondaryAppInstance: FirebaseApp | null = null;
export function getSecondaryAuthApp(): FirebaseApp {
  if (!secondaryAppInstance) {
    secondaryAppInstance = initializeApp(activeConfig, 'retool-user-provisioning');
  }
  return secondaryAppInstance;
}

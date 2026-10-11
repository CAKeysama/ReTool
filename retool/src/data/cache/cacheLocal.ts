/**
 * Cache local mínimo em IndexedDB (chave → valor), usado para guardar as
 * partes do índice de busca entre aberturas do app. Toda falha (modo privado,
 * cota do navegador, ambiente sem IndexedDB) é silenciosa: o app apenas
 * volta a baixar do Firestore.
 */
const DB_NOME = 'retool-cache';
const STORE = 'kv';

let abertura: Promise<IDBDatabase | null> | null = null;

function abrir(): Promise<IDBDatabase | null> {
  if (abertura) return abertura;
  abertura = new Promise(resolve => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB_NOME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return abertura;
}

export async function lerCache<T>(chave: string): Promise<T | undefined> {
  const db = await abrir();
  if (!db) return undefined;
  return new Promise(resolve => {
    try {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(chave);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

export async function gravarCache(chave: string, valor: unknown): Promise<void> {
  const db = await abrir();
  if (!db) return;
  await new Promise<void>(resolve => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(valor, chave);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

/** Apaga todo o cache local (chamado no logout: nada do banco fica no disco). */
export async function limparCache(): Promise<void> {
  const db = await abrir();
  if (!db) return;
  await new Promise<void>(resolve => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

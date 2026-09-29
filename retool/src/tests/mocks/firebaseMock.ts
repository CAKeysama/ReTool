import { jest } from '@jest/globals';

export const mockDbState = {
  dispositivos: [] as any[],
  categorias: [] as any[],
  tipos: [] as any[],
  familias: [] as any[],
  produtos: [] as any[],
  reutilizacoes: [] as any[],
  audit_logs: [] as any[],
  users: [] as any[],
  notifications: [] as any[],
  solicitacoes_cargo: [] as any[],
  pendencias_cargo: [] as any[],
};

export const resetMockDb = () => {
  (Object.keys(mockDbState) as (keyof typeof mockDbState)[]).forEach(col => {
    mockDbState[col] = [];
  });
};

// Mock do módulo 'uuid' globalmente para evitar SyntaxError por causa do ESM
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mocked-uuid-' + Math.random().toString(36).substring(2, 9)),
}));

// Intercepta e mocka o arquivo de configuração para evitar a avaliação de import.meta.env
jest.mock('../../data/datasources/firebase', () => ({
  db: {},
  storage: {},
}));

jest.mock('../../config/firebase', () => ({
  db: {},
  storage: {},
}));

type Restricao =
  | { tipo: 'where'; campo: string; op: string; valor: any }
  | { tipo: 'orderBy'; campo: string; direcao: 'asc' | 'desc' }
  | { tipo: 'limit'; n: number }
  | { tipo: 'startAfter'; cursor: any };

function comparar(a: any, b: any): number {
  if (a === b) return 0;
  if (a === undefined || a === null) return -1;
  if (b === undefined || b === null) return 1;
  return a < b ? -1 : 1;
}

function atende(item: any, r: Extract<Restricao, { tipo: 'where' }>): boolean {
  const v = item[r.campo];
  switch (r.op) {
    case '==': return v === r.valor;
    case 'in': return Array.isArray(r.valor) && r.valor.includes(v);
    case '>=': return v !== undefined && comparar(v, r.valor) >= 0;
    case '<=': return v !== undefined && comparar(v, r.valor) <= 0;
    case '>': return v !== undefined && comparar(v, r.valor) > 0;
    case '<': return v !== undefined && comparar(v, r.valor) < 0;
    default: throw new Error(`Operador não suportado no mock: ${r.op}`);
  }
}

/** Aplica where/orderBy/startAfter/limit sobre a coleção em memória. */
function executarConsulta(ref: { name: string; restricoes?: Restricao[] }): any[] {
  const col = ref.name as keyof typeof mockDbState;
  let itens = [...(mockDbState[col] || [])];
  const restricoes = ref.restricoes || [];
  for (const r of restricoes) {
    if (r.tipo === 'where') itens = itens.filter(item => atende(item, r));
  }
  const ordem = restricoes.filter((r): r is Extract<Restricao, { tipo: 'orderBy' }> => r.tipo === 'orderBy');
  if (ordem.length > 0) {
    itens.sort((a, b) => {
      for (const o of ordem) {
        const c = comparar(a[o.campo], b[o.campo]);
        if (c !== 0) return o.direcao === 'desc' ? -c : c;
      }
      return 0;
    });
  }
  const apos = restricoes.find((r): r is Extract<Restricao, { tipo: 'startAfter' }> => r.tipo === 'startAfter');
  if (apos) {
    const idx = itens.findIndex(item => item.id === apos.cursor?.id);
    itens = idx >= 0 ? itens.slice(idx + 1) : itens;
  }
  const limite = restricoes.find((r): r is Extract<Restricao, { tipo: 'limit' }> => r.tipo === 'limit');
  if (limite) itens = itens.slice(0, limite.n);
  return itens;
}

const snapshotDeDocs = (itens: any[]) => ({
  docs: itens.map(item => ({ id: item.id, data: () => item }))
});

function snapshotDeDoc(docRef: { colName: string; id: string }) {
  const col = docRef.colName as keyof typeof mockDbState;
  const item = (mockDbState[col] || []).find((i: any) => i.id === docRef.id);
  return { id: docRef.id, exists: () => !!item, data: () => item, metadata: { hasPendingWrites: false } };
}

function gravar(docRef: any, data: any, merge = false) {
  const col = docRef.colName as keyof typeof mockDbState;
  if (!mockDbState[col]) return;
  const idx = mockDbState[col].findIndex((item: any) => item.id === docRef.id);
  if (idx >= 0) {
    mockDbState[col][idx] = merge
      ? { ...mockDbState[col][idx], ...data, id: docRef.id }
      : { ...data, id: docRef.id };
  } else {
    mockDbState[col].push({ ...data, id: docRef.id });
  }
}

function atualizar(docRef: any, data: any) {
  const col = docRef.colName as keyof typeof mockDbState;
  if (!mockDbState[col]) return;
  const item = mockDbState[col].find((i: any) => i.id === docRef.id);
  // Como no Firestore real, atualizar documento inexistente falha.
  if (!item) throw Object.assign(new Error(`No document to update: ${col}/${docRef.id}`), { code: 'not-found' });
  Object.assign(item, data);
}

function remover(docRef: any) {
  const col = docRef.colName as keyof typeof mockDbState;
  if (mockDbState[col]) {
    mockDbState[col] = mockDbState[col].filter((item: any) => item.id !== docRef.id);
  }
}

jest.mock('firebase/firestore', () => {
  return {
    getFirestore: jest.fn(() => ({})),
    collection: jest.fn((db: any, name: string) => ({ name })),
    query: jest.fn((colRef: any, ...restricoes: any[]) => ({
      name: colRef.name,
      restricoes: [...(colRef.restricoes || []), ...restricoes]
    })),
    where: jest.fn((campo: string, op: string, valor: any) => ({ tipo: 'where', campo, op, valor })),
    orderBy: jest.fn((campo: string, direcao: 'asc' | 'desc' = 'asc') => ({ tipo: 'orderBy', campo, direcao })),
    limit: jest.fn((n: number) => ({ tipo: 'limit', n })),
    startAfter: jest.fn((cursor: any) => ({ tipo: 'startAfter', cursor })),
    serverTimestamp: jest.fn(() => ({
      __serverTimestampMock: true,
      toDate: () => new Date('2026-01-02T03:04:05.000Z')
    })),
    Timestamp: class MockTimestamp {
      seconds: number;
      nanoseconds: number;
      constructor(seconds = 0, nanoseconds = 0) {
        this.seconds = seconds;
        this.nanoseconds = nanoseconds;
      }
      toDate() {
        return new Date(this.seconds * 1000);
      }
    },
    doc: jest.fn((db: any, colName: string, id: string) => ({ colName, id })),
    getDoc: jest.fn(async (docRef: any) => snapshotDeDoc(docRef)),
    setDoc: jest.fn(async (docRef: any, data: any) => gravar(docRef, data)),
    updateDoc: jest.fn(async (docRef: any, data: any) => atualizar(docRef, data)),
    deleteDoc: jest.fn(async (docRef: any) => remover(docRef)),
    onSnapshot: jest.fn((ref: any, opcoesOuCallback: any, talvezCallback?: any) => {
      // Aceita as duas assinaturas: (ref, cb, erro?) e (ref, opções, cb, erro?).
      const callback = typeof opcoesOuCallback === 'function' ? opcoesOuCallback : talvezCallback;
      if (ref.colName) callback(snapshotDeDoc(ref));
      else callback(snapshotDeDocs(executarConsulta(ref)));
      return () => {}; // return unsubscribe function
    }),
    getDocs: jest.fn(async (ref: any) => snapshotDeDocs(executarConsulta(ref))),
    getCountFromServer: jest.fn(async (ref: any) => {
      const semLimite = { ...ref, restricoes: (ref.restricoes || []).filter((r: any) => r.tipo === 'where') };
      const count = executarConsulta(semLimite).length;
      return { data: () => ({ count }) };
    }),
    writeBatch: jest.fn(() => {
      const operations: any[] = [];
      return {
        set: jest.fn((docRef: any, data: any, options: any) => {
          operations.push({ type: 'set', docRef, data, options });
        }),
        update: jest.fn((docRef: any, data: any) => {
          operations.push({ type: 'update', docRef, data });
        }),
        delete: jest.fn((docRef: any) => {
          operations.push({ type: 'delete', docRef });
        }),
        commit: jest.fn(async () => {
          // Atomicidade: valida os updates antes de aplicar qualquer operação.
          for (const op of operations) {
            if (op.type === 'update') {
              const col = op.docRef.colName as keyof typeof mockDbState;
              if (mockDbState[col] && !mockDbState[col].some((i: any) => i.id === op.docRef.id)) {
                throw Object.assign(new Error(`No document to update: ${col}/${op.docRef.id}`), { code: 'not-found' });
              }
            }
          }
          for (const op of operations) {
            if (op.type === 'set') gravar(op.docRef, op.data, !!op.options?.merge);
            else if (op.type === 'update') atualizar(op.docRef, op.data);
            else if (op.type === 'delete') remover(op.docRef);
          }
        })
      };
    })
  };
});

jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(() => ({})),
}));

jest.mock('firebase/storage', () => ({
  getStorage: jest.fn(() => ({})),
  ref: jest.fn((storage: any, path: string) => ({ fullPath: path })),
  uploadBytesResumable: jest.fn((storageRef: any) => ({
    snapshot: { ref: storageRef },
    on: jest.fn((event: string, progressCb: any, errorCb: any, completeCb: any) => {
      if (progressCb) {
        progressCb({ bytesTransferred: 100, totalBytes: 100 });
      }
      if (completeCb) {
        completeCb();
      }
    }),
  })),
  getDownloadURL: jest.fn(async (storageRef: any) => `https://firebasestorage.googleapis.com/v0/b/mock-bucket/o/${encodeURIComponent(storageRef?.fullPath || 'mock')}`),
  deleteObject: jest.fn(async () => {}),
  listAll: jest.fn(async () => ({ items: [], prefixes: [] })),
}));

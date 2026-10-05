import { jest } from '@jest/globals';

export const mockDbState = {
  dispositivos: [] as any[],
  categorias: [] as any[],
  tipos: [] as any[],
  familias: [] as any[],
  produtos: [] as any[],
  reutilizacoes: [] as any[],
  audit_logs: [] as any[],
};

export const resetMockDb = () => {
  mockDbState.dispositivos = [];
  mockDbState.categorias = [];
  mockDbState.tipos = [];
  mockDbState.familias = [];
  mockDbState.produtos = [];
  mockDbState.reutilizacoes = [];
  mockDbState.audit_logs = [];
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

jest.mock('../../data/datasources/storage', () => ({
  storage: {},
}));

jest.mock('../../config/firebase', () => ({
  db: {},
  storage: {},
}));

jest.mock('firebase/firestore', () => {
  return {
    getFirestore: jest.fn(() => ({})),
    collection: jest.fn((db: any, name: string) => ({ name })),
    // As restrições ficam anotadas na consulta (`restricoes`); getDocs só as
    // aplica na leitura paginada por id (orderBy(documentId()) + startAfter + limit).
    query: jest.fn((colRef: any, ...constraints: any[]) => ({ ...colRef, restricoes: [...(colRef?.restricoes || []), ...constraints] })),
    orderBy: jest.fn((campo?: any, ..._args: any[]) => ({ tipo: 'orderBy', campo })),
    limit: jest.fn((n?: any) => ({ tipo: 'limit', n })),
    documentId: jest.fn(() => '__name__'),
    where: jest.fn((campo?: any, op?: any, valor?: any) => ({ tipo: 'where', campo, op, valor })),
    // count() aplica os where ('==', 'in', '>') anotados na consulta.
    getCountFromServer: jest.fn(async (colRef: any) => {
      const col = colRef.name as keyof typeof mockDbState;
      const filtros: any[] = (colRef.restricoes || []).filter((r: any) => r?.tipo === 'where');
      const passa = (item: any) => filtros.every(f => {
        const v = item[f.campo];
        if (f.op === '==') return v === f.valor;
        if (f.op === 'in') return (f.valor as any[]).includes(v);
        if (f.op === '>') return typeof v === typeof f.valor && v > f.valor;
        return true;
      });
      const count = (mockDbState[col] || []).filter(passa).length;
      return { data: () => ({ count }) };
    }),
    startAfter: jest.fn((valor?: any) => ({ tipo: 'startAfter', valor })),
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
    setDoc: jest.fn(async (docRef: any, data: any) => {
      const col = docRef.colName as keyof typeof mockDbState;
      if (mockDbState[col]) {
        const idx = mockDbState[col].findIndex((item: any) => item.id === docRef.id);
        if (idx >= 0) {
          mockDbState[col][idx] = { ...data, id: docRef.id };
        } else {
          mockDbState[col].push({ ...data, id: docRef.id });
        }
      }
    }),
    updateDoc: jest.fn(async (docRef: any, data: any) => {
      const col = docRef.colName as keyof typeof mockDbState;
      if (mockDbState[col]) {
        const item = mockDbState[col].find((item: any) => item.id === docRef.id);
        if (item) {
          Object.assign(item, data);
        }
      }
    }),
    deleteDoc: jest.fn(async (docRef: any) => {
      const col = docRef.colName as keyof typeof mockDbState;
      if (mockDbState[col]) {
        mockDbState[col] = mockDbState[col].filter((item: any) => item.id !== docRef.id);
      }
    }),
    onSnapshot: jest.fn((colRef: any, ...args: any[]) => {
      // Aceita a forma com opções (onSnapshot(ref, { includeMetadataChanges }, cb)).
      const callback = args.find(a => typeof a === 'function');
      const col = colRef.name as keyof typeof mockDbState;
      const docs = (mockDbState[col] || []).map(item => ({
        id: item.id,
        data: () => item
      }));
      callback({ docs, metadata: { fromCache: false } });
      return () => {}; // return unsubscribe function
    }),
    getDocsFromServer: jest.fn(async (colRef: any) => {
      const fs = jest.requireMock('firebase/firestore') as any;
      return fs.getDocs(colRef);
    }),
    getDocs: jest.fn(async (colRef: any) => {
      const col = colRef.name as keyof typeof mockDbState;
      let itens = [...(mockDbState[col] || [])];
      const restricoes: any[] = colRef.restricoes || [];
      if (restricoes.some(r => r?.tipo === 'orderBy' && r.campo === '__name__')) {
        itens.sort((a, b) => (String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0));
        const depois = restricoes.find(r => r?.tipo === 'startAfter');
        if (depois) itens = itens.filter(i => String(i.id) > String(depois.valor));
        const lim = restricoes.find(r => r?.tipo === 'limit' && typeof r.n === 'number');
        if (lim) itens = itens.slice(0, lim.n);
      }
      const docs = itens.map(item => ({
        id: item.id,
        data: () => item
      }));
      return { docs, size: docs.length, empty: docs.length === 0 };
    }),
    writeBatch: jest.fn(() => {
      const operations: any[] = [];
      return {
        set: jest.fn((docRef: any, data: any, options: any) => {
          operations.push({ type: 'set', docRef, data, options });
        }),
        delete: jest.fn((docRef: any) => {
          operations.push({ type: 'delete', docRef });
        }),
        update: jest.fn((docRef: any, data: any) => {
          operations.push({ type: 'set', docRef, data, options: { merge: true } });
        }),
        commit: jest.fn(async () => {
          for (const op of operations) {
            if (op.type === 'set') {
              const col = op.docRef.colName as keyof typeof mockDbState;
              if (mockDbState[col]) {
                const idx = mockDbState[col].findIndex((item: any) => item.id === op.docRef.id);
                if (idx >= 0) {
                  if (op.options && op.options.merge) {
                    mockDbState[col][idx] = { ...mockDbState[col][idx], ...op.data, id: op.docRef.id };
                  } else {
                    mockDbState[col][idx] = { ...op.data, id: op.docRef.id };
                  }
                } else {
                  mockDbState[col].push({ ...op.data, id: op.docRef.id });
                }
              }
            } else if (op.type === 'delete') {
              const col = op.docRef.colName as keyof typeof mockDbState;
              if (mockDbState[col]) {
                mockDbState[col] = mockDbState[col].filter((item: any) => item.id !== op.docRef.id);
              }
            }
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

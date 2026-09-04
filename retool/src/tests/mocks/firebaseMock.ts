import { jest } from '@jest/globals';

export const mockDbState = {
  dispositivos: [] as any[],
  categorias: [] as any[],
  tipos: [] as any[],
  familias: [] as any[],
  produtos: [] as any[],
  reutilizacoes: [] as any[],
};

export const resetMockDb = () => {
  mockDbState.dispositivos = [];
  mockDbState.categorias = [];
  mockDbState.tipos = [];
  mockDbState.familias = [];
  mockDbState.produtos = [];
  mockDbState.reutilizacoes = [];
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

jest.mock('firebase/firestore', () => {
  return {
    getFirestore: jest.fn(() => ({})),
    collection: jest.fn((db: any, name: string) => ({ name })),
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
    onSnapshot: jest.fn((colRef: any, callback: any) => {
      const col = colRef.name as keyof typeof mockDbState;
      const docs = (mockDbState[col] || []).map(item => ({
        id: item.id,
        data: () => item
      }));
      callback({ docs });
      return () => {}; // return unsubscribe function
    }),
    getDocs: jest.fn(async (colRef: any) => {
      const col = colRef.name as keyof typeof mockDbState;
      const docs = (mockDbState[col] || []).map(item => ({
        id: item.id,
        data: () => item
      }));
      return { docs };
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

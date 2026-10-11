import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { app, usarEmuladores } from './firebase';

export const storage = getStorage(app);
if (usarEmuladores) connectStorageEmulator(storage, '127.0.0.1', 9199);

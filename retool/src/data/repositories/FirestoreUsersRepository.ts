import { db } from '../datasources/firebase';
import { collection, onSnapshot, doc, getDoc, getDocs, query, where, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { UserProfile, UserRole } from '../../domain/entities/user';

export class FirestoreUsersRepository {
  async getProfile(uid: string): Promise<UserProfile | null> {
    const docSnap = await getDoc(doc(db, 'users', uid));
    if (docSnap.exists()) {
      return { uid: docSnap.id, ...docSnap.data() } as UserProfile;
    }
    return null;
  }

  async setProfile(profile: UserProfile): Promise<void> {
    await setDoc(doc(db, 'users', profile.uid), profile);
  }

  async updateRole(uid: string, perfil: UserRole): Promise<void> {
    await updateDoc(doc(db, 'users', uid), {
      perfil,
      atualizadoEm: new Date().toISOString()
    });
  }

  async updateStatus(uid: string, ativo: boolean): Promise<void> {
    await updateDoc(doc(db, 'users', uid), {
      ativo,
      atualizadoEm: new Date().toISOString()
    });
  }

  async deleteProfile(uid: string): Promise<void> {
    await deleteDoc(doc(db, 'users', uid));
  }

  subscribeAll(callback: (users: UserProfile[]) => void, onError?: (e: unknown) => void): () => void {
    return onSnapshot(collection(db, 'users'), (snapshot) => {
      callback(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
    }, (e) => onError?.(e));
  }

  /** Administradoras ativas (para avisar sobre uma nova solicitação de conta). */
  async listarAdminsAtivos(): Promise<UserProfile[]> {
    const q = query(collection(db, 'users'), where('perfil', '==', 'admin'), where('ativo', '==', true));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
  }

  subscribeProfile(uid: string, callback: (profile: UserProfile | null) => void): () => void {
    return onSnapshot(doc(db, 'users', uid), (snap) => {
      if (snap.exists()) {
        callback({ uid: snap.id, ...snap.data() } as UserProfile);
      } else {
        callback(null);
      }
    });
  }
}

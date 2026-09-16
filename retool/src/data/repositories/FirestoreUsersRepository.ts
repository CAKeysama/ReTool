import { db } from '../datasources/firebase';
import { collection, onSnapshot, doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
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

  subscribeAll(callback: (users: UserProfile[]) => void): () => void {
    return onSnapshot(collection(db, 'users'), (snapshot) => {
      callback(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
    });
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

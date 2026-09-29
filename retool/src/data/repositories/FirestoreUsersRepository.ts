import { db } from '../datasources/firebase';
import { collection, onSnapshot, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';
import { UserProfile, UserRole } from '../../domain/entities/user';
import { IUsersRepository } from '../../domain/repositories/IAcessosRepositories';

/** Remove chaves `undefined` (o Firestore recusa esse valor). */
function semIndefinidos<T extends object>(dados: T): T {
  return Object.fromEntries(Object.entries(dados).filter(([, v]) => v !== undefined)) as T;
}

export class FirestoreUsersRepository implements IUsersRepository {
  async getProfile(uid: string): Promise<UserProfile | null> {
    const docSnap = await getDoc(doc(db, 'users', uid));
    if (docSnap.exists()) {
      return { uid: docSnap.id, ...docSnap.data() } as UserProfile;
    }
    return null;
  }

  async setProfile(profile: UserProfile): Promise<void> {
    await setDoc(doc(db, 'users', profile.uid), semIndefinidos(profile));
  }

  async updateProfile(uid: string, data: Partial<UserProfile>): Promise<void> {
    await updateDoc(doc(db, 'users', uid), semIndefinidos(data));
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

  /**
   * Administração ativa — destinatária das notificações de cadastro e de
   * alteração de cargo. A consulta filtra por `perfil == 'admin'`, único
   * recorte que as regras liberam para contas convidadas.
   */
  async listarAdministradoresAtivos(): Promise<UserProfile[]> {
    const snap = await getDocs(query(collection(db, 'users'), where('perfil', '==', 'admin')));
    return snap.docs
      .map(d => ({ uid: d.id, ...d.data() } as UserProfile))
      .filter(u => u.ativo === true);
  }

  subscribeAll(callback: (users: UserProfile[]) => void, onError?: (error: Error) => void): () => void {
    return onSnapshot(collection(db, 'users'), (snapshot) => {
      callback(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
    }, (error) => {
      console.warn('Falha ao sincronizar usuários:', error);
      callback([]);
      onError?.(error);
    });
  }

  /**
   * Perfil em tempo real, somente com estado CONFIRMADO pelo servidor: uma
   * escrita local ainda pendente (ex.: conclusão da troca de senha) não
   * pode liberar permissões na interface antes de valer nas regras.
   */
  subscribeProfile(uid: string, callback: (profile: UserProfile | null) => void): () => void {
    return onSnapshot(doc(db, 'users', uid), { includeMetadataChanges: true }, (snap) => {
      if (snap.metadata.hasPendingWrites) return;
      if (snap.exists()) {
        callback({ uid: snap.id, ...snap.data() } as UserProfile);
      } else {
        callback(null);
      }
    }, (error) => {
      // Ex.: sessão encerrada enquanto o listener ainda estava ativo.
      console.warn('Falha ao acompanhar o perfil do usuário:', error);
    });
  }
}

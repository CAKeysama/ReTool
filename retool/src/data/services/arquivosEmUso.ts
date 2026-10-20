import { getDownloadURL, ref } from 'firebase/storage';
import { collection, getDocsFromServer, limit, query, where } from 'firebase/firestore';
import { storage } from '../datasources/storage';
import { db } from '../datasources/firebase';
import { CAMPOS_IMAGEM_DISPOSITIVO, ehCaminhoDeImagem, urlSemToken } from '../../domain/entities/dispositivo';
import { medirConsulta } from '../observabilidade/metricas';

/**
 * A propagação grava o MESMO link de imagem em vários dispositivos da linha,
 * e o arquivo fica na pasta de quem fez o upload. Ao excluir esse
 * dispositivo, a imagem só pode sair do Storage se nenhum outro dispositivo
 * ainda a usar. Compara pelo link sem o token (o token pode ter sido
 * trocado). Consulta o servidor: o cache local pode estar desatualizado.
 *
 * Chamado depois que o documento do dispositivo já foi excluído (ele não
 * conta como "em uso"). PDFs não são propagados: saem sempre.
 */
export async function arquivoAindaUsado(caminho: string): Promise<boolean> {
  if (!ehCaminhoDeImagem(caminho)) return false;
  const base = urlSemToken(await getDownloadURL(ref(storage, caminho)));
  for (const campo of CAMPOS_IMAGEM_DISPOSITIVO) {
    const q = query(
      collection(db, 'dispositivos'),
      where(campo, '>=', base),
      where(campo, '<', base + ''),
      limit(1)
    );
    const snap = await medirConsulta('dispositivos:imagem-em-uso', () => getDocsFromServer(q), s => s.size);
    if (!snap.empty) return true;
  }
  return false;
}

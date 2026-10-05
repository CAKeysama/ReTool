import { useEffect, useState } from 'react';
import { Dispositivo } from '../../domain/entities/dispositivo';
import { Reutilizacao } from '../../domain/entities/reutilizacao';
import { assinarDispositivo } from '../../data/repositories/FirestoreDispositivosConsultas';
import { FirestoreReutilizacoesRepository } from '../../data/repositories/FirestoreReutilizacoesRepository';

const reutilizacoesRepo = new FirestoreReutilizacoesRepository();

export type EstadoCarga = 'carregando' | 'pronto' | 'erro';

/** Um dispositivo em tempo real (1 documento), com estados de carga distintos de "não encontrado". */
export function useDispositivo(id: string | undefined) {
  const [estado, setEstado] = useState<EstadoCarga>('carregando');
  const [dispositivo, setDispositivo] = useState<Dispositivo | null>(null);
  const [erro, setErro] = useState<unknown>(null);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    if (!id) { setEstado('pronto'); setDispositivo(null); return; }
    setEstado('carregando');
    setErro(null);
    return assinarDispositivo(id, d => { setDispositivo(d); setEstado('pronto'); }, e => { setErro(e); setEstado('erro'); });
  }, [id, tentativa]);

  return { dispositivo, estado, erro, tentarNovamente: () => setTentativa(t => t + 1) };
}

/** Reutilizações de um dispositivo em tempo real (consulta por dispositivoId, não a coleção inteira). */
export function useReutilizacoesDoDispositivo(dispositivoId: string | undefined) {
  const [estado, setEstado] = useState<EstadoCarga>('carregando');
  const [reutilizacoes, setReutilizacoes] = useState<Reutilizacao[]>([]);
  const [erro, setErro] = useState<unknown>(null);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    if (!dispositivoId) { setEstado('pronto'); setReutilizacoes([]); return; }
    setEstado('carregando');
    setErro(null);
    return reutilizacoesRepo.subscribeDoDispositivo(
      dispositivoId,
      l => { setReutilizacoes(l); setEstado('pronto'); },
      e => { setErro(e); setEstado('erro'); }
    );
  }, [dispositivoId, tentativa]);

  return { reutilizacoes, estado, erro, tentarNovamente: () => setTentativa(t => t + 1) };
}

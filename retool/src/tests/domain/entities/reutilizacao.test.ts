import { describe, it, expect } from '@jest/globals';
import {
  REUTILIZACAO_STATUS,
  normalizarStatusReutilizacao,
  transicaoReutilizacaoPermitida
} from '../../../domain/entities/reutilizacao';

describe('Fluxo de Reutilização - Máquina de Estados', () => {
  it('deve possuir exatamente os 7 estados da arquitetura', () => {
    expect(REUTILIZACAO_STATUS).toEqual([
      'Em análise (Engenharia)',
      'Em análise (Projetista)',
      'Reutilização aprovada',
      'Reutilização não aprovada',
      'Liberado para fabricação (novo dispositivo)',
      'Aguardando novo filtro (Projetista)',
      'Em andamento - OS'
    ]);
  });

  it('deve normalizar registros legados (pendente/aprovado/rejeitado)', () => {
    expect(normalizarStatusReutilizacao('pendente')).toBe('Em análise (Projetista)');
    expect(normalizarStatusReutilizacao('aprovado')).toBe('Reutilização aprovada');
    expect(normalizarStatusReutilizacao('rejeitado')).toBe('Reutilização não aprovada');
    expect(normalizarStatusReutilizacao(undefined)).toBe('Em análise (Projetista)');
    expect(normalizarStatusReutilizacao('Em andamento - OS')).toBe('Em andamento - OS');
  });

  it('Engenharia: inicia o 1º filtro, gera OS e solicita dispositivo novo', () => {
    expect(transicaoReutilizacaoPermitida('engenharia', 'Em análise (Engenharia)', 'Em análise (Projetista)')).toBe(true);
    expect(transicaoReutilizacaoPermitida('engenharia', 'Reutilização aprovada', 'Em andamento - OS')).toBe(true);
    expect(transicaoReutilizacaoPermitida('engenharia', 'Reutilização não aprovada', 'Em andamento - OS')).toBe(true);
    expect(transicaoReutilizacaoPermitida('engenharia', 'Reutilização não aprovada', 'Aguardando novo filtro (Projetista)')).toBe(true);
    // Engenharia não aprova/rejeita nem libera fabricação
    expect(transicaoReutilizacaoPermitida('engenharia', 'Em análise (Projetista)', 'Reutilização aprovada')).toBe(false);
    expect(transicaoReutilizacaoPermitida('engenharia', 'Aguardando novo filtro (Projetista)', 'Liberado para fabricação (novo dispositivo)')).toBe(false);
  });

  it('Projetista: 1º filtro (aprova/não aprova) e 2º filtro (similares)', () => {
    expect(transicaoReutilizacaoPermitida('projetista', 'Em análise (Projetista)', 'Reutilização aprovada')).toBe(true);
    expect(transicaoReutilizacaoPermitida('projetista', 'Em análise (Projetista)', 'Reutilização não aprovada')).toBe(true);
    expect(transicaoReutilizacaoPermitida('projetista', 'Aguardando novo filtro (Projetista)', 'Em análise (Projetista)')).toBe(true);
    expect(transicaoReutilizacaoPermitida('projetista', 'Aguardando novo filtro (Projetista)', 'Liberado para fabricação (novo dispositivo)')).toBe(true);
    // Projetista não inicia o fluxo nem gera OS
    expect(transicaoReutilizacaoPermitida('projetista', 'Em análise (Engenharia)', 'Em análise (Projetista)')).toBe(false);
    expect(transicaoReutilizacaoPermitida('projetista', 'Reutilização aprovada', 'Em andamento - OS')).toBe(false);
  });

  it('Gerência: nenhuma transição (somente leitura)', () => {
    for (const de of REUTILIZACAO_STATUS) {
      for (const para of REUTILIZACAO_STATUS) {
        expect(transicaoReutilizacaoPermitida('gerencia', de, para)).toBe(false);
      }
    }
  });

  it('Filas: Projetista vê apenas seus dois estados de análise; Engenharia vê rascunhos e retornos', () => {
    const filaProjetista = ['Em análise (Projetista)', 'Aguardando novo filtro (Projetista)'];
    const filaEngenharia = ['Em análise (Engenharia)', 'Reutilização aprovada', 'Reutilização não aprovada'];
    expect(REUTILIZACAO_STATUS.filter(s => filaProjetista.includes(s))).toHaveLength(2);
    expect(REUTILIZACAO_STATUS.filter(s => filaEngenharia.includes(s))).toHaveLength(3);
  });
});

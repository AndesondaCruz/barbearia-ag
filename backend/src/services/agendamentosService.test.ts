import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Agendamento } from '../repositories/agendamentosRepository';
import type { Servico } from '../repositories/servicosRepository';
import { criarAgendamentosService } from './agendamentosService';

// 2026-11-25 (quarta) 10:00 em Fortaleza = 13:00 UTC
const AGORA = new Date('2026-11-25T13:00:00Z');
const CORTE: Servico = { id: 's1', nome: 'Corte', descricao: '', precoCentavos: 3500, duracaoMinutos: 30 };
const CORTE_COM_OPCOES: Servico = { ...CORTE, id: 's2', opcoes: ['Tesoura', 'Máquina'] };
const CLIENTE = { id: 'cliente-1', isBarbeiro: false };
const OUTRO = { id: 'cliente-2', isBarbeiro: false };
const BARBEIRO = { id: 'barbeiro-1', isBarbeiro: true };

/** Relógio controlável para simular a passagem do tempo nos testes. */
const relogio = { agora: AGORA };

function montar() {
  relogio.agora = AGORA;
  const tabela = new Map<string, Agendamento>();
  const chave = (d: string, h: string) => `${d}|${h}`;
  const agendamentos = {
    listarPorData: async (d: string) => [...tabela.values()].filter((a) => a.data === d),
    listarPorCliente: async (c: string) => [...tabela.values()].filter((a) => a.clienteId === c),
    listarTodos: async () => [...tabela.values()],
    buscar: async (d: string, h: string) => tabela.get(chave(d, h)) ?? null,
    reservar: async (a: Agendamento) => {
      const atual = tabela.get(chave(a.data, a.hora));
      if (atual && atual.status !== 'cancelado') return false;
      tabela.set(chave(a.data, a.hora), a);
      return true;
    },
    atualizarStatus: async (d: string, h: string, status: Agendamento['status']) => {
      const a = { ...tabela.get(chave(d, h))!, status };
      tabela.set(chave(d, h), a);
      return a;
    },
  };
  const servicos = {
    listar: async () => [CORTE],
    buscar: async (id: string) => [CORTE, CORTE_COM_OPCOES].find((s) => s.id === id) ?? null,
    criar: async () => {},
    remover: async () => true,
  };
  return criarAgendamentosService({ agendamentos, servicos, agora: () => relogio.agora });
}

const pedido = (hora = '14:00', data = '2026-11-26') => ({
  servicoId: 's1',
  data,
  hora,
  clienteNome: 'Ana',
  clienteTelefone: '(84) 99999-8888',
});

describe('agendamentosService', () => {
  it('lista só horários futuros quando a data é hoje', async () => {
    const disp = await montar().disponibilidade('2026-11-25');
    assert.equal(disp.aberto, true);
    assert.ok(!disp.horarios.includes('09:30'));
    assert.ok(disp.horarios.includes('10:30'));
  });

  it('informa que domingo é fechado', async () => {
    const disp = await montar().disponibilidade('2026-11-29');
    assert.equal(disp.aberto, false);
  });

  it('impede reserva dupla no mesmo horário (409)', async () => {
    const svc = montar();
    await svc.criar(CLIENTE, pedido());
    await assert.rejects(svc.criar(OUTRO, pedido()), { status: 409 });
  });

  it('libera o horário depois de cancelado', async () => {
    const svc = montar();
    const a = await svc.criar(CLIENTE, pedido());
    await svc.alterarStatus(CLIENTE, a.id, { status: 'cancelado' });
    const novo = await svc.criar(OUTRO, pedido());
    assert.equal(novo.clienteId, OUTRO.id);
  });

  it('cliente não vê nem cancela agendamento de outro cliente (404)', async () => {
    const svc = montar();
    const a = await svc.criar(CLIENTE, pedido());
    await assert.rejects(svc.buscar(OUTRO, a.id), { status: 404 });
    await assert.rejects(svc.alterarStatus(OUTRO, a.id, { status: 'cancelado' }), { status: 404 });
  });

  it('cliente não pode marcar como concluído (403)', async () => {
    const svc = montar();
    const a = await svc.criar(CLIENTE, pedido());
    await assert.rejects(svc.alterarStatus(CLIENTE, a.id, { status: 'concluido' }), { status: 403 });
  });

  it('barbeiro não conclui antes do horário (400), mas conclui depois', async () => {
    const svc = montar();
    const a = await svc.criar(CLIENTE, pedido('14:00', '2026-11-25'));
    assert.equal((await svc.listar(BARBEIRO))[0].podeConcluir, false);
    await assert.rejects(svc.alterarStatus(BARBEIRO, a.id, { status: 'concluido' }), { status: 400 });

    relogio.agora = new Date('2026-11-25T17:05:00Z'); // 14:05 em Fortaleza
    assert.equal((await svc.listar(BARBEIRO))[0].podeConcluir, true);
    const concluido = await svc.alterarStatus(BARBEIRO, a.id, { status: 'concluido' });
    assert.equal(concluido.status, 'concluido');
  });

  it('barbeiro pode cancelar agendamento futuro, mas não altera um já concluído (409)', async () => {
    const svc = montar();
    const futuro = await svc.criar(CLIENTE, pedido('16:00'));
    assert.equal((await svc.alterarStatus(BARBEIRO, futuro.id, { status: 'cancelado' })).status, 'cancelado');

    const hoje = await svc.criar(CLIENTE, pedido('14:00', '2026-11-25'));
    relogio.agora = new Date('2026-11-25T17:30:00Z');
    await svc.alterarStatus(BARBEIRO, hoje.id, { status: 'concluido' });
    await assert.rejects(svc.alterarStatus(BARBEIRO, hoje.id, { status: 'cancelado' }), { status: 409 });
  });

  it('cliente lista apenas os próprios agendamentos; barbeiro lista todos', async () => {
    const svc = montar();
    await svc.criar(CLIENTE, pedido('14:00'));
    await svc.criar(OUTRO, pedido('15:00'));
    assert.equal((await svc.listar(CLIENTE)).length, 1);
    assert.equal((await svc.listar(BARBEIRO)).length, 2);
  });

  it('exige escolher tesoura ou máquina quando o serviço tem opções (400)', async () => {
    const svc = montar();
    const base = { ...pedido(), servicoId: 's2' };
    await assert.rejects(svc.criar(CLIENTE, base), { status: 400 });
    await assert.rejects(svc.criar(CLIENTE, { ...base, opcao: 'Navalha' }), { status: 400 });
    const a = await svc.criar(CLIENTE, { ...base, opcao: 'Tesoura' });
    assert.equal(a.opcao, 'Tesoura');
  });

  it('ignora opção em serviço que não tem opções', async () => {
    const a = await montar().criar(CLIENTE, { ...pedido(), opcao: 'Tesoura' });
    assert.equal(a.opcao, undefined);
  });

  it('salva o telefone só com dígitos e exige telefone válido (400)', async () => {
    const svc = montar();
    const a = await svc.criar(CLIENTE, pedido());
    assert.equal(a.clienteTelefone, '84999998888');
    await assert.rejects(svc.criar(CLIENTE, { ...pedido('15:00'), clienteTelefone: '9999-8888' }), { status: 400 });
    await assert.rejects(svc.criar(CLIENTE, { ...pedido('15:00'), clienteTelefone: undefined }), { status: 400 });
    await assert.rejects(svc.criar(CLIENTE, { ...pedido('15:00'), clienteNome: ' ' }), { status: 400 });
  });

  it('aceita telefone fixo e com +55', async () => {
    const svc = montar();
    assert.equal((await svc.criar(CLIENTE, { ...pedido('15:00'), clienteTelefone: '(84) 3312-0000' })).clienteTelefone, '8433120000');
    assert.equal((await svc.criar(CLIENTE, { ...pedido('16:00'), clienteTelefone: '+55 84 99999-8888' })).clienteTelefone, '84999998888');
  });

  it('rejeita horário fora da grade (400)', async () => {
    await assert.rejects(montar().criar(CLIENTE, pedido('14:10')), { status: 400 });
  });
});

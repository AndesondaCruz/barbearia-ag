import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Agendamento, StatusAgendamento } from '../repositories/agendamentosRepository';
import { criarRelatoriosService } from './relatoriosService';

const BARBEIRO = { id: 'b', isBarbeiro: true };
const CLIENTE = { id: 'c', isBarbeiro: false };

function ag(data: string, hora: string, status: StatusAgendamento, preco: number, servico = 'Corte', opcao?: string): Agendamento {
  return {
    data, hora, id: `${data}_${hora}`, clienteId: 'c', clienteNome: 'Ana', servicoId: 's',
    servicoNome: servico, opcao, precoCentavos: preco, status, criadoEm: '', atualizadoEm: '',
  };
}

const BASE = [
  ag('2026-11-03', '09:00', 'concluido', 3500, 'Corte', 'Tesoura'),
  ag('2026-11-03', '10:00', 'concluido', 3500, 'Corte', 'Máquina'),
  ag('2026-11-10', '09:00', 'concluido', 2500, 'Barba'),
  ag('2026-11-20', '09:00', 'cancelado', 5500, 'Corte + Barba', 'Tesoura'),
  ag('2026-11-28', '09:00', 'confirmado', 5500, 'Corte + Barba', 'Máquina'),
  ag('2026-12-01', '09:00', 'concluido', 9900), // outro mês: não entra
];

const svc = criarRelatoriosService({ listarPorData: async (d) => BASE.filter((a) => a.data === d) });

describe('relatoriosService.ganhosDoMes', () => {
  it('soma só os concluídos do mês e separa o previsto', async () => {
    const r = await svc.ganhosDoMes(BARBEIRO, '2026-11');
    assert.equal(r.recebidoCentavos, 9500);
    assert.equal(r.atendimentosConcluidos, 3);
    assert.equal(r.ticketMedioCentavos, 3167);
    assert.equal(r.previstoCentavos, 5500);
    assert.equal(r.atendimentosPendentes, 1);
    assert.equal(r.cancelados, 1);
  });

  it('agrupa por serviço (com a opção escolhida) e por dia', async () => {
    const r = await svc.ganhosDoMes(BARBEIRO, '2026-11');
    assert.deepEqual(r.porServico.map((s) => s.servico).sort(), ['Barba', 'Corte (Máquina)', 'Corte (Tesoura)']);
    assert.deepEqual(r.porDia, [
      { data: '2026-11-03', totalCentavos: 7000 },
      { data: '2026-11-10', totalCentavos: 2500 },
    ]);
  });

  it('cliente não acessa os ganhos (403)', async () => {
    await assert.rejects(svc.ganhosDoMes(CLIENTE, '2026-11'), { status: 403 });
  });

  it('rejeita mês inválido (400)', async () => {
    await assert.rejects(svc.ganhosDoMes(BARBEIRO, '2026-13'), { status: 400 });
    await assert.rejects(svc.ganhosDoMes(BARBEIRO, undefined), { status: 400 });
  });
});

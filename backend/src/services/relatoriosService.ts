import type { Usuario } from '../lib/auth';
import { badRequest, forbidden } from '../lib/http';
import type { agendamentosRepository } from '../repositories/agendamentosRepository';

type AgendamentosRepo = Pick<typeof agendamentosRepository, 'listarPorData'>;

export interface GanhosDoMes {
  mes: string;
  /** Dinheiro que de fato entrou: soma dos atendimentos concluídos. */
  recebidoCentavos: number;
  atendimentosConcluidos: number;
  ticketMedioCentavos: number;
  /** Agendamentos confirmados no mês que ainda não foram concluídos. */
  previstoCentavos: number;
  atendimentosPendentes: number;
  cancelados: number;
  porServico: { servico: string; quantidade: number; totalCentavos: number }[];
  porDia: { data: string; totalCentavos: number }[];
}

const MES_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** Camada de negócios dos relatórios do barbeiro. */
export function criarRelatoriosService(agendamentos: AgendamentosRepo) {
  return {
    async ganhosDoMes(usuario: Usuario, mes: unknown): Promise<GanhosDoMes> {
      if (!usuario.isBarbeiro) throw forbidden('Somente o barbeiro pode ver os ganhos');
      const m = typeof mes === 'string' ? MES_RE.exec(mes) : null;
      if (!m) throw badRequest('Informe o mês no formato YYYY-MM');

      // A tabela é particionada por dia: uma consulta por dia do mês, em paralelo.
      // Para o volume de uma barbearia isso é barato e evita varrer a tabela inteira.
      const totalDias = new Date(Date.UTC(Number(m[1]), Number(m[2]), 0)).getUTCDate();
      const dias = Array.from({ length: totalDias }, (_, i) => `${mes}-${String(i + 1).padStart(2, '0')}`);
      const itens = (await Promise.all(dias.map((d) => agendamentos.listarPorData(d)))).flat();

      const concluidos = itens.filter((a) => a.status === 'concluido');
      const pendentes = itens.filter((a) => a.status === 'confirmado');
      const soma = (lista: typeof itens) => lista.reduce((t, a) => t + a.precoCentavos, 0);
      const recebido = soma(concluidos);

      const porServico = new Map<string, { quantidade: number; totalCentavos: number }>();
      const porDia = new Map<string, number>();
      for (const a of concluidos) {
        const nome = a.opcao ? `${a.servicoNome} (${a.opcao})` : a.servicoNome;
        const atual = porServico.get(nome) ?? { quantidade: 0, totalCentavos: 0 };
        porServico.set(nome, { quantidade: atual.quantidade + 1, totalCentavos: atual.totalCentavos + a.precoCentavos });
        porDia.set(a.data, (porDia.get(a.data) ?? 0) + a.precoCentavos);
      }

      return {
        mes: mes as string,
        recebidoCentavos: recebido,
        atendimentosConcluidos: concluidos.length,
        ticketMedioCentavos: concluidos.length ? Math.round(recebido / concluidos.length) : 0,
        previstoCentavos: soma(pendentes),
        atendimentosPendentes: pendentes.length,
        cancelados: itens.filter((a) => a.status === 'cancelado').length,
        porServico: [...porServico.entries()]
          .map(([servico, v]) => ({ servico, ...v }))
          .sort((a, b) => b.totalCentavos - a.totalCentavos),
        porDia: [...porDia.entries()]
          .map(([data, totalCentavos]) => ({ data, totalCentavos }))
          .sort((a, b) => a.data.localeCompare(b.data)),
      };
    },
  };
}

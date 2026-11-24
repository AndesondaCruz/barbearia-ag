import { config } from '../config';
import type { Usuario } from '../lib/auth';
import { agoraLocal, diaDaSemana, diferencaEmDias, gradeDeHorarios, isData, isHora } from '../lib/datas';
import { badRequest, conflict, forbidden, notFound } from '../lib/http';
import type {
  Agendamento,
  StatusAgendamento,
  agendamentosRepository,
} from '../repositories/agendamentosRepository';
import type { servicosRepository } from '../repositories/servicosRepository';

type AgendamentosRepo = typeof agendamentosRepository;
type ServicosRepo = typeof servicosRepository;

export interface Dependencias {
  agendamentos: AgendamentosRepo;
  servicos: ServicosRepo;
  /** Injetável para testes. */
  agora?: () => Date;
}

/** O id público do recurso é derivado da chave: 2026-11-27_0930. */
export const idDoAgendamento = (data: string, hora: string) => `${data}_${hora.replace(':', '')}`;

export function chaveDoId(id: string): { data: string; hora: string } {
  const m = /^(\d{4}-\d{2}-\d{2})_(\d{2})(\d{2})$/.exec(id);
  if (!m) throw notFound('Agendamento não encontrado');
  return { data: m[1], hora: `${m[2]}:${m[3]}` };
}

const STATUS_VALIDOS: StatusAgendamento[] = ['confirmado', 'cancelado', 'concluido'];

/** Camada de negócios dos agendamentos: todas as regras da barbearia ficam aqui. */
export function criarAgendamentosService(deps: Dependencias) {
  const agora = () => agoraLocal(deps.agora?.());

  /** Valida se a data pode receber agendamentos e retorna o motivo se não puder. */
  function motivoDataIndisponivel(data: string): string | null {
    const hoje = agora().data;
    const dias = diferencaEmDias(hoje, data);
    if (dias < 0) return 'Não é possível agendar em datas passadas';
    if (dias > config.diasMaximosAntecedencia) {
      return `Agendamentos só podem ser feitos com até ${config.diasMaximosAntecedencia} dias de antecedência`;
    }
    if ((config.diasFechados as readonly number[]).includes(diaDaSemana(data))) {
      return 'A barbearia não abre neste dia';
    }
    return null;
  }

  async function disponibilidade(data: unknown) {
    if (!isData(data)) throw badRequest('Informe a data no formato YYYY-MM-DD');

    const motivo = motivoDataIndisponivel(data);
    if (motivo) return { data, aberto: false, motivo, horarios: [] as string[] };

    const ocupados = new Set(
      (await deps.agendamentos.listarPorData(data))
        .filter((a) => a.status !== 'cancelado')
        .map((a) => a.hora),
    );
    const { data: hoje, hora: horaAtual } = agora();
    const horarios = gradeDeHorarios().filter(
      (h) => !ocupados.has(h) && (data !== hoje || h > horaAtual),
    );
    return { data, aberto: true, motivo: null, horarios };
  }

  return {
    disponibilidade,

    async listar(usuario: Usuario, filtroData?: string): Promise<(Agendamento & { podeCancelar: boolean })[]> {
      if (filtroData !== undefined && !isData(filtroData)) {
        throw badRequest('Filtro de data deve estar no formato YYYY-MM-DD');
      }

      let itens: Agendamento[];
      if (usuario.isBarbeiro) {
        itens = filtroData
          ? await deps.agendamentos.listarPorData(filtroData)
          : await deps.agendamentos.listarTodos();
      } else {
        // Cliente só enxerga os próprios agendamentos (autorização por recurso).
        itens = await deps.agendamentos.listarPorCliente(usuario.id);
        if (filtroData) itens = itens.filter((a) => a.data === filtroData);
      }

      return itens
        .sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora))
        .map((a) => ({ ...a, podeCancelar: podeAlterar(usuario, a) }));
    },

    async buscar(usuario: Usuario, id: string): Promise<Agendamento> {
      const { data, hora } = chaveDoId(id);
      const agendamento = await deps.agendamentos.buscar(data, hora);
      // 404 também para agendamento de outro cliente: não revela que ele existe.
      if (!agendamento || (!usuario.isBarbeiro && agendamento.clienteId !== usuario.id)) {
        throw notFound('Agendamento não encontrado');
      }
      return agendamento;
    },

    async criar(usuario: Usuario, body: Record<string, unknown>): Promise<Agendamento> {
      const { servicoId, data, hora } = body;
      const clienteNome = typeof body.clienteNome === 'string' ? body.clienteNome.trim().slice(0, 80) : '';

      if (typeof servicoId !== 'string' || !servicoId) throw badRequest('servicoId é obrigatório');
      if (!isData(data)) throw badRequest('data deve estar no formato YYYY-MM-DD');
      if (!isHora(hora)) throw badRequest('hora deve estar no formato HH:MM');
      if (!clienteNome) throw badRequest('clienteNome é obrigatório');

      const servico = await deps.servicos.buscar(servicoId);
      if (!servico) throw badRequest('Serviço inexistente');

      const disp = await disponibilidade(data);
      if (!disp.aberto) throw badRequest(disp.motivo ?? 'Data indisponível');
      if (!gradeDeHorarios().includes(hora)) throw badRequest('Horário fora da grade de atendimento');
      if (!disp.horarios.includes(hora)) throw conflict('Este horário não está mais disponível');

      const instante = new Date().toISOString();
      const agendamento: Agendamento = {
        data,
        hora,
        id: idDoAgendamento(data, hora),
        clienteId: usuario.id,
        clienteNome,
        servicoId: servico.id,
        servicoNome: servico.nome,
        precoCentavos: servico.precoCentavos,
        status: 'confirmado',
        criadoEm: instante,
        atualizadoEm: instante,
      };

      const reservado = await deps.agendamentos.reservar(agendamento);
      if (!reservado) throw conflict('Este horário acabou de ser reservado por outra pessoa');
      return agendamento;
    },

    async alterarStatus(usuario: Usuario, id: string, body: Record<string, unknown>): Promise<Agendamento> {
      const novoStatus = body.status as StatusAgendamento;
      if (!STATUS_VALIDOS.includes(novoStatus)) {
        throw badRequest(`status deve ser um de: ${STATUS_VALIDOS.join(', ')}`);
      }

      const atual = await this.buscar(usuario, id);

      if (!usuario.isBarbeiro) {
        // Cliente pode apenas cancelar o próprio agendamento futuro.
        if (novoStatus !== 'cancelado') throw forbidden('Cliente só pode cancelar agendamentos');
        if (!podeAlterar(usuario, atual)) {
          throw badRequest('Este agendamento não pode mais ser cancelado');
        }
      } else if (atual.status === 'cancelado' && novoStatus !== 'cancelado') {
        // Reativar um cancelado poderia colidir com nova reserva no mesmo horário.
        throw conflict('Agendamento cancelado não pode ser reativado');
      }

      return deps.agendamentos.atualizarStatus(atual.data, atual.hora, novoStatus);
    },
  };

  function podeAlterar(usuario: Usuario, a: Agendamento): boolean {
    if (a.status !== 'confirmado') return false;
    if (usuario.isBarbeiro) return true;
    const { data, hora } = agora();
    return a.clienteId === usuario.id && a.data + a.hora > data + hora;
  }
}

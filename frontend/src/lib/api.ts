import { limparSessao, obterAccessToken } from './auth';
import { config } from './config';

export interface Servico {
  id: string;
  nome: string;
  descricao: string;
  precoCentavos: number;
  duracaoMinutos: number;
  opcoes?: string[];
}

export type StatusAgendamento = 'confirmado' | 'cancelado' | 'concluido';

export interface Agendamento {
  id: string;
  data: string;
  hora: string;
  clienteNome: string;
  clienteTelefone?: string;
  servicoNome: string;
  opcao?: string;
  precoCentavos: number;
  status: StatusAgendamento;
  podeCancelar?: boolean;
  podeConcluir?: boolean;
}

export interface Disponibilidade {
  data: string;
  aberto: boolean;
  motivo: string | null;
  horarios: string[];
}

export interface GanhosDoMes {
  mes: string;
  recebidoCentavos: number;
  atendimentosConcluidos: number;
  ticketMedioCentavos: number;
  previstoCentavos: number;
  atendimentosPendentes: number;
  cancelados: number;
  porServico: { servico: string; quantidade: number; totalCentavos: number }[];
  porDia: { data: string; totalCentavos: number }[];
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Cliente HTTP da camada de apresentação para a API de negócios. */
async function requisicao<T>(metodo: string, caminho: string, corpo?: unknown, autenticado = true): Promise<T> {
  const headers: Record<string, string> = {};
  if (corpo !== undefined) headers['Content-Type'] = 'application/json';
  if (autenticado) {
    const token = await obterAccessToken();
    if (!token) throw new ApiError(401, 'Sua sessão expirou. Entre novamente.');
    headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${config().apiUrl}${caminho}`, {
      method: metodo,
      headers,
      body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Sem conexão com o servidor. Verifique sua internet.');
  }

  if (res.status === 204) return undefined as T;
  const dados = (await res.json().catch(() => ({}))) as { mensagem?: string; message?: string };
  if (!res.ok) {
    if (res.status === 401) limparSessao();
    throw new ApiError(res.status, dados.mensagem ?? dados.message ?? `Erro ${res.status}`);
  }
  return dados as T;
}

export const api = {
  listarServicos: () => requisicao<Servico[]>('GET', '/servicos', undefined, false),
  criarServico: (s: { nome: string; descricao: string; precoCentavos: number; opcoes?: string[] }) =>
    requisicao<Servico>('POST', '/servicos', s),
  removerServico: (id: string) => requisicao<void>('DELETE', `/servicos/${encodeURIComponent(id)}`),

  disponibilidade: (data: string) =>
    requisicao<Disponibilidade>('GET', `/disponibilidade?data=${data}`, undefined, false),

  listarAgendamentos: (data?: string) =>
    requisicao<Agendamento[]>('GET', `/agendamentos${data ? `?data=${data}` : ''}`),
  criarAgendamento: (a: {
    servicoId: string;
    data: string;
    hora: string;
    clienteNome: string;
    clienteTelefone: string;
    opcao?: string;
  }) =>
    requisicao<Agendamento>('POST', '/agendamentos', a),
  alterarStatus: (id: string, status: StatusAgendamento) =>
    requisicao<Agendamento>('PATCH', `/agendamentos/${encodeURIComponent(id)}`, { status }),

  ganhosDoMes: (mes: string) => requisicao<GanhosDoMes>('GET', `/relatorios/ganhos?mes=${mes}`),
};

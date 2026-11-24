/**
 * Configuração da camada de negócios.
 * Nomes de tabelas vêm de variáveis de ambiente da Lambda; regras de horário
 * ficam centralizadas aqui para não se espalharem pelo código.
 */
export const config = {
  tabelaServicos: process.env.TABELA_SERVICOS ?? 'barbearia-servicos',
  tabelaAgendamentos: process.env.TABELA_AGENDAMENTOS ?? 'barbearia-agendamentos',
  indiceCliente: 'clienteId-index',
  grupoBarbeiro: 'barbeiro',
  fusoHorario: 'America/Fortaleza',
  horaAbertura: 9,
  horaFechamento: 18,
  intervaloMinutos: 30,
  /** 0 = domingo (getUTCDay). */
  diasFechados: [0],
  diasMaximosAntecedencia: 30,
} as const;

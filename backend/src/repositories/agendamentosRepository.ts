import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { GetCommand, PutCommand, QueryCommand, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { config } from '../config';
import { db } from './dynamo';

export type StatusAgendamento = 'confirmado' | 'cancelado' | 'concluido';

/**
 * Chave da tabela: data (partição) + hora (ordenação).
 * Como a barbearia tem uma cadeira, cada par data+hora é um horário único;
 * isso torna a regra "um agendamento por horário" garantida pelo próprio banco.
 */
export interface Agendamento {
  data: string;
  hora: string;
  id: string;
  clienteId: string;
  clienteNome: string;
  /** Só dígitos, com DDD. Opcional porque agendamentos antigos não têm. */
  clienteTelefone?: string;
  servicoId: string;
  servicoNome: string;
  /** Variação escolhida (ex.: "Tesoura"), quando o serviço tem opções. */
  opcao?: string;
  precoCentavos: number;
  status: StatusAgendamento;
  criadoEm: string;
  atualizadoEm: string;
}

export const agendamentosRepository = {
  async listarPorData(data: string): Promise<Agendamento[]> {
    const res = await db.send(
      new QueryCommand({
        TableName: config.tabelaAgendamentos,
        KeyConditionExpression: '#d = :d',
        ExpressionAttributeNames: { '#d': 'data' },
        ExpressionAttributeValues: { ':d': data },
      }),
    );
    return (res.Items ?? []) as Agendamento[];
  },

  async listarPorCliente(clienteId: string): Promise<Agendamento[]> {
    const res = await db.send(
      new QueryCommand({
        TableName: config.tabelaAgendamentos,
        IndexName: config.indiceCliente,
        KeyConditionExpression: 'clienteId = :c',
        ExpressionAttributeValues: { ':c': clienteId },
      }),
    );
    return (res.Items ?? []) as Agendamento[];
  },

  /** Usado só na visão geral do barbeiro; volume de uma barbearia é pequeno. */
  async listarTodos(): Promise<Agendamento[]> {
    const res = await db.send(new ScanCommand({ TableName: config.tabelaAgendamentos }));
    return (res.Items ?? []) as Agendamento[];
  },

  async buscar(data: string, hora: string): Promise<Agendamento | null> {
    const res = await db.send(
      new GetCommand({ TableName: config.tabelaAgendamentos, Key: { data, hora } }),
    );
    return (res.Item as Agendamento | undefined) ?? null;
  },

  /**
   * Grava o agendamento só se o horário estiver livre (inexistente ou cancelado).
   * A condição roda dentro do DynamoDB, então duas requisições simultâneas
   * para o mesmo horário não geram reserva dupla.
   * Retorna false se o horário já estiver ocupado.
   */
  async reservar(agendamento: Agendamento): Promise<boolean> {
    try {
      await db.send(
        new PutCommand({
          TableName: config.tabelaAgendamentos,
          Item: agendamento,
          ConditionExpression: 'attribute_not_exists(#d) OR #s = :cancelado',
          ExpressionAttributeNames: { '#d': 'data', '#s': 'status' },
          ExpressionAttributeValues: { ':cancelado': 'cancelado' },
        }),
      );
      return true;
    } catch (err) {
      if (err instanceof ConditionalCheckFailedException) return false;
      throw err;
    }
  },

  async atualizarStatus(data: string, hora: string, status: StatusAgendamento): Promise<Agendamento> {
    const res = await db.send(
      new UpdateCommand({
        TableName: config.tabelaAgendamentos,
        Key: { data, hora },
        UpdateExpression: 'SET #s = :s, atualizadoEm = :agora',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: { ':s': status, ':agora': new Date().toISOString() },
        ReturnValues: 'ALL_NEW',
      }),
    );
    return res.Attributes as Agendamento;
  },
};

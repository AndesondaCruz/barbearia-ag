import { DeleteCommand, GetCommand, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { config } from '../config';
import { db } from './dynamo';

export interface Servico {
  id: string;
  nome: string;
  descricao: string;
  precoCentavos: number;
  duracaoMinutos: number;
}

/** Camada de dados: acesso à tabela de serviços. Sem regra de negócio aqui. */
export const servicosRepository = {
  async listar(): Promise<Servico[]> {
    const res = await db.send(new ScanCommand({ TableName: config.tabelaServicos }));
    return (res.Items ?? []) as Servico[];
  },

  async buscar(id: string): Promise<Servico | null> {
    const res = await db.send(new GetCommand({ TableName: config.tabelaServicos, Key: { id } }));
    return (res.Item as Servico | undefined) ?? null;
  },

  async criar(servico: Servico): Promise<void> {
    await db.send(new PutCommand({ TableName: config.tabelaServicos, Item: servico }));
  },

  async remover(id: string): Promise<boolean> {
    const res = await db.send(
      new DeleteCommand({ TableName: config.tabelaServicos, Key: { id }, ReturnValues: 'ALL_OLD' }),
    );
    return Boolean(res.Attributes);
  },
};

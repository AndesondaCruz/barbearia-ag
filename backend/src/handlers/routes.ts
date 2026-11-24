import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda';
import { exigirUsuario, usuarioDasClaims, type Usuario } from '../lib/auth';
import { json, noContent, parseBody } from '../lib/http';
import { agendamentosRepository } from '../repositories/agendamentosRepository';
import { servicosRepository } from '../repositories/servicosRepository';
import { criarAgendamentosService } from '../services/agendamentosService';
import { criarServicosService } from '../services/servicosService';

const servicos = criarServicosService(servicosRepository);
const agendamentos = criarAgendamentosService({ agendamentos: agendamentosRepository, servicos: servicosRepository });

export interface Contexto {
  usuario: Usuario | null;
  params: Record<string, string | undefined>;
  query: Record<string, string | undefined>;
  body: () => Record<string, unknown>;
}

type Handler = (ctx: Contexto) => Promise<APIGatewayProxyStructuredResultV2>;

/**
 * Camada de apresentação da API: traduz HTTP <-> chamadas de serviço.
 * As chaves batem com as rotas declaradas no API Gateway (infra/03-api.sh).
 */
export const rotas: Record<string, Handler> = {
  'GET /servicos': async () => json(200, await servicos.listar()),

  'POST /servicos': async (ctx) => json(201, await servicos.criar(exigirUsuario(ctx.usuario), ctx.body())),

  'DELETE /servicos/{id}': async (ctx) => {
    await servicos.remover(exigirUsuario(ctx.usuario), ctx.params.id ?? '');
    return noContent();
  },

  'GET /disponibilidade': async (ctx) => json(200, await agendamentos.disponibilidade(ctx.query.data)),

  'GET /me': async (ctx) => {
    const u = exigirUsuario(ctx.usuario);
    return json(200, { id: u.id, perfil: u.isBarbeiro ? 'barbeiro' : 'cliente' });
  },

  'GET /agendamentos': async (ctx) =>
    json(200, await agendamentos.listar(exigirUsuario(ctx.usuario), ctx.query.data)),

  'POST /agendamentos': async (ctx) =>
    json(201, await agendamentos.criar(exigirUsuario(ctx.usuario), ctx.body())),

  'GET /agendamentos/{id}': async (ctx) =>
    json(200, await agendamentos.buscar(exigirUsuario(ctx.usuario), ctx.params.id ?? '')),

  'PATCH /agendamentos/{id}': async (ctx) =>
    json(200, await agendamentos.alterarStatus(exigirUsuario(ctx.usuario), ctx.params.id ?? '', ctx.body())),
};

export function contextoDoEvento(event: APIGatewayProxyEventV2WithJWTAuthorizer): Contexto {
  return {
    usuario: usuarioDasClaims(event.requestContext.authorizer?.jwt?.claims),
    params: event.pathParameters ?? {},
    query: event.queryStringParameters ?? {},
    body: () => parseBody(event.body, event.isBase64Encoded),
  };
}

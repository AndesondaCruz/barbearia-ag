import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda';
import { contextoDoEvento, rotas } from './handlers/routes';
import { HttpError, json } from './lib/http';

/**
 * Ponto de entrada da Lambda. Um único handler roteia pelo routeKey do
 * API Gateway e centraliza o tratamento de erros e os logs.
 */
export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyStructuredResultV2> {
  const rota = rotas[event.routeKey];
  if (!rota) return json(404, { mensagem: 'Rota não encontrada' });

  try {
    return await rota(contextoDoEvento(event));
  } catch (err) {
    if (err instanceof HttpError) {
      return json(err.status, { mensagem: err.message });
    }
    console.error(
      JSON.stringify({
        nivel: 'erro',
        rota: event.routeKey,
        requestId: event.requestContext.requestId,
        erro: err instanceof Error ? err.message : String(err),
      }),
    );
    return json(500, { mensagem: 'Erro interno. Tente novamente em instantes.' });
  }
}

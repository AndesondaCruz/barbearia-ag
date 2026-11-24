import type { APIGatewayProxyStructuredResultV2 } from 'aws-lambda';

/** Erro de domínio com status HTTP associado; tratado no handler global. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const badRequest = (msg: string) => new HttpError(400, msg);
export const forbidden = (msg = 'Acesso negado para o seu perfil') => new HttpError(403, msg);
export const notFound = (msg = 'Recurso não encontrado') => new HttpError(404, msg);
export const conflict = (msg: string) => new HttpError(409, msg);

export function json(status: number, body: unknown): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  };
}

export function noContent(): APIGatewayProxyStructuredResultV2 {
  return { statusCode: 204 };
}

/** Lê o corpo JSON da requisição, rejeitando JSON inválido com 400. */
export function parseBody(raw: string | undefined, isBase64?: boolean): Record<string, unknown> {
  if (!raw) return {};
  try {
    const text = isBase64 ? Buffer.from(raw, 'base64').toString('utf8') : raw;
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error();
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw badRequest('Corpo da requisição deve ser um objeto JSON válido');
  }
}

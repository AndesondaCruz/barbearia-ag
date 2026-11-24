import { config } from '../config';
import { HttpError } from './http';

export interface Usuario {
  id: string;
  isBarbeiro: boolean;
}

type Claims = Record<string, string | number | boolean | string[]>;

/**
 * O API Gateway (autorizador JWT) já validou assinatura, emissor, expiração e
 * client_id do access_token antes de chamar a Lambda. Aqui só lemos as claims
 * para decidir a AUTORIZAÇÃO de negócio (cliente x barbeiro).
 */
export function usuarioDasClaims(claims: Claims | undefined): Usuario | null {
  if (!claims || typeof claims.sub !== 'string') return null;
  return { id: claims.sub, isBarbeiro: grupos(claims['cognito:groups']).includes(config.grupoBarbeiro) };
}

export function exigirUsuario(usuario: Usuario | null): Usuario {
  if (!usuario) throw new HttpError(401, 'Autenticação necessária');
  return usuario;
}

/** O HTTP API entrega arrays de claims como string no formato "[a b]". */
function grupos(valor: Claims[string] | undefined): string[] {
  if (Array.isArray(valor)) return valor;
  if (typeof valor !== 'string') return [];
  return valor
    .replace(/^\[|\]$/g, '')
    .split(/[\s,]+/)
    .filter(Boolean);
}

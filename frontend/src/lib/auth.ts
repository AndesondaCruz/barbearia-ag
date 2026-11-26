import { config, redirectUri } from './config';

/**
 * Login com a página hospedada do Cognito usando Authorization Code + PKCE.
 * O navegador nunca vê a senha da aplicação: o Cognito autentica e devolve um
 * código de uso único, que trocamos por tokens com o verificador PKCE.
 */

interface Tokens {
  accessToken: string;
  idToken: string;
  refreshToken?: string;
  expiraEm: number;
}

export interface UsuarioSessao {
  nome: string;
  email: string;
  isBarbeiro: boolean;
}

const CHAVE_TOKENS = 'barbearia.tokens';
const CHAVE_PKCE = 'barbearia.pkce';
const ESCOPOS = 'openid email profile';

function base64Url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return btoa(String.fromCharCode(...arr)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function aleatorio(tamanho = 32): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(tamanho)));
}

async function desafioPkce(verificador: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verificador));
  return base64Url(hash);
}

function lerTokens(): Tokens | null {
  try {
    const bruto = sessionStorage.getItem(CHAVE_TOKENS);
    return bruto ? (JSON.parse(bruto) as Tokens) : null;
  } catch {
    return null;
  }
}

function salvarTokens(resposta: Record<string, unknown>, refreshAnterior?: string) {
  const tokens: Tokens = {
    accessToken: String(resposta.access_token),
    idToken: String(resposta.id_token),
    refreshToken: (resposta.refresh_token as string | undefined) ?? refreshAnterior,
    expiraEm: Date.now() + Number(resposta.expires_in ?? 3600) * 1000,
  };
  sessionStorage.setItem(CHAVE_TOKENS, JSON.stringify(tokens));
}

async function chamarToken(params: Record<string, string>) {
  const res = await fetch(`${config().cognitoDomain}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: config().clientId, ...params }),
  });
  if (!res.ok) throw new Error('Falha ao obter tokens do Cognito');
  return (await res.json()) as Record<string, unknown>;
}

export async function iniciarLogin(): Promise<void> {
  const verificador = aleatorio(48);
  const estado = aleatorio(16);
  sessionStorage.setItem(CHAVE_PKCE, JSON.stringify({ verificador, estado }));

  const url = new URL(`${config().cognitoDomain}/oauth2/authorize`);
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: config().clientId,
    redirect_uri: redirectUri(),
    scope: ESCOPOS,
    state: estado,
    code_challenge: await desafioPkce(verificador),
    code_challenge_method: 'S256',
    // Página de login do Cognito (Managed Login) em português.
    lang: 'pt-BR',
  }).toString();
  window.location.assign(url.toString());
}

/** Processa o retorno do Cognito (?code=...&state=...). Retorna true se houve login. */
export async function processarRetornoLogin(): Promise<boolean> {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  if (!code) return false;

  const pkce = JSON.parse(sessionStorage.getItem(CHAVE_PKCE) ?? 'null') as
    | { verificador: string; estado: string }
    | null;
  sessionStorage.removeItem(CHAVE_PKCE);
  window.history.replaceState({}, '', '/');

  // O state protege contra CSRF no fluxo de login.
  if (!pkce || params.get('state') !== pkce.estado) {
    throw new Error('Retorno de login inválido. Tente entrar novamente.');
  }

  salvarTokens(
    await chamarToken({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri(),
      code_verifier: pkce.verificador,
    }),
  );
  return true;
}

/** Retorna um access_token válido, renovando com o refresh_token se preciso. */
export async function obterAccessToken(): Promise<string | null> {
  const tokens = lerTokens();
  if (!tokens) return null;
  if (Date.now() < tokens.expiraEm - 60_000) return tokens.accessToken;
  if (!tokens.refreshToken) {
    limparSessao();
    return null;
  }
  try {
    salvarTokens(
      await chamarToken({ grant_type: 'refresh_token', refresh_token: tokens.refreshToken }),
      tokens.refreshToken,
    );
    return lerTokens()?.accessToken ?? null;
  } catch {
    limparSessao();
    return null;
  }
}

export function usuarioAtual(): UsuarioSessao | null {
  const tokens = lerTokens();
  if (!tokens) return null;
  try {
    // Decodifica o payload do id_token (UTF-8) só para exibir nome e perfil;
    // a validação de verdade do token acontece no API Gateway.
    const binario = atob(tokens.idToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = Uint8Array.from(binario, (c) => c.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
    const grupos = (payload['cognito:groups'] as string[] | undefined) ?? [];
    return {
      nome: String(payload.name ?? payload.email ?? 'Cliente'),
      email: String(payload.email ?? ''),
      isBarbeiro: grupos.includes('barbeiro'),
    };
  } catch {
    return null;
  }
}

export function limparSessao() {
  sessionStorage.removeItem(CHAVE_TOKENS);
}

export function sair() {
  limparSessao();
  const url = new URL(`${config().cognitoDomain}/logout`);
  url.search = new URLSearchParams({ client_id: config().clientId, logout_uri: redirectUri() }).toString();
  window.location.assign(url.toString());
}

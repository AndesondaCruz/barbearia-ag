export interface AppConfig {
  apiUrl: string;
  cognitoDomain: string;
  clientId: string;
}

let atual: AppConfig | null = null;

/**
 * A configuração é lida em tempo de execução de /config.json, gerado pelo
 * script de implantação. Assim o mesmo build serve para qualquer ambiente.
 */
export async function carregarConfig(): Promise<AppConfig> {
  const res = await fetch('/config.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('Não foi possível carregar /config.json');
  atual = (await res.json()) as AppConfig;
  return atual;
}

export function config(): AppConfig {
  if (!atual) throw new Error('Configuração ainda não carregada');
  return atual;
}

export const redirectUri = () => `${window.location.origin}/`;

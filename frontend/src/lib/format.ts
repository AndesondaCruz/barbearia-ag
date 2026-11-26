const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** Primeira letra maiúscula: "quinta-feira, 26 de novembro" -> "Quinta-feira, 26 de novembro". */
const inicialMaiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

export const formatarPreco = (centavos: number) => moeda.format(centavos / 100);

export function formatarData(data: string): string {
  const [a, m, d] = data.split('-').map(Number);
  return inicialMaiuscula(
    new Date(a, m - 1, d).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }),
  );
}

/** Nome do serviço com a variação escolhida, ex.: "Corte (Tesoura)". */
export const nomeDoServico = (servico: string, opcao?: string) => (opcao ? `${servico} (${opcao})` : servico);

/** Máscara progressiva enquanto digita: (84) 99999-8888 ou (84) 3312-0000. */
export function mascaraTelefone(valor: string): string {
  const d = valor.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export const telefoneValido = (valor: string) => /^\d{10,11}$/.test(valor.replace(/\D/g, ''));

/** Link que abre a conversa no WhatsApp (código do Brasil + DDD + número). */
export const linkWhatsApp = (digitos: string) => `https://wa.me/55${digitos}`;

export const mesAtual =() => hojeIso().slice(0, 7);

export function formatarMes(mes: string): string {
  const [a, m] = mes.split('-').map(Number);
  return inicialMaiuscula(new Date(a, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }));
}

/** Data local (fuso do navegador) no formato YYYY-MM-DD. */
export function hojeIso(somarDias = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + somarDias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

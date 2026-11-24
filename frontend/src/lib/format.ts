const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export const formatarPreco = (centavos: number) => moeda.format(centavos / 100);

export function formatarData(data: string): string {
  const [a, m, d] = data.split('-').map(Number);
  return new Date(a, m - 1, d).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
}

/** Data local (fuso do navegador) no formato YYYY-MM-DD. */
export function hojeIso(somarDias = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + somarDias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

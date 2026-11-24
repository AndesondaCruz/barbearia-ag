import type { ReactNode } from 'react';

export function Carregando({ texto = 'Carregando...' }: { texto?: string }) {
  return (
    <div role="status" className="flex items-center gap-3 py-8 text-zinc-400">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-600 border-t-amber-400" />
      {texto}
    </div>
  );
}

export function Erro({ mensagem, tentarNovamente }: { mensagem: string; tentarNovamente?: () => void }) {
  return (
    <div role="alert" className="rounded-lg border border-red-900 bg-red-950/50 p-4 text-red-200">
      <p>{mensagem}</p>
      {tentarNovamente && (
        <button onClick={tentarNovamente} className="mt-3 text-sm font-semibold text-red-100 underline">
          Tentar novamente
        </button>
      )}
    </div>
  );
}

export function Vazio({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-700 p-8 text-center text-zinc-400">
      <p className="font-semibold text-zinc-200">{titulo}</p>
      {children && <div className="mt-2 text-sm">{children}</div>}
    </div>
  );
}

export function Aviso({ tipo, children }: { tipo: 'sucesso' | 'erro'; children: ReactNode }) {
  const estilo =
    tipo === 'sucesso'
      ? 'border-emerald-800 bg-emerald-950/50 text-emerald-200'
      : 'border-red-900 bg-red-950/50 text-red-200';
  return (
    <div aria-live="polite" className={`rounded-lg border p-4 ${estilo}`}>
      {children}
    </div>
  );
}

const ESTILO_STATUS = {
  confirmado: 'bg-amber-400/15 text-amber-300',
  concluido: 'bg-emerald-400/15 text-emerald-300',
  cancelado: 'bg-zinc-700/50 text-zinc-400 line-through',
} as const;

export function StatusBadge({ status }: { status: keyof typeof ESTILO_STATUS }) {
  const rotulo = { confirmado: 'Confirmado', concluido: 'Concluído', cancelado: 'Cancelado' }[status];
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ESTILO_STATUS[status]}`}>{rotulo}</span>;
}

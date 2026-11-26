import { useState } from 'react';
import type { Agendamento, StatusAgendamento } from '../lib/api';
import { formatarData, formatarPreco, nomeDoServico } from '../lib/format';
import { StatusBadge } from './Feedback';

interface Props {
  agendamento: Agendamento;
  mostrarCliente?: boolean;
  acoes: { status: StatusAgendamento; rotulo: string; perigo?: boolean }[];
  aoAlterar: (status: StatusAgendamento) => void;
  ocupado: boolean;
}

/** Cartão de agendamento com confirmação em dois cliques para ações destrutivas. */
export function AgendamentoCard({ agendamento: a, mostrarCliente, acoes, aoAlterar, ocupado }: Props) {
  const [confirmando, setConfirmando] = useState<StatusAgendamento | null>(null);

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex items-center gap-3">
          <span className="font-display text-2xl text-amber-400">{a.hora}</span>
          <StatusBadge status={a.status} />
        </div>
        <p className="mt-1 capitalize text-zinc-300">{formatarData(a.data)}</p>
        <p className="text-sm text-zinc-400">
          {nomeDoServico(a.servicoNome, a.opcao)} · {formatarPreco(a.precoCentavos)}
          {mostrarCliente && <> · Cliente: <span className="text-zinc-200">{a.clienteNome}</span></>}
        </p>
      </div>

      {acoes.length > 0 && (
        <div className="flex gap-2">
          {acoes.map(({ status, rotulo, perigo }) =>
            confirmando === status ? (
              <button
                key={status}
                disabled={ocupado}
                onClick={() => {
                  aoAlterar(status);
                  setConfirmando(null);
                }}
                className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
              >
                Confirmar?
              </button>
            ) : (
              <button
                key={status}
                disabled={ocupado}
                onClick={() => (perigo ? setConfirmando(status) : aoAlterar(status))}
                className={`rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-50 ${
                  perigo
                    ? 'border border-zinc-700 text-zinc-300 hover:border-red-500 hover:text-red-300'
                    : 'bg-emerald-600 text-white hover:bg-emerald-500'
                }`}
              >
                {rotulo}
              </button>
            ),
          )}
        </div>
      )}
    </li>
  );
}

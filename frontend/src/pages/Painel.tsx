import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { AgendamentoCard } from '../components/AgendamentoCard';
import { Aviso, Carregando, Erro, Vazio } from '../components/Feedback';
import { api, type StatusAgendamento } from '../lib/api';
import { formatarPreco, hojeIso } from '../lib/format';

/** Área do barbeiro: agenda do dia e catálogo de serviços. */
export function Painel() {
  return (
    <div className="space-y-12">
      <Agenda />
      <Servicos />
    </div>
  );
}

function Agenda() {
  const qc = useQueryClient();
  const [data, setData] = useState(hojeIso());
  const agenda = useQuery({ queryKey: ['agendamentos', 'dia', data], queryFn: () => api.listarAgendamentos(data) });
  const alterar = useMutation({
    mutationFn: ({ id, status }: { id: string; status: StatusAgendamento }) => api.alterarStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agendamentos'] });
      qc.invalidateQueries({ queryKey: ['disponibilidade'] });
    },
  });

  const ativos = agenda.data?.filter((a) => a.status !== 'cancelado') ?? [];
  const faturamento = ativos.reduce((t, a) => t + a.precoCentavos, 0);

  return (
    <section aria-labelledby="titulo-agenda" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 id="titulo-agenda" className="font-display text-3xl">
          Agenda do barbeiro
        </h1>
        <label className="text-sm text-zinc-400">
          Dia{' '}
          <input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="ml-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 [color-scheme:dark]"
          />
        </label>
      </div>

      {agenda.data && (
        <div className="grid grid-cols-2 gap-3 sm:max-w-md">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-xs uppercase text-zinc-500">Atendimentos</p>
            <p className="font-display text-2xl">{ativos.length}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-xs uppercase text-zinc-500">Previsto</p>
            <p className="font-display text-2xl text-amber-400">{formatarPreco(faturamento)}</p>
          </div>
        </div>
      )}

      {alterar.isError && <Aviso tipo="erro">{alterar.error.message}</Aviso>}
      {agenda.isPending && <Carregando />}
      {agenda.isError && <Erro mensagem={agenda.error.message} tentarNovamente={() => agenda.refetch()} />}
      {agenda.data?.length === 0 && <Vazio titulo="Nenhum agendamento neste dia" />}
      {agenda.data && agenda.data.length > 0 && (
        <ul className="space-y-3">
          {agenda.data.map((a) => (
            <AgendamentoCard
              key={a.id}
              agendamento={a}
              mostrarCliente
              acoes={[
                // A regra de quando concluir vem do backend; a tela só obedece.
                ...(a.podeConcluir ? [{ status: 'concluido' as const, rotulo: 'Concluir' }] : []),
                ...(a.podeCancelar ? [{ status: 'cancelado' as const, rotulo: 'Cancelar', perigo: true }] : []),
              ]}
              aoAlterar={(status) => alterar.mutate({ id: a.id, status })}
              ocupado={alterar.isPending}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function Servicos() {
  const qc = useQueryClient();
  const servicos = useQuery({ queryKey: ['servicos'], queryFn: api.listarServicos });
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [preco, setPreco] = useState('');

  const criar = useMutation({
    mutationFn: api.criarServico,
    onSuccess: () => {
      setNome('');
      setDescricao('');
      setPreco('');
      qc.invalidateQueries({ queryKey: ['servicos'] });
    },
  });
  const remover = useMutation({
    mutationFn: api.removerServico,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['servicos'] }),
  });

  function enviar(e: FormEvent) {
    e.preventDefault();
    const precoCentavos = Math.round(Number(preco.replace(',', '.')) * 100);
    criar.mutate({ nome, descricao, precoCentavos });
  }

  const campo = 'w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2';

  return (
    <section aria-labelledby="titulo-servicos-adm" className="space-y-4">
      <h2 id="titulo-servicos-adm" className="font-display text-2xl">
        Serviços
      </h2>

      <form onSubmit={enviar} className="grid gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 sm:grid-cols-[1fr_2fr_8rem_auto]">
        <label className="text-sm">
          Nome
          <input required minLength={2} value={nome} onChange={(e) => setNome(e.target.value)} className={campo} />
        </label>
        <label className="text-sm">
          Descrição
          <input value={descricao} maxLength={200} onChange={(e) => setDescricao(e.target.value)} className={campo} />
        </label>
        <label className="text-sm">
          Preço (R$)
          <input
            required
            inputMode="decimal"
            pattern="^\d+([.,]\d{1,2})?$"
            value={preco}
            onChange={(e) => setPreco(e.target.value)}
            className={campo}
          />
        </label>
        <button
          disabled={criar.isPending}
          className="self-end rounded-lg bg-amber-400 px-4 py-2 font-semibold text-zinc-950 disabled:opacity-50"
        >
          {criar.isPending ? 'Salvando...' : 'Adicionar'}
        </button>
      </form>

      {criar.isError && <Aviso tipo="erro">{criar.error.message}</Aviso>}
      {remover.isError && <Aviso tipo="erro">{remover.error.message}</Aviso>}
      {servicos.isPending && <Carregando />}
      {servicos.data && (
        <ul className="divide-y divide-zinc-800 rounded-xl border border-zinc-800">
          {servicos.data.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-4 p-4">
              <span>
                {s.nome} <span className="text-zinc-500">· {formatarPreco(s.precoCentavos)}</span>
              </span>
              <button
                disabled={remover.isPending}
                onClick={() => remover.mutate(s.id)}
                className="text-sm text-zinc-400 hover:text-red-300"
                aria-label={`Remover serviço ${s.nome}`}
              >
                Remover
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

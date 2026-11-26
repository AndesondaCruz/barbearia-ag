import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { AgendamentoCard } from '../components/AgendamentoCard';
import { Aviso, Carregando, Erro, Vazio } from '../components/Feedback';
import { api, type StatusAgendamento } from '../lib/api';
import { formatarMes, formatarPreco, hojeIso, mesAtual } from '../lib/format';

/** Área do barbeiro: agenda do dia e catálogo de serviços. */
export function Painel() {
  return (
    <div className="space-y-12">
      <Agenda />
      <Ganhos />
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
      qc.invalidateQueries({ queryKey: ['ganhos'] });
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

function Cartao({ rotulo, valor, destaque, detalhe }: { rotulo: string; valor: string; destaque?: boolean; detalhe?: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <p className="text-xs uppercase text-zinc-500">{rotulo}</p>
      <p className={`font-display text-2xl ${destaque ? 'text-amber-400' : ''}`}>{valor}</p>
      {detalhe && <p className="mt-1 text-xs text-zinc-500">{detalhe}</p>}
    </div>
  );
}

/** Relatório mensal: o que já entrou (concluídos) separado do que ainda está previsto. */
function Ganhos() {
  const [mes, setMes] = useState(mesAtual());
  const ganhos = useQuery({ queryKey: ['ganhos', mes], queryFn: () => api.ganhosDoMes(mes), enabled: Boolean(mes) });
  const g = ganhos.data;
  const maiorServico = Math.max(1, ...(g?.porServico.map((s) => s.totalCentavos) ?? [1]));

  return (
    <section aria-labelledby="titulo-ganhos" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 id="titulo-ganhos" className="font-display text-2xl">
          Ganhos do mês
        </h2>
        <label className="text-sm text-zinc-400">
          Mês{' '}
          <input
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="ml-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 [color-scheme:dark]"
          />
        </label>
      </div>

      {ganhos.isPending && <Carregando texto="Calculando ganhos..." />}
      {ganhos.isError && <Erro mensagem={ganhos.error.message} tentarNovamente={() => ganhos.refetch()} />}
      {g && (
        <>
          <p className="text-sm capitalize text-zinc-400">{formatarMes(g.mes)}</p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Cartao
              rotulo="Recebido"
              valor={formatarPreco(g.recebidoCentavos)}
              destaque
              detalhe={`${g.atendimentosConcluidos} atendimento(s) concluído(s)`}
            />
            <Cartao rotulo="Ticket médio" valor={formatarPreco(g.ticketMedioCentavos)} />
            <Cartao
              rotulo="A receber"
              valor={formatarPreco(g.previstoCentavos)}
              detalhe={`${g.atendimentosPendentes} agendamento(s) confirmado(s)`}
            />
            <Cartao rotulo="Cancelados" valor={String(g.cancelados)} />
          </div>

          {g.porServico.length === 0 ? (
            <Vazio titulo="Nenhum atendimento concluído neste mês">
              Os ganhos aparecem quando os atendimentos são marcados como concluídos na agenda.
            </Vazio>
          ) : (
            <div className="rounded-xl border border-zinc-800 p-4">
              <h3 className="mb-3 text-sm font-semibold text-zinc-300">Por serviço</h3>
              <ul className="space-y-3">
                {g.porServico.map((s) => (
                  <li key={s.servico}>
                    <div className="flex justify-between text-sm">
                      <span>
                        {s.servico} <span className="text-zinc-500">· {s.quantidade}x</span>
                      </span>
                      <span className="text-amber-400">{formatarPreco(s.totalCentavos)}</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-zinc-800" aria-hidden="true">
                      <div
                        className="h-2 rounded-full bg-amber-400"
                        style={{ width: `${(s.totalCentavos / maiorServico) * 100}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
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
  const [opcoes, setOpcoes] = useState('');

  const criar = useMutation({
    mutationFn: api.criarServico,
    onSuccess: () => {
      setNome('');
      setDescricao('');
      setPreco('');
      setOpcoes('');
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
    const lista = opcoes.split(',').map((o) => o.trim()).filter(Boolean);
    criar.mutate({ nome, descricao, precoCentavos, opcoes: lista.length ? lista : undefined });
  }

  const campo = 'w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2';

  return (
    <section aria-labelledby="titulo-servicos-adm" className="space-y-4">
      <h2 id="titulo-servicos-adm" className="font-display text-2xl">
        Serviços
      </h2>

      <form onSubmit={enviar} className="grid gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 sm:grid-cols-[1fr_2fr_8rem_auto]">
        <label className="text-sm sm:col-span-4">
          Opções para o cliente escolher (opcional, separadas por vírgula)
          <input
            value={opcoes}
            onChange={(e) => setOpcoes(e.target.value)}
            placeholder="Ex.: Tesoura, Máquina"
            className={campo}
          />
        </label>
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
                {s.opcoes && <span className="ml-2 text-xs text-zinc-500">({s.opcoes.join(' / ')})</span>}
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

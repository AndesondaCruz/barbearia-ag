import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Aviso, Carregando, Erro, Vazio } from '../components/Feedback';
import { api, type Agendamento } from '../lib/api';
import type { UsuarioSessao } from '../lib/auth';
import { formatarData, formatarPreco, hojeIso } from '../lib/format';

interface Props {
  usuario: UsuarioSessao | null;
  entrar: () => void;
  verMeusHorarios: () => void;
}

export function Agendar({ usuario, entrar, verMeusHorarios }: Props) {
  const qc = useQueryClient();
  const [servicoId, setServicoId] = useState('');
  const [data, setData] = useState(hojeIso());
  const [hora, setHora] = useState('');
  const [confirmado, setConfirmado] = useState<Agendamento | null>(null);

  const servicos = useQuery({ queryKey: ['servicos'], queryFn: api.listarServicos });
  const disponibilidade = useQuery({
    queryKey: ['disponibilidade', data],
    queryFn: () => api.disponibilidade(data),
    enabled: Boolean(data),
  });

  const agendar = useMutation({
    mutationFn: api.criarAgendamento,
    onSuccess: (novo) => {
      setConfirmado(novo);
      setHora('');
      qc.invalidateQueries({ queryKey: ['disponibilidade'] });
      qc.invalidateQueries({ queryKey: ['agendamentos'] });
    },
    // Se outra pessoa reservou o horário, atualiza a grade.
    onError: () => qc.invalidateQueries({ queryKey: ['disponibilidade', data] }),
  });

  if (confirmado) {
    return (
      <div className="space-y-4">
        <Aviso tipo="sucesso">
          <p className="font-semibold">Agendamento confirmado!</p>
          <p className="mt-1 capitalize">
            {confirmado.servicoNome} · {formatarData(confirmado.data)} às {confirmado.hora}
          </p>
        </Aviso>
        <div className="flex gap-3">
          <button onClick={verMeusHorarios} className="rounded-lg bg-amber-400 px-4 py-2 font-semibold text-zinc-950">
            Ver meus horários
          </button>
          <button onClick={() => setConfirmado(null)} className="rounded-lg border border-zinc-700 px-4 py-2">
            Agendar outro
          </button>
        </div>
      </div>
    );
  }

  const servicoEscolhido = servicos.data?.find((s) => s.id === servicoId);
  const podeConfirmar = Boolean(usuario && servicoId && data && hora) && !agendar.isPending;

  return (
    <div className="space-y-8">
      <h1 className="font-display text-3xl">Agendar horário</h1>

      <fieldset>
        <legend className="mb-3 font-semibold">1. Escolha o serviço</legend>
        {servicos.isPending && <Carregando />}
        {servicos.isError && <Erro mensagem={servicos.error.message} tentarNovamente={() => servicos.refetch()} />}
        <div className="grid gap-3 sm:grid-cols-2">
          {servicos.data?.map((s) => (
            <label
              key={s.id}
              className={`flex cursor-pointer items-center justify-between rounded-xl border p-4 ${
                servicoId === s.id ? 'border-amber-400 bg-amber-400/10' : 'border-zinc-800 bg-zinc-900 hover:border-zinc-600'
              }`}
            >
              <span className="flex items-center gap-3">
                <input
                  type="radio"
                  name="servico"
                  value={s.id}
                  checked={servicoId === s.id}
                  onChange={() => setServicoId(s.id)}
                  className="accent-amber-400"
                />
                {s.nome}
              </span>
              <span className="text-amber-400">{formatarPreco(s.precoCentavos)}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="data" className="mb-3 block font-semibold">
          2. Escolha o dia
        </label>
        <input
          id="data"
          type="date"
          value={data}
          min={hojeIso()}
          max={hojeIso(30)}
          onChange={(e) => {
            setData(e.target.value);
            setHora('');
          }}
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 [color-scheme:dark]"
        />
      </div>

      <fieldset>
        <legend className="mb-3 font-semibold">3. Escolha o horário</legend>
        {disponibilidade.isPending && <Carregando texto="Buscando horários livres..." />}
        {disponibilidade.isError && (
          <Erro mensagem={disponibilidade.error.message} tentarNovamente={() => disponibilidade.refetch()} />
        )}
        {disponibilidade.data && !disponibilidade.data.aberto && (
          <Vazio titulo="Dia indisponível">{disponibilidade.data.motivo}</Vazio>
        )}
        {disponibilidade.data?.aberto && disponibilidade.data.horarios.length === 0 && (
          <Vazio titulo="Nenhum horário livre neste dia">Tente outra data.</Vazio>
        )}
        {disponibilidade.data?.aberto && disponibilidade.data.horarios.length > 0 && (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-9">
            {disponibilidade.data.horarios.map((h) => (
              <button
                key={h}
                type="button"
                aria-pressed={hora === h}
                onClick={() => setHora(h)}
                className={`rounded-lg border py-2 text-sm font-semibold ${
                  hora === h
                    ? 'border-amber-400 bg-amber-400 text-zinc-950'
                    : 'border-zinc-700 bg-zinc-900 hover:border-amber-400'
                }`}
              >
                {h}
              </button>
            ))}
          </div>
        )}
      </fieldset>

      {agendar.isError && <Aviso tipo="erro">{agendar.error.message}</Aviso>}

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        {servicoEscolhido && hora ? (
          <p className="capitalize text-zinc-300">
            {servicoEscolhido.nome} · {formatarData(data)} às {hora}
          </p>
        ) : (
          <p className="text-zinc-500">Selecione serviço, dia e horário.</p>
        )}
        {usuario ? (
          <button
            disabled={!podeConfirmar}
            onClick={() => agendar.mutate({ servicoId, data, hora, clienteNome: usuario.nome })}
            className="mt-4 rounded-lg bg-amber-400 px-6 py-3 font-semibold text-zinc-950 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {agendar.isPending ? 'Confirmando...' : 'Confirmar agendamento'}
          </button>
        ) : (
          <button onClick={entrar} className="mt-4 rounded-lg bg-amber-400 px-6 py-3 font-semibold text-zinc-950">
            Entrar para confirmar
          </button>
        )}
      </div>
    </div>
  );
}

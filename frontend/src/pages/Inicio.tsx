import { useQuery } from '@tanstack/react-query';
import { Carregando, Erro, Vazio } from '../components/Feedback';
import { api } from '../lib/api';
import { formatarPreco } from '../lib/format';

export function Inicio({ irParaAgendar }: { irParaAgendar: () => void }) {
  const servicos = useQuery({ queryKey: ['servicos'], queryFn: api.listarServicos });

  return (
    <div className="space-y-12">
      <section className="rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-950 p-8 sm:p-12">
        <p className="text-sm uppercase tracking-[0.3em] text-amber-400">Agendamento online</p>
        <h1 className="mt-3 font-display text-4xl sm:text-5xl">Seu horário, sem fila.</h1>
        <p className="mt-4 max-w-xl text-zinc-400">
          Escolha o serviço, veja os horários livres em tempo real e confirme em poucos cliques.
          Atendemos de segunda a sábado, das 9h às 18h.
        </p>
        <button
          onClick={irParaAgendar}
          className="mt-8 rounded-lg bg-amber-400 px-6 py-3 font-semibold text-zinc-950 hover:bg-amber-300"
        >
          Agendar horário
        </button>
      </section>

      <section aria-labelledby="titulo-servicos">
        <h2 id="titulo-servicos" className="font-display text-2xl">
          Serviços
        </h2>
        <div className="mt-4">
          {servicos.isPending && <Carregando texto="Carregando serviços..." />}
          {servicos.isError && <Erro mensagem={servicos.error.message} tentarNovamente={() => servicos.refetch()} />}
          {servicos.data?.length === 0 && <Vazio titulo="Nenhum serviço cadastrado ainda" />}
          {servicos.data && servicos.data.length > 0 && (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {servicos.data.map((s) => (
                <li key={s.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="font-semibold">{s.nome}</h3>
                    <span className="font-display text-lg text-amber-400">{formatarPreco(s.precoCentavos)}</span>
                  </div>
                  <p className="mt-2 text-sm text-zinc-400">{s.descricao}</p>
                  <p className="mt-3 text-xs text-zinc-500">
                    {s.duracaoMinutos} min{s.opcoes && ` · ${s.opcoes.join(' ou ')}`}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

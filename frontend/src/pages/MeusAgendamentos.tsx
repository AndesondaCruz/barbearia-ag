import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AgendamentoCard } from '../components/AgendamentoCard';
import { Aviso, Carregando, Erro, Vazio } from '../components/Feedback';
import { api } from '../lib/api';

export function MeusAgendamentos({ irParaAgendar }: { irParaAgendar: () => void }) {
  const qc = useQueryClient();
  const lista = useQuery({ queryKey: ['agendamentos', 'meus'], queryFn: () => api.listarAgendamentos() });
  const cancelar = useMutation({
    mutationFn: (id: string) => api.alterarStatus(id, 'cancelado'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agendamentos'] });
      qc.invalidateQueries({ queryKey: ['disponibilidade'] });
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl">Meus horários</h1>
      {cancelar.isError && <Aviso tipo="erro">{cancelar.error.message}</Aviso>}
      {lista.isPending && <Carregando />}
      {lista.isError && <Erro mensagem={lista.error.message} tentarNovamente={() => lista.refetch()} />}
      {lista.data?.length === 0 && (
        <Vazio titulo="Você ainda não tem agendamentos">
          <button onClick={irParaAgendar} className="font-semibold text-amber-400 underline">
            Agendar agora
          </button>
        </Vazio>
      )}
      {lista.data && lista.data.length > 0 && (
        <ul className="space-y-3">
          {lista.data.map((a) => (
            <AgendamentoCard
              key={a.id}
              agendamento={a}
              acoes={a.podeCancelar ? [{ status: 'cancelado', rotulo: 'Cancelar', perigo: true }] : []}
              aoAlterar={() => cancelar.mutate(a.id)}
              ocupado={cancelar.isPending}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

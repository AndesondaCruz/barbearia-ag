import { useEffect, useState } from 'react';
import { Carregando, Erro } from './components/Feedback';
import { iniciarLogin, processarRetornoLogin, sair, usuarioAtual, type UsuarioSessao } from './lib/auth';
import { Agendar } from './pages/Agendar';
import { Inicio } from './pages/Inicio';
import { MeusAgendamentos } from './pages/MeusAgendamentos';
import { Painel } from './pages/Painel';

type Pagina = 'inicio' | 'agendar' | 'meus' | 'painel';

export function App() {
  const [pagina, setPagina] = useState<Pagina>('inicio');
  const [usuario, setUsuario] = useState<UsuarioSessao | null>(usuarioAtual);
  const [processandoLogin, setProcessandoLogin] = useState(true);
  const [erroLogin, setErroLogin] = useState<string | null>(null);

  useEffect(() => {
    processarRetornoLogin()
      .then((logou) => {
        if (logou) {
          setUsuario(usuarioAtual());
          setPagina('agendar');
        }
      })
      .catch((e: Error) => setErroLogin(e.message))
      .finally(() => setProcessandoLogin(false));
  }, []);

  const entrar = () => void iniciarLogin();

  const abas: { id: Pagina; rotulo: string; visivel: boolean }[] = [
    { id: 'inicio', rotulo: 'Início', visivel: true },
    { id: 'agendar', rotulo: 'Agendar', visivel: true },
    { id: 'meus', rotulo: 'Meus horários', visivel: Boolean(usuario) },
    { id: 'painel', rotulo: 'Painel do barbeiro', visivel: Boolean(usuario?.isBarbeiro) },
  ];

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 py-5">
        <button onClick={() => setPagina('inicio')} className="font-display text-2xl">
          Barbearia <span className="text-amber-400">Navalha</span>
        </button>
        <div className="flex items-center gap-3 text-sm">
          {usuario ? (
            <>
              <span className="text-zinc-400">
                Olá, <span className="text-zinc-100">{usuario.nome.split(' ')[0]}</span>
                {usuario.isBarbeiro && <span className="ml-2 rounded bg-amber-400/15 px-2 py-0.5 text-amber-300">barbeiro</span>}
              </span>
              <button onClick={sair} className="rounded-lg border border-zinc-700 px-3 py-1.5 hover:border-zinc-500">
                Sair
              </button>
            </>
          ) : (
            <button onClick={entrar} className="rounded-lg bg-amber-400 px-4 py-2 font-semibold text-zinc-950 hover:bg-amber-300">
              Entrar / Criar conta
            </button>
          )}
        </div>
        <nav aria-label="Principal" className="w-full">
          <ul className="flex gap-1 overflow-x-auto">
            {abas
              .filter((a) => a.visivel)
              .map((a) => (
                <li key={a.id}>
                  <button
                    onClick={() => setPagina(a.id)}
                    aria-current={pagina === a.id ? 'page' : undefined}
                    className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm ${
                      pagina === a.id ? 'bg-zinc-800 text-amber-400' : 'text-zinc-400 hover:text-zinc-100'
                    }`}
                  >
                    {a.rotulo}
                  </button>
                </li>
              ))}
          </ul>
        </nav>
      </header>

      <main className="flex-1 py-10">
        {processandoLogin ? (
          <Carregando texto="Verificando sessão..." />
        ) : (
          <>
            {erroLogin && (
              <div className="mb-6">
                <Erro mensagem={erroLogin} />
              </div>
            )}
            {pagina === 'inicio' && <Inicio irParaAgendar={() => setPagina('agendar')} />}
            {pagina === 'agendar' && (
              <Agendar usuario={usuario} entrar={entrar} verMeusHorarios={() => setPagina('meus')} />
            )}
            {pagina === 'meus' && usuario && <MeusAgendamentos irParaAgendar={() => setPagina('agendar')} />}
            {pagina === 'painel' && usuario?.isBarbeiro && <Painel />}
          </>
        )}
      </main>

      <footer className="border-t border-zinc-800 py-6 text-center text-xs text-zinc-500">
        Projeto final de Sistemas Distribuídos · UFERSA · Andeson da Cruz de Almeida
      </footer>
    </div>
  );
}

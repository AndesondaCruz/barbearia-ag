import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ApiError } from './lib/api';
import { carregarConfig } from './lib/config';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      // Não insiste em erros de cliente (4xx); tenta de novo só em falhas de rede/servidor.
      retry: (tentativas, erro) => !(erro instanceof ApiError && erro.status >= 400 && erro.status < 500) && tentativas < 2,
    },
  },
});

const raiz = createRoot(document.getElementById('root')!);

carregarConfig()
  .then(() =>
    raiz.render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </StrictMode>,
    ),
  )
  .catch(() =>
    raiz.render(
      <p role="alert" className="p-8 text-red-300">
        Não foi possível iniciar a aplicação (configuração ausente).
      </p>,
    ),
  );

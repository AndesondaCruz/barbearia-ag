# Barbearia Navalha

Sistema de agendamento online para uma barbearia, desenvolvido como projeto final da disciplina de **Sistemas Distribuídos** (UFERSA).

- Aplicação: https://andeson.grupo-02.sd.ufersa.dev.br
- API: https://api.andeson.grupo-02.sd.ufersa.dev.br

## Funcionalidades

| Perfil | O que pode fazer |
|---|---|
| Visitante | Ver serviços e preços; consultar horários livres de qualquer dia |
| Cliente (logado) | Agendar um horário; ver e cancelar os próprios agendamentos |
| Barbeiro (grupo `barbeiro`) | Ver a agenda de qualquer dia com o total previsto; concluir ou cancelar atendimentos; cadastrar e remover serviços |

## Arquitetura em três camadas

```
 Navegador
    │  HTTPS
    ▼
┌───────────────────────────┐   login (Authorization Code + PKCE)   ┌──────────────────────┐
│ APRESENTAÇÃO              │ ────────────────────────────────────▶ │ Amazon Cognito       │
│ React + TypeScript        │ ◀──────── access_token (JWT) ──────── │ User Pool + login    │
│ AWS Amplify Hosting       │                                       │ hospedado            │
│ andeson.grupo-02...       │                                       └──────────▲───────────┘
└────────────┬──────────────┘                                                  │ chaves públicas (JWKS)
             │ REST/JSON + Authorization: Bearer <access_token>                │
             ▼                                                                 │
┌───────────────────────────┐                                                  │
│ NEGÓCIOS                  │  autorizador JWT valida assinatura, emissor, ────┘
│ API Gateway (HTTP API)    │  expiração e client_id antes de chamar a Lambda
│ api.andeson.grupo-02...   │
│ AWS Lambda (Node.js/TS)   │  regras: grade de horários, reserva sem conflito,
│  handlers → services      │  cliente só acessa os próprios agendamentos,
│           → repositories  │  ações de barbeiro exigem o grupo "barbeiro"
└────────────┬──────────────┘
             ▼
┌───────────────────────────┐
│ DADOS                     │  barbearia-servicos      (PK: id)
│ Amazon DynamoDB           │  barbearia-agendamentos  (PK: data, SK: hora; GSI: clienteId)
└───────────────────────────┘
```

### Decisões de projeto

- **Reserva sem conflito garantida pelo banco**: a chave do agendamento é `data + hora`. A gravação usa uma escrita condicional (`attribute_not_exists OR status = cancelado`), então duas pessoas clicando no mesmo horário ao mesmo tempo não geram reserva dupla: a segunda recebe `409 Conflict`.
- **Autenticação x autorização**: o API Gateway autentica (valida o JWT do Cognito). A Lambda autoriza com base nas claims: `sub` identifica o dono do agendamento e `cognito:groups` define se a pessoa é barbeiro.
- **Recursos públicos e protegidos**: `GET /servicos` e `GET /disponibilidade` são públicos para o visitante consultar antes de criar conta. Todas as outras rotas exigem token.
- **Configuração em tempo de execução**: o front-end lê `/config.json`, gerado na implantação. O mesmo build funciona em qualquer ambiente.

## API (estilo baseado em recursos)

| Método | Recurso | Acesso | Descrição |
|---|---|---|---|
| GET | `/servicos` | público | Lista os serviços |
| POST | `/servicos` | barbeiro | Cadastra um serviço |
| DELETE | `/servicos/{id}` | barbeiro | Remove um serviço |
| GET | `/disponibilidade?data=YYYY-MM-DD` | público | Horários livres do dia |
| GET | `/me` | autenticado | Perfil do usuário (cliente ou barbeiro) |
| GET | `/agendamentos?data=` | autenticado | Cliente: os seus. Barbeiro: todos |
| POST | `/agendamentos` | autenticado | Cria um agendamento |
| GET | `/agendamentos/{id}` | dono ou barbeiro | Detalhe de um agendamento |
| PATCH | `/agendamentos/{id}` | dono (cancelar) ou barbeiro | Altera o status |

Códigos de resposta: `200`, `201`, `204`, `400` (validação), `401` (sem token válido), `403` (perfil sem permissão), `404`, `409` (horário ocupado).

## Estrutura

```
backend/   Lambda (handlers, services, repositories) e testes das regras de negócio
frontend/  React + Vite + Tailwind + TanStack Query
infra/     Scripts de implantação para o AWS CloudShell
```

## Implantação (AWS CloudShell)

```bash
git clone https://github.com/AndesondaCruz/barbearia-ag.git && cd barbearia-ag
bash infra/deploy.sh            # dados, Cognito, API, domínio da API e front-end
bash infra/07-app-dominio.sh    # domínio raiz do app (move o site andreza para andreza.<dominio>)
bash infra/promover-barbeiro.sh email@exemplo.com
```

## Desenvolvimento local

```bash
cd backend && npm install && npm test
cd frontend && npm install && npm run dev   # requer frontend/public/config.json
```

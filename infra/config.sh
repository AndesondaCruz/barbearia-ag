#!/usr/bin/env bash
# Configuração compartilhada pelos scripts de implantação (executar no AWS CloudShell).
set -euo pipefail
export AWS_PAGER=""
export AWS_DEFAULT_REGION=us-east-1

REGIAO=us-east-1
DOMINIO_BASE=andeson.grupo-02.sd.ufersa.dev.br
APP_DOMINIO=$DOMINIO_BASE
API_DOMINIO=api.$DOMINIO_BASE

TABELA_SERVICOS=barbearia-servicos
TABELA_AGENDAMENTOS=barbearia-agendamentos
COGNITO_PREFIXO=barbearia-andeson-2024010296
LAMBDA_NOME=barbearia-api
API_NOME=barbearia-api
AMPLIFY_APP=barbearia-web
AMPLIFY_BRANCH=main
ANDREZA_APP=andreza-homenagem

RAIZ=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)

# Estado local (IDs criados) para os scripts poderem ser executados de novo sem duplicar recursos.
ESTADO=$RAIZ/infra/.estado
touch "$ESTADO"
# shellcheck disable=SC1090
source "$ESTADO"

salvar() {
  grep -v "^$1=" "$ESTADO" > "$ESTADO.tmp" || true
  echo "$1=$2" >> "$ESTADO.tmp"
  mv "$ESTADO.tmp" "$ESTADO"
  export "$1=$2"
}

log() { echo; echo "==> $*"; }

conta_id() { aws sts get-caller-identity --query Account --output text; }
role_arn() { aws iam get-role --role-name LabRole --query Role.Arn --output text; }
zona_id() { aws route53 list-hosted-zones-by-name --dns-name "$DOMINIO_BASE" --query 'HostedZones[0].Id' --output text; }

cognito_url() { echo "https://$COGNITO_PREFIXO.auth.$REGIAO.amazoncognito.com"; }

# Origens permitidas (CORS) e URLs de retorno do login.
origens() {
  local lista=("https://$APP_DOMINIO" "http://localhost:5173")
  [ -n "${AMPLIFY_ID:-}" ] && lista+=("https://$AMPLIFY_BRANCH.$AMPLIFY_ID.amplifyapp.com")
  echo "${lista[@]}"
}

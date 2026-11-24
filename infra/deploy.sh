#!/usr/bin/env bash
# Implantação completa, exceto a troca do domínio raiz (07-app-dominio.sh),
# que mexe em outro app e é executada separadamente.
set -euo pipefail
DIR=$(dirname "$0")
bash "$DIR/01-dados.sh"
bash "$DIR/02-frontend-app.sh"
bash "$DIR/03-auth.sh"
bash "$DIR/04-api.sh"
bash "$DIR/05-api-dominio.sh"
bash "$DIR/06-frontend-deploy.sh"
echo
echo "Pronto. Próximo passo: bash infra/07-app-dominio.sh"

#!/usr/bin/env bash
# Coloca um usuário já cadastrado no grupo "barbeiro" (acesso ao painel).
# Uso: bash infra/promover-barbeiro.sh email@exemplo.com
source "$(dirname "$0")/config.sh"

EMAIL=${1:?Informe o e-mail do usuário}
aws cognito-idp admin-add-user-to-group --user-pool-id "$POOL_ID" --username "$EMAIL" --group-name barbeiro
echo "$EMAIL agora é barbeiro. Saia e entre de novo no site para o novo perfil valer."

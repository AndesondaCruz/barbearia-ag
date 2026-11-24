#!/usr/bin/env bash
# Cria o app Amplify (ainda vazio) para já conhecer a URL padrão dele,
# que entra no CORS da API e nas URLs de retorno do Cognito.
source "$(dirname "$0")/config.sh"

if [ -z "${AMPLIFY_ID:-}" ]; then
  log "Criando app Amplify $AMPLIFY_APP"
  ID=$(aws amplify create-app --name "$AMPLIFY_APP" --platform WEB --query app.appId --output text)
  salvar AMPLIFY_ID "$ID"
  aws amplify create-branch --app-id "$AMPLIFY_ID" --branch-name "$AMPLIFY_BRANCH" --stage PRODUCTION > /dev/null
fi

echo "App Amplify: $AMPLIFY_ID (https://$AMPLIFY_BRANCH.$AMPLIFY_ID.amplifyapp.com)"

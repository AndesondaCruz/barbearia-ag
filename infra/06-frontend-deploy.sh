#!/usr/bin/env bash
# Camada de apresentação: build do React e implantação manual no Amplify.
source "$(dirname "$0")/config.sh"

log "Compilando o front-end"
( cd "$RAIZ/frontend" && npm ci --no-audit --no-fund --silent && npm run build --silent )

# Configuração lida pelo navegador em tempo de execução (não contém segredos).
cat > "$RAIZ/frontend/dist/config.json" <<JSON
{
  "apiUrl": "https://$API_DOMINIO",
  "cognitoDomain": "$(cognito_url)",
  "clientId": "$CLIENT_ID"
}
JSON

( cd "$RAIZ/frontend/dist" && rm -f ../site.zip && zip -q -r ../site.zip . )

log "Enviando para o Amplify"
read -r JOB URL_UPLOAD <<< "$(aws amplify create-deployment --app-id "$AMPLIFY_ID" --branch-name "$AMPLIFY_BRANCH" \
  --query '[jobId,zipUploadUrl]' --output text)"
curl -sSf -T "$RAIZ/frontend/site.zip" "$URL_UPLOAD"
aws amplify start-deployment --app-id "$AMPLIFY_ID" --branch-name "$AMPLIFY_BRANCH" --job-id "$JOB" > /dev/null

STATUS=PENDING
while [ "$STATUS" != "SUCCEED" ] && [ "$STATUS" != "FAILED" ]; do
  sleep 5
  STATUS=$(aws amplify get-job --app-id "$AMPLIFY_ID" --branch-name "$AMPLIFY_BRANCH" --job-id "$JOB" \
    --query job.summary.status --output text)
  echo "  status: $STATUS"
done
[ "$STATUS" = "SUCCEED" ] || { echo "Falha na implantação"; exit 1; }

echo "Front-end publicado em https://$AMPLIFY_BRANCH.$AMPLIFY_ID.amplifyapp.com"

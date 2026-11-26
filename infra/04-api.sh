#!/usr/bin/env bash
# Camada de negócios: Lambda + API Gateway HTTP com autorizador JWT do Cognito.
source "$(dirname "$0")/config.sh"

log "Compilando a Lambda"
( cd "$RAIZ/backend" && npm ci --no-audit --no-fund --silent && npm test --silent && npm run build --silent )
( cd "$RAIZ/backend/dist" && rm -f ../lambda.zip && zip -q ../lambda.zip index.js )

AMBIENTE="Variables={TABELA_SERVICOS=$TABELA_SERVICOS,TABELA_AGENDAMENTOS=$TABELA_AGENDAMENTOS}"

if aws lambda get-function --function-name "$LAMBDA_NOME" > /dev/null 2>&1; then
  log "Atualizando código da Lambda"
  aws lambda update-function-code --function-name "$LAMBDA_NOME" --zip-file "fileb://$RAIZ/backend/lambda.zip" > /dev/null
  aws lambda wait function-updated --function-name "$LAMBDA_NOME"
else
  log "Criando Lambda (role LabRole)"
  aws lambda create-function --function-name "$LAMBDA_NOME" \
    --runtime nodejs20.x --handler index.handler --role "$(role_arn)" \
    --timeout 10 --memory-size 256 --environment "$AMBIENTE" \
    --zip-file "fileb://$RAIZ/backend/lambda.zip" > /dev/null
  aws lambda wait function-active --function-name "$LAMBDA_NOME"
fi
LAMBDA_ARN=$(aws lambda get-function --function-name "$LAMBDA_NOME" --query Configuration.FunctionArn --output text)

# CORS: só o front-end da barbearia (e o ambiente local) podem chamar a API pelo navegador.
read -r -a ORIGENS <<< "$(origens)"
ORIGENS_JSON=$(printf '"%s",' "${ORIGENS[@]}")
CORS="{\"AllowOrigins\":[${ORIGENS_JSON%,}],\"AllowMethods\":[\"GET\",\"POST\",\"PATCH\",\"DELETE\",\"OPTIONS\"],\"AllowHeaders\":[\"authorization\",\"content-type\"],\"MaxAge\":300}"

if [ -z "${API_ID:-}" ]; then
  log "Criando HTTP API"
  ID=$(aws apigatewayv2 create-api --name "$API_NOME" --protocol-type HTTP \
    --cors-configuration "$CORS" --query ApiId --output text)
  salvar API_ID "$ID"

  INTEGRACAO=$(aws apigatewayv2 create-integration --api-id "$API_ID" --integration-type AWS_PROXY \
    --integration-uri "$LAMBDA_ARN" --payload-format-version 2.0 --query IntegrationId --output text)
  salvar INTEGRACAO_ID "$INTEGRACAO"

  # O autorizador valida assinatura, emissor (User Pool), expiração e client_id do access_token.
  AUTORIZADOR=$(aws apigatewayv2 create-authorizer --api-id "$API_ID" --name cognito-jwt \
    --authorizer-type JWT --identity-source '$request.header.Authorization' \
    --jwt-configuration "Audience=$CLIENT_ID,Issuer=https://cognito-idp.$REGIAO.amazonaws.com/$POOL_ID" \
    --query AuthorizerId --output text)
  salvar AUTORIZADOR_ID "$AUTORIZADOR"

  aws apigatewayv2 create-stage --api-id "$API_ID" --stage-name '$default' --auto-deploy > /dev/null
  aws lambda add-permission --function-name "$LAMBDA_NOME" --statement-id apigw-barbearia \
    --action lambda:InvokeFunction --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:$REGIAO:$(conta_id):$API_ID/*" > /dev/null
else
  log "Atualizando CORS da API"
  aws apigatewayv2 update-api --api-id "$API_ID" --cors-configuration "$CORS" > /dev/null
fi

# Rotas: cria só as que ainda não existem, então rodar de novo adiciona rotas novas sem duplicar.
ROTAS_PUBLICAS=('GET /servicos' 'GET /disponibilidade')
ROTAS_PROTEGIDAS=('POST /servicos' 'DELETE /servicos/{id}' 'GET /me' 'GET /agendamentos'
                  'POST /agendamentos' 'GET /agendamentos/{id}' 'PATCH /agendamentos/{id}'
                  'GET /relatorios/ganhos')
EXISTENTES=$(aws apigatewayv2 get-routes --api-id "$API_ID" --query 'Items[].RouteKey' --output text | tr '\t' '\n')

log "Sincronizando rotas"
for rota in "${ROTAS_PUBLICAS[@]}"; do
  if ! grep -qxF "$rota" <<< "$EXISTENTES"; then
    aws apigatewayv2 create-route --api-id "$API_ID" --route-key "$rota" \
      --target "integrations/$INTEGRACAO_ID" > /dev/null
    echo "  publica (nova):   $rota"
  fi
done
for rota in "${ROTAS_PROTEGIDAS[@]}"; do
  if ! grep -qxF "$rota" <<< "$EXISTENTES"; then
    aws apigatewayv2 create-route --api-id "$API_ID" --route-key "$rota" \
      --target "integrations/$INTEGRACAO_ID" \
      --authorization-type JWT --authorizer-id "$AUTORIZADOR_ID" > /dev/null
    echo "  protegida (nova): $rota"
  fi
done

echo "API: https://$API_ID.execute-api.$REGIAO.amazonaws.com"

#!/usr/bin/env bash
# Camada de dados: tabelas DynamoDB e serviços iniciais.
source "$(dirname "$0")/config.sh"

log "Tabela $TABELA_SERVICOS"
if ! aws dynamodb describe-table --table-name "$TABELA_SERVICOS" > /dev/null 2>&1; then
  aws dynamodb create-table \
    --table-name "$TABELA_SERVICOS" \
    --attribute-definitions AttributeName=id,AttributeType=S \
    --key-schema AttributeName=id,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST > /dev/null
fi

log "Tabela $TABELA_AGENDAMENTOS (chave: data + hora; índice por cliente)"
if ! aws dynamodb describe-table --table-name "$TABELA_AGENDAMENTOS" > /dev/null 2>&1; then
  aws dynamodb create-table \
    --table-name "$TABELA_AGENDAMENTOS" \
    --attribute-definitions \
      AttributeName=data,AttributeType=S \
      AttributeName=hora,AttributeType=S \
      AttributeName=clienteId,AttributeType=S \
      AttributeName=id,AttributeType=S \
    --key-schema AttributeName=data,KeyType=HASH AttributeName=hora,KeyType=RANGE \
    --global-secondary-indexes '[{
      "IndexName": "clienteId-index",
      "KeySchema": [{"AttributeName":"clienteId","KeyType":"HASH"},{"AttributeName":"id","KeyType":"RANGE"}],
      "Projection": {"ProjectionType":"ALL"}
    }]' \
    --billing-mode PAY_PER_REQUEST > /dev/null
fi

aws dynamodb wait table-exists --table-name "$TABELA_SERVICOS"
aws dynamodb wait table-exists --table-name "$TABELA_AGENDAMENTOS"

QTD=$(aws dynamodb scan --table-name "$TABELA_SERVICOS" --select COUNT --query Count --output text)
if [ "$QTD" = "0" ]; then
  log "Cadastrando serviços iniciais"
  aws dynamodb batch-write-item --request-items "file://$RAIZ/infra/servicos-iniciais.json" > /dev/null
fi

echo "Camada de dados pronta."

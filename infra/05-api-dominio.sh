#!/usr/bin/env bash
# DNS da API: api.andeson.grupo-02.sd.ufersa.dev.br -> HTTP API da barbearia.
# Se o domínio já existir (de uma atividade anterior), apenas troca o mapeamento.
source "$(dirname "$0")/config.sh"

if aws apigatewayv2 get-domain-name --domain-name "$API_DOMINIO" > /dev/null 2>&1; then
  log "Domínio $API_DOMINIO já existe: trocando o mapeamento para a API da barbearia"
  for m in $(aws apigatewayv2 get-api-mappings --domain-name "$API_DOMINIO" --query 'Items[].ApiMappingId' --output text); do
    ANTIGA=$(aws apigatewayv2 get-api-mapping --domain-name "$API_DOMINIO" --api-mapping-id "$m" --query ApiId --output text)
    if [ "$ANTIGA" != "$API_ID" ]; then
      echo "  removendo mapeamento antigo ($m -> API $ANTIGA)"
      aws apigatewayv2 delete-api-mapping --domain-name "$API_DOMINIO" --api-mapping-id "$m"
    fi
  done
else
  log "Criando certificado e domínio $API_DOMINIO"
  CERT=$(aws acm list-certificates --certificate-statuses ISSUED \
    --query "CertificateSummaryList[?DomainName=='$API_DOMINIO'].CertificateArn | [0]" --output text)
  if [ "$CERT" = "None" ] || [ -z "$CERT" ]; then
    CERT=$(aws acm request-certificate --domain-name "$API_DOMINIO" --validation-method DNS --query CertificateArn --output text)
    NOME=None
    while [ "$NOME" = "None" ]; do
      sleep 5
      NOME=$(aws acm describe-certificate --certificate-arn "$CERT" --query 'Certificate.DomainValidationOptions[0].ResourceRecord.Name' --output text)
    done
    VALOR=$(aws acm describe-certificate --certificate-arn "$CERT" --query 'Certificate.DomainValidationOptions[0].ResourceRecord.Value' --output text)
    aws route53 change-resource-record-sets --hosted-zone-id "$(zona_id)" --change-batch \
      "{\"Changes\":[{\"Action\":\"UPSERT\",\"ResourceRecordSet\":{\"Name\":\"$NOME\",\"Type\":\"CNAME\",\"TTL\":300,\"ResourceRecords\":[{\"Value\":\"$VALOR\"}]}}]}" > /dev/null
    echo "  aguardando validação do certificado..."
    aws acm wait certificate-validated --certificate-arn "$CERT"
  fi
  aws apigatewayv2 create-domain-name --domain-name "$API_DOMINIO" \
    --domain-name-configurations "CertificateArn=$CERT,EndpointType=REGIONAL" > /dev/null
fi

if ! aws apigatewayv2 get-api-mappings --domain-name "$API_DOMINIO" --query 'Items[].ApiId' --output text | grep -q "$API_ID"; then
  aws apigatewayv2 create-api-mapping --domain-name "$API_DOMINIO" --api-id "$API_ID" --stage '$default' > /dev/null
fi

# Registro A (alias) apontando para o endpoint regional do domínio.
read -r ALVO ZONA_ALVO <<< "$(aws apigatewayv2 get-domain-name --domain-name "$API_DOMINIO" \
  --query 'DomainNameConfigurations[0].[ApiGatewayDomainName,HostedZoneId]' --output text)"
aws route53 change-resource-record-sets --hosted-zone-id "$(zona_id)" --change-batch \
  "{\"Changes\":[{\"Action\":\"UPSERT\",\"ResourceRecordSet\":{\"Name\":\"$API_DOMINIO\",\"Type\":\"A\",\"AliasTarget\":{\"HostedZoneId\":\"$ZONA_ALVO\",\"DNSName\":\"$ALVO\",\"EvaluateTargetHealth\":false}}}]}" > /dev/null

echo "API publicada em https://$API_DOMINIO"

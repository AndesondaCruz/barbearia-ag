#!/usr/bin/env bash
# DNS do app: andeson.grupo-02.sd.ufersa.dev.br -> front-end da barbearia.
#
# ATENÇÃO: o domínio raiz estava associado ao app "andreza-homenagem".
# Este script move o site da Andreza para ficar somente em andreza.<dominio>
# e associa o domínio raiz à barbearia. Execute apenas depois de confirmar.
source "$(dirname "$0")/config.sh"

ANDREZA_ID=$(aws amplify list-apps --query "apps[?name=='$ANDREZA_APP'].appId | [0]" --output text)

if [ "$ANDREZA_ID" != "None" ] && aws amplify get-domain-association --app-id "$ANDREZA_ID" --domain-name "$DOMINIO_BASE" > /dev/null 2>&1; then
  BRANCH_ANDREZA=$(aws amplify get-domain-association --app-id "$ANDREZA_ID" --domain-name "$DOMINIO_BASE" \
    --query 'domainAssociation.subDomains[0].subDomainSetting.branchName' --output text)

  log "Removendo associação do domínio raiz do app $ANDREZA_APP ($ANDREZA_ID)"
  aws amplify delete-domain-association --app-id "$ANDREZA_ID" --domain-name "$DOMINIO_BASE" > /dev/null
  while aws amplify get-domain-association --app-id "$ANDREZA_ID" --domain-name "$DOMINIO_BASE" > /dev/null 2>&1; do
    sleep 5
  done

  log "Associando andreza.$DOMINIO_BASE ao app $ANDREZA_APP (branch $BRANCH_ANDREZA)"
  aws amplify create-domain-association --app-id "$ANDREZA_ID" --domain-name "andreza.$DOMINIO_BASE" \
    --sub-domain-settings "[{\"prefix\":\"\",\"branchName\":\"$BRANCH_ANDREZA\"}]" > /dev/null
fi

if ! aws amplify get-domain-association --app-id "$AMPLIFY_ID" --domain-name "$DOMINIO_BASE" > /dev/null 2>&1; then
  log "Associando $DOMINIO_BASE ao app $AMPLIFY_APP"
  aws amplify create-domain-association --app-id "$AMPLIFY_ID" --domain-name "$DOMINIO_BASE" \
    --sub-domain-settings "[{\"prefix\":\"\",\"branchName\":\"$AMPLIFY_BRANCH\"}]" > /dev/null
fi

log "Aguardando os certificados (pode levar de 5 a 20 minutos)"
while true; do
  S1=$(aws amplify get-domain-association --app-id "$AMPLIFY_ID" --domain-name "$DOMINIO_BASE" --query domainAssociation.domainStatus --output text)
  S2=AVAILABLE
  if [ "$ANDREZA_ID" != "None" ]; then
    S2=$(aws amplify get-domain-association --app-id "$ANDREZA_ID" --domain-name "andreza.$DOMINIO_BASE" --query domainAssociation.domainStatus --output text 2>/dev/null || echo AUSENTE)
  fi
  echo "  barbearia: $S1 | andreza: $S2"
  [ "$S1" = "AVAILABLE" ] && [ "$S2" = "AVAILABLE" ] && break
  case "$S1$S2" in *FAILED*) echo "Falha em uma das associações"; exit 1 ;; esac
  sleep 30
done

echo "App: https://$DOMINIO_BASE | Andreza: https://andreza.$DOMINIO_BASE"

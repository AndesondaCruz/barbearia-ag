#!/usr/bin/env bash
# Autenticação: Cognito User Pool (login por e-mail), página de login hospedada,
# cliente público com Authorization Code + PKCE e grupo "barbeiro".
source "$(dirname "$0")/config.sh"

if [ -z "${POOL_ID:-}" ]; then
  log "Criando User Pool"
  ID=$(aws cognito-idp create-user-pool \
    --pool-name barbearia-usuarios \
    --username-attributes email \
    --auto-verified-attributes email \
    --schema Name=name,AttributeDataType=String,Required=true,Mutable=true \
    --policies 'PasswordPolicy={MinimumLength=8,RequireUppercase=true,RequireLowercase=true,RequireNumbers=true,RequireSymbols=false}' \
    --account-recovery-setting 'RecoveryMechanisms=[{Priority=1,Name=verified_email}]' \
    --query UserPool.Id --output text)
  salvar POOL_ID "$ID"
  aws cognito-idp create-user-pool-domain --user-pool-id "$POOL_ID" --domain "$COGNITO_PREFIXO" > /dev/null
  aws cognito-idp create-group --user-pool-id "$POOL_ID" --group-name barbeiro \
    --description "Acesso ao painel do barbeiro" > /dev/null
fi

# As URLs de retorno precisam bater exatamente com window.location.origin + "/".
read -r -a ORIGENS <<< "$(origens)"
CALLBACKS=()
for o in "${ORIGENS[@]}"; do CALLBACKS+=("$o/"); done

CONFIG_CLIENTE=(
  --allowed-o-auth-flows code
  --allowed-o-auth-scopes openid email profile
  --allowed-o-auth-flows-user-pool-client
  --callback-urls "${CALLBACKS[@]}"
  --logout-urls "${CALLBACKS[@]}"
  --supported-identity-providers COGNITO
  --explicit-auth-flows ALLOW_USER_SRP_AUTH ALLOW_REFRESH_TOKEN_AUTH
  --prevent-user-existence-errors ENABLED
  --access-token-validity 60 --id-token-validity 60 --refresh-token-validity 1
  --token-validity-units AccessToken=minutes,IdToken=minutes,RefreshToken=days
)

if [ -z "${CLIENT_ID:-}" ]; then
  log "Criando cliente do app (sem segredo, Authorization Code + PKCE)"
  ID=$(aws cognito-idp create-user-pool-client --user-pool-id "$POOL_ID" \
    --client-name barbearia-web --no-generate-secret "${CONFIG_CLIENTE[@]}" \
    --query UserPoolClient.ClientId --output text)
  salvar CLIENT_ID "$ID"
else
  log "Atualizando URLs de retorno do cliente"
  aws cognito-idp update-user-pool-client --user-pool-id "$POOL_ID" --client-id "$CLIENT_ID" \
    --client-name barbearia-web "${CONFIG_CLIENTE[@]}" > /dev/null
fi

echo "User Pool: $POOL_ID | Client: $CLIENT_ID"
echo "Login: $(cognito_url)/login?client_id=$CLIENT_ID&response_type=code&scope=openid+email+profile&redirect_uri=https://$APP_DOMINIO/"

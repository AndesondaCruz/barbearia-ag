#!/usr/bin/env bash
# Página de login (Cognito Managed Login): versão 2, em português e com a
# identidade visual da barbearia (tema escuro e destaques em âmbar).
# Para voltar à página clássica: aws cognito-idp update-user-pool-domain \
#   --user-pool-id "$POOL_ID" --domain "$COGNITO_PREFIXO" --managed-login-version 1
source "$(dirname "$0")/config.sh"

if [ -z "${BRANDING_ID:-}" ]; then
  log "Criando estilo padrão do Managed Login"
  ID=$(aws cognito-idp create-managed-login-branding --user-pool-id "$POOL_ID" --client-id "$CLIENT_ID" \
    --use-cognito-provided-values --query ManagedLoginBranding.ManagedLoginBrandingId --output text)
  salvar BRANDING_ID "$ID"
fi

log "Ativando Managed Login (versão 2) no domínio $COGNITO_PREFIXO"
aws cognito-idp update-user-pool-domain --user-pool-id "$POOL_ID" --domain "$COGNITO_PREFIXO" \
  --managed-login-version 2 > /dev/null

log "Aplicando cores da barbearia"
aws cognito-idp describe-managed-login-branding --user-pool-id "$POOL_ID" \
  --managed-login-branding-id "$BRANDING_ID" --return-merged-resources \
  --query ManagedLoginBranding.Settings > /tmp/branding-atual.json

python3 - /tmp/branding-atual.json /tmp/branding-novo.json <<'PY'
import json, sys

entrada, saida = sys.argv[1], sys.argv[2]
s = json.load(open(entrada))

FUNDO = "09090bff"      # zinc-950, mesmo fundo do site
CARTAO = "18181bff"     # zinc-900
BORDA = "3f3f46ff"      # zinc-700
TEXTO_ESCURO = "18181bff"

def ambar(cor):
    """Troca tons de azul do tema padrão por tons de âmbar de luminosidade parecida."""
    r, g, b = (int(cor[i:i + 2], 16) for i in (0, 2, 4))
    if not (b > r + 40 and b >= g):
        return cor
    luz = (r + g + b) / 3
    if luz > 170:
        return "fcd34dff"   # amber-300
    if luz > 110:
        return "fbbf24ff"   # amber-400
    return "f59e0bff"       # amber-500

def trocar(no, dentro_dark=False):
    if isinstance(no, dict):
        for k, v in no.items():
            escuro = dentro_dark or k == "darkMode"
            if isinstance(v, str) and escuro and len(v) == 8 and all(c in "0123456789abcdef" for c in v.lower()):
                no[k] = ambar(v.lower())
            else:
                trocar(v, escuro)
    elif isinstance(no, list):
        for item in no:
            trocar(item, dentro_dark)

trocar(s)

s["categories"]["global"]["colorSchemeMode"] = "DARK"

comp = s["components"]
fundo = comp["pageBackground"]
fundo["darkMode"]["color"] = FUNDO
fundo["image"]["enabled"] = False

# Texto escuro sobre o botão âmbar, para manter o contraste (WCAG).
for estado in ("defaults", "hover", "active"):
    if estado in comp["primaryButton"]["darkMode"]:
        comp["primaryButton"]["darkMode"][estado]["textColor"] = TEXTO_ESCURO

form = comp["form"]
if "darkMode" in form:
    form["darkMode"]["backgroundColor"] = CARTAO
    form["darkMode"]["borderColor"] = BORDA

# Campos de texto: fundo do site em vez do azul-marinho padrão.
def fundo_dos_campos(no):
    if isinstance(no, dict):
        for k, v in no.items():
            if k == "backgroundColor" and isinstance(v, str):
                no[k] = FUNDO
            else:
                fundo_dos_campos(v)

for classe in ("input", "dropDown"):
    if classe in s["componentClasses"] and "darkMode" in s["componentClasses"][classe]:
        fundo_dos_campos(s["componentClasses"][classe]["darkMode"])

json.dump(s, open(saida, "w"))
print("estilo gerado")
PY

aws cognito-idp update-managed-login-branding --user-pool-id "$POOL_ID" \
  --managed-login-branding-id "$BRANDING_ID" --settings file:///tmp/branding-novo.json > /dev/null

echo "Login atualizado: $(cognito_url)/oauth2/authorize?client_id=$CLIENT_ID&response_type=code&scope=openid+email+profile&redirect_uri=https://$APP_DOMINIO/&lang=pt-BR"

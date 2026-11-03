# Configurar os serviços externos (opcionais)

O app **funciona 100% sem internet**: análise facial, notas, plano, histórico, comparação, PDF e
o assistente em modo "motor local de regras". Os passos abaixo só são necessários para:

| Recurso | Precisa de |
|---|---|
| ASCEND AI com inteligência artificial de verdade | Backend + chave da Anthropic **ou** OpenAI |
| Simulador de visual (cortes, barba, sobrancelhas) | Backend + chave da OpenAI (modelo de edição de imagem `gpt-image-1`) |
| Login e sincronização em nuvem | Projeto Supabase (gratuito) |
| Excluir a conta na nuvem | Backend + Supabase |

> As chaves de IA ficam **só no servidor**. O APK nunca contém chaves secretas.

---

## 1. Criar o projeto Supabase (grátis)

1. Entre em https://supabase.com → **New project**.
2. Vá em **SQL Editor** → cole o conteúdo de `backend/supabase/schema.sql` → **Run**.
   Isso cria a tabela `analyses` com segurança por linha (cada usuário só vê os próprios dados).
3. Em **Project Settings → API** copie:
   - **Project URL** (ex.: `https://abcd.supabase.co`)
   - **anon public key**
   - **service_role key** (secreta — só vai no servidor, nunca no app)

No app: **Ajustes → Conta e nuvem → Configurar / entrar** → cole a URL e a chave **anon** → Salvar →
crie a conta com e-mail e senha. (Se o Supabase pedir confirmação por e-mail, confirme e depois toque em **Entrar**.)

## 2. Publicar o backend (Edge Function)

No computador, com o [Supabase CLI](https://supabase.com/docs/guides/cli) instalado:

```bash
cd backend
supabase login
supabase link --project-ref SEU_PROJECT_REF

# Escolha um token longo e aleatório: ele protege o seu backend.
supabase secrets set ASCEND_APP_TOKEN="um-token-longo-e-aleatorio"

# IA do assistente — use UMA das opções:
supabase secrets set AI_PROVIDER=anthropic ANTHROPIC_API_KEY="sk-ant-..."    # opcional: ANTHROPIC_MODEL
supabase secrets set AI_PROVIDER=openai    OPENAI_API_KEY="sk-..."           # opcional: OPENAI_MODEL

# Simulador de visual (edição de imagem):
supabase secrets set OPENAI_API_KEY="sk-..."                                  # opcional: IMAGE_MODEL

# Exclusão de conta:
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="eyJ..."

supabase functions deploy ascend --no-verify-jwt
```

`--no-verify-jwt` é necessário porque o backend usa o próprio token (`ASCEND_APP_TOKEN`).
`SUPABASE_URL` já é definida automaticamente pela plataforma.

No app: **Ajustes → Inteligência artificial**
- URL do backend: `https://SEU_PROJECT_REF.supabase.co/functions/v1/ascend`
- Token de acesso: o mesmo `ASCEND_APP_TOKEN`
- Toque em **Testar conexão** — deve aparecer "Conectado".

Depois, em **Ajustes → Privacidade**, ative **Permitir envio a serviços externos de IA**.

## 3. O que é enviado

- **Assistente:** só os relatórios em texto (notas, métricas, limitações) + sua pergunta. Nenhuma foto.
- **Simulador:** a foto frontal recortada, apenas quando você toca em *Gerar simulação*.
- **Sincronização:** só os relatórios em texto. As fotos ficam no aparelho.

## 4. Gerar a versão de lançamento assinada (Play Store)

```bash
keytool -genkey -v -keystore ascend-release.jks -keyalg RSA -keysize 4096 -validity 10000 -alias ascend
cp keystore.properties.example keystore.properties   # edite com caminho e senhas
./gradlew bundleRelease     # gera app/build/outputs/bundle/release/app-release.aab
./gradlew assembleRelease   # ou APK assinado
```

Antes de compilar localmente, baixe os modelos (o CI faz isso sozinho):

```bash
mkdir -p app/src/main/assets
curl -L -o app/src/main/assets/face_landmarker.task https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
curl -L -o app/src/main/assets/selfie_multiclass.tflite https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite
```

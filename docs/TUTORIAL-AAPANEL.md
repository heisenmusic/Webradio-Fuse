# Tutorial: instalar o Fuse Radio Enterprise no aaPanel (passo a passo para iniciantes)

Este guia assume que você **nunca fez isso antes**. Siga na ordem, copiando e colando
os comandos. Tempo estimado: 30–40 minutos.

## O que você precisa antes de começar

- Um **VPS** (servidor) com Ubuntu 22.04/24.04 e o **aaPanel já instalado**
  (mínimo recomendado: 2 vCPU, 4 GB RAM);
- **Dois subdomínios** apontando para o IP do servidor (crie no seu provedor de DNS):
  - `app.seudominio.com` → site (player + dashboard)
  - `api.seudominio.com` → API
- O projeto no GitHub (este repositório).

> 💡 Sempre que o tutorial disser "Terminal", use o **terminal do próprio aaPanel**:
> menu lateral → **Terminal**. Não precisa de programa externo.

---

## Parte 1 — Instalar os aplicativos no aaPanel (5 min)

No menu **App Store** do aaPanel, instale (botão *Install* de cada um):

1. **Nginx** (qualquer versão recente);
2. **PostgreSQL** — escolha a versão **16**;
3. **PM2 Manager** — na instalação ele pergunta a versão do Node: escolha **v20** ou superior.

Aguarde os três aparecerem como instalados.

---

## Parte 2 — Criar o banco de dados (2 min)

1. Menu **Databases** → aba **PostgreSQL** → **Add Database**;
2. Preencha:
   - **Database name**: `fuse_radio`
   - **Username**: `fuse`
   - **Password**: clique em gerar e **copie a senha** (você vai usá-la já já);
3. Salve.

---

## Parte 3 — Baixar o projeto no servidor (5 min)

Abra o **Terminal** do aaPanel e cole, uma linha por vez:

```bash
cd /www/wwwroot
git clone https://github.com/heisenmusic/Webradio-Fuse.git fuse-radio
cd fuse-radio
```

> ⚠️ **Se o repositório for privado**, o `git clone` vai pedir usuário e senha.
> No campo senha, use um **token** do GitHub (crie em GitHub → Settings →
> Developer settings → Personal access tokens → *Fine-grained*, com acesso de
> leitura ao repositório). Cole o token quando pedir a senha.

**Alternativa sem git (ZIP):** no GitHub, clique no seletor de branch, escolha a
branch com o código, depois **Code → Download ZIP**. No aaPanel vá em
**Files** → pasta `/www/wwwroot` → botão **Upload** (não precisa de FTP) → envie o
ZIP → clique com o direito no arquivo → **Unzip** → renomeie a pasta extraída para
`fuse-radio`. Depois, no Terminal: `cd /www/wwwroot/fuse-radio`.

---

## Parte 4 — Rodar o instalador automático (10–15 min)

Ainda no Terminal, dentro de `/www/wwwroot/fuse-radio`:

```bash
bash scripts/instalar-aapanel.sh
```

O instalador vai perguntar, nesta ordem — tenha as respostas à mão:

| Pergunta | O que responder |
| --- | --- |
| Nome do banco | `fuse_radio` (Enter) |
| Usuário do banco | `fuse` (Enter) |
| Senha do banco | a senha copiada na Parte 2 |
| Host do banco | `localhost` (Enter) |
| Domínio do site | `app.seudominio.com` |
| Domínio da API | `api.seudominio.com` |
| E-mail do admin | seu e-mail |
| Senha do admin | crie uma senha forte (mín. 8 caracteres) |

Ele instala as dependências, compila tudo, cria as tabelas no banco, gera os
segredos de segurança sozinho e cria seu usuário administrador. No final ele
mostra um **resumo com os próximos passos** — que são exatamente as Partes 5 e 6
abaixo.

---

## Parte 5 — Colocar os aplicativos no ar com o PM2 (5 min)

Menu **App Store** → **PM2 Manager** → aba **Project** → **Add Project**. Crie **dois**:

**Projeto 1 — API**

| Campo | Valor |
| --- | --- |
| Name | `fuse-api` |
| Run directory | `/www/wwwroot/fuse-radio/apps/api` |
| Startup file | `dist/main.js` |

**Projeto 2 — Site (player + dashboard)**

| Campo | Valor |
| --- | --- |
| Name | `fuse-web` |
| Run directory | `/www/wwwroot/fuse-radio/apps/web` |
| Startup file / comando | `node_modules/next/dist/bin/next` com argumento `start` — ou, se o seu PM2 Manager tiver o campo "command", use `pnpm start` |

Os dois devem ficar com status **online** (bolinha verde). O PM2 também religa os
apps sozinho se o servidor reiniciar.

---

## Parte 6 — Criar os sites e o SSL (10 min)

Menu **Website** → **Add site**, duas vezes:

### Site 1 — `app.seudominio.com`

1. **Domain name**: `app.seudominio.com` · PHP version: **Pure static** → Submit;
2. Clique no site criado → **Reverse proxy** → **Add reverse proxy**:
   - Proxy name: `fuse-web`
   - Target URL: `http://127.0.0.1:3000`
3. Ainda no site → **SSL** → aba **Let's Encrypt** → marque o domínio → **Apply**;
4. Depois do certificado, ative **Force HTTPS**.

### Site 2 — `api.seudominio.com`

1. **Domain name**: `api.seudominio.com` · Pure static → Submit;
2. **Reverse proxy** → Target URL: `http://127.0.0.1:4000` e **ative o toggle
   "WebSocket support"** (obrigatório — sem isso o tempo real não funciona);
3. **SSL** → Let's Encrypt → Apply → Force HTTPS;
4. **Config** (arquivo nginx do site): dentro do bloco `server { … }`, adicione a
   linha abaixo e salve (permite upload de áudios de até 60 MB):

```nginx
client_max_body_size 60m;
```

---

## Parte 7 — Testar 🎉

- **Dashboard**: abra `https://app.seudominio.com/admin/login` e entre com o
  e-mail e a senha que você criou na Parte 4;
- **Player da loja**: abra `https://app.seudominio.com/player`, clique em
  *Iniciar transmissão* e a rádio toca com failover automático;
- No dashboard → **Avisos**, envie um MP3 de teste e agende para daqui a 2 minutos:
  o player toca no horário, abaixando a música automaticamente.

---

## Como atualizar o sistema depois

No Terminal do aaPanel:

```bash
cd /www/wwwroot/fuse-radio
git pull
pnpm install
pnpm --filter @fuse/shared build && pnpm --filter @fuse/api build && pnpm --filter @fuse/web build
pnpm --filter @fuse/api prisma:deploy
```

E no **PM2 Manager**, clique em **Restart** nos projetos `fuse-api` e `fuse-web`.
(Se você instalou via ZIP: baixe o ZIP novo, substitua os arquivos e rode os
mesmos comandos a partir do `pnpm install`.)

---

## Problemas comuns

| Sintoma | Causa provável / solução |
| --- | --- |
| `502 Bad Gateway` | O app do PM2 não está *online* — abra o PM2 Manager e veja o **Log** do projeto |
| Dashboard não loga | `NEXT_PUBLIC_API_URL` errado no `apps/web/.env` — corrija e rode `pnpm --filter @fuse/web build` + restart do `fuse-web` |
| Upload falha com erro 413 | Faltou o `client_max_body_size 60m;` no nginx do site da API |
| Tempo real não atualiza | Faltou ativar **WebSocket support** no reverse proxy da API |
| `P1001 Can't reach database` | PostgreSQL parado (App Store → PostgreSQL → Start) ou senha errada no `apps/api/.env` |
| Player não vincula à loja | No player, abra as configurações (ícone de engrenagem) e defina o **código da loja** igual ao cadastrado no dashboard |

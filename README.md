# Controle de Materiais

Projeto da disciplina de Gestão de Projetos, retomado dos arquivos do chat “gestão de equipes com IA”. O produto é um sistema interno de requisição de materiais. A IA auxilia o desenvolvimento; o escopo original não exige um chatbot no produto.

## Situação da entrega

Frontend implementado em HTML5, CSS3 e JavaScript puro, com ES Modules e sem build. A integração está preparada para o `schema.sql` revisado. **A URL e a chave pública do seu Supabase já estão preenchidas.** Ainda é necessário conferir o esquema do banco, testar com contas reais e publicar no seu GitHub Pages. Não há dados fictícios misturados à aplicação, contas de demonstração ou senha embutida.

As implementações de login e permissões seguem a documentação do Supabase:

- https://supabase.com/docs/reference/javascript/installing
- https://supabase.com/docs/reference/javascript/auth-signinwithpassword
- https://supabase.com/docs/guides/database/postgres/row-level-security

## 1. Abrir no Windows

1. Extraia todo o ZIP para uma pasta, por exemplo `Documentos/controle-materiais`.
2. Com Python 3 instalado, dê dois cliques em `INICIAR-WINDOWS.bat`. O navegador abre em `http://127.0.0.1:8000`.
3. Mantenha a janela do servidor aberta. Ctrl+C encerra o servidor.

Alternativa: abra a pasta no VS Code e sirva `index.html` com a extensão Live Server. Não abra `index.html` diretamente com duplo clique: ES Modules exigem HTTP. `iniciar.py` é apenas um servidor local de arquivos estáticos para desenvolvimento; toda regra de negócio permanece no Supabase. Não é usado no GitHub Pages.

## 2. Conexão ao Supabase existente

Crie o arquivo `js/config.js` ou edite caso já exista, preenchendo a URL e a chave pública fornecidas em 22/09/2026. Você deve preencher esses dados com os detalhes do seu projeto. O prefixo `NEXT_PUBLIC_` que veio do painel foi adaptado aos nomes usados pelo JavaScript deste projeto; não é necessário Next.js nem arquivo `.env`.

Edite as duas constantes com os dados do seu Supabase:

```js
export const SUPABASE_URL = 'https://SEU-PROJETO.supabase.co';
export const SUPABASE_ANON_KEY = 'SUA_CHAVE_PUBLICAVEL_OU_ANON';
```

Use a URL do projeto e a chave **publishable** (`sb_publishable_...`) ou a antiga chave `anon`, disponíveis no painel do seu Supabase. A chave pública é própria para o frontend; RLS e funções protegidas controlam o acesso. Nunca coloque `service_role`, `sb_secret_...`, senha de usuário ou senha do banco no código.

## 3. Conferir o banco antes de aplicar SQL

O arquivo `schema.sql` é uma cópia do esquema revisado que já constava no trabalho. Inclui as tabelas `materiais`, `perfis`, `requisicoes`, as políticas RLS e as funções `resolver_requisicao`, `entregar_requisicao` e `registrar_entrada_material`.

**O script completo é para um projeto vazio e não deve ser executado novamente sobre tabelas existentes.** Como o projeto Supabase já foi criado anteriormente, primeiro confira o que existe no SQL Editor com uma consulta somente de leitura:

```sql
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in ('materiais', 'perfis', 'requisicoes')
order by table_name, ordinal_position;
```

Se o esquema revisado já está aplicado, não precisa recriá-lo. Se o banco está vazio, execute `schema.sql` inteiro. Se há apenas parte do esquema ou uma versão antiga, faça uma migração específica depois de comparar os objetos; não apague tabelas para instalar esta entrega.

O SQL revisado prevalece sobre os trechos antigos da especificação: autorização usa `app_metadata`, aprovação e recusa usam RPC, a entrada é atômica e a entrega preserva a autoria da aprovação.

## 4. Criar as contas

Crie um administrador e um solicitante em Authentication → Users, usando e-mail e senha. Não existe cadastro público neste MVP. O trigger do esquema cria o registro em `perfis` para os novos usuários; o SQL também preenche perfis para usuários anteriores.

Para conceder o perfil administrativo, execute **somente no SQL Editor administrativo do Supabase**, substituindo o e-mail:

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
                        || '{"perfil":"admin"}'::jsonb
where email = 'EMAIL_DO_ADMIN';
```

O usuário precisa sair e entrar novamente. As demais contas são solicitantes por padrão. Não use `user_metadata.perfil` para conceder acesso. Não foi incluída senha de teste neste projeto.

## 5. Fluxo implementado

| Tela | Comportamento |
| --- | --- |
| `index.html` | Login por e-mail e senha; sessão existente; mensagens de erro. |
| `painel.html` | Solicitante consulta suas requisições; admin consulta todas, filtra status, aprova, recusa e registra entrega. Detalhes mostram justificativa e datas. |
| `nova-requisicao.html` | Materiais ativos, saldo, quantidade inteira e justificativa opcional. |
| `materiais.html` | Somente admin: cadastrar, editar dados, entrada de estoque, desativar/reativar e consultar histórico do material. |

Sem dashboards, relatórios, notificações ou carrinho, conforme o escopo. Quantidades são inteiras. Aprovar não reserva saldo; a disponibilidade é conferida novamente na entrega. O material inativo permanece no histórico e não pode receber novas requisições. As listagens consultam páginas sucessivas para não limitar o histórico aos primeiros registros do Supabase.

O saldo não aparece como campo editável após o cadastro. A entrega ocorre na RPC que bloqueia a requisição e altera estoque e status na mesma transação. O banco é a barreira de segurança; ocultar botões não substitui RLS.

## 6. Publicar no GitHub Pages

Use o repositório previsto para este trabalho e coloque os arquivos da pasta `controle-materiais` na raiz. No GitHub, em Settings → Pages, escolha a publicação da branch `main`, pasta raiz. Configure a URL final em Authentication → URL Configuration no Supabase conforme o endereço do seu repositório.

Os caminhos são relativos (`./`), preparados para `https://USUARIO.github.io/REPOSITORIO/`. Não há etapa de build, npm ou backend próprio a instalar. O navegador precisa de internet para carregar o cliente Supabase por CDN e acessar o banco.

Esta entrega não criou repositório, não alterou o seu Supabase e não publicou o site.

## Estrutura

- Quatro páginas HTML na raiz.
- `css/style.css`: identidade visual responsiva do design existente.
- `js/config.js`: configuração pública do projeto.
- `js/supabase.js`: inicialização do cliente e verificação da configuração.
- `js/auth.js`: sessão, perfis, navegação e logout.
- `js/ui.js`: feedback, validação e formatação.
- `js/data.js`: consultas paginadas e tratamento de respostas.
- `js/login.js`, `js/materiais.js`, `js/nova-requisicao.js`, `js/painel.js`: comportamento das telas.
- `schema.sql`: esquema revisado existente.
- `docs/design.md` e `docs/tasks-originais.md`: documentos de referência preservados.
- `docs/VALIDACAO.md`: verificações realizadas e pendências.

Consulte `docs/VALIDACAO.md` antes de considerar o MVP pronto para uso real.

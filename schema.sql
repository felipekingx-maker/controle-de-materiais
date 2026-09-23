-- ============================================================================
-- Sistema Interno de Requisicao de Materiais - Esquema MVP (Supabase)
-- Versao revisada e segura
--
-- Execute este arquivo inteiro no SQL Editor de um projeto Supabase vazio.
-- Stack prevista: HTML + CSS + JavaScript puro + Supabase.
-- ============================================================================

begin;

-- 1. TABELAS -----------------------------------------------------------------

create table public.materiais (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (btrim(nome) <> ''),
  unidade text not null check (btrim(unidade) <> ''),
  saldo integer not null default 0 check (saldo >= 0),
  estoque_min integer not null default 0 check (estoque_min >= 0),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

-- Impede duplicidades como "Papel A4" e "papel a4".
create unique index materiais_nome_unico_ci
  on public.materiais (lower(btrim(nome)));

-- Perfil publico minimo. O navegador nao consulta auth.users diretamente.
create table public.perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null check (btrim(nome) <> ''),
  criado_em timestamptz not null default now()
);

create table public.requisicoes (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materiais(id),
  solicitante_id uuid not null references auth.users(id),
  quantidade integer not null check (quantidade > 0),
  status text not null default 'pendente'
    check (status in ('pendente', 'aprovada', 'recusada', 'entregue')),
  justificativa text,
  criado_em timestamptz not null default now(),

  -- Guarda quem aprovou ou recusou.
  resolvido_em timestamptz,
  resolvido_por uuid references auth.users(id),

  -- Guarda separadamente quem registrou a entrega, preservando a aprovacao.
  entregue_em timestamptz,
  entregue_por uuid references auth.users(id),

  constraint requisicoes_auditoria_consistente check (
    (status = 'pendente'
      and resolvido_em is null and resolvido_por is null
      and entregue_em is null and entregue_por is null)
    or
    (status in ('aprovada', 'recusada')
      and resolvido_em is not null and resolvido_por is not null
      and entregue_em is null and entregue_por is null)
    or
    (status = 'entregue'
      and resolvido_em is not null and resolvido_por is not null
      and entregue_em is not null and entregue_por is not null)
  )
);

create index idx_requisicoes_status
  on public.requisicoes(status);

create index idx_requisicoes_solicitante_criado
  on public.requisicoes(solicitante_id, criado_em desc);

create index idx_requisicoes_material
  on public.requisicoes(material_id);


-- 2. FUNCOES DE PERFIL E SEGURANCA -------------------------------------------

-- O perfil administrativo fica em app_metadata, que nao pode ser alterado
-- pelo proprio usuario. Nao use user_metadata para autorizacao.
create or replace function public.is_admin()
returns boolean
language sql
stable
set search_path = pg_catalog, public
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'perfil') = 'admin',
    false
  );
$$;

-- Cria automaticamente o perfil publico de cada novo usuario.
create or replace function public.criar_perfil_novo_usuario()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.perfis (id, nome)
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'nome'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Usuario'
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.criar_perfil_novo_usuario();

-- Preenche perfis para usuarios que ja existiam antes da execucao deste SQL.
insert into public.perfis (id, nome)
select
  u.id,
  coalesce(
    nullif(btrim(u.raw_user_meta_data ->> 'nome'), ''),
    nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
    'Usuario'
  )
from auth.users u
on conflict (id) do nothing;


-- 3. FUNCOES ATOMICAS DE NEGOCIO --------------------------------------------

-- Aprova ou recusa uma requisicao pendente.
create or replace function public.resolver_requisicao(
  p_requisicao_id uuid,
  p_decisao text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_status text;
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado';
  end if;

  if not public.is_admin() then
    raise exception 'Apenas administradores podem aprovar ou recusar requisicoes';
  end if;

  if p_decisao not in ('aprovada', 'recusada') then
    raise exception 'Decisao invalida: use aprovada ou recusada';
  end if;

  select r.status
    into v_status
    from public.requisicoes r
    where r.id = p_requisicao_id
    for update;

  if not found then
    raise exception 'Requisicao nao encontrada';
  end if;

  if v_status <> 'pendente' then
    raise exception 'Apenas requisicoes pendentes podem ser aprovadas ou recusadas';
  end if;

  update public.requisicoes
     set status = p_decisao,
         resolvido_em = now(),
         resolvido_por = auth.uid()
   where id = p_requisicao_id;
end;
$$;

-- Entrega uma requisicao aprovada e baixa o saldo na mesma transacao.
create or replace function public.entregar_requisicao(p_requisicao_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_requisicao public.requisicoes%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado';
  end if;

  if not public.is_admin() then
    raise exception 'Apenas administradores podem registrar entregas';
  end if;

  select *
    into v_requisicao
    from public.requisicoes
    where id = p_requisicao_id
    for update;

  if not found then
    raise exception 'Requisicao nao encontrada';
  end if;

  if v_requisicao.status <> 'aprovada' then
    raise exception 'So e possivel entregar requisicoes aprovadas';
  end if;

  update public.materiais
     set saldo = saldo - v_requisicao.quantidade
   where id = v_requisicao.material_id
     and saldo >= v_requisicao.quantidade;

  if not found then
    raise exception 'Saldo insuficiente';
  end if;

  update public.requisicoes
     set status = 'entregue',
         entregue_em = now(),
         entregue_por = auth.uid()
   where id = p_requisicao_id;
end;
$$;

-- Soma uma entrada de estoque de forma atomica.
create or replace function public.registrar_entrada_material(
  p_material_id uuid,
  p_quantidade integer
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_novo_saldo integer;
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado';
  end if;

  if not public.is_admin() then
    raise exception 'Apenas administradores podem registrar entradas de estoque';
  end if;

  if p_quantidade is null or p_quantidade <= 0 then
    raise exception 'A quantidade deve ser maior que zero';
  end if;

  update public.materiais
     set saldo = saldo + p_quantidade
   where id = p_material_id
   returning saldo into v_novo_saldo;

  if not found then
    raise exception 'Material nao encontrado';
  end if;

  return v_novo_saldo;
end;
$$;


-- 4. ROW LEVEL SECURITY -------------------------------------------------------

alter table public.materiais enable row level security;
alter table public.perfis enable row level security;
alter table public.requisicoes enable row level security;

-- Materiais: autenticados leem; somente admin cadastra e edita dados permitidos.
create policy "materiais_select_autenticado"
  on public.materiais
  for select
  to authenticated
  using (true);

create policy "materiais_insert_admin"
  on public.materiais
  for insert
  to authenticated
  with check (public.is_admin());

create policy "materiais_update_admin"
  on public.materiais
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Perfis: usuario le e altera o proprio nome; admin le todos.
create policy "perfis_select_proprio_ou_admin"
  on public.perfis
  for select
  to authenticated
  using (id = auth.uid() or public.is_admin());

create policy "perfis_update_proprio"
  on public.perfis
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Requisicoes: usuario le as proprias; admin le todas.
create policy "requisicoes_select_proprias_ou_admin"
  on public.requisicoes
  for select
  to authenticated
  using (solicitante_id = auth.uid() or public.is_admin());

-- Usuario autenticado so cria requisicao pendente para si, de material ativo
-- e com saldo suficiente no momento da solicitacao.
create policy "requisicoes_insert_propria"
  on public.requisicoes
  for insert
  to authenticated
  with check (
    solicitante_id = auth.uid()
    and status = 'pendente'
    and resolvido_em is null
    and resolvido_por is null
    and entregue_em is null
    and entregue_por is null
    and exists (
      select 1
        from public.materiais m
       where m.id = material_id
         and m.ativo = true
         and m.saldo >= quantidade
    )
  );

-- Nao existe policy de UPDATE/DELETE em requisicoes.
-- Aprovar, recusar e entregar sao operacoes exclusivas das RPCs protegidas.


-- 5. PRIVILEGIOS --------------------------------------------------------------

-- Remove privilegios amplos que podem existir por padrao no schema public.
revoke all on table public.materiais from anon, authenticated;
revoke all on table public.perfis from anon, authenticated;
revoke all on table public.requisicoes from anon, authenticated;

-- Consultas permitidas.
grant select on table public.materiais to authenticated;
grant select on table public.perfis to authenticated;
grant select on table public.requisicoes to authenticated;

-- Cadastro e edicao segura de materiais. O saldo nao pode ser reduzido por
-- update direto: entrada e saida passam pelas RPCs.
grant insert (nome, unidade, saldo, estoque_min, ativo)
  on table public.materiais to authenticated;
grant update (nome, unidade, estoque_min, ativo)
  on table public.materiais to authenticated;

-- Usuario pode atualizar apenas o proprio nome, conforme a RLS.
grant update (nome)
  on table public.perfis to authenticated;

-- Criacao de requisicao sem permitir update ou delete direto.
grant insert (material_id, solicitante_id, quantidade, status, justificativa)
  on table public.requisicoes to authenticated;

-- Funcoes: nenhuma e publica/anonima; somente autenticados recebem o necessario.
revoke all on function public.is_admin() from public, anon, authenticated;
revoke all on function public.resolver_requisicao(uuid, text) from public, anon, authenticated;
revoke all on function public.entregar_requisicao(uuid) from public, anon, authenticated;
revoke all on function public.registrar_entrada_material(uuid, integer) from public, anon, authenticated;
revoke all on function public.criar_perfil_novo_usuario() from public, anon, authenticated;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.resolver_requisicao(uuid, text) to authenticated;
grant execute on function public.entregar_requisicao(uuid) to authenticated;
grant execute on function public.registrar_entrada_material(uuid, integer) to authenticated;

commit;


-- 6. POS-SETUP MANUAL ---------------------------------------------------------
--
-- Depois de criar o primeiro usuario em Authentication > Users, transforme-o
-- em admin pelo SQL Editor. Troque o e-mail abaixo pelo e-mail real:
--
-- update auth.users
--    set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
--                            || '{"perfil":"admin"}'::jsonb
--  where email = 'admin@empresa.com';
--
-- O usuario precisa sair e entrar novamente para o novo app_metadata aparecer
-- no JWT da sessao. Os demais usuarios permanecem solicitantes por padrao.
--
-- Chamadas esperadas no frontend:
--   Aprovar:  supabase.rpc('resolver_requisicao',
--               { p_requisicao_id: id, p_decisao: 'aprovada' })
--   Recusar:  supabase.rpc('resolver_requisicao',
--               { p_requisicao_id: id, p_decisao: 'recusada' })
--   Entregar: supabase.rpc('entregar_requisicao',
--               { p_requisicao_id: id })
--   Entrada:  supabase.rpc('registrar_entrada_material',
--               { p_material_id: id, p_quantidade: quantidade })

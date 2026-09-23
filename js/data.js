import { supabase } from './supabase.js';

const PAGE_SIZE = 50;

export async function fetchMateriais(page = 0, search = '') {
  let query = supabase
    .from('materiais')
    .select('*', { count: 'exact' })
    .order('nome');

  if (search) {
    query = query.ilike('nome', `%${search}%`);
  }

  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  query = query.range(from, to);

  return await query;
}

export async function createMaterial(data) {
  return await supabase.from('materiais').insert(data).select().single();
}

export async function registrarEntrada(material_id, quantidade) {
  return await supabase.rpc('registrar_entrada_material', {
    p_material_id: material_id,
    p_quantidade: quantidade
  });
}

export async function fetchRequisicoes(page = 0, search = '', status = '') {
  let query = supabase
    .from('requisicoes')
    .select(`
      *,
      materiais (nome, unidade),
      perfis!requisicoes_solicitante_id_fkey (nome)
    `, { count: 'exact' })
    .order('criado_em', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  if (search) {
    query = query.ilike('materiais.nome', `%${search}%`); // Basic search for now
  }

  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  query = query.range(from, to);

  return await query;
}

export async function createRequisicao(data) {
  return await supabase.from('requisicoes').insert(data).select().single();
}

export async function resolverRequisicao(requisicao_id, decisao) {
  return await supabase.rpc('resolver_requisicao', {
    p_requisicao_id: requisicao_id,
    p_decisao: decisao
  });
}

export async function entregarRequisicao(requisicao_id) {
  return await supabase.rpc('entregar_requisicao', {
    p_requisicao_id: requisicao_id
  });
}

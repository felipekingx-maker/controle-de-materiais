import { supabase } from './supabase.js';

export async function getUser() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session) return null;
  return session.user;
}

export async function isAdmin() {
  const user = await getUser();
  return user?.app_metadata?.perfil === 'admin';
}

export async function requireAuth() {
  const user = await getUser();
  if (!user) {
    window.location.href = './index.html';
  }
  return user;
}

export async function requireAdmin() {
  const user = await requireAuth();
  const admin = await isAdmin();
  if (!admin) {
    window.location.href = './painel.html';
  }
  return user;
}

export async function login(email, password) {
  return await supabase.auth.signInWithPassword({ email, password });
}

export async function logout() {
  await supabase.auth.signOut();
  window.location.href = './index.html';
}

export async function buildNavigation() {
    const nav = document.getElementById('navigation');
    if (!nav) return;

    const admin = await isAdmin();
    let html = `
        <nav class="nav-links">
            <a href="./painel.html" class="nav-link">Requisições</a>
            <a href="./nova-requisicao.html" class="nav-link">Nova Requisição</a>
    `;
    if (admin) {
        html += `<a href="./materiais.html" class="nav-link">Materiais</a>`;
    }
    html += `
        </nav>
        <button id="logout-button" class="button secondary mt-auto">Sair</button>
    `;
    nav.innerHTML = html;

    document.getElementById('logout-button')?.addEventListener('click', logout);
}

document.addEventListener('DOMContentLoaded', buildNavigation);

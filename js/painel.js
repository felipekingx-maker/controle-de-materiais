import { requireAuth, isAdmin } from './auth.js';
import { fetchRequisicoes, resolverRequisicao, entregarRequisicao } from './data.js';
import { showToast, showError, hideError, setLoading, setupDialog, setupMenu, formatDate } from './ui.js';

let currentUser = null;
let isUserAdmin = false;
let detailsDialog;
let currentRequisicoes = [];

document.addEventListener('DOMContentLoaded', async () => {
    currentUser = await requireAuth();
    if (!currentUser) return;

    isUserAdmin = await isAdmin();

    document.getElementById('workspace').removeAttribute('hidden');
    setupMenu();

    detailsDialog = setupDialog('details-dialog');

    if (!isUserAdmin) {
        // Hide requester column and status filter if not admin
        document.getElementById('requester-heading')?.setAttribute('hidden', '');
    }

    const searchInput = document.getElementById('search');
    let searchTimeout;
    searchInput?.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => loadRequisicoes(), 300);
    });

    document.getElementById('status-filter')?.addEventListener('change', loadRequisicoes);
    document.getElementById('refresh')?.addEventListener('click', loadRequisicoes);

    await loadRequisicoes();
});

async function loadRequisicoes() {
    const search = document.getElementById('search')?.value || '';
    const status = document.getElementById('status-filter')?.value || '';

    const loading = document.getElementById('loading');
    const table = document.getElementById('requests-table');
    const tbody = document.getElementById('requests-body');
    const emptyState = document.getElementById('empty-state');

    loading.removeAttribute('hidden');
    table.setAttribute('hidden', '');
    emptyState.setAttribute('hidden', '');
    tbody.innerHTML = '';

    const { data, count, error } = await fetchRequisicoes(0, search, status);

    loading.setAttribute('hidden', '');

    if (error) {
        showError('Erro ao carregar requisições.');
        return;
    }

    currentRequisicoes = data || [];
    document.getElementById('list-count').textContent = `Requisições (${count || (data ? data.length : 0)})`;

    if (currentRequisicoes.length === 0) {
        emptyState.removeAttribute('hidden');
        return;
    }

    currentRequisicoes.forEach(req => {
        const tr = document.createElement('tr');
        const materialNome = req.materiais?.nome || 'Desconhecido';
        const unidade = req.materiais?.unidade || '';
        const solicitante = req.perfis?.nome || 'Desconhecido';

        const statusMap = {
            'pendente': '<span style="color: #856404; background: #fff3cd; padding: 2px 6px; border-radius: 4px;">Pendente</span>',
            'aprovada': '<span style="color: #0c5460; background: #d1ecf1; padding: 2px 6px; border-radius: 4px;">Aprovada</span>',
            'recusada': '<span style="color: #721c24; background: #f8d7da; padding: 2px 6px; border-radius: 4px;">Recusada</span>',
            'entregue': '<span style="color: #155724; background: #d4edda; padding: 2px 6px; border-radius: 4px;">Entregue</span>'
        };

        let actions = `<button class="button small secondary btn-details" data-id="${req.id}">Detalhes</button>`;

        if (isUserAdmin) {
            if (req.status === 'pendente') {
                actions += `
                    <button class="button small success btn-approve" data-id="${req.id}">Aprovar</button>
                    <button class="button small secondary btn-reject" data-id="${req.id}" style="color: #dc3545;">Recusar</button>
                `;
            } else if (req.status === 'aprovada') {
                actions += `<button class="button small btn-deliver" data-id="${req.id}">Entregar</button>`;
            }
        }

        let cols = `
            <td><strong>${materialNome}</strong></td>
            <td>${req.quantidade} ${unidade}</td>
        `;

        if (isUserAdmin) cols += `<td>${solicitante}</td>`;

        cols += `
            <td>${statusMap[req.status] || req.status}</td>
            <td>${formatDate(req.criado_em)}</td>
            <td style="display: flex; gap: 0.5rem; flex-wrap: wrap;">${actions}</td>
        `;

        tr.innerHTML = cols;
        tbody.appendChild(tr);
    });

    table.removeAttribute('hidden');

    // Attach events
    document.querySelectorAll('.btn-details').forEach(btn => btn.addEventListener('click', () => showDetails(btn.dataset.id)));
    document.querySelectorAll('.btn-approve').forEach(btn => btn.addEventListener('click', () => handleResolver(btn.dataset.id, 'aprovada')));
    document.querySelectorAll('.btn-reject').forEach(btn => btn.addEventListener('click', () => handleResolver(btn.dataset.id, 'recusada')));
    document.querySelectorAll('.btn-deliver').forEach(btn => btn.addEventListener('click', () => handleEntregar(btn.dataset.id)));
}

function showDetails(id) {
    const req = currentRequisicoes.find(r => r.id === id);
    if (!req) return;

    const content = document.getElementById('details-content');
    content.innerHTML = `
        <p><strong>Material:</strong> ${req.materiais?.nome}</p>
        <p><strong>Quantidade:</strong> ${req.quantidade} ${req.materiais?.unidade}</p>
        <p><strong>Solicitante:</strong> ${req.perfis?.nome}</p>
        <p><strong>Status:</strong> ${req.status}</p>
        <p><strong>Justificativa:</strong> ${req.justificativa || 'Nenhuma'}</p>
        <p><strong>Solicitado em:</strong> ${formatDate(req.criado_em)}</p>
        ${req.resolvido_em ? `<p><strong>Resolvido em:</strong> ${formatDate(req.resolvido_em)}</p>` : ''}
        ${req.entregue_em ? `<p><strong>Entregue em:</strong> ${formatDate(req.entregue_em)}</p>` : ''}
    `;

    detailsDialog.showModal();
}

async function handleResolver(id, decisao) {
    if (!confirm(`Tem certeza que deseja marcar como ${decisao}?`)) return;

    const { error } = await resolverRequisicao(id, decisao);
    if (error) {
        showToast(`Erro ao ${decisao === 'aprovada' ? 'aprovar' : 'recusar'} requisição.`, 'error');
    } else {
        showToast(`Requisição ${decisao}!`, 'success');
        loadRequisicoes();
    }
}

async function handleEntregar(id) {
    if (!confirm('Confirmar entrega do material ao solicitante? Isso descontará o saldo do estoque.')) return;

    const { error } = await entregarRequisicao(id);
    if (error) {
        showToast(error.message || 'Erro ao registrar entrega. Verifique o saldo.', 'error');
    } else {
        showToast('Entrega registrada com sucesso!', 'success');
        loadRequisicoes();
    }
}

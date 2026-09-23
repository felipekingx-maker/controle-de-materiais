import { requireAdmin } from './auth.js';
import { fetchMateriais, createMaterial, registrarEntrada } from './data.js';
import { showToast, showError, hideError, setLoading, setupDialog, setupMenu, formatDate } from './ui.js';
import { supabase } from './supabase.js';

let materialDialog, entryDialog;
let currentMaterialId = null;

document.addEventListener('DOMContentLoaded', async () => {
    const user = await requireAdmin();
    if (!user) return;

    document.getElementById('workspace').removeAttribute('hidden');
    setupMenu();

    materialDialog = setupDialog('material-dialog', 'create-material');
    entryDialog = setupDialog('entry-dialog');

    document.getElementById('material-form')?.addEventListener('submit', handleMaterialSubmit);
    document.getElementById('entry-form')?.addEventListener('submit', handleEntrySubmit);

    const searchInput = document.getElementById('search');
    let searchTimeout;
    searchInput?.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => loadMateriais(e.target.value), 300);
    });

    document.getElementById('refresh')?.addEventListener('click', () => {
        loadMateriais(document.getElementById('search')?.value || '');
    });

    await loadMateriais();
});

async function loadMateriais(search = '') {
    const loading = document.getElementById('loading');
    const table = document.getElementById('materials-table');
    const tbody = document.getElementById('materials-body');
    const emptyState = document.getElementById('empty-state');

    loading.removeAttribute('hidden');
    table.setAttribute('hidden', '');
    emptyState.setAttribute('hidden', '');
    tbody.innerHTML = '';

    const { data, count, error } = await fetchMateriais(0, search);

    loading.setAttribute('hidden', '');

    if (error) {
        showError('Erro ao carregar materiais.');
        return;
    }

    document.getElementById('list-count').textContent = `Materiais (${count || (data ? data.length : 0)})`;

    if (!data || data.length === 0) {
        emptyState.removeAttribute('hidden');
        return;
    }

    data.forEach(material => {
        const tr = document.createElement('tr');
        const isActive = material.ativo;
        const statusText = isActive ? 'Ativo' : 'Inativo';
        const statusClass = isActive ? 'text-success' : 'text-error';
        const saldoLow = material.saldo <= material.estoque_min && isActive;

        tr.innerHTML = `
            <td><strong>${material.nome}</strong></td>
            <td><span class="${saldoLow ? 'text-error font-bold' : ''}">${material.saldo} ${material.unidade}</span></td>
            <td>${material.estoque_min}</td>
            <td><span class="${statusClass}">${statusText}</span></td>
            <td>
                ${isActive ? `<button class="button small secondary btn-entry" data-id="${material.id}" data-name="${material.nome}">+ Entrada</button>` : ''}
                <button class="button small secondary btn-toggle" data-id="${material.id}" data-active="${material.ativo}">
                    ${isActive ? 'Desativar' : 'Reativar'}
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    table.removeAttribute('hidden');

    // Attach event listeners for buttons
    document.querySelectorAll('.btn-entry').forEach(btn => {
        btn.addEventListener('click', () => openEntryDialog(btn.dataset.id, btn.dataset.name));
    });

    document.querySelectorAll('.btn-toggle').forEach(btn => {
        btn.addEventListener('click', () => toggleMaterialStatus(btn.dataset.id, btn.dataset.active === 'true'));
    });
}

function openEntryDialog(id, name) {
    currentMaterialId = id;
    document.getElementById('entry-description').textContent = `Adicionar saldo para: ${name}`;
    document.getElementById('entry-amount').value = '';
    document.getElementById('entry-error').setAttribute('hidden', '');
    entryDialog.showModal();
}

async function handleEntrySubmit(e) {
    e.preventDefault();
    const amountInput = document.getElementById('entry-amount');
    const amount = parseInt(amountInput.value, 10);

    if (isNaN(amount) || amount <= 0) {
        showError('Informe uma quantidade válida.', 'entry-error');
        return;
    }

    setLoading(true, 'save-entry');
    const { error } = await registrarEntrada(currentMaterialId, amount);
    setLoading(false, 'save-entry');

    if (error) {
        showError(error.message || 'Erro ao registrar entrada.', 'entry-error');
    } else {
        entryDialog.close();
        showToast('Entrada registrada com sucesso!', 'success');
        loadMateriais(document.getElementById('search')?.value || '');
    }
}

async function handleMaterialSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('material-name').value;
    const unit = document.getElementById('material-unit').value;
    const initialBalance = parseInt(document.getElementById('material-balance').value, 10) || 0;
    const minStock = parseInt(document.getElementById('material-min').value, 10) || 0;

    setLoading(true, 'save-material');
    const { error } = await createMaterial({
        nome: name,
        unidade: unit,
        saldo: initialBalance,
        estoque_min: minStock,
        ativo: true
    });
    setLoading(false, 'save-material');

    if (error) {
        showError(error.message || 'Erro ao cadastrar material.', 'material-error');
    } else {
        materialDialog.close();
        e.target.reset();
        showToast('Material cadastrado com sucesso!', 'success');
        loadMateriais();
    }
}

async function toggleMaterialStatus(id, currentStatus) {
    const newStatus = !currentStatus;
    const action = newStatus ? 'reativar' : 'desativar';

    if (!confirm(`Tem certeza que deseja ${action} este material?`)) return;

    const { error } = await supabase
        .from('materiais')
        .update({ ativo: newStatus })
        .eq('id', id);

    if (error) {
        showToast(`Erro ao ${action} material.`, 'error');
    } else {
        showToast(`Material ${newStatus ? 'reativado' : 'desativado'} com sucesso!`, 'success');
        loadMateriais(document.getElementById('search')?.value || '');
    }
}

import { requireAuth } from './auth.js';
import { fetchMateriais, createRequisicao } from './data.js';
import { showToast, showError, hideError, setLoading, setupMenu } from './ui.js';

let currentUser = null;
let currentMateriais = [];

document.addEventListener('DOMContentLoaded', async () => {
    currentUser = await requireAuth();
    if (!currentUser) return;

    document.getElementById('workspace').removeAttribute('hidden');
    setupMenu();

    await loadMateriais();

    const form = document.getElementById('request-form');
    form.addEventListener('submit', handleRequisicaoSubmit);

    document.getElementById('refresh-materials')?.addEventListener('click', loadMateriais);

    document.getElementById('request-material')?.addEventListener('change', updateAvailableStock);
});

async function loadMateriais() {
    const select = document.getElementById('request-material');
    if (!select) return;

    select.innerHTML = '<option value="">Carregando materiais…</option>';
    select.disabled = true;

    const { data, error } = await fetchMateriais(); // Fetches first 50

    select.innerHTML = '<option value="">Selecione o material...</option>';

    if (error) {
        showError('Erro ao carregar materiais.');
        return;
    }

    currentMateriais = (data || []).filter(m => m.ativo && m.saldo > 0);

    if (currentMateriais.length === 0) {
        document.getElementById('no-materials').removeAttribute('hidden');
        document.getElementById('request-form').setAttribute('hidden', '');
        return;
    }

    currentMateriais.forEach(m => {
        const option = document.createElement('option');
        option.value = m.id;
        option.textContent = m.nome;
        select.appendChild(option);
    });

    select.disabled = false;
    updateAvailableStock();
}

function updateAvailableStock() {
    const select = document.getElementById('request-material');
    const available = document.getElementById('available');
    const sendBtn = document.getElementById('send-request');
    const amountInput = document.getElementById('request-amount');

    if (!select || !available || !sendBtn || !amountInput) return;

    const selectedId = select.value;
    const material = currentMateriais.find(m => m.id === selectedId);

    if (material) {
        available.textContent = `${material.saldo} ${material.unidade}`;
        amountInput.max = material.saldo;
        sendBtn.disabled = false;
    } else {
        available.textContent = 'Selecione um material';
        sendBtn.disabled = true;
    }
}

async function handleRequisicaoSubmit(e) {
    e.preventDefault();
    hideError();

    const select = document.getElementById('request-material');
    const amount = document.getElementById('request-amount');
    const reason = document.getElementById('request-reason');

    const materialId = select.value;
    const quantidade = parseInt(amount.value, 10);
    const justificativa = reason.value;

    if (!materialId || isNaN(quantidade) || quantidade <= 0) {
        showError('Preencha o material e a quantidade corretamente.');
        return;
    }

    setLoading(true, 'send-request');

    const { error } = await createRequisicao({
        material_id: materialId,
        quantidade: quantidade,
        justificativa: justificativa,
        solicitante_id: currentUser.id
    });

    setLoading(false, 'send-request');

    if (error) {
        showError('Erro ao criar requisição. O saldo pode ter sido alterado ou ocorreu um problema no servidor.');
    } else {
        showToast('Requisição enviada com sucesso!', 'success');
        e.target.reset();
        updateAvailableStock();
        loadMateriais(); // Refresh stock immediately
    }
}

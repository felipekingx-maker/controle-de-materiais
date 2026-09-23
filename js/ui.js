export function showToast(message, type = 'info') {
  const container = document.getElementById('toasts');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

export function showError(message, elementId = 'page-error') {
  const el = document.getElementById(elementId);
  if (el) {
    el.textContent = message;
    el.removeAttribute('hidden');
  }
}

export function hideError(elementId = 'page-error') {
  const el = document.getElementById(elementId);
  if (el) {
    el.setAttribute('hidden', '');
  }
}

export function setLoading(isLoading, buttonId) {
  const btn = document.getElementById(buttonId);
  if (btn) {
    btn.disabled = isLoading;
    if (isLoading) {
      btn.dataset.originalText = btn.textContent;
      btn.textContent = 'Carregando...';
    } else {
      btn.textContent = btn.dataset.originalText || btn.textContent;
    }
  }
}

export function setupDialog(dialogId, openButtonId = null) {
  const dialog = document.getElementById(dialogId);
  if (!dialog) return null;

  if (openButtonId) {
    const openBtn = document.getElementById(openButtonId);
    if (openBtn) {
      openBtn.addEventListener('click', () => dialog.showModal());
    }
  }

  dialog.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => dialog.close());
  });

  return dialog;
}

export function formatDate(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

export function setupMenu() {
    const toggle = document.getElementById('menu-toggle');
    const nav = document.getElementById('navigation');
    if (!toggle || !nav) return;

    toggle.addEventListener('click', () => {
        const expanded = toggle.getAttribute('aria-expanded') === 'true' || false;
        toggle.setAttribute('aria-expanded', !expanded);
        nav.classList.toggle('open');
    });
}

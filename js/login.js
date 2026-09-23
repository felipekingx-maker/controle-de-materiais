import { login, getUser } from './auth.js';
import { showError, hideError, setLoading } from './ui.js';

document.addEventListener('DOMContentLoaded', async () => {
    const user = await getUser();
    if (user) {
        window.location.href = './painel.html';
        return;
    }

    const form = document.getElementById('login-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideError();
        setLoading(true, 'login-button');

        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        const { error } = await login(email, password);

        setLoading(false, 'login-button');

        if (error) {
            showError('Email ou senha inválidos.');
        } else {
            window.location.href = './painel.html';
        }
    });
});

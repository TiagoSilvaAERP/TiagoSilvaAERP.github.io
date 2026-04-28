document.addEventListener('DOMContentLoaded', () => {
    const baseDatabaseUrl = '../assets/db/database.json';
    const storageKey = 'backofficeDatabase';

    const form = document.getElementById('loginForm');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const showPassword = document.getElementById('showPassword');
    const message = document.getElementById('loginMessage');
    const button = document.getElementById('loginBtn');

    let users = [];

    const loadUsers = async () => {
        try {
            const response = await fetch(baseDatabaseUrl, { cache: 'no-store' });
            const data = await response.json();

            if (Array.isArray(data)) {
                users = data;
            } else if (Array.isArray(data.users)) {
                users = data.users;
            }
        } catch (err) {
            console.warn('Erro ao carregar database.json', err);
        }

        try {
            const stored = JSON.parse(localStorage.getItem(storageKey) || 'null');
            if (stored && Array.isArray(stored.users)) {
                users = stored.users;
            }
        } catch (err) {
            console.warn('Erro ao ler a base guardada no browser', err);
        }
    };

    const usersPromise = loadUsers();

    showPassword.addEventListener('change', () => {
        passwordInput.type = showPassword.checked ? 'text' : 'password';
    });

    const goToDashboard = (user) => {
        sessionStorage.setItem('backofficeUser', JSON.stringify(user));
        if ((user.role || '').toString() === 'mesa') {
            window.location.href = '../index.html';
            return;
        }

        window.location.href = '../admin/index.html';
    };

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        await usersPromise;

        // reset message
        message.innerHTML = '';

        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();

        if (!username || !password) {
            message.innerHTML = '<div class="alert alert-danger alert-inline">Preenche o utilizador e a palavra-passe.</div>';
            return;
        }

        button.disabled = true;
        button.textContent = 'A validar...';

        const match = users.find((u) => {
            const uName = (u.username || u.name || '').toString();
            return uName === username && (u.password || '') === password;
        });

        setTimeout(() => {
            if (match) {
                message.innerHTML = '<div class="alert alert-success alert-inline">Login efetuado com sucesso.</div>';
                // small delay to show message
                setTimeout(() => { goToDashboard(match); }, 600);
            } else {
                message.innerHTML = '<div class="alert alert-danger alert-inline">Credenciais inválidas.</div>';
            }

            button.disabled = false;
            button.textContent = 'Entrar';
        }, 600);
    });
});
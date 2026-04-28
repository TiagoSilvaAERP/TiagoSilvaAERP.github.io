document.addEventListener('DOMContentLoaded', async () => {
    const page = document.body.dataset.page || 'overview';
    const storageKey = 'backofficeDatabase';
    const baseDatabaseUrl = '../assets/db/database.json';

    const sidebar = document.getElementById('adminSidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const logoutBtn = document.getElementById('logoutBtn');
    const accessAlert = document.getElementById('accessAlert');

    const sidebarUserName = document.getElementById('sidebarUserName');
    const sidebarUserRole = document.getElementById('sidebarUserRole');
    const topbarUserName = document.getElementById('topbarUserName');
    const topbarUserRole = document.getElementById('topbarUserRole');

    const topbarActions = document.querySelector('.topbar-actions');

    const database = {
        users: [],
        partidos: [],
        temas: [],
        tempofala: [],
        settings: {
            defaultSessionMinutes: 20,
            enabled: true,
        },
    };

    let editingPartyId = null;
    let editingUserId = null;
    let editingTemaId = null;
    let editingTempofalaId = null;

    const currentUser = JSON.parse(sessionStorage.getItem('backofficeUser') || '{}');
    const currentRole = (currentUser.role || 'guest').toString();
    const isAdmin = currentRole === 'admin';

    const partyForm = document.getElementById('partyForm');
    const partyGrid = document.getElementById('partyGrid');
    const partyCount = document.getElementById('partyCount');
    const partyNameInput = document.getElementById('partyName');
    const partyShortInput = document.getElementById('partyShort');
    const partyColorInput = document.getElementById('partyColor');
    const partyImageInput = document.getElementById('partyImage');
    const partySubmitButton = document.getElementById('partySubmitButton');
    const cancelPartyEdit = document.getElementById('cancelPartyEdit');

    const userForm = document.getElementById('userForm');
    const usersTable = document.getElementById('usersTable');
    const userCount = document.getElementById('userCount');
    const userNameInput = document.getElementById('userName');
    const userUsernameInput = document.getElementById('userUsername');
    const userPasswordInput = document.getElementById('userPassword');
    const userRoleInput = document.getElementById('userRole');
    const userSubmitButton = document.getElementById('userSubmitButton');
    const cancelUserEdit = document.getElementById('cancelUserEdit');

    const themeForm = document.getElementById('themeForm');
    const themeNameInput = document.getElementById('themeName');
    const themeNotesInput = document.getElementById('themeNotes');
    const themeCount = document.getElementById('themeCount');
    const themeBadges = document.getElementById('themeBadges');
    const temasTable = document.getElementById('temasTable');
    const themeSubmitButton = document.getElementById('themeSubmitButton');
    const cancelThemeEdit = document.getElementById('cancelThemeEdit');

    const speakingTimeForm = document.getElementById('speakingTimeForm');
    const speakingTheme = document.getElementById('speakingTheme');
    const speakingParty = document.getElementById('speakingParty');
    const speakingMinutes = document.getElementById('speakingMinutes');
    const tempofalaTable = document.getElementById('tempofalaTable') || document.getElementById('speakingTimesTable');
    const timeBadges = document.getElementById('timeBadges');
    const timeSummary = document.getElementById('timeSummary');
    const speakingTimeSubmitButton = document.getElementById('speakingTimeSubmitButton');
    const cancelSpeakingTimeEdit = document.getElementById('cancelSpeakingTimeEdit');

    const countCards = {
        parties: document.getElementById('partyCountOverview'),
        users: document.getElementById('userCountOverview'),
        themes: document.getElementById('themeCountOverview'),
        times: document.getElementById('timeCountOverview'),
    };

    const loadDatabase = async () => {
        const response = await fetch(baseDatabaseUrl, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error('Não foi possível carregar a base inicial.');
        }

        const baseData = await response.json();
        database.users = Array.isArray(baseData.users) ? baseData.users : [];
        database.partidos = Array.isArray(baseData.partidos) ? baseData.partidos : [];
        database.temas = Array.isArray(baseData.temas) ? baseData.temas : [];
        database.tempofala = Array.isArray(baseData.tempofala) ? baseData.tempofala : [];
        database.settings = baseData.settings && typeof baseData.settings === 'object'
            ? { ...database.settings, ...baseData.settings }
            : { ...database.settings };

        const mergeById = (baseItems, storedItems) => {
            const merged = new Map();

            storedItems.forEach((item) => {
                merged.set(Number(item.id), { ...item });
            });

            baseItems.forEach((item) => {
                merged.set(Number(item.id), { ...item });
            });

            return Array.from(merged.values());
        };

        try {
            const stored = JSON.parse(localStorage.getItem(storageKey) || 'null');
            if (stored && typeof stored === 'object') {
                database.users = Array.isArray(stored.users)
                    ? mergeById(database.users, stored.users)
                    : database.users;
                database.partidos = Array.isArray(stored.partidos)
                    ? mergeById(database.partidos, stored.partidos)
                    : database.partidos;
                database.temas = Array.isArray(stored.temas)
                    ? mergeById(database.temas, stored.temas)
                    : database.temas;
                database.tempofala = Array.isArray(stored.tempofala)
                    ? mergeById(database.tempofala, stored.tempofala)
                    : database.tempofala;
                database.settings = stored.settings && typeof stored.settings === 'object'
                    ? { ...database.settings, ...stored.settings }
                    : database.settings;
            }
        } catch {
            // keep base data
        }
    };

    const saveDatabase = async () => {
        localStorage.setItem(storageKey, JSON.stringify(database));
    };

    const nextId = (items) => items.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1;
    const getParty = (id) => database.partidos.find((party) => Number(party.id) === Number(id));
    const getTheme = (id) => database.temas.find((theme) => Number(theme.id) === Number(id));
    const getUser = (id) => database.users.find((user) => Number(user.id) === Number(id));

    const setHeaderUser = () => {
        const label = currentUser.name || currentUser.username || 'Utilizador';
        if (sidebarUserName) sidebarUserName.textContent = label;
        if (sidebarUserRole) sidebarUserRole.textContent = currentRole;
        if (topbarUserName) topbarUserName.textContent = label;
        if (topbarUserRole) topbarUserRole.textContent = `role: ${currentRole}`;
    };

    const setAccessMessage = () => {
        if (!accessAlert) return;

        if (!isAdmin) {
            accessAlert.innerHTML = `
                <div class="alert alert-warning shadow-sm">
                    <strong>Acesso limitado:</strong> só o utilizador <strong>admin</strong> pode criar, editar ou remover itens.
                </div>
            `;
        } else {
            accessAlert.innerHTML = '';
        }
    };

    const setSidebarState = () => {
        if (!sidebarToggle || !sidebar) return;
        sidebarToggle.addEventListener('click', () => sidebar.classList.toggle('open'));
    };

    const setLogout = () => {
        if (!logoutBtn) return;
        logoutBtn.addEventListener('click', () => {
            sessionStorage.removeItem('backofficeUser');
            window.location.href = '../auth/login.html';
        });
    };

    const setBackButton = () => {
        if (!topbarActions || page === 'overview') return;

        const existing = document.getElementById('backToOverviewBtn');
        if (existing) return;

        const backButton = document.createElement('a');
        backButton.id = 'backToOverviewBtn';
        backButton.className = 'btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-1';
        backButton.href = 'index.html';
        backButton.innerHTML = '<i class="bx bx-arrow-back"></i> Voltar';

        topbarActions.insertBefore(backButton, topbarActions.firstChild);
    };

    const updateOverviewCounts = () => {
        if (countCards.parties) countCards.parties.textContent = String(database.partidos.length);
        if (countCards.users) countCards.users.textContent = String(database.users.length);
        if (countCards.themes) countCards.themes.textContent = String(database.temas.length);
        if (countCards.times) countCards.times.textContent = String(database.tempofala.length);
    };

    const syncPartyFormMode = () => {
        if (!partySubmitButton) return;
        partySubmitButton.innerHTML = editingPartyId ? '<i class="bx bx-save"></i> Atualizar partido' : '<i class="bx bx-plus"></i> Guardar partido';
        if (cancelPartyEdit) cancelPartyEdit.classList.toggle('d-none', !editingPartyId);
    };

    const syncUserFormMode = () => {
        if (!userSubmitButton) return;
        userSubmitButton.innerHTML = editingUserId ? '<i class="bx bx-save"></i> Atualizar utilizador' : '<i class="bx bx-plus"></i> Adicionar utilizador';
        if (cancelUserEdit) cancelUserEdit.classList.toggle('d-none', !editingUserId);
    };

    const syncThemeFormMode = () => {
        if (!themeSubmitButton) return;
        themeSubmitButton.innerHTML = editingTemaId ? '<i class="bx bx-save"></i> Atualizar tema' : '<i class="bx bx-plus"></i> Guardar tema';
        if (cancelThemeEdit) cancelThemeEdit.classList.toggle('d-none', !editingTemaId);
    };

    const syncTimeFormMode = () => {
        if (!speakingTimeSubmitButton) return;
        speakingTimeSubmitButton.innerHTML = editingTempofalaId ? '<i class="bx bx-save"></i> Atualizar tempo' : '<i class="bx bx-plus"></i> Adicionar tempo';
        if (cancelSpeakingTimeEdit) cancelSpeakingTimeEdit.classList.toggle('d-none', !editingTempofalaId);
    };

    const resetPartyForm = () => {
        if (!partyForm) return;
        partyForm.reset();
        if (partyColorInput) partyColorInput.value = '#2563eb';
        editingPartyId = null;
        syncPartyFormMode();
    };

    const resetUserForm = () => {
        if (!userForm) return;
        userForm.reset();
        editingUserId = null;
        syncUserFormMode();
    };

    const resetThemeForm = () => {
        if (!themeForm) return;
        themeForm.reset();
        editingTemaId = null;
        syncThemeFormMode();
    };

    const resetTimeForm = () => {
        if (!speakingTimeForm) return;
        speakingTimeForm.reset();
        if (speakingMinutes) speakingMinutes.value = '20';
        editingTempofalaId = null;
        syncTimeFormMode();
    };

    const renderParties = () => {
        if (page !== 'partidos' || !partyGrid || !partyCount) return;

        partyCount.textContent = String(database.partidos.length);
        partyGrid.innerHTML = database.partidos.length
            ? database.partidos.map((party) => `
                <article class="party-card">
                    <div class="party-cover" style="background-image:url('${party.image || ''}')"></div>
                    <div class="party-body">
                        <div class="d-flex align-items-start justify-content-between gap-2">
                            <div>
                                <h5>${party.name || 'Partido'}</h5>
                                <p>${party.short || '--'}</p>
                            </div>
                            <span class="badge text-bg-light" style="border:1px solid ${party.color || '#2563eb'}; color:${party.color || '#2563eb'};">${party.color || '#2563eb'}</span>
                        </div>
                        <div class="party-actions">
                            <button class="btn btn-sm btn-outline-primary" type="button" data-action="edit-party" data-id="${party.id}"><i class="bx bx-edit"></i> Editar</button>
                            <button class="btn btn-sm btn-outline-danger" type="button" data-action="delete-party" data-id="${party.id}"><i class="bx bx-trash"></i> Remover</button>
                        </div>
                    </div>
                </article>
            `).join('')
            : '<div class="text-muted">Ainda não há partidos adicionados.</div>';
    };

    const renderUsers = () => {
        if (page !== 'utilizadores' || !usersTable || !userCount) return;

        userCount.textContent = String(database.users.length);
        usersTable.innerHTML = database.users.length
            ? database.users.map((user) => `
                <tr>
                    <td>
                        <strong>${user.name || 'Utilizador'}</strong>
                    </td>
                    <td>${user.username || '--'}</td>
                    <td><span class="badge text-bg-${user.role === 'admin' ? 'primary' : user.role === 'mesa' ? 'success' : 'secondary'}">${user.role || 'user'}</span></td>
                    <td class="text-end">
                        <div class="user-actions justify-content-end">
                            <button class="btn btn-sm btn-outline-primary" type="button" data-action="edit-user" data-id="${user.id}"><i class="bx bx-edit"></i></button>
                            <button class="btn btn-sm btn-outline-danger" type="button" data-action="delete-user" data-id="${user.id}"><i class="bx bx-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `).join('')
            : '<tr><td colspan="4" class="text-muted">Ainda não há utilizadores.</td></tr>';
    };

    const renderThemes = () => {
        if (page !== 'temas') return;

        if (themeCount) themeCount.textContent = String(database.temas.length);
        if (themeBadges) {
            themeBadges.innerHTML = database.temas.length
                ? database.temas.map((theme) => `
                    <span class="badge text-bg-light text-dark border d-inline-flex align-items-center gap-2">
                        ${theme.name}
                        <button type="button" class="btn p-0 border-0 bg-transparent text-danger" data-action="delete-theme" data-id="${theme.id}" aria-label="Remover tema">
                            <i class="bx bx-x"></i>
                        </button>
                    </span>
                `).join('')
                : '<span class="text-muted">Ainda não existem temas.</span>';
        }

        if (temasTable) {
            temasTable.innerHTML = database.temas.length
                ? database.temas.map((theme) => `
                    <tr>
                        <td>${theme.name || '--'}</td>
                        <td>${theme.notes || '<span class="text-muted">sem notas</span>'}</td>
                        <td class="text-end">
                            <button class="btn btn-sm btn-outline-danger" type="button" data-action="delete-theme" data-id="${theme.id}"><i class="bx bx-trash"></i></button>
                        </td>
                    </tr>
                `).join('')
                : '<tr><td colspan="3" class="text-muted">Ainda não há temas.</td></tr>';
        }
    };

    const renderSpeakingTimeSelects = () => {
        if (page !== 'tempofala') return;

        if (speakingTheme) {
            speakingTheme.innerHTML = database.temas.length
                ? [
                    '<option value="">Seleciona um tema</option>',
                    ...database.temas.map((theme) => `<option value="${theme.id}">${theme.name || 'Tema'}</option>`),
                ].join('')
                : '<option value="">Sem temas configurados</option>';
        }

        if (speakingParty) {
            speakingParty.innerHTML = database.partidos.length
                ? [
                    '<option value="">Seleciona um partido</option>',
                    ...database.partidos.map((party) => `<option value="${party.id}">${party.name || 'Partido'}</option>`),
                ].join('')
                : '<option value="">Sem partidos configurados</option>';
        }

        if (editingTempofalaId) {
            const item = database.tempofala.find((entry) => Number(entry.id) === Number(editingTempofalaId));
            if (item) {
                speakingTheme.value = String(item.themeId);
                speakingParty.value = String(item.partyId);
            }
        }
    };

    const renderSpeakingTimes = () => {
        if (page !== 'tempofala' || !tempofalaTable || !timeBadges || !timeSummary) return;

        timeSummary.textContent = String(database.tempofala.length);
        const totalMinutes = database.tempofala.reduce((sum, item) => sum + (Number(item.minutes) || 0), 0);
        timeBadges.innerHTML = `
            <span class="badge text-bg-primary">Temas: ${database.temas.length}</span>
            <span class="badge text-bg-dark">Partidos: ${database.partidos.length}</span>
            <span class="badge text-bg-success">Atribuições: ${database.tempofala.length}</span>
            <span class="badge text-bg-warning">Total: ${totalMinutes} min</span>
        `;

        tempofalaTable.innerHTML = database.tempofala.length
            ? database.tempofala.map((item) => {
                const theme = getTheme(item.themeId);
                const party = getParty(item.partyId);

                return `
                    <tr>
                        <td>${theme ? theme.name : 'Tema eliminado'}</td>
                        <td>${party ? party.name : 'Partido eliminado'}</td>
                        <td><strong>${item.minutes || 0} min</strong></td>
                        <td class="text-end">
                            <div class="user-actions justify-content-end">
                                <button class="btn btn-sm btn-outline-primary" type="button" data-action="edit-speaking-time" data-id="${item.id}"><i class="bx bx-edit"></i></button>
                                <button class="btn btn-sm btn-outline-danger" type="button" data-action="delete-speaking-time" data-id="${item.id}"><i class="bx bx-trash"></i></button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('')
            : '<tr><td colspan="4" class="text-muted">Ainda não há tempos definidos.</td></tr>';
    };

    const renderOverview = () => {
        if (page !== 'overview') return;
        updateOverviewCounts();
    };

    const renderAll = () => {
        setHeaderUser();
        setAccessMessage();
        renderOverview();
        renderParties();
        renderUsers();
        renderThemes();
        renderSpeakingTimeSelects();
        renderSpeakingTimes();
    };

    const pageGuard = () => {
        if (page === 'overview') return;
        if (page === 'partidos' && !partyForm) return;
        if (page === 'utilizadores' && !userForm) return;
        if (page === 'temas' && !themeForm) return;
        if (page === 'tempofala' && !speakingTimeForm) return;
    };

    if (page === 'partidos' && partyForm) {
        partyForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (!isAdmin) return;

            const name = partyNameInput.value.trim();
            if (!name) return;

            const payload = {
                id: editingPartyId || nextId(database.partidos),
                name,
                short: partyShortInput.value.trim(),
                color: partyColorInput.value,
                image: partyImageInput.value.trim(),
            };

            if (editingPartyId) {
                const index = database.partidos.findIndex((party) => Number(party.id) === Number(editingPartyId));
                if (index !== -1) {
                    database.partidos[index] = payload;
                }
            } else {
                database.partidos.push(payload);
            }

            await saveDatabase();
            resetPartyForm();
            renderAll();
        });

        cancelPartyEdit?.addEventListener('click', resetPartyForm);
    }

    if (page === 'utilizadores' && userForm) {
        userForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (!isAdmin) return;

            const name = userNameInput.value.trim();
            const username = userUsernameInput.value.trim();
            const password = userPasswordInput.value.trim();

            if (!name || !username || !password) return;

            const payload = {
                id: editingUserId || nextId(database.users),
                name,
                username,
                password,
                role: userRoleInput.value,
            };

            if (editingUserId) {
                const index = database.users.findIndex((user) => Number(user.id) === Number(editingUserId));
                if (index !== -1) {
                    database.users[index] = payload;
                }
            } else {
                database.users.push(payload);
            }

            await saveDatabase();
            resetUserForm();
            renderAll();
        });

        cancelUserEdit?.addEventListener('click', resetUserForm);
    }

    if (page === 'temas' && themeForm) {
        themeForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (!isAdmin) return;

            const name = themeNameInput.value.trim();
            if (!name) return;

            if (editingTemaId) {
                const index = database.temas.findIndex((theme) => Number(theme.id) === Number(editingTemaId));
                if (index !== -1) {
                    database.temas[index] = {
                        ...database.temas[index],
                        name,
                        notes: themeNotesInput.value.trim(),
                    };
                }
            } else {
                database.temas.push({
                    id: nextId(database.temas),
                    name,
                    notes: themeNotesInput.value.trim(),
                });
            }

            await saveDatabase();
            resetThemeForm();
            renderAll();
        });

        cancelThemeEdit?.addEventListener('click', resetThemeForm);
    }

    if (page === 'tempofala' && speakingTimeForm) {
        speakingTimeForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (!isAdmin) return;

            const themeId = Number(speakingTheme.value);
            const partyId = Number(speakingParty.value);
            const minutes = Number(speakingMinutes.value || 0);

            if (!themeId || !partyId || minutes <= 0) return;

            const payload = {
                id: editingTempofalaId || nextId(database.tempofala),
                themeId,
                partyId,
                minutes,
            };

            if (editingTempofalaId) {
                const index = database.tempofala.findIndex((item) => Number(item.id) === Number(editingTempofalaId));
                if (index !== -1) {
                    database.tempofala[index] = payload;
                }
            } else {
                const existing = database.tempofala.find((item) => Number(item.themeId) === themeId && Number(item.partyId) === partyId);
                if (existing) {
                    existing.minutes = minutes;
                } else {
                    database.tempofala.push(payload);
                }
            }

            await saveDatabase();
            resetTimeForm();
            renderAll();
        });

        cancelSpeakingTimeEdit?.addEventListener('click', resetTimeForm);
    }

    document.addEventListener('click', async (event) => {
        const actionButton = event.target.closest('[data-action]');
        if (!actionButton) return;

        const action = actionButton.dataset.action;
        const id = Number(actionButton.dataset.id);

        if (action === 'edit-party') {
            const party = getParty(id);
            if (!party) return;

            partyNameInput.value = party.name || '';
            partyShortInput.value = party.short || '';
            partyColorInput.value = party.color || '#2563eb';
            partyImageInput.value = party.image || '';
            editingPartyId = id;
            syncPartyFormMode();
            partyForm?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        if (action === 'delete-party') {
            database.partidos = database.partidos.filter((party) => Number(party.id) !== id);
            database.tempofala = database.tempofala.filter((item) => Number(item.partyId) !== id);
            await saveDatabase();
            renderAll();
        }

        if (action === 'edit-user') {
            const user = getUser(id);
            if (!user) return;

            userNameInput.value = user.name || '';
            userUsernameInput.value = user.username || '';
            userPasswordInput.value = user.password || '';
            userRoleInput.value = user.role || 'viewer';
            editingUserId = id;
            syncUserFormMode();
            userForm?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        if (action === 'delete-user') {
            database.users = database.users.filter((user) => Number(user.id) !== id);
            await saveDatabase();
            renderAll();
        }

        if (action === 'delete-theme') {
            database.temas = database.temas.filter((theme) => Number(theme.id) !== id);
            database.tempofala = database.tempofala.filter((item) => Number(item.themeId) !== id);
            await saveDatabase();
            renderAll();
        }

        if (action === 'edit-speaking-time') {
            const item = database.tempofala.find((entry) => Number(entry.id) === id);
            if (!item) return;

            speakingTheme.value = String(item.themeId);
            speakingParty.value = String(item.partyId);
            speakingMinutes.value = String(item.minutes || 0);
            editingTempofalaId = id;
            syncTimeFormMode();
            speakingTimeForm?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        if (action === 'delete-speaking-time') {
            database.tempofala = database.tempofala.filter((item) => Number(item.id) !== id);
            await saveDatabase();
            renderAll();
        }
    });

    try {
        await loadDatabase();
        pageGuard();
        renderAll();
    } catch (error) {
        if (accessAlert) {
            accessAlert.innerHTML = `
                <div class="alert alert-danger shadow-sm">
                    <strong>Erro ao carregar a base de dados:</strong> ${error.message}
                </div>
            `;
        }
    }

    setSidebarState();
    setLogout();
    setBackButton();
});

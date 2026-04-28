document.addEventListener('DOMContentLoaded', () => {
    const baseDatabaseUrl = './assets/db/database.json';
    const storageKey = 'backofficeDatabase';
    const speechesKey = 'backofficeMesaSpeeches';
    const themeKey = 'backofficeMesaTheme';
    const unlockKey = 'backofficeMesaThemesUnlocked';
    const lockKey = 'backofficeMesaThemeLocked';

    const currentUser = JSON.parse(sessionStorage.getItem('backofficeUser') || 'null');
    if (!currentUser || (currentUser.role || '').toString() !== 'mesa') {
        if ((currentUser?.role || '').toString() === 'admin') {
            window.location.href = './admin/index.html';
        } else {
            window.location.href = './auth/login.html';
        }
        return;
    }

    const data = {
        users: [],
        partidos: [],
        temas: [],
        tempofala: [],
        settings: {},
    };

    const els = {
        userName: document.getElementById('userName'),
        userRole: document.getElementById('userRole'),
        logoutBtn: document.getElementById('logoutBtn'),
        resetBtn: document.getElementById('resetBtn'),
        themeButtons: document.getElementById('themeButtons'),
        themeHint: document.getElementById('themeHint'),
        selectedThemeLabel: document.getElementById('selectedThemeLabel'),
        partiesGrid: document.getElementById('partiesGrid'),
        infoBanner: document.getElementById('infoBanner'),
    };

    let tick = null;
    let themeUnlocked = localStorage.getItem(unlockKey) === '1';
    let themeLocked = localStorage.getItem(lockKey) === '1';

    const getParty = (id) => data.partidos.find((item) => Number(item.id) === Number(id));
    const getTheme = (id) => data.temas.find((item) => Number(item.id) === Number(id));
    const getConfig = (themeId, partyId) => data.tempofala.find((item) => Number(item.themeId) === Number(themeId) && Number(item.partyId) === Number(partyId));

    const mergeById = (baseItems, storedItems) => {
        const merged = new Map();
        baseItems.forEach((item) => merged.set(Number(item.id), { ...item }));
        storedItems.forEach((item) => merged.set(Number(item.id), { ...item }));
        return Array.from(merged.values());
    };

    const loadDatabase = async () => {
        const response = await fetch(baseDatabaseUrl, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error('Não foi possível carregar a base de dados.');
        }

        const baseData = await response.json();
        data.users = Array.isArray(baseData.users) ? baseData.users : [];
        data.partidos = Array.isArray(baseData.partidos) ? baseData.partidos : [];
        data.temas = Array.isArray(baseData.temas) ? baseData.temas : [];
        data.tempofala = Array.isArray(baseData.tempofala) ? baseData.tempofala : [];
        data.settings = baseData.settings && typeof baseData.settings === 'object' ? { ...baseData.settings } : {};

        try {
            const stored = JSON.parse(localStorage.getItem(storageKey) || 'null');
            if (stored && typeof stored === 'object') {
                data.partidos = Array.isArray(stored.partidos) ? mergeById(data.partidos, stored.partidos) : data.partidos;
                data.temas = Array.isArray(stored.temas) ? mergeById(data.temas, stored.temas) : data.temas;
                data.tempofala = Array.isArray(stored.tempofala) ? mergeById(data.tempofala, stored.tempofala) : data.tempofala;
                data.settings = stored.settings && typeof stored.settings === 'object' ? { ...data.settings, ...stored.settings } : data.settings;
            }
        } catch {
            // mantém o JSON
        }
    };

    const formatSeconds = (value) => {
        const total = Math.max(0, Math.floor(value || 0));
        const minutes = Math.floor(total / 60);
        const seconds = total % 60;
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };

    const speechKey = (themeId, partyId) => `${Number(themeId)}:${Number(partyId)}`;

    const readSpeeches = () => {
        try {
            const raw = localStorage.getItem(speechesKey);
            const parsed = raw ? JSON.parse(raw) : {};
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch {
            return {};
        }
    };

    const saveSpeeches = (states) => {
        localStorage.setItem(speechesKey, JSON.stringify(states));
    };

    const clearSpeeches = () => {
        localStorage.removeItem(speechesKey);
    };

    const getSelectedThemeId = () => {
        const stored = Number(localStorage.getItem(themeKey) || 0);
        if (stored) return stored;
        return Number(data.temas[0]?.id || 0);
    };

    const setSelectedThemeId = (themeId) => {
        localStorage.setItem(themeKey, String(themeId || ''));
    };

    const setThemesUnlocked = (value) => {
        themeUnlocked = Boolean(value);
        localStorage.setItem(unlockKey, themeUnlocked ? '1' : '0');
    };

    const setThemeLocked = (value) => {
        themeLocked = Boolean(value);
        localStorage.setItem(lockKey, themeLocked ? '1' : '0');
    };

    const syncHeader = () => {
        if (els.userName) els.userName.textContent = currentUser.name || currentUser.username || 'Mesa';
        if (els.userRole) els.userRole.textContent = currentUser.role || 'mesa';
    };

    const setBanner = (type, title, text) => {
        if (!els.infoBanner) return;

        const alertClass = type === 'danger' ? 'alert-danger' : type === 'success' ? 'alert-success' : type === 'warning' ? 'alert-warning' : 'alert-info';
        els.infoBanner.innerHTML = `
            <div class="mesa-alert alert ${alertClass} mb-0 shadow-sm">
                <strong>${title}</strong>
                <div>${text}</div>
            </div>
        `;
    };

    const getMinutesForCurrentSelection = (themeId, partyId) => {
        const config = getConfig(themeId, partyId);
        return Number(config?.minutes) || Number(data.settings.defaultSessionMinutes) || 20;
    };

    const getStateSnapshot = (state) => {
        if (!state) {
            return { elapsedSeconds: 0, remainingSeconds: 0, running: false };
        }

        const startedAt = Number(state.startedAt || 0);
        const elapsedSeconds = Number(state.elapsedSeconds || 0) + (state.running ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : 0);
        const remainingSeconds = Math.max(0, Number(state.totalSeconds || 0) - elapsedSeconds);

        return {
            elapsedSeconds,
            remainingSeconds,
            running: Boolean(state.running),
        };
    };

    const stopTick = () => {
        if (tick) {
            clearInterval(tick);
            tick = null;
        }
    };

    const startTick = () => {
        stopTick();
        tick = setInterval(renderAll, 1000);
    };

    const renderThemeButtons = () => {
        if (!els.themeButtons) return;

        if (!data.temas.length) {
            els.themeButtons.innerHTML = '<div class="mesa-empty">Ainda não existem temas configurados.</div>';
            return;
        }

        const selectedThemeId = getSelectedThemeId();

        els.themeButtons.innerHTML = data.temas.map((theme) => {
            const active = Number(theme.id) === Number(selectedThemeId);
            const disabled = !themeUnlocked || (themeLocked && !active);

            return `
                <button class="btn mesa-theme-btn ${active ? 'is-active' : ''}" type="button" data-theme-id="${theme.id}" ${disabled ? 'disabled' : ''}>
                    <span class="mesa-theme-index">${String(theme.id).padStart(2, '0')}</span>
                    <span class="mesa-theme-name">${theme.name || 'Tema'}</span>
                </button>
            `;
        }).join('');

        if (els.themeHint) {
            els.themeHint.textContent = themeUnlocked
                ? 'Agora já podes trocar entre temas.'
                : 'Primeiro clica em reset para poderes escolher os temas.';
        }

        if (els.selectedThemeLabel) {
            const theme = getTheme(selectedThemeId);
            els.selectedThemeLabel.textContent = theme ? theme.name : 'Nenhum';
        }
    };

    const renderPartyList = () => {
        if (!els.partiesGrid) return;

        if (!data.partidos.length) {
            els.partiesGrid.innerHTML = '<div class="mesa-empty">Ainda não existem partidos configurados.</div>';
            return;
        }

        const selectedThemeId = getSelectedThemeId();
        const theme = getTheme(selectedThemeId);
        const states = readSpeeches();

        els.partiesGrid.innerHTML = data.partidos.map((party) => {
            const key = speechKey(selectedThemeId, party.id);
            const state = states[key] || null;
            const snapshot = getStateSnapshot(state);
            const baseSeconds = Number(state?.totalSeconds || getMinutesForCurrentSelection(selectedThemeId, party.id) * 60);
            const remainingSeconds = snapshot.running || snapshot.elapsedSeconds > 0
                ? Math.max(0, baseSeconds - snapshot.elapsedSeconds)
                : baseSeconds;
            const progress = baseSeconds > 0 ? Math.min(100, ((baseSeconds - remainingSeconds) / baseSeconds) * 100) : 0;
            const statusLabel = snapshot.running
                ? 'A falar'
                : remainingSeconds <= 0 && snapshot.elapsedSeconds > 0
                    ? 'Tempo esgotado'
                    : snapshot.elapsedSeconds > 0 && remainingSeconds > 0
                    ? 'Em pausa'
                    : 'Pronto';

            return `
                <article class="mesa-party ${snapshot.running ? 'is-running' : ''} ${remainingSeconds <= 0 && snapshot.elapsedSeconds > 0 ? 'is-expired' : ''}">
                    <div class="mesa-party-image-wrap">
                        <img class="mesa-party-image" src="${party.image || ''}" alt="${party.name || 'Partido'}">
                    </div>
                    <div class="mesa-party-content">
                        <div class="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
                            <div>
                                <h3 class="mesa-party-name mb-1">${party.name || 'Partido'}</h3>
                                <div class="mesa-party-meta">${theme ? theme.name : 'Tema'} • ${party.short || '--'}</div>
                            </div>
                            <span class="badge ${snapshot.running ? 'text-bg-success' : 'text-bg-light text-dark border'}">${statusLabel}</span>
                        </div>
                        <div class="mesa-time-line">
                            <div>
                                <small class="text-muted d-block">Tempo</small>
                                <strong class="mesa-time-value ${remainingSeconds <= 0 && snapshot.elapsedSeconds > 0 ? 'is-expired' : ''}">${formatSeconds(remainingSeconds)}</strong>
                            </div>
                            <div>
                                <div class="progress mesa-progress" role="progressbar" aria-valuenow="${Math.round(progress)}" aria-valuemin="0" aria-valuemax="100">
                                    <div class="progress-bar" style="width: ${progress}%"></div>
                                </div>
                                <small class="text-muted">${Math.round(progress)}% usado</small>
                            </div>
                        </div>
                        <div class="mesa-party-actions">
                            <button class="btn btn-outline-dark btn-sm" type="button" data-action="play-speech" data-theme="${selectedThemeId}" data-party="${party.id}">
                                <i class="bx bx-play"></i> Play
                            </button>
                            <button class="btn btn-outline-secondary btn-sm" type="button" data-action="pause-speech" data-theme="${selectedThemeId}" data-party="${party.id}" ${snapshot.running ? '' : 'disabled'}>
                                <i class="bx bx-pause"></i> Pausa
                            </button>
                        </div>
                    </div>
                </article>
            `;
        }).join('');
    };

    const renderAll = () => {
        renderThemeButtons();
        renderPartyList();
    };

    const pauseSpeech = (themeId, partyId) => {
        const states = readSpeeches();
        const key = speechKey(themeId, partyId);
        const current = states[key];

        if (!current || !current.running) return;

        const elapsedSeconds = Number(current.elapsedSeconds || 0) + Math.max(0, Math.floor((Date.now() - Number(current.startedAt || Date.now())) / 1000));
        states[key] = {
            ...current,
            elapsedSeconds,
            running: false,
            startedAt: undefined,
        };

        saveSpeeches(states);
        stopTick();
        renderAll();

        const party = getParty(partyId);
        const theme = getTheme(themeId);
        setBanner('info', 'Palavra em pausa', `${party ? party.name : 'O partido'} ficou em pausa em ${theme ? theme.name : 'tema'} com ${formatSeconds(Math.max(0, Number(current.totalSeconds || 0) - elapsedSeconds))} restantes.`);
    };

    const playSpeech = (themeId, partyId) => {
        const theme = getTheme(themeId);
        const party = getParty(partyId);

        if (!theme || !party) return;

        if (!themeUnlocked) {
            setBanner('warning', 'Temas bloqueados', 'Primeiro clica em reset para poderes escolher os temas.');
            return;
        }

        const totalSeconds = getMinutesForCurrentSelection(themeId, partyId) * 60;
        const states = readSpeeches();

        Object.entries(states).forEach(([key, state]) => {
            if (!state?.running) return;
            if (key === speechKey(themeId, partyId)) return;
            const elapsedSeconds = Number(state.elapsedSeconds || 0) + Math.max(0, Math.floor((Date.now() - Number(state.startedAt || Date.now())) / 1000));
            states[key] = {
                ...state,
                elapsedSeconds,
                running: false,
                startedAt: undefined,
            };
        });

        const key = speechKey(themeId, partyId);
        const current = states[key] || { themeId: Number(themeId), partyId: Number(partyId), totalSeconds, elapsedSeconds: 0, running: false };
        const snapshot = getStateSnapshot(current);
        const remainingSeconds = Math.max(0, totalSeconds - snapshot.elapsedSeconds);

        if (remainingSeconds <= 0 && current.elapsedSeconds > 0) {
            states[key] = {
                ...current,
                totalSeconds,
                running: false,
                startedAt: undefined,
            };
            saveSpeeches(states);
            renderAll();
            setBanner('warning', 'Tempo esgotado', `${party.name} já usou o tempo definido para ${theme.name}.`);
            return;
        }

        states[key] = {
            themeId: Number(themeId),
            partyId: Number(partyId),
            totalSeconds,
            elapsedSeconds: snapshot.elapsedSeconds,
            running: true,
            startedAt: Date.now(),
        };

        saveSpeeches(states);
        setSelectedThemeId(themeId);
        setThemeLocked(true);
        startTick();
        renderAll();
        setBanner('success', 'Palavra atribuída', `${party.name} começou a falar em ${theme.name}.`);
    };

    const resetMesa = () => {
        clearSpeeches();
        setThemesUnlocked(true);
        setThemeLocked(false);

        if (!localStorage.getItem(themeKey) && data.temas.length) {
            setSelectedThemeId(data.temas[0].id);
        }

        stopTick();
        renderAll();
        setBanner('warning', 'Reset feito', 'Os temas ficaram desbloqueados e os tempos foram limpos.');
    };

    const bindEvents = () => {
        els.resetBtn?.addEventListener('click', resetMesa);

        document.addEventListener('click', (event) => {
            const themeButton = event.target.closest('[data-theme-id]');
            if (themeButton) {
                if (!themeUnlocked) {
                    setBanner('warning', 'Temas bloqueados', 'Primeiro clica em reset para poderes escolher os temas.');
                    return;
                }

                const themeId = Number(themeButton.dataset.themeId);
                if (!themeId) return;
                setSelectedThemeId(themeId);
                setThemeLocked(true);
                renderAll();
                const theme = getTheme(themeId);
                setBanner('info', 'Tema selecionado', theme ? `A mesa ficou em ${theme.name}.` : 'Tema selecionado.');
                return;
            }

            const actionButton = event.target.closest('[data-action]');
            if (!actionButton) return;

            const action = actionButton.dataset.action;
            const themeId = Number(actionButton.dataset.theme);
            const partyId = Number(actionButton.dataset.party);

            if (!themeId || !partyId) return;

            if (action === 'play-speech') {
                playSpeech(themeId, partyId);
            }

            if (action === 'pause-speech') {
                pauseSpeech(themeId, partyId);
            }
        });

        els.logoutBtn?.addEventListener('click', () => {
            sessionStorage.removeItem('backofficeUser');
            clearSpeeches();
            window.location.href = './auth/login.html';
        });
    };

    const init = async () => {
        await loadDatabase();
        syncHeader();

        if (!localStorage.getItem(themeKey) && data.temas.length) {
            setSelectedThemeId(data.temas[0].id);
        }

        if (!localStorage.getItem(unlockKey)) {
            setThemesUnlocked(false);
        }

        if (!localStorage.getItem(lockKey)) {
            setThemeLocked(false);
        }

        renderAll();
        bindEvents();

        const hasRunning = Object.values(readSpeeches()).some((state) => Boolean(state?.running));
        if (hasRunning) {
            startTick();
            setBanner('warning', 'Palavra em curso', 'Existe pelo menos uma fila ativa guardada nesta sessão.');
            return;
        }

        setBanner('info', 'Mesa pronta', themeUnlocked ? 'Podes escolher um tema e controlar a fila.' : 'Primeiro clica em reset para desbloquear os temas.');
    };

    init().catch((error) => {
        if (els.infoBanner) {
            els.infoBanner.innerHTML = `
                <div class="mesa-alert alert alert-danger mb-0 shadow-sm">
                    <strong>Erro ao carregar a mesa:</strong>
                    <div>${error.message}</div>
                </div>
            `;
        }
    });
});
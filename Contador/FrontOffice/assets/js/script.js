document.addEventListener('DOMContentLoaded', () => {
    const baseDatabaseUrl = '../../BackOffice/assets/db/database.json';
    const storageKey = 'backofficeDatabase';
    const speechesKey = 'backofficeMesaSpeeches';
    const themeKey = 'backofficeMesaTheme';

    const els = {
        partyName: document.getElementById('partyName'),
        timer: document.getElementById('timer'),
        statusText: document.getElementById('statusText'),
        progressBar: document.getElementById('progressBar'),
        sidebar: document.querySelector('.sidebar'),
    };

    const data = {
        partidos: [],
        temas: [],
        tempofala: [],
        settings: {},
    };

    let selectedPartyId = null;
    let activeThemeId = null;
    let tick = null;

    const mergeById = (baseItems, storedItems) => {
        const merged = new Map();

        storedItems.forEach((item) => merged.set(Number(item.id), { ...item }));
        baseItems.forEach((item) => merged.set(Number(item.id), { ...item }));

        return Array.from(merged.values());
    };

    const loadDatabase = async () => {
        const response = await fetch(baseDatabaseUrl, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error('Não foi possível carregar a base de dados.');
        }

        const baseData = await response.json();
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
            // keep base JSON
        }
    };

    const readSpeeches = () => {
        try {
            const raw = localStorage.getItem(speechesKey);
            const parsed = raw ? JSON.parse(raw) : {};
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch {
            return {};
        }
    };

    const formatTime = (seconds) => {
        const total = Math.max(0, Math.floor(seconds || 0));
        const mins = Math.floor(total / 60);
        const secs = total % 60;
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };

    const getTheme = (id) => data.temas.find((theme) => Number(theme.id) === Number(id));
    const getParty = (id) => data.partidos.find((party) => Number(party.id) === Number(id));
    const getConfig = (themeId, partyId) => data.tempofala.find((item) => Number(item.themeId) === Number(themeId) && Number(item.partyId) === Number(partyId));

    const getSelectedThemeId = () => {
        const stored = Number(localStorage.getItem(themeKey) || 0);
        if (stored) return stored;
        return Number(data.temas[0]?.id || 0);
    };

    const getSpeechKey = (themeId, partyId) => `${Number(themeId)}:${Number(partyId)}`;

    const getSpeechSnapshot = (state) => {
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

    const getPartySpeechState = (themeId, partyId) => {
        const speeches = readSpeeches();
        return speeches[getSpeechKey(themeId, partyId)] || null;
    };

    const getMinutesForParty = (themeId, partyId) => {
        const config = getConfig(themeId, partyId);
        return Number(config?.minutes) || Number(data.settings.defaultSessionMinutes) || 20;
    };

    const getActiveSpeech = () => {
        const speeches = readSpeeches();
        return Object.values(speeches).find((state) => Boolean(state?.running)) || null;
    };

    const updateMainView = () => {
        const selectedThemeId = activeThemeId || getSelectedThemeId();
        const activeSpeech = getActiveSpeech();
        const currentThemeId = activeSpeech ? Number(activeSpeech.themeId) : selectedThemeId;
        const currentPartyId = activeSpeech ? Number(activeSpeech.partyId) : selectedPartyId || Number(data.partidos[0]?.id || 0);
        const theme = getTheme(currentThemeId);
        const party = getParty(currentPartyId);
        const state = activeSpeech || getPartySpeechState(currentThemeId, currentPartyId);
        const snapshot = getSpeechSnapshot(state);
        const totalSeconds = Number(state?.totalSeconds || getMinutesForParty(currentThemeId, currentPartyId) * 60);
        const remainingSeconds = state ? snapshot.remainingSeconds : totalSeconds;
        const progress = totalSeconds > 0 ? Math.min(100, ((totalSeconds - remainingSeconds) / totalSeconds) * 100) : 0;
        const expired = remainingSeconds <= 0 && (snapshot.elapsedSeconds > 0 || Boolean(state));

        if (els.partyName) {
            els.partyName.textContent = party ? (party.short || party.name || '---') : '---';
        }

        if (els.timer) {
            els.timer.textContent = formatTime(remainingSeconds);
            els.timer.classList.toggle('negative', expired);
        }

        if (els.statusText) {
            if (snapshot.running) {
                els.statusText.textContent = 'EM CURSO';
            } else if (expired) {
                els.statusText.textContent = 'TEMPO ESGOTADO';
            } else if (snapshot.elapsedSeconds > 0) {
                els.statusText.textContent = 'EM PAUSA';
            } else {
                els.statusText.textContent = 'EM ESPERA';
            }
        }

        if (els.progressBar) {
            els.progressBar.style.width = `${progress}%`;
            els.progressBar.classList.toggle('negative', expired);
        }
    };

    const renderSidebar = () => {
        if (!els.sidebar) return;

        const selectedThemeId = activeThemeId || getSelectedThemeId();
        const speeches = readSpeeches();
        const activeSpeech = getActiveSpeech();

        const partyMarkup = data.partidos.map((party) => {
            const state = speeches[getSpeechKey(selectedThemeId, party.id)] || null;
            const snapshot = getSpeechSnapshot(state);
            const totalSeconds = Number(state?.totalSeconds || getMinutesForParty(selectedThemeId, party.id) * 60);
            const remainingSeconds = state ? snapshot.remainingSeconds : totalSeconds;
            const isActive = activeSpeech && Number(activeSpeech.partyId) === Number(party.id) && Number(activeSpeech.themeId) === Number(selectedThemeId);
            const expired = remainingSeconds <= 0 && (snapshot.elapsedSeconds > 0 || Boolean(state));
            const classes = ['party-item'];
            if (isActive) classes.push('active');
            if (expired) classes.push('expired');
            if (isActive) classes.push('broadcast');

            return `
                <div class="${classes.join(' ')}">
                    <span class="party-label">${party.short || party.name || 'Partido'}</span>
                    <span class="side-timer">${formatTime(remainingSeconds)}</span>
                </div>
            `;
        }).join('');

        els.sidebar.innerHTML = partyMarkup;
    };

    const setSelectedPartyFromCurrentTheme = () => {
        const selectedThemeId = activeThemeId || getSelectedThemeId();
        const activeSpeech = getActiveSpeech();

        if (activeSpeech && Number(activeSpeech.themeId) === Number(selectedThemeId)) {
            selectedPartyId = Number(activeSpeech.partyId);
            return;
        }

        if (!selectedPartyId) {
            const firstParty = data.partidos[0];
            selectedPartyId = Number(firstParty?.id || 0);
        }
    };

    const renderAll = () => {
        activeThemeId = getSelectedThemeId();
        setSelectedPartyFromCurrentTheme();
        renderSidebar();
        updateMainView();
    };

    const startTicker = () => {
        if (tick) clearInterval(tick);
        tick = setInterval(renderAll, 1000);
    };

    const bindEvents = () => {
        window.addEventListener('storage', (event) => {
            if ([storageKey, speechesKey, themeKey].includes(event.key)) {
                renderAll();
            }
        });
    };

    const init = async () => {
        await loadDatabase();
        bindEvents();
        renderAll();
        startTicker();
    };

    init().catch((error) => {
        if (els.partyName) els.partyName.textContent = 'Erro';
        if (els.statusText) els.statusText.textContent = 'FALHA AO CARREGAR';
        if (els.timer) els.timer.textContent = '--:--';
        console.error(error);
    });
});

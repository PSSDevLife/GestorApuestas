// ====== CONSTANTS & STATE ======
const GOOGLE_CLIENT_ID = '312796004624-378anhhjd7sp70maeug6eb4r992gjkjj.apps.googleusercontent.com'; // ¡Reemplaza aquí tu ID de Google!

let state = {
    initialBankroll: null,
    bets: []
};

let chartInstance = null;

let authState = {
    user: null
};

// ====== INITIALIZATION ======
function init() {
    loadData();
    setupDate();
    setupEventListeners();
    renderAll();
}

function getStorageKey(base) {
    if (authState.user && authState.user.email) {
        return `${base}_${authState.user.email}`;
    }
    return `${base}_guest`;
}

function loadData() {
    const activeUser = localStorage.getItem('bt_active_user');
    if (activeUser) {
        authState.user = JSON.parse(activeUser);
        updateUserProfileUI();
        document.getElementById('btn-google-logout').style.display = 'flex';
        hideLoginScreen();
    } else {
        updateUserProfileUI();
        showLoginScreen();
    }

    const savedBankroll = localStorage.getItem(getStorageKey('bt_initialBankroll'));
    const savedBets = localStorage.getItem(getStorageKey('bt_bets'));

    if (savedBankroll) {
        state.initialBankroll = parseFloat(savedBankroll);
        document.getElementById('initial-bankroll').value = state.initialBankroll;
    } else {
        state.initialBankroll = null;
        document.getElementById('initial-bankroll').value = '';
    }

    if (savedBets) {
        state.bets = JSON.parse(savedBets);
    } else {
        state.bets = [];
    }
}

function saveData() {
    if (state.initialBankroll !== null) {
        localStorage.setItem(getStorageKey('bt_initialBankroll'), state.initialBankroll);
    }
    localStorage.setItem(getStorageKey('bt_bets'), JSON.stringify(state.bets));
}

function setupDate() {
    document.getElementById('bet-date').valueAsDate = new Date();
}

// ====== LOGIC & CALCULATIONS ======
function calculateMetrics() {
    let totalPnL = 0;
    let totalStakeSettled = 0;
    let totalStakePending = 0;
    let wonBets = 0;
    let settledBets = 0;

    state.bets.forEach(bet => {
        const stake = parseFloat(bet.stake);
        const odds = parseFloat(bet.odds);

        if (bet.status === 'Ganada') {
            const profit = (stake * odds) - stake;
            totalPnL += profit;
            totalStakeSettled += stake;
            wonBets++;
            settledBets++;
        } else if (bet.status === 'Perdida') {
            totalPnL -= stake;
            totalStakeSettled += stake;
            settledBets++;
        } else if (bet.status === 'Pendiente') {
            totalStakePending += stake;
        }
    });

    const currentBankroll = (state.initialBankroll || 0) + totalPnL - totalStakePending;
    const yieldROI = totalStakeSettled > 0 ? (totalPnL / totalStakeSettled) * 100 : 0;
    const hitRate = settledBets > 0 ? (wonBets / settledBets) * 100 : 0;

    return {
        currentBankroll,
        totalPnL,
        yieldROI,
        hitRate
    };
}

function getPnLForBet(bet) {
    const stake = parseFloat(bet.stake);
    const odds = parseFloat(bet.odds);

    if (bet.status === 'Ganada') return (stake * odds) - stake;
    if (bet.status === 'Perdida') return -stake;
    return 0;
}

// ====== RENDER ======
function renderAll() {
    updateMetrics();
    renderTable();
    renderChart();
    renderAdvancedStats();
}

function updateMetrics() {
    const metrics = calculateMetrics();

    document.getElementById('metric-bankroll').textContent = `€${metrics.currentBankroll.toFixed(2)}`;
    document.getElementById('metric-pnl').textContent = `€${metrics.totalPnL.toFixed(2)}`;
    document.getElementById('metric-yield').textContent = `${metrics.yieldROI.toFixed(2)}%`;
    document.getElementById('metric-hitrate').textContent = `${metrics.hitRate.toFixed(2)}%`;

    document.getElementById('metric-pnl').className = metrics.totalPnL > 0 ? 'positive' : (metrics.totalPnL < 0 ? 'negative' : '');
    document.getElementById('metric-yield').className = metrics.yieldROI > 0 ? 'positive' : (metrics.yieldROI < 0 ? 'negative' : '');
}

function renderTable() {
    const tbody = document.getElementById('bets-body');
    tbody.innerHTML = '';

    const filterStatus = document.getElementById('filter-status').value;
    const filterFrom = document.getElementById('filter-date-from').value;
    const filterTo = document.getElementById('filter-date-to').value;

    const sortedBets = [...state.bets].sort((a, b) => new Date(b.date) - new Date(a.date));

    sortedBets.forEach(bet => {
        if (filterStatus !== 'Todas' && bet.status !== filterStatus) return;
        if (filterFrom && new Date(bet.date) < new Date(filterFrom)) return;
        if (filterTo && new Date(bet.date) > new Date(filterTo)) return;

        const pnl = getPnLForBet(bet);
        const pnlClass = pnl > 0 ? 'positive' : (pnl < 0 ? 'negative' : '');
        const pnlText = bet.status === 'Pendiente' ? '-' : (bet.status === 'Nula' ? '0.00' : `${pnl > 0 ? '+' : ''}${pnl.toFixed(2)}€`);

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${formatDate(bet.date)}</td>
            <td><strong>${bet.match}</strong></td>
            <td>${bet.type || 'Match Odds'}</td>
            <td>${bet.bookie}</td>
            <td>${bet.odds}</td>
            <td>${bet.stake}€</td>
            <td>
                <div class="status-badge status-${bet.status.toLowerCase()}">
                    <select onchange="changeBetStatus('${bet.id}', this.value)">
                        <option value="Pendiente" ${bet.status === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
                        <option value="Ganada" ${bet.status === 'Ganada' ? 'selected' : ''}>Ganada</option>
                        <option value="Perdida" ${bet.status === 'Perdida' ? 'selected' : ''}>Perdida</option>
                        <option value="Nula" ${bet.status === 'Nula' ? 'selected' : ''}>Nula</option>
                    </select>
                </div>
            </td>
            <td class="pnl-val ${pnlClass}">${pnlText}</td>
            <td>
                <button class="btn-icon delete" onclick="deleteBet('${bet.id}')" title="Eliminar Apuesta">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function renderChart() {
    const ctx = document.getElementById('bankrollChart').getContext('2d');
    const sortedBets = [...state.bets].sort((a, b) => new Date(a.date) - new Date(b.date));

    let labels = ['Inicio'];
    let bankrollEvolution = [state.initialBankroll || 0];
    let currentBal = state.initialBankroll || 0;

    sortedBets.forEach(bet => {
        if (bet.status === 'Ganada' || bet.status === 'Perdida') {
            currentBal += getPnLForBet(bet);
            labels.push(formatDate(bet.date));
            bankrollEvolution.push(currentBal);
        }
    });

    if (chartInstance) chartInstance.destroy();

    const gradient = ctx.createLinearGradient(0, 0, 0, 350);
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.5)');
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)');

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Bankroll (€)',
                data: bankrollEvolution,
                borderColor: '#3b82f6',
                backgroundColor: gradient,
                borderWidth: 3,
                pointBackgroundColor: '#10b981',
                pointRadius: 4,
                pointHoverRadius: 6,
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { backgroundColor: '#1e293b', titleColor: '#f8fafc', bodyColor: '#e2e8f0' }
            },
            scales: {
                y: { grid: { color: '#334155', drawBorder: false }, ticks: { color: '#94a3b8' } },
                x: { grid: { display: false, drawBorder: false }, ticks: { color: '#94a3b8', maxTicksLimit: 10 } }
            },
            interaction: { mode: 'nearest', axis: 'x', intersect: false }
        }
    });
}

function renderAdvancedStats() {
    const monthly = {};
    const typeStats = {};
    const bookieStats = {};

    state.bets.forEach(bet => {
        if (bet.status === 'Pendiente' || bet.status === 'Nula') return;

        const date = new Date(bet.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const type = bet.type || 'Match Odds';
        const bookie = bet.bookie;
        const pnl = getPnLForBet(bet);
        const stake = parseFloat(bet.stake);

        if (!monthly[monthKey]) monthly[monthKey] = { bets: 0, pnl: 0, staked: 0 };
        monthly[monthKey].bets++; monthly[monthKey].pnl += pnl; monthly[monthKey].staked += stake;

        if (!typeStats[type]) typeStats[type] = { bets: 0, pnl: 0, staked: 0 };
        typeStats[type].bets++; typeStats[type].pnl += pnl; typeStats[type].staked += stake;

        if (!bookieStats[bookie]) bookieStats[bookie] = { bets: 0, pnl: 0, staked: 0 };
        bookieStats[bookie].bets++; bookieStats[bookie].pnl += pnl; bookieStats[bookie].staked += stake;
    });

    const renderTableStats = (dataObj, tbodyId) => {
        const tbody = document.getElementById(tbodyId);
        tbody.innerHTML = '';
        Object.keys(dataObj).sort().reverse().forEach(k => {
            const d = dataObj[k];
            const yieldPerc = d.staked > 0 ? (d.pnl / d.staked * 100).toFixed(2) : 0;
            const pnlClass = d.pnl > 0 ? 'positive' : (d.pnl < 0 ? 'negative' : '');
            const yClass = yieldPerc > 0 ? 'positive' : (yieldPerc < 0 ? 'negative' : '');

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${k}</strong></td>
                <td>${d.bets}</td>
                <td class="pnl-val ${pnlClass}">${d.pnl > 0 ? '+' : ''}${d.pnl.toFixed(2)}€</td>
                <td class="pnl-val ${yClass}">${yieldPerc}%</td>
            `;
            tbody.appendChild(tr);
        });
    };

    renderTableStats(monthly, 'stats-monthly-body');
    renderTableStats(typeStats, 'stats-type-body');
    renderTableStats(bookieStats, 'stats-bookie-body');
}

// ====== ACTIONS ======
function saveBankroll() {
    const val = parseFloat(document.getElementById('initial-bankroll').value);
    if (!isNaN(val)) {
        state.initialBankroll = val;
        saveData();
        renderAll();
        alert("Bankroll Inicial guardado correctamente.");
    }
}

function addBet(e) {
    e.preventDefault();
    if (state.initialBankroll === null) {
        alert("Por favor, establece un Bankroll Inicial primero.");
        return;
    }

    const newBet = {
        id: Date.now().toString(),
        date: document.getElementById('bet-date').value,
        match: document.getElementById('bet-match').value,
        bookie: document.getElementById('bet-bookie').value,
        type: document.getElementById('bet-type').value,
        odds: parseFloat(document.getElementById('bet-odds').value).toFixed(2),
        stake: parseFloat(document.getElementById('bet-stake').value).toFixed(2),
        status: document.getElementById('bet-status').value
    };

    state.bets.push(newBet);
    saveData();
    renderAll();

    // Close modal and reset form
    document.getElementById('bet-form').reset();
    document.getElementById('bet-date').valueAsDate = new Date();
    document.getElementById('bet-modal').classList.remove('active');
}

window.deleteBet = function (id) {
    state.bets = state.bets.filter(b => b.id !== id);
    saveData();
    renderAll();
};

window.changeBetStatus = function (id, newStatus) {
    const bet = state.bets.find(b => b.id === id);
    if (bet) {
        bet.status = newStatus;
        saveData();
        renderAll();
    }
};

function exportCSV() {
    if (state.bets.length === 0) { alert("No hay apuestas para exportar."); return; }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "ID,Fecha,Partido,Tipo,Casa,Cuota,Stake,Estado\n";

    state.bets.forEach(bet => {
        const row = [bet.id, bet.date, `"${bet.match}"`, bet.type || 'Match Odds', bet.bookie, bet.odds, bet.stake, bet.status].join(",");
        csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.href = encodedUri;
    link.download = `bankroll_export_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function importCSV(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (event) {
        const lines = event.target.result.split("\n");
        let newBets = [];

        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            const row = []; let buffer = ''; let inQuotes = false;
            for (let c of lines[i]) {
                if (c === '"') inQuotes = !inQuotes;
                else if (c === ',' && !inQuotes) { row.push(buffer); buffer = ''; }
                else buffer += c;
            }
            row.push(buffer);

            if (row.length >= 8) {
                newBets.push({
                    id: row[0].replace(/"/g, '').trim() || Date.now().toString() + i,
                    date: row[1].replace(/"/g, '').trim(),
                    match: row[2].replace(/"/g, '').trim(),
                    type: row[3].replace(/"/g, '').trim(),
                    bookie: row[4].replace(/"/g, '').trim(),
                    odds: parseFloat(row[5].replace(/"/g, '')).toFixed(2),
                    stake: parseFloat(row[6].replace(/"/g, '')).toFixed(2),
                    status: row[7].replace(/"/g, '').trim()
                });
            } else if (row.length === 7) {
                newBets.push({
                    id: row[0].replace(/"/g, '').trim() || Date.now().toString() + i,
                    date: row[1].replace(/"/g, '').trim(),
                    match: row[2].replace(/"/g, '').trim(),
                    type: 'Match Odds',
                    bookie: row[3].replace(/"/g, '').trim(),
                    odds: parseFloat(row[4].replace(/"/g, '')).toFixed(2),
                    stake: parseFloat(row[5].replace(/"/g, '')).toFixed(2),
                    status: row[6].replace(/"/g, '').trim()
                });
            }
        }

        if (newBets.length > 0) {
            state.bets = [...state.bets, ...newBets];
            state.bets = Array.from(new Map(state.bets.map(item => [item.id, item])).values());
            saveData(); renderAll();
            alert(`Importadas ${newBets.length} apuestas exitosamente.`);
        }
    };
    reader.readAsText(file);
    e.target.value = '';
}

async function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    document.getElementById('ocr-loading').style.display = 'block';

    try {
        const result = await Tesseract.recognize(file, 'spa');
        const text = result.data.text.toLowerCase();

        const bookies = ['bet365', 'william hill', 'bwin', 'betfair', '1xbet', 'pinnacle'];
        for (let b of bookies) {
            if (text.includes(b)) {
                Array.from(document.getElementById('bet-bookie').options).forEach(opt => {
                    if (opt.value.toLowerCase() === b) document.getElementById('bet-bookie').value = opt.value;
                });
                break;
            }
        }

        if (text.includes('corner') || text.includes('córner') || text.includes('saque de esquina')) {
            document.getElementById('bet-type').value = 'Córners';
        } else if (text.includes('tarjeta') || text.includes('amonestacion') || text.includes('amonestación')) {
            document.getElementById('bet-type').value = 'Tarjetas';
        } else if (text.includes('gol') || text.includes('goles') || text.includes('más de')) {
            document.getElementById('bet-type').value = 'Goles';
        }

        const oddsMatch = text.match(/\b([1-9][0-9]?[\.,][0-9]{2})\b/g);
        if (oddsMatch && oddsMatch.length > 0) {
            const oddsVal = oddsMatch[0].replace(',', '.');
            if (parseFloat(oddsVal) > 1.0) document.getElementById('bet-odds').value = oddsVal;
        }

        const stakeMatch = text.match(/\b(\d+[\.,]?\d*)\s*(€|eur|euros)/i);
        if (stakeMatch) {
            const stakeVal = stakeMatch[1].replace(',', '.');
            document.getElementById('bet-stake').value = stakeVal;
        }

        if (text.includes('ganada') || text.includes('resuelto') || text.includes('ganador')) {
            document.getElementById('bet-status').value = 'Ganada';
        } else if (text.includes('perdida') || text.includes('pérdida')) {
            document.getElementById('bet-status').value = 'Perdida';
        }

        const matchRegex = /([a-z\u00C0-\u017F\s]+)\s+(vs|v|contra)\.?\s+([a-z\u00C0-\u017F\s]+)/i;
        const matchTeam = text.match(matchRegex);
        if (matchTeam) {
            const home = matchTeam[1].trim(); const away = matchTeam[3].trim();
            if (home.length > 3 && away.length > 3) document.getElementById('bet-match').value = `${home} vs ${away}`.toUpperCase();
        }

    } catch (err) {
        console.error("OCR Error:", err);
    } finally {
        document.getElementById('ocr-loading').style.display = 'none';
        e.target.value = '';
    }
}

// ====== GOOGLE AUTHENTICATION & LOGIN UI ======
function showLoginScreen() {
    document.getElementById('login-screen').classList.remove('hidden');
    renderGoogleButton();
}

function hideLoginScreen() {
    document.getElementById('login-screen').classList.add('hidden');
}

function loginAsGuest() {
    authState.user = null;
    localStorage.removeItem('bt_active_user');
    updateUserProfileUI();
    document.getElementById('btn-google-logout').style.display = 'none';
    hideLoginScreen();
    loadData();
    renderAll();
}

function decodeJwtResponse(token) {
    let base64Url = token.split('.')[1];
    let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    let jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
}

function handleCredentialResponse(response) {
    const payload = decodeJwtResponse(response.credential);
    authState.user = {
        name: payload.name,
        email: payload.email,
        picture: payload.picture
    };

    localStorage.setItem('bt_active_user', JSON.stringify(authState.user));
    document.getElementById('btn-google-logout').style.display = 'flex';

    hideLoginScreen();
    alert(`Sesión iniciada como ${authState.user.email} ✅`);

    loadData();
    renderAll();
}

function renderGoogleButton() {
    if (window.google && window.google.accounts && window.google.accounts.id) {
        google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleCredentialResponse
        });
        google.accounts.id.renderButton(
            document.getElementById("btn-google-login-container"),
            { theme: "outline", size: "large", type: "standard", width: 280 }
        );
    } else {
        setTimeout(renderGoogleButton, 500); // Retry if script not fully loaded
    }
}

function logoutGoogle() {
    if (window.google) google.accounts.id.disableAutoSelect();
    authState.user = null;
    localStorage.removeItem('bt_active_user');
    document.getElementById('btn-google-logout').style.display = 'none';
    updateUserProfileUI();
    showLoginScreen();

    state.bets = [];
    state.initialBankroll = null;
    renderAll();
}

function updateUserProfileUI() {
    const container = document.getElementById('user-profile');
    if (authState.user) {
        container.innerHTML = `
            <img src="${authState.user.picture}" alt="Avatar" class="user-avatar" referrerpolicy="no-referrer">
            <span class="user-name">${authState.user.name}</span>
        `;
    } else {
        container.innerHTML = `<span style="font-size: 0.9rem; color: var(--text-muted);"><i class="fa-solid fa-user"></i> Invitado</span>`;
    }
}

// ====== EVENT LISTENERS ======
function setupEventListeners() {
    document.getElementById('btn-guest-login').addEventListener('click', loginAsGuest);
    document.getElementById('btn-google-logout').addEventListener('click', logoutGoogle);
    document.getElementById('btn-save-bankroll').addEventListener('click', saveBankroll);
    document.getElementById('bet-form').addEventListener('submit', addBet);

    // Filters
    document.getElementById('filter-status').addEventListener('change', renderTable);
    document.getElementById('filter-date-from').addEventListener('change', renderTable);
    document.getElementById('filter-date-to').addEventListener('change', renderTable);
    document.getElementById('btn-clear-filters').addEventListener('click', () => {
        document.getElementById('filter-status').value = 'Pendiente';
        document.getElementById('filter-date-from').value = '';
        document.getElementById('filter-date-to').value = '';
        renderTable();
    });

    // CSV & OCR
    document.getElementById('btn-export-csv').addEventListener('click', exportCSV);
    document.getElementById('input-import-csv').addEventListener('change', importCSV);
    document.getElementById('bet-image-upload').addEventListener('change', handleImageUpload);

    // Stake Auto-calc
    document.getElementById('bet-stake-level').addEventListener('change', function (e) {
        const val = e.target.value;
        if (!val) return;
        const currentBankroll = calculateMetrics().currentBankroll;
        if (currentBankroll > 0) {
            const stakeValue = (currentBankroll * (parseFloat(val) / 100)).toFixed(2);
            document.getElementById('bet-stake').value = stakeValue;
        } else {
            alert('Configura y dispón de saldo para auto-calcular el stake.');
            e.target.value = '';
        }
    });

    // Tabs Navigation
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

            e.currentTarget.classList.add('active');
            document.getElementById(e.currentTarget.dataset.tab).classList.add('active');

            if (e.currentTarget.dataset.tab === 'tab-stats' && chartInstance) {
                chartInstance.update();
            }
        });
    });

    // Modal
    const modal = document.getElementById('bet-modal');
    document.getElementById('btn-open-modal').addEventListener('click', () => modal.classList.add('active'));
    document.querySelector('.close-modal').addEventListener('click', () => modal.classList.remove('active'));

    // Close modal on outside click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('active');
    });
}

// Arrancar App
document.addEventListener('DOMContentLoaded', init);

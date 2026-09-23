const statusElements = {
    updated: document.getElementById('status-updated'),
    message: document.getElementById('status-message'),
    events: document.getElementById('airport-events'),
    coverage: document.getElementById('status-coverage'),
    list: document.getElementById('airport-list'),
    refreshButton: document.getElementById('refresh-airport-status'),
    refreshStatus: document.getElementById('refresh-status')
};

const configUrl = 'data/airport-status-config.json';
const snapshotUrl = 'data/airport-status.json';
let config = null;
let snapshot = null;
let refreshFailed = false;
const staleAfterMs = 45 * 60 * 1000;

function utc(value) {
    const date = new Date(value);
    return Number.isFinite(date.getTime())
        ? date.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC')
        : 'Unavailable';
}

function line(parent, text, tag = 'p') {
    const el = document.createElement(tag);
    el.textContent = text;
    parent.append(el);
    return el;
}

function validSnapshot(data) {
    return data && data.schemaVersion === 1
        && Number.isFinite(Date.parse(data.fetchedAt))
        && Array.isArray(data.airports)
        && Array.isArray(data.monitoredAirports);
}

function renderStatus() {
    if (!snapshot) return;
    const stale = Date.now() - Date.parse(snapshot.fetchedAt) > staleAfterMs;
    statusElements.updated.textContent = `Last successful fetch: ${utc(snapshot.fetchedAt)}`;
    statusElements.message.textContent = refreshFailed
        ? 'Could not reload the saved snapshot. The displayed status may be out of date.'
        : stale ? 'This snapshot may be out of date. Check the published status again later or visit ATCSCC.' : '';
    statusElements.coverage.textContent = snapshot.coverage;
    statusElements.list.textContent = `Monitored airports: ${config ? config.airports.join(', ') : snapshot.monitoredAirports.join(', ')}`;
    statusElements.events.replaceChildren();

    let count = 0;
    snapshot.airports.forEach(airport => {
        const events = airport.events.filter(event => Date.parse(event.start) <= Date.now() && Date.now() < Date.parse(event.end));
        if (!events.length) return;
        count++;
        const card = document.createElement('section');
        card.className = 'answer-panel';
        line(card, `${airport.code} · ${airport.name}`, 'h2');
        events.forEach(event => {
            const block = document.createElement('div');
            block.className = 'airport-event';
            line(block, event.type, 'h3');
            line(block, event.reason);
            line(block, `${utc(event.start)} — ${utc(event.end)}`);
            const delays = [];
            if (Number.isFinite(event.averageDelayMinutes)) delays.push(`Average delay: ${event.averageDelayMinutes} min`);
            if (Number.isFinite(event.maximumDelayMinutes)) delays.push(`Maximum delay: ${event.maximumDelayMinutes} min`);
            if (delays.length) line(block, delays.join(' · '));
            if (event.advisoryUrl) {
                try {
                    const url = new URL(event.advisoryUrl);
                    if (url.protocol === 'https:' && (url.hostname === 'faa.gov' || url.hostname.endsWith('.faa.gov'))) {
                        const link = line(block, 'FAA advisory ↗', 'a');
                        link.href = url.href;
                        link.className = 'home-link';
                    }
                } catch (_) { /* Ignore invalid source links. */ }
            }
            card.append(block);
        });
        statusElements.events.append(card);
    });

    if (!count) {
        line(statusElements.events, stale || refreshFailed
            ? 'No unexpired events in this snapshot. Current status could not be confirmed.'
            : 'No qualifying active events reported for the monitored airports.');
    }
}

async function loadSavedSnapshot(manual = false) {
    try {
        const response = await fetch(snapshotUrl, { cache: 'no-store' });
        if (!response.ok) throw new Error('Saved snapshot unavailable');
        const data = await response.json();
        if (!validSnapshot(data)) throw new Error('Invalid saved snapshot');
        snapshot = data;
        refreshFailed = false;
        renderStatus();
        if (manual) statusElements.refreshStatus.textContent = `Loaded the published snapshot. FAA data was fetched at ${utc(snapshot.fetchedAt)}.`;
    } catch (_) {
        refreshFailed = true;
        statusElements.updated.textContent = 'No saved status snapshot available.';
        statusElements.message.textContent = 'The saved status file could not be loaded.';
        if (manual) statusElements.refreshStatus.textContent = 'Could not reload the saved snapshot. Please try again later.';
    }
}

async function loadConfig() {
    const response = await fetch(configUrl, { cache: 'no-store' });
    if (!response.ok) throw new Error('Airport configuration unavailable');
    const data = await response.json();
    if (!data || !Array.isArray(data.airports) || !Array.isArray(data.excluded_closure_patterns)) {
        throw new Error('Invalid airport configuration');
    }
    config = {
        airports: data.airports
    };
    statusElements.list.textContent = `Monitored airports: ${config.airports.join(', ')}`;
}

async function reloadSavedStatus() {
    statusElements.refreshButton.disabled = true;
    statusElements.refreshStatus.textContent = 'Reloading the published status file…';
    await loadSavedSnapshot(true);
    statusElements.refreshButton.disabled = false;
}

statusElements.refreshButton.disabled = true;
statusElements.refreshButton.addEventListener('click', reloadSavedStatus);
loadConfig().then(() => {
    statusElements.refreshButton.disabled = false;
    return loadSavedSnapshot();
}).catch(() => {
    statusElements.updated.textContent = 'Airport configuration unavailable.';
    statusElements.list.textContent = 'Airport list unavailable. Please try reloading the page.';
    statusElements.refreshStatus.textContent = 'Airport configuration could not be loaded.';
});

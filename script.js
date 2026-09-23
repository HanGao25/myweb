/* Tile IDs: 0–8 万, 9–17 筒, 18–26 条. */
const SUITS = ['万', '筒', '条'];
const tileName = id => `${id % 9 + 1}${SUITS[Math.floor(id / 9)]}`;

function canFormMelds(counts) {
    const first = counts.findIndex(n => n > 0);
    if (first === -1) return true;
    if (counts[first] >= 3) {
        counts[first] -= 3;
        const valid = canFormMelds(counts);
        counts[first] += 3;
        if (valid) return true;
    }
    if (first % 9 <= 6 && counts[first + 1] && counts[first + 2]) {
        counts[first]--; counts[first + 1]--; counts[first + 2]--;
        const valid = canFormMelds(counts);
        counts[first]++; counts[first + 1]++; counts[first + 2]++;
        if (valid) return true;
    }
    return false;
}

function isWinning(counts, missingSuit) {
    if (counts.length !== 27 || counts.some(n => !Number.isInteger(n) || n < 0 || n > 4)) return false;
    if (counts.reduce((a, b) => a + b, 0) !== 14) return false;
    if (counts.slice(missingSuit * 9, missingSuit * 9 + 9).some(Boolean)) return false;
    if (counts.every(n => n % 2 === 0)) return true;
    for (let pair = 0; pair < 27; pair++) {
        if (counts[pair] < 2) continue;
        const rest = counts.slice();
        rest[pair] -= 2;
        if (canFormMelds(rest)) return true;
    }
    return false;
}

function winningTiles(counts, missingSuit) {
    const result = [];
    for (let id = 0; id < 27; id++) {
        if (counts[id] >= 4 || Math.floor(id / 9) === missingSuit) continue;
        const candidate = counts.slice();
        candidate[id]++;
        if (isWinning(candidate, missingSuit)) result.push(id);
    }
    return result;
}

function generatePuzzle(random = Math.random) {
    const pick = array => array[Math.floor(random() * array.length)];
    const missingSuit = pick([0, 1, 2]);
    const suits = [0, 1, 2].filter(s => s !== missingSuit);
    const allowed = Array.from({ length: 27 }, (_, i) => i).filter(i => suits.includes(Math.floor(i / 9)));
    // Construct a legal winning hand, then remove one tile: every puzzle is ready.
    for (let attempt = 0; attempt < 500; attempt++) {
        const counts = Array(27).fill(0);
        if (random() < 0.25) {
            for (let pair = 0; pair < 7; pair++) counts[pick(allowed)] += 2;
        } else {
            counts[pick(allowed)] = 2;
            for (let meld = 0; meld < 4; meld++) {
                if (random() < 0.5) counts[pick(allowed)] += 3;
                else {
                    const start = pick(suits) * 9 + Math.floor(random() * 7);
                    counts[start]++; counts[start + 1]++; counts[start + 2]++;
                }
            }
        }
        if (counts.some(n => n > 4)) continue;
        const tiles = counts.flatMap((n, id) => Array(n).fill(id));
        counts[pick(tiles)]--;
        return { counts, missingSuit, answers: winningTiles(counts, missingSuit) };
    }
    // Bounded fallback for unusual random sources.
    const counts = Array(27).fill(0);
    [3, 3, 3, 1, 1, 1, 1].forEach((n, i) => { counts[suits[0] * 9 + i] = n; });
    return { counts, missingSuit, answers: winningTiles(counts, missingSuit) };
}

const COPY = {
    zh: {
        title: '四川麻将 · 听牌练习', home: '← 返回游戏列表', eyebrow: '四川麻将 · 单人练习',
        heading: '这手牌，胡什么？', intro: '手牌已经下叫。选出所有可以胡的牌，看看你有没有找全。',
        handTitle: '你的手牌 · 13 张', answerTitle: '哪些牌可以胡？', help: '点击选牌，再次点击取消。可以多选。',
        check: '检查答案', reveal: '查看答案', next: '换一题 →', rulesTitle: '本练习的规则',
        rules1: '只用万、筒、条，每种牌最多 4 张。每题为未碰、未杠的 13 张暗手牌，并已打完定缺花色。胡牌为「四组顺子或刻子 + 一对将」，或七对（四张相同牌可以算两对）。没有癞子，不计算番数。',
        rules2: '只判断牌型，不考虑其他玩家或牌河中的牌。手里已有 4 张的牌不能再摸入；定缺花色不能胡。检查或查看答案后，本题结束；首次检查全对才计为答对。',
        suits: ['万', '筒', '条'], hand: '手牌', round: n => `第 ${n} 题`, score: (c,a) => `答对 ${c} / 已作答 ${a}`,
        missing: s => `定缺：${s}`, forbidden: '定缺花色不能胡', four: '手里已有四张',
        empty: '请先选出至少一张可以胡的牌。', revealed: '答案已揭晓，本题不计为答对。', success: '全部找对了！', retry: '还差一点，再看看这些牌：',
        all: '全部可胡：', missed: '漏选：', extra: '误选：', separator: '、'
    },
    en: {
        title: 'Sichuan Mahjong · Winning Tiles', home: '← Back to games', eyebrow: 'SICHUAN MAHJONG · SOLO PRACTICE',
        heading: 'Which tiles complete this hand?', intro: 'This hand is one tile away from winning. Find every tile that can complete it.',
        handTitle: 'Your hand · 13 tiles', answerTitle: 'Select all winning tiles', help: 'Select a tile to choose it; select it again to undo. You can choose multiple tiles.',
        check: 'Check answer', reveal: 'Reveal answer', next: 'Next hand →', rulesTitle: 'Practice rules',
        rules1: 'Only Characters, Circles, and Bamboo are used, with four copies of each tile. Each puzzle has 13 concealed tiles, no exposed melds or kongs, and no tiles of its declared excluded suit. A winning hand contains four sequences or triplets and a pair, or seven pairs (four identical tiles can count as two pairs). No wildcards or scoring multipliers.',
        rules2: 'Judge the hand only; other players and discarded tiles are ignored. You cannot draw a fifth copy or win with the excluded suit. Checking or revealing ends the round. Only a completely correct first submission earns a point.',
        suits: ['Characters', 'Circles', 'Bamboo'], hand: 'Your hand', round: n => `Round ${n}`, score: (c,a) => `${c} correct / ${a} attempted`,
        missing: s => `Excluded suit: ${s}`, forbidden: 'Excluded suit cannot complete this hand', four: 'All four copies are already in your hand',
        empty: 'Select at least one winning tile first.', revealed: 'Answer revealed. No point awarded for this round.', success: 'You found them all!', retry: 'Not quite! Compare your choices below:',
        all: 'All winning tiles: ', missed: 'Missed: ', extra: 'Incorrect picks: ', separator: ', '
    }
};

// Vector tile faces stay crisp without relying on a mahjong emoji font.
function tileArtwork(id) {
    const rank = id % 9 + 1, suit = Math.floor(id / 9);
    const red = '#b42f32', green = '#176448', blue = '#214977';
    let drawing = '';
    if (suit === 0) {
        drawing = `<text x="30" y="31" text-anchor="middle" fill="${blue}" font-size="29" font-family="Kaiti SC, STKaiti, KaiTi, serif">${'一二三四五六七八九'[rank-1]}</text><text x="30" y="64" text-anchor="middle" fill="${red}" font-size="32" font-family="Kaiti SC, STKaiti, KaiTi, serif">萬</text>`;
    } else if (suit === 2 && rank === 1) {
        // One bamboo traditionally uses a bird instead of a single stalk.
        drawing = `<image href="figures/bird.PNG" x="2" y="2" width="56" height="72" preserveAspectRatio="xMidYMid meet"/>`;
    } else {
        const layouts = {
            1: [[30,38]], 2: [[30,21],[30,55]], 3: [[16,17],[30,38],[44,59]],
            4: [[16,20],[44,20],[16,56],[44,56]],
            5: [[16,16],[44,16],[30,38],[16,60],[44,60]],
            6: [[16,16],[44,16],[16,38],[44,38],[16,60],[44,60]],
            7: [[30,12],[16,30],[44,30],[16,46],[44,46],[16,62],[44,62]],
            8: [[16,12],[44,12],[16,29],[44,29],[16,47],[44,47],[16,64],[44,64]],
            9: [[14,16],[30,16],[46,16],[14,38],[30,38],[46,38],[14,60],[30,60],[46,60]]
        };
        const positions = suit === 1 && rank === 7
            ? [[14,12],[30,23],[46,34],[16,48],[44,48],[16,66],[44,66]]
            : layouts[rank];
        drawing = positions.map(([x,y], i) => {
            const color = suit === 1 ? (rank === 7 ? (i < 3 ? green : red) : rank === 1 ? green : rank === 5 && i === 2 ? red : rank === 9 ? [green,red,blue][Math.floor(i/3)] : i % 2 ? blue : green) : (rank === 7 && i === 0 ? red : green);
            if (suit === 1) {
                const r = rank === 1 ? 21 : rank === 9 ? 6 : 8;
                return `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${color}" stroke-width="2.5"/><circle cx="${x}" cy="${y}" r="${r*0.55}" fill="none" stroke="${color}" stroke-width="1.5"/><circle cx="${x}" cy="${y}" r="${rank === 1 ? 5 : 2}" fill="${rank === 1 ? red : color}"/>`;
            }
            return `<g stroke="${color}" stroke-linecap="round"><path d="M${x-2} ${y-6} V${y+6} M${x+2} ${y-6} V${y+6}" stroke-width="2.5"/><path d="M${x-4} ${y-6} H${x+4} M${x-4} ${y} H${x+4} M${x-4} ${y+6} H${x+4}" stroke-width="2"/></g>`;
        }).join('');
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 76" aria-hidden="true" focusable="false">${drawing}</svg>`;
}

function startGame() {
    const $ = id => document.getElementById(id);
    let language = 'zh';
    try { const saved = localStorage.getItem('mahjong-language'); if (saved in COPY) language = saved; } catch (_) { /* Storage is optional. */ }
    let puzzle, selected, finished, revealed = false, showEmpty = false;
    let round = 0, correct = 0, attempted = 0;
    const words = () => COPY[language];
    const name = id => language === 'zh' ? tileName(id) : `${id % 9 + 1} ${words().suits[Math.floor(id / 9)]}`;
    function makeTile(id, interactive = false) {
        const tile = document.createElement(interactive ? 'button' : 'span');
        tile.className = `tile suit-${Math.floor(id / 9)}`;
        tile.setAttribute('aria-label', name(id));
        if (!interactive) tile.setAttribute('role', 'img');
        tile.title = name(id);
        tile.innerHTML = tileArtwork(id);
        if (interactive) {
            tile.type = 'button';
            tile.setAttribute('aria-pressed', String(selected.has(id)));
            const excluded = Math.floor(id / 9) === puzzle.missingSuit;
            tile.disabled = finished || excluded || puzzle.counts[id] === 4;
            if (excluded || puzzle.counts[id] === 4) tile.title += ` — ${excluded ? words().forbidden : words().four}`;
            if (finished && puzzle.answers.includes(id)) tile.classList.add('answer-correct');
            if (finished && selected.has(id) && !puzzle.answers.includes(id)) tile.classList.add('answer-wrong');
            tile.addEventListener('click', () => {
                if (finished) return;
                if (selected.has(id)) selected.delete(id); else selected.add(id);
                tile.setAttribute('aria-pressed', String(selected.has(id)));
                showEmpty = false; renderFeedback();
            });
        }
        return tile;
    }
    function renderFeedback() {
        $('feedback').replaceChildren();
        const t = words();
        if (showEmpty) { $('feedback').textContent = t.empty; return; }
        if (!finished) return;
        const missed = puzzle.answers.filter(id => !selected.has(id));
        const extra = [...selected].filter(id => !puzzle.answers.includes(id));
        const list = ids => ids.map(name).join(t.separator);
        const lines = [revealed ? t.revealed : !missed.length && !extra.length ? t.success : t.retry, t.all + list(puzzle.answers)];
        if (!revealed && missed.length) lines.push(t.missed + list(missed));
        if (!revealed && extra.length) lines.push(t.extra + list(extra));
        lines.forEach(line => { const p = document.createElement('p'); p.textContent = line; $('feedback').append(p); });
    }
    function render() {
        const t = words();
        document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
        document.title = t.title;
        $('language').value = language;
        document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t[el.dataset.i18n]; });
        $('round').textContent = t.round(round);
        $('score').textContent = t.score(correct, attempted);
        $('missing-suit').textContent = t.missing(t.suits[puzzle.missingSuit]);
        $('hand').setAttribute('aria-label', t.hand);
        $('hand').replaceChildren(); $('choices').replaceChildren();
        puzzle.counts.forEach((n, id) => { for (let i = 0; i < n; i++) $('hand').append(makeTile(id)); });
        t.suits.forEach((suit, s) => {
            const group = document.createElement('div');
            group.setAttribute('role', 'group'); group.setAttribute('aria-label', suit);
            const label = document.createElement('p'); label.className = 'suit-label'; label.textContent = suit;
            const row = document.createElement('div'); row.className = 'choice-row';
            for (let rank = 0; rank < 9; rank++) row.append(makeTile(s * 9 + rank, true));
            group.append(label, row); $('choices').append(group);
        });
        $('check').disabled = finished; $('reveal').disabled = finished;
        renderFeedback();
    }
    function nextPuzzle() {
        puzzle = generatePuzzle(); selected = new Set(); finished = false; revealed = false; showEmpty = false; round++;
        render();
    }
    function finish(reveal) {
        if (finished) return;
        if (!reveal && !selected.size) { showEmpty = true; renderFeedback(); return; }
        finished = true; revealed = reveal; showEmpty = false; attempted++;
        if (!reveal && selected.size === puzzle.answers.length && puzzle.answers.every(id => selected.has(id))) correct++;
        render();
    }
    $('language').addEventListener('change', event => {
        language = event.target.value;
        try { localStorage.setItem('mahjong-language', language); } catch (_) { /* Still works without storage. */ }
        render();
    });
    $('check').addEventListener('click', () => finish(false));
    $('reveal').addEventListener('click', () => finish(true));
    $('next').addEventListener('click', nextPuzzle);
    nextPuzzle();
}

if (typeof document !== 'undefined') startGame();

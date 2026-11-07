/**
 * Thách đấu 1-1: Kéo co (8 giây) và Oẳn tù tì (thắng 2 ván).
 * Server giữ trạng thái trận; client chỉ vẽ và gửi thao tác.
 */
(function () {
    'use strict';

    const BADGE_KEY = 'bieng.badges';
    const GAME_LABEL = { tug: 'kéo co', rps: 'oẳn tù tì' };
    const EMOJI = { rock: '✊', paper: '✋', scissors: '✌️' };
    const state = {
        id: null, game: null, role: 'a', opponentId: null, opponentName: '',
        playing: false, finished: false, tapsMe: 0, tapsThem: 0,
        scoreMe: 0, scoreThem: 0, round: 1, endsAt: 0, seconds: 8,
        myChoice: null, theirChoice: null, pendingInvite: null, lastTarget: null, raf: 0,
        npc: false, botTimer: 0, localEndTimer: 0,
        board: ['', '', '', '', '', '', '', '', ''], turn: 'a', myMark: 'X'
    };

    function $(id) { return document.getElementById(id); }

    function myId() {
        return (window.cafeNetwork && window.cafeNetwork.playerId) || 'me';
    }

    function badges() {
        try {
            const list = JSON.parse(localStorage.getItem(BADGE_KEY) || '[]');
            return Array.isArray(list) ? list : [];
        } catch (error) { return []; }
    }
    function sendBadges() {
        if (window.cafeNetwork) window.cafeNetwork.send({ type: 'badges', badges: badges() });
    }
    function addBadge(emoji) {
        const list = badges();
        if (list.indexOf(emoji) !== -1) return;
        list.push(emoji);
        localStorage.setItem(BADGE_KEY, JSON.stringify(list.slice(0, 4)));
        sendBadges();
        window.dispatchEvent(new CustomEvent('bieng:badges'));
    }

    // ---------- gửi / nhận lời mời ----------
    function challenge(pid, name) {
        if (!pid) return;
        state.npc = false;
        state.lastTarget = { id: pid, name: name };
        const hint = $('duel-choose-hint');
        if (hint) hint.textContent = 'Thách đấu ' + name + ' — chọn trò chơi:';
        $('duel-choose').classList.remove('hidden');
    }

    function challengeNpc() {
        state.npc = true;
        state.lastTarget = { id: 'npc', name: 'Hoàng Bệu' };
        const hint = $('duel-choose-hint');
        if (hint) hint.textContent = 'Thách đấu Hoàng Bệu (chủ quán) — chọn trò:';
        $('duel-choose').classList.remove('hidden');
    }

    function sendInvite(game) {
        if (!state.lastTarget) return;
        $('duel-choose').classList.add('hidden');
        if (state.lastTarget.id === 'npc') return startNpcDuel(game);
        state.npc = false;
        window.cafeNetwork.send({ type: 'duel_invite', to: state.lastTarget.id, game: game });
    }

    // ---------- đấu với NPC Hoàng Bệu (tự động, tỉ lệ thắng 50%) ----------
    function startNpcDuel(game) {
        state.npc = true;
        startDuel({
            id: 'NPC-' + Date.now(), game: game, a: myId(), b: 'npc',
            names: { npc: 'Hoàng Bệu' }, seconds: 8
        });
        if (game === 'tug') {
            clearInterval(state.botTimer);
            state.botTimer = setInterval(function () {
                if (!state.playing || state.game !== 'tug') return;
                state.tapsThem += 1;
                draw();
            }, 110 + Math.random() * 110);
            clearTimeout(state.localEndTimer);
            state.localEndTimer = setTimeout(endNpcTug, 8000);
        }
    }

    function endNpcTug() {
        if (!state.playing || state.game !== 'tug') return;
        const win = Math.random() < 0.5;
        const mine = Math.max(1, state.tapsMe);
        const theirs = win
            ? Math.max(0, mine - 1 - Math.floor(Math.random() * 4))
            : mine + 2 + Math.floor(Math.random() * 4);
        finishDuel({
            game: 'tug', winner: win ? myId() : 'npc',
            a_taps: mine, b_taps: theirs, score: {}, names: {}
        });
    }

    function resolveNpcRound(mine, theirs) {
        const me = myId();
        let winner = null;
        if (mine !== theirs) {
            const beats = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
            winner = beats[mine] === theirs ? me : 'npc';
        }
        if (winner === me) state.scoreMe += 1;
        else if (winner === 'npc') state.scoreThem += 1;
        const score = {};
        score[me] = state.scoreMe;
        score.npc = state.scoreThem;
        applyRound({ round: state.round, a_choice: mine, b_choice: theirs, winner: winner, score: score });
        if (state.scoreMe >= 2 || state.scoreThem >= 2) {
            finishDuel({
                game: 'rps', winner: state.scoreMe >= 2 ? me : 'npc',
                score: score, names: {}, a_taps: 0, b_taps: 0
            });
        }
    }

    function onInvite(data) {
        state.pendingInvite = data;
        const text = $('duel-invite-text');
        if (text) text.textContent = data.from_name + ' thách bạn ' + (GAME_LABEL[data.game] || 'đấu') + '!';
        $('duel-invite').classList.remove('hidden');
    }

    // ---------- vào trận ----------
    function startDuel(data) {
        state.id = data.id;
        state.game = data.game;
        state.role = (window.cafeNetwork.playerId === data.a) ? 'a' : 'b';
        state.opponentId = state.role === 'a' ? data.b : data.a;
        state.opponentName = data.names[state.opponentId] || 'Đối thủ';
        state.playing = true;
        state.finished = false;
        state.tapsMe = 0; state.tapsThem = 0;
        state.scoreMe = 0; state.scoreThem = 0;
        state.round = 1;
        state.myChoice = null; state.theirChoice = null;
        state.seconds = data.seconds || 8;
        state.hoangGood = undefined;
        state.endsAt = Date.now() + state.seconds * 1000;

        $('duel-invite').classList.add('hidden');
        const titles = { tug: '🪢 Kéo co', rps: '✌️ Oẳn tù tì', xoxo: '⭕ X-O' };
        $('duel-title').textContent = (titles[state.game] || 'Đấu') + ' với ' + state.opponentName;
        if (state.game === 'xoxo') {
            state.board = (data.board || ['', '', '', '', '', '', '', '', '']).slice();
            state.turn = data.turn || 'a';
            state.myMark = state.role === 'a' ? 'X' : 'O';
            $('duel-hint').textContent = 'Bấm vào ô trống để đánh dấu. Ai có 3 ô liền nhau (hoặc chéo) thì thắng.';
        } else {
            $('duel-hint').textContent = state.game === 'tug'
                ? 'Chạm liên tục vào ô bên dưới để kéo ly cà phê về phía bạn!'
                : 'Bấm ✊ ✋ ✌️ — ai thắng 2 ván trước thì thắng.';
        }
        $('duel-modal').classList.remove('hidden');
        $('duel-rps').classList.toggle('hidden', state.game !== 'rps');
        $('duel-rematch').classList.add('hidden');
        setStatus(state.game === 'tug' ? 'Chuẩn bị…' : (state.game === 'xoxo' ? 'Lượt của bạn' : 'Chọn tay của bạn'));
        drawLoop();
    }

    function setStatus(text) {
        const element = $('duel-status');
        if (element) element.textContent = text;
    }

    function finishDuel(data) {
        state.playing = false;
        state.finished = true;
        cancelAnimationFrame(state.raf);
        clearInterval(state.botTimer);
        clearTimeout(state.localEndTimer);
        const winner = data.winner;
        const iWon = winner && winner === myId();
        const draw = !winner;
        setStatus(draw ? '🤝 Hoà!' : (iWon ? '🏆 Bạn thắng!' : '😅 Bạn thua — đấu lại nhé!'));
        if (state.game === 'tug') {
            state.tapsMe = state.role === 'a' ? data.a_taps : data.b_taps;
            state.tapsThem = state.role === 'a' ? data.b_taps : data.a_taps;
        } else if (data.score) {
            state.scoreMe = data.score[myId()] || 0;
            state.scoreThem = data.score[state.opponentId] || 0;
        }
        if (iWon) {
            addBadge(state.game === 'tug' ? '🏆' : '✌️');
            if (window.cafeAudio) window.cafeAudio.playDing();
        }
        draw();
        $('duel-rematch').classList.remove('hidden');
    }

    // ---------- X-O ----------
    function xoLines() {
        return [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    }
    function xoCheck(board, mark) {
        const lines = xoLines();
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].every(function (cell) { return board[cell] === mark; })) return lines[i];
        }
        return null;
    }
    function myTurn() {
        return (state.myMark === 'X' && state.turn === 'a') || (state.myMark === 'O' && state.turn === 'b');
    }
    function handleXoClick(event) {
        if (!state.playing || state.game !== 'xoxo') return;
        if (!myTurn()) { setStatus('Chờ đối thủ…'); return; }
        const canvas = canvasEl();
        const rect = canvas.getBoundingClientRect();
        const px = (event.clientX - rect.left) * (canvas.width / rect.width);
        const py = (event.clientY - rect.top) * (canvas.height / rect.height);
        const size = 180, left = (canvas.width - size) / 2 - 40, top = 20, cell = size / 3;
        if (px < left || py < top || px > left + size || py > top + size) return;
        const index = Math.floor((py - top) / cell) * 3 + Math.floor((px - left) / cell);
        if (state.board[index]) return;
        if (state.npc) return npcXoMove(index);
        window.cafeNetwork.send({ type: 'duel_move', id: state.id, cell: index });
    }
    function npcXoMove(index) {
        state.board[index] = state.myMark;
        if (xoCheck(state.board, state.myMark)) return finishXo(true);
        state.turn = state.turn === 'a' ? 'b' : 'a';
        setStatus('Hoàng Bệu đang suy nghĩ…');
        draw();
        setTimeout(function () {
            if (!state.playing) return;
            const opponentMark = state.myMark === 'X' ? 'O' : 'X';
            const empty = [];
            state.board.forEach(function (mark, i) { if (!mark) empty.push(i); });
            if (!empty.length) return finishXo(null);
            // Hoàng Bệu chơi tối ưu 60% số ván (chặn/ghi điểm), 40% đánh ngẫu nhiên
            if (state.hoangGood === undefined) state.hoangGood = Math.random() < 0.6;
            let pick = null;
            const winning = empty.find(function (cell) {
                state.board[cell] = opponentMark;
                const win = xoCheck(state.board, opponentMark);
                state.board[cell] = '';
                return win;
            });
            const blocking = empty.find(function (cell) {
                state.board[cell] = state.myMark;
                const win = xoCheck(state.board, state.myMark);
                state.board[cell] = '';
                return win;
            });
            if (state.hoangGood) {
                pick = winning !== undefined ? winning : (blocking !== undefined ? blocking : null);
            } else if (Math.random() < 0.5) {
                pick = blocking !== undefined ? blocking : null;
            }
            if (pick === null) pick = empty[Math.floor(Math.random() * empty.length)];
            state.board[pick] = opponentMark;
            if (xoCheck(state.board, opponentMark)) return finishXo(false);
            if (state.board.every(Boolean)) return finishXo(null);
            state.turn = state.turn === 'a' ? 'b' : 'a';
            setStatus('Lượt của bạn');
            draw();
        }, 650);
    }
    function finishXo(result) {
        finishDuel({
            game: 'xoxo',
            winner: result ? myId() : (result === false ? 'npc' : null),
            a_taps: 0, b_taps: 0, score: {}, names: {}
        });
    }

    // ---------- vẽ ----------
    function canvasEl() { return $('duel-canvas'); }

    function draw() {
        const canvas = canvasEl();
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const W = canvas.width, H = canvas.height;
        ctx.fillStyle = '#101a2b';
        ctx.fillRect(0, 0, W, H);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (state.game === 'xoxo') {
            const size = 180, left = (W - size) / 2 - 40, top = 20, cell = size / 3;
            ctx.strokeStyle = '#475569';
            ctx.lineWidth = 3;
            for (let i = 0; i <= 3; i++) {
                ctx.beginPath(); ctx.moveTo(left + i * cell, top); ctx.lineTo(left + i * cell, top + size); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(left, top + i * cell); ctx.lineTo(left + size, top + i * cell); ctx.stroke();
            }
            ctx.font = 'bold 38px sans-serif';
            state.board.forEach(function (mark, index) {
                if (!mark) return;
                const x = left + (index % 3 + 0.5) * cell;
                const y = top + (Math.floor(index / 3) + 0.5) * cell;
                ctx.fillStyle = mark === 'X' ? '#60a5fa' : '#f87171';
                ctx.fillText(mark, x, y);
            });
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'left';
            ctx.fillStyle = '#93c5fd';
            ctx.fillText('Bạn: ' + state.myMark, 12, 20);
            ctx.fillStyle = '#fca5a5';
            ctx.fillText(state.opponentName + ': ' + (state.myMark === 'X' ? 'O' : 'X'), 12, 40);
            return;
        }

        if (state.game === 'tug') {
            const left = 50, right = W - 50, midY = 140;
            ctx.strokeStyle = '#475569';
            ctx.lineWidth = 6;
            ctx.beginPath(); ctx.moveTo(left, midY); ctx.lineTo(right, midY); ctx.stroke();

            const diff = Math.max(-8, Math.min(8, state.tapsMe - state.tapsThem));
            const position = 0.5 + diff * 0.05;
            const cupX = left + (right - left) * Math.max(0.07, Math.min(0.93, position));

            ctx.fillStyle = 'rgba(251,191,36,0.16)';
            ctx.fillRect(W / 2 - 2, midY - 60, 4, 120);

            ctx.font = '34px "Segoe UI Emoji", sans-serif';
            ctx.fillText('☕', cupX, midY - 2);

            const remain = Math.max(0, Math.ceil((state.endsAt - Date.now()) / 1000));
            ctx.fillStyle = '#f8fafc';
            ctx.font = 'bold 16px sans-serif';
            ctx.fillText(remain + 's', W / 2, 26);

            ctx.font = '12px sans-serif';
            ctx.fillStyle = '#93c5fd';
            ctx.fillText('BẠN · ' + state.tapsMe, left + 40, 60);
            ctx.fillStyle = '#fca5a5';
            ctx.fillText(state.opponentName + ' · ' + state.tapsThem, right - 40, 60);

            ctx.fillStyle = 'rgba(255,255,255,0.06)';
            ctx.fillRect(30, H - 52, W - 60, 40);
            ctx.fillStyle = '#f8fafc';
            ctx.font = 'bold 15px sans-serif';
            ctx.fillText(state.playing ? 'CHẠM LIÊN TỤC!' : 'Đã kết thúc', W / 2, H - 32);
        } else {
            ctx.font = '54px "Segoe UI Emoji", sans-serif';
            ctx.fillText(state.myChoice ? EMOJI[state.myChoice] : '❔', W / 4, 92);
            ctx.fillText(state.theirChoice ? EMOJI[state.theirChoice] : '❔', (W * 3) / 4, 92);

            ctx.fillStyle = '#f8fafc';
            ctx.font = 'bold 20px sans-serif';
            ctx.fillText(state.scoreMe + ' : ' + state.scoreThem, W / 2, 92);

            ctx.font = '12px sans-serif';
            ctx.fillStyle = '#93c5fd';
            ctx.fillText('BẠN', W / 4, 140);
            ctx.fillStyle = '#fca5a5';
            ctx.fillText(state.opponentName, (W * 3) / 4, 140);

            ctx.fillStyle = '#e2e8f0';
            ctx.font = '13px sans-serif';
            ctx.fillText('Ván ' + state.round + ' · ai thắng 2 ván trước', W / 2, 178);
        }
    }

    function drawLoop() {
        cancelAnimationFrame(state.raf);
        const tick = function () {
            draw();
            if (state.playing && state.game === 'tug') state.raf = requestAnimationFrame(tick);
        };
        tick();
    }

    // ---------- thao tác ----------
    let lastTap = 0;
    function tap() {
        if (!state.playing || state.game !== 'tug') return;
        const now = Date.now();
        if (now - lastTap < 45) return;
        lastTap = now;
        state.tapsMe += 1;
        window.cafeNetwork.send({ type: 'duel_tap', id: state.id });
        draw();
    }

    function applyRound(data) {
        state.myChoice = state.role === 'a' ? data.a_choice : data.b_choice;
        state.theirChoice = state.role === 'a' ? data.b_choice : data.a_choice;
        state.scoreMe = data.score[myId()] || 0;
        state.scoreThem = data.score[state.opponentId] || 0;
        state.round = data.round + 1;
        const result = data.winner === null ? 'Hoà ván này'
            : (data.winner === myId() ? 'Bạn thắng ván này!' : state.opponentName + ' thắng ván này');
        setStatus(result + ' · ' + state.scoreMe + '–' + state.scoreThem);
        draw();
        resetRpsButtons();
        setTimeout(function () {
            if (!state.playing) return;
            state.myChoice = null;
            state.theirChoice = null;
            setStatus('Chọn tay của bạn');
            draw();
        }, 1200);
    }

    function chooseRps(choice) {
        if (!state.playing || state.game !== 'rps' || state.myChoice) return;
        state.myChoice = choice;
        setStatus('Đã chọn ' + EMOJI[choice] + ' — chờ đối thủ…');
        draw();
        document.querySelectorAll('.rps-btn').forEach(function (button) { button.disabled = true; });
        if (state.npc) {
            const options = ['rock', 'paper', 'scissors'];
            const theirs = options[Math.floor(Math.random() * 3)];
            setTimeout(function () { if (state.playing) resolveNpcRound(choice, theirs); }, 600);
            return;
        }
        window.cafeNetwork.send({ type: 'duel_rps', id: state.id, choice: choice });
    }

    function resetRpsButtons() {
        document.querySelectorAll('.rps-btn').forEach(function (button) { button.disabled = false; });
    }

    // ---------- nối mạng ----------
    function wireNetwork() {
        const net = window.cafeNetwork;
        if (!net) return;

        net.on('connected', sendBadges);

        net.on('duel_sent', function (data) {
            window.showSystemNotice('⚔️ Đã gửi lời thách đấu ' + (GAME_LABEL[data.game] || '') + ' tới ' + data.to_name + '.');
        });

        net.on('duel_invite', onInvite);

        net.on('duel_start', function (data) {
            state.npc = false;
            startDuel(data);
        });

        net.on('duel_progress', function (data) {
            state.tapsMe = state.role === 'a' ? data.a_taps : data.b_taps;
            state.tapsThem = state.role === 'a' ? data.b_taps : data.a_taps;
            draw();
        });

        net.on('duel_round', applyRound);

        net.on('duel_board', function (data) {
            state.board = (data.board || []).slice();
            state.turn = data.turn;
            draw();
            if (data.winner !== null && data.winner !== undefined) {
                setStatus(data.winner === myId() ? '🏆 Bạn thắng!' : '😅 Bạn thua');
            } else {
                setStatus(myTurn() ? 'Lượt của bạn' : 'Chờ đối thủ…');
            }
        });

        net.on('duel_end', finishDuel);
    }

    // ---------- UI ----------
    function wireUi() {
        document.querySelectorAll('.duel-option').forEach(function (option) {
            option.addEventListener('click', function () { sendInvite(option.dataset.game); });
        });
        const accept = $('duel-accept');
        if (accept) accept.addEventListener('click', function () {
            $('duel-invite').classList.add('hidden');
            if (state.pendingInvite) {
                window.cafeNetwork.send({ type: 'duel_answer', id: state.pendingInvite.id, accept: true });
                state.pendingInvite = null;
            }
        });
        const decline = $('duel-decline');
        if (decline) decline.addEventListener('click', function () {
            $('duel-invite').classList.add('hidden');
            if (state.pendingInvite) {
                window.cafeNetwork.send({ type: 'duel_answer', id: state.pendingInvite.id, accept: false });
                state.pendingInvite = null;
            }
        });

        const canvas = canvasEl();
        if (canvas) {
            canvas.addEventListener('pointerdown', function (event) {
                event.preventDefault();
                if (state.game === 'xoxo') { handleXoClick(event); return; }
                tap();
            });
        }
        document.querySelectorAll('.rps-btn').forEach(function (button) {
            button.addEventListener('click', function () { chooseRps(button.dataset.choice); });
        });

        const close = $('duel-close');
        if (close) close.addEventListener('click', function () {
            cancelAnimationFrame(state.raf);
            clearInterval(state.botTimer);
            clearTimeout(state.localEndTimer);
            state.playing = false;
            $('duel-modal').classList.add('hidden');
        });
        const rematch = $('duel-rematch');
        if (rematch) rematch.addEventListener('click', function () {
            $('duel-modal').classList.add('hidden');
            if (state.npc) challengeNpc();
            else if (state.opponentId) challenge(state.opponentId, state.opponentName);
        });

        window.addEventListener('bieng:badges', function () { document.querySelectorAll('.rps-btn').forEach(function (b) { b.disabled = false; }); });
    }

    document.addEventListener('DOMContentLoaded', function () {
        wireUi();
        wireNetwork();
        sendBadges();
    });

    window.BiengDuel = {
        challenge: challenge,
        challengeNpc: challengeNpc,
        badges: badges,
        addBadge: addBadge,
        busy: function () { return state.playing || !!state.pendingInvite; }
    };
})();

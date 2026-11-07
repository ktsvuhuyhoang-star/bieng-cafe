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
        myChoice: null, theirChoice: null, pendingInvite: null, lastTarget: null, raf: 0
    };

    function $(id) { return document.getElementById(id); }

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
        state.lastTarget = { id: pid, name: name };
        const hint = $('duel-choose-hint');
        if (hint) hint.textContent = 'Thách đấu ' + name + ' — chọn trò chơi:';
        $('duel-choose').classList.remove('hidden');
    }

    function sendInvite(game) {
        if (!state.lastTarget) return;
        $('duel-choose').classList.add('hidden');
        window.cafeNetwork.send({ type: 'duel_invite', to: state.lastTarget.id, game: game });
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
        state.endsAt = Date.now() + state.seconds * 1000;

        $('duel-invite').classList.add('hidden');
        $('duel-title').textContent = (state.game === 'tug' ? '🪢 Kéo co' : '✌️ Oẳn tù tì') + ' với ' + state.opponentName;
        $('duel-hint').textContent = state.game === 'tug'
            ? 'Chạm liên tục vào ô bên dưới để kéo ly cà phê về phía bạn!'
            : 'Bấm ✊ ✋ ✌️ — ai thắng 2 ván trước thì thắng.';
        $('duel-modal').classList.remove('hidden');
        $('duel-rps').classList.toggle('hidden', state.game !== 'rps');
        $('duel-rematch').classList.add('hidden');
        setStatus(state.game === 'tug' ? 'Chuẩn bị…' : 'Chọn tay của bạn');
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
        const winner = data.winner;
        const iWon = winner && winner === window.cafeNetwork.playerId;
        const draw = !winner;
        setStatus(draw ? '🤝 Hoà!' : (iWon ? '🏆 Bạn thắng!' : '😅 Bạn thua — đấu lại nhé!'));
        if (state.game === 'tug') {
            state.tapsMe = state.role === 'a' ? data.a_taps : data.b_taps;
            state.tapsThem = state.role === 'a' ? data.b_taps : data.a_taps;
        } else if (data.score) {
            state.scoreMe = data.score[window.cafeNetwork.playerId] || 0;
            state.scoreThem = data.score[state.opponentId] || 0;
        }
        if (iWon) {
            addBadge(state.game === 'tug' ? '🏆' : '✌️');
            if (window.cafeAudio) window.cafeAudio.playDing();
        }
        draw();
        $('duel-rematch').classList.remove('hidden');
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

    function chooseRps(choice) {
        if (!state.playing || state.game !== 'rps' || state.myChoice) return;
        state.myChoice = choice;
        setStatus('Đã chọn ' + EMOJI[choice] + ' — chờ đối thủ…');
        window.cafeNetwork.send({ type: 'duel_rps', id: state.id, choice: choice });
        draw();
        document.querySelectorAll('.rps-btn').forEach(function (button) { button.disabled = true; });
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

        net.on('duel_start', startDuel);

        net.on('duel_progress', function (data) {
            state.tapsMe = state.role === 'a' ? data.a_taps : data.b_taps;
            state.tapsThem = state.role === 'a' ? data.b_taps : data.a_taps;
            draw();
        });

        net.on('duel_round', function (data) {
            state.myChoice = state.role === 'a' ? data.a_choice : data.b_choice;
            state.theirChoice = state.role === 'a' ? data.b_choice : data.a_choice;
            state.scoreMe = data.score[window.cafeNetwork.playerId] || 0;
            state.scoreThem = data.score[state.opponentId] || 0;
            state.round = data.round + 1;
            const result = data.winner === null ? 'Hoà ván này' :
                (data.winner === window.cafeNetwork.playerId ? 'Bạn thắng ván này!' : 'Đối thủ thắng ván này');
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
            canvas.addEventListener('pointerdown', function (event) { event.preventDefault(); tap(); });
        }
        document.querySelectorAll('.rps-btn').forEach(function (button) {
            button.addEventListener('click', function () { chooseRps(button.dataset.choice); });
        });

        const close = $('duel-close');
        if (close) close.addEventListener('click', function () {
            cancelAnimationFrame(state.raf);
            state.playing = false;
            $('duel-modal').classList.add('hidden');
        });
        const rematch = $('duel-rematch');
        if (rematch) rematch.addEventListener('click', function () {
            $('duel-modal').classList.add('hidden');
            if (state.opponentId) challenge(state.opponentId, state.opponentName);
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
        badges: badges,
        addBadge: addBadge,
        busy: function () { return state.playing || !!state.pendingInvite; }
    };
})();

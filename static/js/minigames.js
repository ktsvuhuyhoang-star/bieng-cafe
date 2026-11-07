/**
 * Bieng Cafe - ba mini game pha chế: Pour-over, Espresso, Cold brew.
 * Mỗi món là một lượt chơi ngắn (~10-20 giây), thắng thì gọi onDone(tên món).
 */
(function () {
    'use strict';

    const W = 420, H = 240;
    const DRINKS = {
        pourover: {
            name: 'Pour-over', icon: '🌊',
            hint: 'Giữ chuột hoặc Space để rót nước. Giữ vạch nước trong vùng xanh cho tới khi đầy bình.'
        },
        espresso: {
            name: 'Espresso', icon: '⚡',
            hint: 'Giữ để tăng áp suất, nhả để giảm. Giữ kim trong vùng vàng 8.5–9.5 bar cho tới khi đầy.'
        },
        coldbrew: {
            name: 'Cold brew', icon: '🧊',
            hint: 'Bấm chuột hoặc Space đúng lúc giọt cà phê rơi ngang miệng ly.'
        },
        toilet: {
            name: 'WC', icon: '🚽',
            hint: 'Giữ chuột hoặc Space để giữ thăng bằng. Giữ thanh trong vùng xanh khoảng 8 giây.'
        }
    };

    let canvas = null, ctx = null, raf = 0, last = 0, mine = null, holding = false, onDone = null;
    let modal, titleEl, hintEl, statusEl, barEl, canvasEl;

    function fresh(key) {
        return {
            key: key, t: 0, progress: 0, flow: 0.12, pressure: 0,
            needle: 0.5, velocity: 0,
            drops: [], spawn: 0.4, hits: 0, misses: 0, finished: false, flash: 0
        };
    }

    function el(id) { return document.getElementById(id); }

    function setStatus(text) { if (statusEl) statusEl.textContent = text; }

    function drawPourOver(s) {
        const band = 0.5 + 0.23 * Math.sin(s.t * 0.9);
        // bình rót
        ctx.fillStyle = '#1f2937';
        ctx.fillRect(40, 40, 70, 150);
        // vạch nước
        const top = 190 - s.flow * 140;
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(44, top, 62, 190 - top);
        // vùng xanh
        const bandTop = 190 - (band + 0.11) * 140;
        ctx.fillStyle = 'rgba(34,197,94,0.35)';
        ctx.fillRect(40, bandTop, 70, 0.22 * 140);
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 2;
        ctx.strokeRect(40, bandTop, 70, 0.22 * 140);
        // phễu + ly
        ctx.fillStyle = '#78350f';
        ctx.beginPath();
        ctx.moveTo(150, 70); ctx.lineTo(280, 70); ctx.lineTo(230, 140); ctx.lineTo(200, 140);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#e7e5e4';
        ctx.fillRect(190, 150, 50, 70);
        ctx.fillStyle = '#6b4423';
        ctx.fillRect(194, 190 - s.progress * 0.38, 42, s.progress * 0.38);
        // giọt
        if (holding) {
            ctx.fillStyle = '#8b5e34';
            ctx.beginPath(); ctx.arc(215, 150, 3, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = '#fef3c7';
        ctx.font = '13px sans-serif';
        ctx.fillText('Dòng chảy: ' + Math.round(s.flow * 100) + '%', 300, 100);
        ctx.fillText('Ly: ' + Math.round(s.progress) + '%', 300, 124);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '12px sans-serif';
        ctx.fillText(holding ? 'Đang rót…' : 'Nhấn giữ để rót', 300, 152);
    }

    function drawEspresso(s) {
        // đồng hồ áp
        ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(110, 120, 70, Math.PI * 0.8, Math.PI * 2.2); ctx.stroke();
        const angle = Math.PI * (0.8 + 1.4 * Math.min(1, s.pressure / 12));
        ctx.strokeStyle = s.pressure >= 8.4 && s.pressure <= 9.6 ? '#22c55e' : '#f59e0b';
        ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(110, 120);
        ctx.lineTo(110 + Math.cos(angle) * 62, 120 + Math.sin(angle) * 62); ctx.stroke();
        // vùng vàng
        ctx.strokeStyle = 'rgba(250,204,21,0.5)'; ctx.lineWidth = 9;
        ctx.beginPath(); ctx.arc(110, 120, 66, Math.PI * (0.8 + 1.4 * 8.4 / 12), Math.PI * (0.8 + 1.4 * 9.6 / 12)); ctx.stroke();
        ctx.fillStyle = '#f8fafc'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(s.pressure.toFixed(1) + ' bar', 110, 165);
        ctx.textAlign = 'left';
        // tách
        ctx.fillStyle = '#e7e5e4'; ctx.fillRect(260, 150, 70, 60);
        ctx.fillStyle = '#7c2d12'; ctx.fillRect(265, 195 - s.progress * 0.45, 60, s.progress * 0.45);
        ctx.fillStyle = '#fef3c7'; ctx.font = '13px sans-serif';
        ctx.fillText('Chiết xuất: ' + Math.round(s.progress) + '%', 260, 70);
    }

    function drawColdBrew(s) {
        ctx.fillStyle = '#0f172a'; ctx.fillRect(60, 40, 300, 170);
        // bình ủ
        ctx.fillStyle = 'rgba(56,189,248,0.25)'; ctx.fillRect(150, 40, 80, 100);
        // ly + vùng hứng (sáng lên khi có giọt đi qua)
        const ready = s.drops.some(function (d) { return !d.scored && d.y > 166 && d.y < 214; });
        ctx.fillStyle = ready ? 'rgba(34,197,94,0.55)' : 'rgba(34,197,94,0.22)';
        ctx.fillRect(120, 166, 200, 48);
        ctx.strokeStyle = ready ? '#4ade80' : '#22c55e'; ctx.lineWidth = ready ? 3 : 1;
        ctx.strokeRect(120, 166, 200, 48);
        ctx.fillStyle = '#e7e5e4'; ctx.fillRect(120, 176, 200, 8);
        ctx.strokeStyle = '#94a3b8'; ctx.strokeRect(120, 176, 200, 64);
        // giọt
        s.drops.forEach(function (d) {
            ctx.fillStyle = '#b45309';
            ctx.beginPath(); ctx.arc(d.x, d.y, 5, 0, Math.PI * 2); ctx.fill();
        });
        ctx.fillStyle = '#fef3c7'; ctx.font = '13px sans-serif';
        ctx.fillText('Đạt: ' + s.hits + ' · Trượt: ' + s.misses, 20, 26);
    }

    function drawToilet(s) {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, W, H);
        // bồn cầu
        ctx.fillStyle = '#e5e7eb';
        ctx.beginPath(); ctx.ellipse(140, 150, 54, 34, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#94a3b8';
        ctx.beginPath(); ctx.ellipse(140, 150, 30, 18, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(96, 96, 88, 16);
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(176, 96, 10, 44);
        // thanh thăng bằng
        ctx.fillStyle = 'rgba(34,197,94,0.22)';
        ctx.fillRect(300, 56, 34, 128);
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 2;
        ctx.strokeRect(300, 56, 34, 128);
        const markerY = 56 + (1 - s.needle) * 128;
        ctx.fillStyle = s.needle > 0.34 && s.needle < 0.66 ? '#22c55e' : '#f59e0b';
        ctx.fillRect(292, markerY - 5, 50, 10);
        ctx.fillStyle = '#fef3c7';
        ctx.font = '13px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('Giữ thăng bằng…', 60, 224);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '12px sans-serif';
        ctx.fillText(Math.round(s.progress) + '%', 300, 204);
    }

    function update(s, dt) {
        s.t += dt;
        s.flash = Math.max(0, s.flash - dt * 2);
        if (s.finished) return;

        if (s.key === 'pourover') {
            const band = 0.5 + 0.23 * Math.sin(s.t * 0.9);
            s.flow += (holding ? 0.75 : -0.6) * dt;
            s.flow = Math.max(0, Math.min(1, s.flow));
            const good = Math.abs(s.flow - band) < 0.11;
            s.progress += (good ? 17 : -8) * dt;
            s.progress = Math.max(0, Math.min(100, s.progress));
            if (s.progress >= 100) finish(s, 'Rót đều tay tuyệt vời! Ly Pour-over đã sẵn sàng.');
        } else if (s.key === 'espresso') {
            s.pressure += (holding ? 4.2 : -3.0) * dt;
            s.pressure = Math.max(0, Math.min(12, s.pressure));
            const good = s.pressure >= 8.4 && s.pressure <= 9.6;
            const burnt = s.pressure > 10.4;
            s.progress += (good ? 19 : burnt ? -22 : -3) * dt;
            s.progress = Math.max(0, Math.min(100, s.progress));
            if (s.progress >= 100) finish(s, 'Chuẩn 9 bar! Espresso đậm đà đã xong.');
        } else if (s.key === 'coldbrew') {
            s.spawn -= dt;
            if (s.spawn <= 0) {
                s.spawn = 0.55 + Math.random() * 0.5;
                s.drops.push({ x: 130 + Math.random() * 180, y: 60, vy: 210, scored: false });
            }
            s.drops.forEach(function (d) {
                d.y += d.vy * dt;
                if (!d.scored && d.y >= 214) { d.scored = true; s.misses++; s.progress = Math.max(0, s.progress - 6); }
            });
            s.drops = s.drops.filter(function (d) { return d.y < 250; });
            if (s.progress >= 100) finish(s, 'Ủ lạnh khéo léo! Ly Cold brew đã sẵn sàng.');
        } else if (s.key === 'toilet') {
            s.velocity += (Math.random() - 0.5) * 2.2 * dt;
            s.velocity += (holding ? -1.7 : 1.15) * dt;
            s.velocity = Math.max(-1.7, Math.min(1.7, s.velocity));
            s.needle = Math.max(0, Math.min(1, s.needle + s.velocity * dt));
            const inside = s.needle > 0.34 && s.needle < 0.66;
            s.progress += (inside ? 14 : -9) * dt;
            s.progress = Math.max(0, Math.min(100, s.progress));
            if (s.progress >= 100) finish(s, 'Xong rồi! Rửa tay rồi ra uống cà phê nhé 🚽🧼');
        }
    }

    function finish(s, message) {
        s.finished = true;
        setStatus('✅ ' + message);
        if (barEl) barEl.style.width = '100%';
        window.cafeAudio && window.cafeAudio.playDing();
        const key = s.key;
        setTimeout(function () {
            if (onDone && mine === s) { onDone(key); }
        }, 900);
    }

    function frame(now) {
        if (!mine) return;
        const dt = Math.min(0.05, (now - last) / 1000 || 0);
        last = now;
        update(mine, dt);
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = '#111a2b';
        ctx.fillRect(0, 0, W, H);
        if (mine.key === 'pourover') drawPourOver(mine);
        else if (mine.key === 'espresso') drawEspresso(mine);
        else if (mine.key === 'toilet') drawToilet(mine);
        else drawColdBrew(mine);
        if (barEl) barEl.style.width = Math.round(mine.progress) + '%';
        if (!mine.finished) {
            const label = mine.key === 'coldbrew'
                ? ('Giọt đã hứng: ' + mine.hits + '/7')
                : ('Tiến độ: ' + Math.round(mine.progress) + '%');
            if (statusEl && statusEl.dataset.idle !== '1') setStatus(label);
        }
        raf = requestAnimationFrame(frame);
    }

    function open(key, done) {
        const spec = DRINKS[key];
        if (!spec) return;
        modal = el('minigame-modal');
        titleEl = el('minigame-title');
        hintEl = el('minigame-hint');
        statusEl = el('minigame-status');
        barEl = el('minigame-progress');
        canvasEl = el('minigame-canvas');
        onDone = done || null;
        mine = fresh(key);
        holding = false;
        titleEl.textContent = spec.icon + ' ' + spec.name;
        hintEl.textContent = spec.hint;
        statusEl.dataset.idle = '1';
        setStatus('Nhấn giữ để bắt đầu.');
        if (barEl) barEl.style.width = '0%';
        modal.classList.remove('hidden');
        ctx = canvasEl.getContext('2d');
        last = performance.now();
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(frame);
    }

    function close() {
        cancelAnimationFrame(raf);
        raf = 0;
        mine = null;
        holding = false;
        if (modal) modal.classList.add('hidden');
    }

    function press() {
        if (!mine || mine.finished) return;
        if (mine.key === 'coldbrew') {
            const drop = mine.drops.find(function (d) { return !d.scored && d.y > 166 && d.y < 214; });
            if (drop) {
                drop.scored = true;
                mine.hits += 1;
                mine.progress = Math.min(100, mine.progress + 15);
                mine.flash = 1;
                setStatus('Đạt! Đã hứng ' + mine.hits + '/7');
            } else {
                setStatus('Chưa đúng lúc — chờ giọt rơi vào vùng xanh nhé.');
            }
            return;
        }
        holding = true;
        if (statusEl) statusEl.dataset.idle = '';
    }

    function release() { holding = false; }

    document.addEventListener('DOMContentLoaded', function () {
        canvasEl = el('minigame-canvas');
        if (!canvasEl) return;
        const down = function (event) { event.preventDefault(); press(); };
        const up = function (event) { event.preventDefault(); release(); };
        canvasEl.addEventListener('mousedown', down);
        canvasEl.addEventListener('mouseup', up);
        canvasEl.addEventListener('mouseleave', release);
        canvasEl.addEventListener('touchstart', down, { passive: false });
        canvasEl.addEventListener('touchend', up, { passive: false });
        canvasEl.addEventListener('touchcancel', release);

        el('minigame-restart').addEventListener('click', function () {
            const key = mine ? mine.key : null;
            if (key) open(key, onDone);
        });
        el('minigame-close').addEventListener('click', close);

        document.addEventListener('keydown', function (event) {
            if (!mine || mine.finished) return;
            const tag = (event.target && event.target.tagName || '').toUpperCase();
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            if (event.code === 'Space') { event.preventDefault(); press(); }
        });
        document.addEventListener('keyup', function (event) {
            if (event.code === 'Space') { event.preventDefault(); release(); }
        });
    });

    window.BiengMini = { open: open, close: close, drinks: DRINKS, current: function () { return mine ? mine.key : null; } };
})();

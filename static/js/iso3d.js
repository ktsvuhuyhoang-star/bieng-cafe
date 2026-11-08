/**
 * Renderer 3D isometric (giai đoạn 0) — đọc layout.json, vẽ khối đùn theo chiều cao.
 * Không dùng thư viện ngoài: tự chiếu + sắp xếp theo độ sâu (painter's algorithm).
 * Bật bằng nút "3D" hoặc thêm ?renderer=3d vào URL.
 */
(function () {
    'use strict';

    const COS30 = Math.cos(Math.PI / 6);
    const SIN30 = Math.sin(Math.PI / 6);
    const PALETTE = {
        floor: [201, 162, 116], rug: [186, 203, 132], wall: [239, 227, 208],
        glass: [168, 216, 232], door: [247, 243, 234], counter: [181, 99, 48],
        table: [181, 99, 48], chair: [114, 80, 55], stool: [156, 106, 54],
        bench: [173, 113, 69], sofa: [63, 122, 85], plant: [93, 140, 72], fixture: [139, 143, 125]
    };
    const SKIP = { wall: true, glass: true, door: true };
    const state = {
        active: false, canvas: null, ctx: null, layout: null, meshes: [], scene: null,
        view: { scale: 1, ox: 0, oy: 0 }, dpr: 1, last: 0, raf: 0, source: null
    };

    function $(id) { return document.getElementById(id); }
    function notice(text) { if (window.showSystemNotice) window.showSystemNotice(text); }

    function resolveLayout() {
        try {
            if (window.publishedLayout && window.publishedLayout.schema === 'bieng-layout') {
                return { data: window.publishedLayout, source: 'bản đã xuất bản' };
            }
        } catch (error) { /* ignore */ }
        try {
            if (typeof BIENG_BUNDLED_LAYOUT !== 'undefined' && BIENG_BUNDLED_LAYOUT) {
                return { data: BIENG_BUNDLED_LAYOUT, source: 'bản mặc định' };
            }
        } catch (error) { /* ignore */ }
        return null;
    }

    function buildMeshes(layout) {
        const meshes = [];
        (layout.instances || []).forEach(function (inst) {
            const def = (layout.definitions || {})[inst.definition];
            if (!def || !def.footprint || def.footprint.length < 3) return;
            const m = inst.transform || [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
            // bỏ qua vật thể quá lớn (sàn/nền) khi dựng danh sách khối
            const base = def.footprint.map(function (p) {
                return [m[0] * p[0] + m[4] * p[1] + m[12], m[1] * p[0] + m[5] * p[1] + m[13], 0];
            });
            const height = Math.max(0, (def.bounds[5] - def.bounds[2]) * Math.abs(m[10] || 1));
            let depth = 0;
            base.forEach(function (p) { depth += p[0] + p[1]; });
            depth /= base.length;
            meshes.push({ kind: def.kind || 'fixture', base: base, height: height, depth: depth });
        });
        return meshes;
    }

    function fitView() {
        const points = [];
        state.meshes.forEach(function (mesh) {
            mesh.base.forEach(function (p) { points.push(project(p, 0)); });
        });
        if (!points.length) return;
        const xs = points.map(function (p) { return p[0]; });
        const ys = points.map(function (p) { return p[1]; });
        const width = Math.max.apply(null, xs) - Math.min.apply(null, xs) || 1;
        const height = Math.max.apply(null, ys) - Math.min.apply(null, ys) || 1;
        const canvas = state.canvas;
        const pad = 40;
        const scale = Math.min((canvas.clientWidth - pad * 2) / width,
            (canvas.clientHeight - pad * 2) / height);
        state.view.scale = scale;
        state.view.ox = canvas.clientWidth / 2 - ((Math.min.apply(null, xs) + width / 2) * scale);
        state.view.oy = canvas.clientHeight / 2 - ((Math.min.apply(null, ys) + height / 2) * scale);
        state.baseIso = { minX: Math.min.apply(null, xs), minY: Math.min.apply(null, ys) };
    }

    function project(point, elevation) {
        const x = point[0];
        const y = point[1];
        const z = point[2] || 0;
        return [
            (x - y) * COS30,
            (x + y) * SIN30 - z * (elevation === undefined ? 1 : elevation)
        ];
    }

    function toScreen(p) {
        return [p[0] * state.view.scale + state.view.ox, p[1] * state.view.scale + state.view.oy];
    }

    function shade(color, factor) {
        return 'rgb(' + Math.max(0, Math.min(255, Math.round(color[0] * factor))) + ','
            + Math.max(0, Math.min(255, Math.round(color[1] * factor))) + ','
            + Math.max(0, Math.min(255, Math.round(color[2] * factor))) + ')';
    }

    function colorOf(kind) { return PALETTE[kind] || [150, 135, 118]; }

    function drawPoly(ctx, points, fill, stroke) {
        if (points.length < 3) return;
        ctx.beginPath();
        ctx.moveTo(points[0][0], points[0][1]);
        for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
        ctx.closePath();
        if (fill) { ctx.fillStyle = fill; ctx.fill(); }
        if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
    }

    function drawMesh(ctx, mesh, alpha) {
        const color = colorOf(mesh.kind);
        const top = mesh.base.map(function (p) { return [p[0], p[1], p[2] + mesh.height]; });
        ctx.globalAlpha = alpha === undefined ? 1 : alpha;
        for (let i = 0; i < mesh.base.length; i++) {
            const a = mesh.base[i];
            const b = mesh.base[(i + 1) % mesh.base.length];
            const ta = top[i];
            const tb = top[(i + 1) % top.length];
            drawPoly(ctx, [
                toScreen(project(a)), toScreen(project(b)),
                toScreen(project(tb)), toScreen(project(ta))
            ], shade(color, 0.72 + (i % 3) * 0.05), null);
        }
        drawPoly(ctx, top.map(function (p) { return toScreen(project(p)); }), shade(color, 1), 'rgba(40,30,22,0.55)');
        ctx.globalAlpha = 1;
    }

    function drawActor(ctx, x, y, shirt, name, emoji) {
        const p = toScreen(project([x, y, 0]));
        const s = Math.max(0.75, Math.min(1.6, state.view.scale * 30));
        ctx.save();
        ctx.translate(p[0], p[1]);
        ctx.scale(s, s);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.ellipse(0, 6, 11, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = shirt || '#3f7aa8';
        ctx.strokeStyle = '#2a2118';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.roundRect(-7, -10, 14, 20, 3);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#f3c99b';
        ctx.beginPath();
        ctx.arc(0, -18, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#3a2a1c';
        ctx.fillRect(-6, -24, 12, 4);
        if (name) {
            ctx.font = 'bold 9px sans-serif';
            const w = ctx.measureText(name).width + 10;
            ctx.fillStyle = 'rgba(28,22,16,0.92)';
            ctx.beginPath();
            ctx.roundRect(-w / 2, -40, w, 13, 6);
            ctx.fill();
            ctx.fillStyle = '#f6e7cf';
            ctx.textAlign = 'center';
            ctx.fillText(name, 0, -30);
        }
        if (emoji) {
            ctx.font = '16px "Segoe UI Emoji", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(emoji, 0, -26);
        }
        ctx.restore();
    }

    function drawScene(now) {
        if (!state.active || !state.ctx) return;
        const ctx = state.ctx;
        const canvas = state.canvas;
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;

        ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
        ctx.clearRect(0, 0, width, height);
        const grad = ctx.createLinearGradient(0, 0, 0, height);
        grad.addColorStop(0, '#1a1510');
        grad.addColorStop(1, '#2a2018');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        const floors = state.meshes.filter(function (m) { return m.kind === 'floor' || m.kind === 'rug'; });
        floors.sort(function (a, b) { return a.depth - b.depth; });
        floors.forEach(function (mesh) {
            drawPoly(ctx, mesh.base.map(function (p) { return toScreen(project(p)); }),
                shade(colorOf(mesh.kind), 1), 'rgba(120,90,60,0.8)');
        });

        state.meshes.filter(function (m) { return SKIP[m.kind]; }).forEach(function (mesh) {
            drawMesh(ctx, mesh, 0.55);
        });

        const solids = state.meshes.filter(function (m) {
            return !SKIP[m.kind] && m.kind !== 'floor' && m.kind !== 'rug';
        });
        solids.sort(function (a, b) { return a.depth - b.depth; });
        solids.forEach(function (mesh) { drawMesh(ctx, mesh, 1); });

        const scene = state.scene || (window.getScene && window.getScene());
        state.scene = scene;
        if (scene && scene.player) {
            const me = scene.player;
            const shirt = (window.guest && window.guest.outfit && window.guest.outfit.shirt) || '#3f7aa8';
            drawActor(ctx, me.x, me.y, shirt, (window.guest && window.guest.name) || 'Bạn');
            let count = 0;
            for (const id in scene.remotePlayers) {
                const rp = scene.remotePlayers[id];
                if (!rp || !rp.sprite) continue;
                drawActor(ctx, rp.sprite.x, rp.sprite.y, '#a85a3f', rp.name);
                if (++count > 24) break;
            }
        }

        ctx.fillStyle = 'rgba(20,16,12,0.72)';
        ctx.fillRect(10, height - 34, 250, 24);
        ctx.fillStyle = '#c9b79b';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('3D isometric (thử nghiệm) · ' + (state.source || ''), 20, height - 18);

        state.raf = requestAnimationFrame(drawScene);
    }

    function resize() {
        if (!state.canvas) return;
        state.dpr = Math.min(2, window.devicePixelRatio || 1);
        state.canvas.width = state.canvas.clientWidth * state.dpr;
        state.canvas.height = state.canvas.clientHeight * state.dpr;
        fitView();
    }

    function screenToWorld(clientX, clientY) {
        const rect = state.canvas.getBoundingClientRect();
        const sx = (clientX - rect.left - state.view.ox) / state.view.scale;
        const sy = (clientY - rect.top - state.view.oy) / state.view.scale;
        const x = (sx / COS30 + sy / SIN30) / 2;
        const y = (sy / SIN30 - sx / COS30) / 2;
        return [x, y];
    }

    function toGame(x, y) {
        const pr = state.layout.projection || {};
        const scale = pr.scale || 1;
        return {
            x: (pr.xOffset || 0) + (y - (pr.modelYOrigin || 0)) * scale,
            y: (pr.yOffset || 0) + (x - (pr.modelXOrigin || 0)) * scale
        };
    }

    function onPointer(event) {
        const scene = window.getScene && window.getScene();
        if (!scene) return;
        const world = screenToWorld(event.clientX, event.clientY);
        const point = toGame(world[0], world[1]);
        if (point.x > 0 && point.x < 960 && point.y > 0 && point.y < 540) {
            scene.targetPos = { x: point.x, y: point.y };
        }
        event.preventDefault();
    }

    function ensureCanvas() {
        if (state.canvas) return;
        const canvas = document.createElement('canvas');
        canvas.id = 'iso3d-canvas';
        canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:5;display:none;touch-action:none;';
        document.body.appendChild(canvas);
        state.canvas = canvas;
        state.ctx = canvas.getContext('2d');
        canvas.addEventListener('pointerdown', onPointer);
        window.addEventListener('resize', resize);
    }

    function enable() {
        ensureCanvas();
        const resolved = state.layout ? { data: state.layout, source: state.source } : resolveLayout();
        if (!resolved) { notice('Chưa có mặt bằng để dựng 3D.'); return false; }
        state.layout = resolved.data;
        state.source = resolved.source;
        state.meshes = buildMeshes(state.layout);
        state.active = true;
        state.canvas.style.display = 'block';
        resize();
        const game = window.getScene && window.getScene();
        if (game && game.sys && game.sys.game && game.sys.game.canvas) {
            game.sys.game.canvas.style.visibility = 'hidden';
        }
        state.raf = requestAnimationFrame(drawScene);
        notice('🧊 Đang xem 3D isometric (thử nghiệm). Bấm 3D lần nữa để quay lại 2D.');
        return true;
    }

    function disable() {
        state.active = false;
        if (state.raf) cancelAnimationFrame(state.raf);
        if (state.canvas) state.canvas.style.display = 'none';
        const game = window.getScene && window.getScene();
        if (game && game.sys && game.sys.game && game.sys.game.canvas) {
            game.sys.game.canvas.style.visibility = 'visible';
        }
        notice('Đã quay lại giao diện 2D.');
    }

    function toggle() { return state.active ? (disable(), false) : enable(); }

    document.addEventListener('DOMContentLoaded', function () {
        const button = $('btn-iso3d');
        if (button) {
            button.addEventListener('click', function () {
                const on = toggle();
                button.textContent = on ? '🧊 3D: bật' : '🧊 3D';
            });
        }
        if (/[?&]renderer=3d/.test(location.search)) {
            setTimeout(enable, 1200);
        }
    });

    window.BiengIso3D = {
        toggle: toggle,
        enable: enable,
        disable: disable,
        active: function () { return state.active; }
    };
})();

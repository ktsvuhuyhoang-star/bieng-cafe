/**
 * Bieng Cafe - bảng tin, lời nhắn công khai và khu quản trị.
 * Mật khẩu chỉ được kiểm tra ở server; client chỉ giữ tạm trong sessionStorage
 * và mất hiệu lực khi tải lại trang.
 */
(function () {
    'use strict';

    const PASS_KEY = 'bieng.admin.pass';
    const state = { posts: [], messages: [], muted: [], online: new Map(), editingId: null, retry: null };

    function $(id) { return document.getElementById(id); }
    function pass() { return sessionStorage.getItem(PASS_KEY) || ''; }

    function fmt(iso) {
        const date = new Date(iso);
        if (isNaN(date.getTime())) return '';
        return date.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
    }

    function notice(message) {
        if (typeof window.showSystemNotice === 'function') window.showSystemNotice(message);
    }

    function report(error) {
        if (error && error.message) notice('⚠️ ' + error.message);
    }

    async function api(path, options) {
        const response = await fetch(path, options || {});
        let data = null;
        try { data = await response.json(); } catch (e) { data = null; }
        if (!response.ok) {
            const error = new Error((data && data.error) || ('Lỗi ' + response.status));
            error.status = response.status;
            throw error;
        }
        return data;
    }

    async function adminApi(method, path, body) {
        const headers = { 'X-Admin-Password': pass() };
        if (body !== undefined) headers['Content-Type'] = 'application/json';
        return api(path, { method: method, headers: headers, body: body === undefined ? undefined : JSON.stringify(body) });
    }

    /** Chạy một thao tác quản trị; thiếu/sai mật khẩu thì hỏi rồi chạy lại chính thao tác đó. */
    async function runAdmin(action) {
        if (!pass()) {
            state.retry = action;
            openGate('Nhập mật khẩu quản trị để tiếp tục.');
            return;
        }
        try {
            await action();
        } catch (error) {
            if (error.status === 401 || error.status === 429) {
                sessionStorage.removeItem(PASS_KEY);
                updateAdminUI();
                state.retry = action;
                openGate(error.message);
                return;
            }
            report(error);
        }
    }

    // ---------- hiển thị ----------
    function node(tag, className, text) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (text !== undefined) element.textContent = text;
        return element;
    }

    function button(icon, label, handler) {
        const element = node('button', 'chip-btn', icon + ' ' + label);
        element.type = 'button';
        element.addEventListener('click', handler);
        return element;
    }

    /** Xoá cần bấm hai lần để tránh hộp thoại confirm bị chặn. */
    function armDelete(element, action) {
        if (element.dataset.armed === '1') {
            element.dataset.armed = '';
            element.textContent = element.dataset.label || '🗑️ Xoá';
            action();
            return;
        }
        element.dataset.armed = '1';
        element.dataset.label = element.textContent;
        element.textContent = '⚠️ Chắc chắn?';
        setTimeout(function () {
            if (element.dataset.armed === '1') {
                element.dataset.armed = '';
                element.textContent = element.dataset.label || '🗑️ Xoá';
            }
        }, 3000);
    }

    function renderPosts() {
        const list = $('news-list');
        if (!list) return;
        list.textContent = '';
        if (!state.posts.length) {
            list.appendChild(node('p', 'board-empty', 'Bảng tin đang trống. Quản trị viên có thể đăng bài đầu tiên.'));
            return;
        }
        state.posts.forEach(function (post) {
            const card = node('article', 'post-card' + (post.pinned ? ' pinned' : ''));
            const head = node('div', 'post-head');
            head.appendChild(node('strong', 'post-title', post.title || '(không tiêu đề)'));
            if (post.pinned) head.appendChild(node('span', 'pin-tag', '📌 Ghim'));
            card.appendChild(head);
            if (post.body) card.appendChild(node('p', 'post-body', post.body));
            if (post.link) {
                const link = node('a', 'post-link', post.link);
                link.href = post.link;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                card.appendChild(link);
            }
            const meta = node('div', 'post-meta');
            meta.appendChild(node('span', '', (post.author || 'Quản trị viên') + ' · ' + fmt(post.created_at)));
            const tools = node('div', 'post-tools');

            tools.appendChild(button('📌', post.pinned ? 'Bỏ ghim' : 'Ghim', function () {
                runAdmin(function () {
                    return adminApi('PATCH', '/api/community/posts/' + post.id, { pinned: !post.pinned }).then(refresh);
                });
            }));
            tools.appendChild(button('✏️', 'Sửa', function () {
                runAdmin(function () { startEdit(post); });
            }));

            const remove = button('🗑️', 'Xoá', function () {
                armDelete(remove, function () {
                    runAdmin(function () {
                        return adminApi('DELETE', '/api/community/posts/' + post.id).then(refresh);
                    });
                });
            });
            tools.appendChild(remove);

            meta.appendChild(tools);
            card.appendChild(meta);
            list.appendChild(card);
        });
    }

    function renderMessages() {
        const list = $('message-list');
        if (!list) return;
        list.textContent = '';
        if (!state.messages.length) {
            list.appendChild(node('p', 'board-empty', 'Chưa có lời nhắn nào. Hãy là người đầu tiên!'));
            return;
        }
        state.messages.forEach(function (message) {
            const card = node('div', 'message-card');
            const head = node('div', 'message-head');
            head.appendChild(node('strong', '', message.name || 'Khách'));
            head.appendChild(node('span', 'message-time', fmt(message.created_at)));
            card.appendChild(head);
            card.appendChild(node('p', 'message-text', message.text));

            const remove = button('🗑️', 'Xoá', function () {
                armDelete(remove, function () {
                    runAdmin(function () {
                        return adminApi('DELETE', '/api/community/messages/' + message.id).then(refresh);
                    });
                });
            });
            card.appendChild(remove);
            list.appendChild(card);
        });
    }

    function renderMutes() {
        const list = $('mute-list');
        if (!list) return;
        list.textContent = '';
        const mutedSet = new Set(state.muted.map(function (name) { return String(name).toLowerCase(); }));
        state.online.forEach(function (player) {
            const row = node('div', 'mute-row');
            const name = player.name || player.id;
            const isMuted = mutedSet.has(String(name).toLowerCase());
            row.appendChild(node('span', '', name + (isMuted ? ' · đang bị khoá' : '')));
            row.appendChild(button(isMuted ? '🔈' : '🔒', isMuted ? 'Mở' : 'Khoá', function () {
                setMute(name, !isMuted);
            }));
            list.appendChild(row);
        });
        state.muted.forEach(function (name) {
            const exists = Array.from(state.online.values()).some(function (player) {
                return String(player.name || '').toLowerCase() === String(name).toLowerCase();
            });
            if (exists) return;
            const row = node('div', 'mute-row');
            row.appendChild(node('span', '', name + ' · đang bị khoá (không online)'));
            row.appendChild(button('🔈', 'Mở', function () { setMute(name, false); }));
            list.appendChild(row);
        });
        if (!list.children.length) list.appendChild(node('p', 'board-empty', 'Chưa có ai bị khoá chat.'));
    }

    function apply(data) {
        if (Array.isArray(data.posts)) state.posts = data.posts;
        if (Array.isArray(data.messages)) state.messages = data.messages;
        if (Array.isArray(data.muted)) state.muted = data.muted;
        renderPosts();
        renderMessages();
        renderMutes();
    }

    async function refresh() {
        try { apply(await api('/api/community')); } catch (error) { report(error); }
    }

    // ---------- quản trị ----------
    function updateAdminUI() {
        const active = !!pass();
        const adminButton = $('btn-admin');
        if (adminButton) adminButton.textContent = active ? '🛠️ Quản trị ✓' : '🔐 Quản trị';
        const newButton = $('news-new');
        if (newButton) newButton.textContent = active ? '＋ Bài mới' : '🔒 Bài mới';
        if (!active) resetEditor();
    }

    function openGate(message) {
        const gate = $('admin-gate');
        if (!gate) return;
        gate.classList.remove('hidden');
        const status = $('admin-gate-status');
        if (status) status.textContent = message || '';
        const input = $('admin-password');
        if (input) { input.value = ''; setTimeout(function () { input.focus(); }, 60); }
    }

    function closeModal(id) {
        const element = $(id);
        if (element) element.classList.add('hidden');
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) active.blur();
    }

    async function login() {
        const input = $('admin-password');
        const status = $('admin-gate-status');
        const value = input ? input.value.trim() : '';
        if (!value) { if (status) status.textContent = 'Chưa nhập mật khẩu.'; return; }
        try {
            const response = await fetch('/api/admin/check', { headers: { 'X-Admin-Password': value } });
            if (!response.ok) throw new Error('Sai mật khẩu quản trị.');
            sessionStorage.setItem(PASS_KEY, value);
            updateAdminUI();
            if (status) status.textContent = '';
            closeModal('admin-gate');
            const retry = state.retry;
            state.retry = null;
            if (retry) { await retry(); } else { openAdmin(); }
        } catch (error) {
            if (status) status.textContent = error.message;
        }
    }

    function openAdmin() {
        if (!pass()) {
            state.retry = openAdmin;
            return openGate('Nhập mật khẩu quản trị để mở bảng quản trị.');
        }
        const modal = $('admin-modal');
        if (!modal) return;
        modal.classList.remove('hidden');
        renderMutes();
        const source = window.BiengSync && window.BiengSync.source;
        if ($('layout-source')) $('layout-source').textContent = 'Đang dùng: ' + (source || 'không rõ');
    }

    function setMute(name, muted) {
        runAdmin(function () {
            return adminApi('POST', '/api/community/mute', { name: name, muted: muted }).then(function (data) {
                if ($('mute-status')) $('mute-status').textContent = muted ? ('Đã khoá chat: ' + name) : ('Đã mở chat: ' + name);
                if (data && data.muted) state.muted = data.muted;
                renderMutes();
            });
        });
    }

    function startEdit(post) {
        state.editingId = post.id;
        $('post-editor').classList.remove('hidden');
        $('post-title').value = post.title || '';
        $('post-body').value = post.body || '';
        $('post-link').value = post.link || '';
        $('post-pinned').checked = !!post.pinned;
        $('post-title').focus();
    }

    function resetEditor() {
        state.editingId = null;
        const editor = $('post-editor');
        if (editor) editor.classList.add('hidden');
        ['post-title', 'post-body', 'post-link'].forEach(function (id) {
            const element = $(id);
            if (element) element.value = '';
        });
        const pinned = $('post-pinned');
        if (pinned) pinned.checked = false;
    }

    function savePost() {
        const payload = {
            title: $('post-title').value.trim(),
            body: $('post-body').value.trim(),
            link: $('post-link').value.trim(),
            pinned: $('post-pinned').checked
        };
        if (!payload.title && !payload.body) { notice('⚠️ Cần ít nhất tiêu đề hoặc nội dung.'); return; }
        if (payload.link && !/^https?:\/\//i.test(payload.link)) { notice('⚠️ Link phải bắt đầu bằng http:// hoặc https://'); return; }
        runAdmin(function () {
            const editing = state.editingId;
            return adminApi(editing ? 'PATCH' : 'POST',
                editing ? '/api/community/posts/' + editing : '/api/community/posts', payload)
                .then(function () {
                    resetEditor();
                    refresh();
                    notice('📌 Đã lưu bài lên bảng tin.');
                });
        });
    }

    async function sendMessage() {
        const input = $('message-input');
        const text = input.value.trim();
        if (!text) return;
        const name = (window.localPlayerProfile && window.localPlayerProfile.name) || 'Khách';
        try {
            await api('/api/community/messages', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name, text: text })
            });
            input.value = '';
            notice('💌 Đã gửi lời nhắn lên bảng.');
            refresh();
        } catch (error) { report(error); }
    }

    function publishLayout() {
        const layout = (window.BiengSync && window.BiengSync.current) || null;
        if (!layout) { notice('⚠️ Chưa có mặt bằng nào đang dùng.'); return; }
        runAdmin(function () {
            return adminApi('POST', '/api/layout', { layout: layout }).then(function () {
                localStorage.removeItem('bieng.layout.sync.v1');
                if ($('layout-status')) $('layout-status').textContent = 'Đã xuất bản. Tải lại trang để mọi người dùng bản mới.';
                notice('🌍 Đã xuất bản mặt bằng cho mọi người.');
            });
        });
    }

    function wire() {
        const on = function (id, event, handler) {
            const element = $(id);
            if (element) element.addEventListener(event, handler);
        };
        on('btn-news', 'click', function () { $('news-modal').classList.remove('hidden'); refresh(); });
        on('btn-board', 'click', function () { $('board-modal').classList.remove('hidden'); refresh(); });
        on('btn-admin', 'click', openAdmin);
        on('news-new', 'click', function () {
            runAdmin(function () { resetEditor(); $('post-editor').classList.remove('hidden'); });
        });
        on('post-cancel', 'click', resetEditor);
        on('post-save', 'click', savePost);
        on('message-send', 'click', sendMessage);
        on('admin-login', 'click', login);
        on('admin-password', 'keydown', function (event) { if (event.key === 'Enter') login(); });
        on('admin-logout', 'click', function () {
            sessionStorage.removeItem(PASS_KEY);
            updateAdminUI();
            closeModal('admin-modal');
            notice('Đã đăng xuất quản trị.');
        });
        on('mute-add', 'click', function () { const value = $('mute-name').value.trim(); if (value) setMute(value, true); });
        on('mute-remove', 'click', function () { const value = $('mute-name').value.trim(); if (value) setMute(value, false); });
        on('layout-publish', 'click', publishLayout);
        on('layout-clear', 'click', function () {
            localStorage.removeItem('bieng.layout.sync.v1');
            notice('Đã bỏ bản mặt bằng riêng trên máy này. Tải lại trang để dùng bản chung.');
        });

        document.querySelectorAll('[data-close]').forEach(function (element) {
            element.addEventListener('click', function () {
                if (element.dataset.close === 'minigame-modal' && window.closeMiniGame) {
                    window.closeMiniGame();
                    return;
                }
                closeModal(element.dataset.close);
                if (element.dataset.close === 'admin-gate') state.retry = null;
            });
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        // Mật khẩu chỉ sống trong một lần tải trang: mở lại trang là phải nhập lại.
        sessionStorage.removeItem(PASS_KEY);
        wire();
        updateAdminUI();
        refresh();

        if (window.cafeNetwork) {
            window.cafeNetwork.on('welcome', function (data) {
                if (data.community) apply(data.community);
                state.online.clear();
                Object.keys(data.players || {}).forEach(function (id) {
                    state.online.set(id, data.players[id]);
                });
                renderMutes();
            });
            window.cafeNetwork.on('player_join', function (data) {
                state.online.set(data.player.id, data.player); renderMutes();
            });
            window.cafeNetwork.on('player_leave', function (data) {
                state.online.delete(data.id); renderMutes();
            });
            window.cafeNetwork.on('community', function (data) { apply(data); });
            window.cafeNetwork.on('layout_published', function () {
                notice('🌍 Quản trị viên vừa cập nhật mặt bằng — tải lại trang để xem bản mới.');
            });
        }
    });

    window.BiengCommunity = {
        refresh: refresh,
        publishLayout: publishLayout,
        openAdmin: openAdmin,
        requireAdmin: runAdmin,
        hasPass: function () { return !!pass(); }
    };
})();

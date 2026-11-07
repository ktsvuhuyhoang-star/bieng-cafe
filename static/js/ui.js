/**
 * Bieng Cafe - UI, HUD, quầy pha chế (mini game), jukebox, chat, mobile, toàn màn hình.
 */

// Global state
window.mobileDpadState = { up: false, down: false, left: false, right: false };
window.localPlayerProfile = null;
let gameInstance = null;

const DRINK_MENU = [
    { key: 'pourover', icon: '🌊', name: 'Pour-over', desc: 'Rót tay chậm rãi, hương hoa quả thanh thoát.' },
    { key: 'espresso', icon: '⚡', name: 'Espresso', desc: 'Ép 9 bar, đậm đặc, lớp crema vàng óng.' },
    { key: 'coldbrew', icon: '🧊', name: 'Cold brew', desc: 'Ủ lạnh 18 giờ, dịu ngọt, uống là mát.' },
    { key: 'matcha', icon: '🍵', name: 'Matcha latte', desc: 'Đánh trà xanh mịn, sữa béo nhẹ, thơm dịu.' },
    { key: 'banana', icon: '🍌', name: 'Bánh chuối', desc: 'Bánh chuối nướng nóng, cắt lát vừa ăn.' },
    { key: 'smoke', icon: '🚬', name: 'Hút thuốc', desc: 'Chỉ hút được ở khu hút thuốc ngoài cửa quán.' }
];

// 1. Vào quán
function initEntry() {
    const enterBtn = document.getElementById('enter-btn');
    const nameInput = document.getElementById('player-name-input');
    const colorPickers = document.querySelectorAll('.outfit-color');

    let selectedShirt = '#d97706';
    colorPickers.forEach(function (picker) {
        picker.addEventListener('click', function () {
            colorPickers.forEach(function (other) { other.classList.remove('selected'); });
            picker.classList.add('selected');
            selectedShirt = picker.getAttribute('data-color');
        });
    });

    const vehicleOptions = document.querySelectorAll('.vehicle-option');
    let selectedVehicle = 'motorbike';
    vehicleOptions.forEach(function (option) {
        option.addEventListener('click', function () {
            vehicleOptions.forEach(function (other) { other.classList.remove('selected'); });
            option.classList.add('selected');
            selectedVehicle = option.getAttribute('data-vehicle') || 'motorbike';
        });
    });

    enterBtn.addEventListener('click', async function () {
        const name = nameInput.value.trim() || 'Khách Ghé Chơi';
        window.localPlayerProfile = {
            name: name,
            vehicle: selectedVehicle,
            outfit: { shirt: selectedShirt, hair: '#451a03', skin: '#fed7aa', pants: '#1e293b' }
        };

        window.cafeAudio.init();
        window.cafeAudio.startRain();
        window.cafeAudio.startLofiMusic();

        document.getElementById('entry-modal').classList.add('hidden');
        document.getElementById('hud-container').classList.remove('hidden');
        document.getElementById('hud-player-name').innerText = name;
        if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
        window.focus();

        await window.loadPublishedLayout();
        launchGame();
    });
}

// Lấy mặt bằng đã xuất bản từ server (nếu có); lỗi thì dùng bản mặc định.
window.publishedLayout = null;
window.loadPublishedLayout = async function () {
    try {
        const response = await fetch('/api/layout', { cache: 'no-store' });
        if (response.status === 204 || !response.ok) return null;
        const data = await response.json();
        if (data && data.schema === 'bieng-layout') window.publishedLayout = data;
    } catch (error) {
        window.publishedLayout = null;
    }
    return window.publishedLayout;
};

function launchGame() {
    const config = {
        type: Phaser.AUTO,
        parent: 'game-container',
        width: 960,
        height: 540,
        pixelArt: true,
        banner: false,
        disableContextMenu: true,
        render: { preserveDrawingBuffer: true, antialias: false, powerPreference: 'low-power' },
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
        scene: [CafeScene]
    };
    gameInstance = new Phaser.Game(config);
    // Tab bị ẩn thì dừng vòng lặp để không ăn CPU/quạt
    document.addEventListener('visibilitychange', function () {
        if (!gameInstance || !gameInstance.loop) return;
        if (document.hidden) gameInstance.loop.sleep();
        else gameInstance.loop.wake();
    });
}

// 2. HUD & thông báo
let lastPrompt = null;
window.updateInteractionPrompt = function (text) {
    const value = text || '';
    if (value === lastPrompt) return;   // tránh ghi DOM 60 lần/giây
    lastPrompt = value;
    const prompt = document.getElementById('interact-prompt');
    const action = document.getElementById('mobile-action-btn');
    if (value) {
        prompt.innerText = value;
        prompt.classList.remove('hidden');
        if (action) action.classList.add('highlight');
    } else {
        prompt.classList.add('hidden');
        if (action) action.classList.remove('highlight');
    }
};

window.updatePlayerStatus = function (statusText) {
    const element = document.getElementById('hud-player-status');
    if (element) element.innerText = statusText;
};

window.showSystemNotice = function (text) {
    const noticeEl = document.getElementById('system-notice');
    if (noticeEl) {
        noticeEl.innerText = text;
        noticeEl.classList.remove('hidden');
        if (noticeEl.hideTimer) clearTimeout(noticeEl.hideTimer);
        noticeEl.hideTimer = setTimeout(function () { noticeEl.classList.add('hidden'); }, 4000);
    }
    window.appendChatMessage('🔔 Bieng Cafe', text);
};

window.getScene = function () {
    return gameInstance ? gameInstance.scene.getScene('CafeScene') : null;
};

// 3. Khoá tiện ích khi chưa gửi xe
window.utilitiesLocked = function () {
    return !!(window.guest && (!window.guest.parked || window.guest.dirty));
};

window.refreshUtilityLocks = function () {
    const locked = window.utilitiesLocked();
    ['btn-drinks', 'btn-jukebox'].forEach(function (id) {
        const element = document.getElementById(id);
        if (element) element.classList.toggle('locked', locked);
    });
};

window.requireParking = function () {
    if (!window.guest) return false;
    if (!window.guest.parked) {
        window.showSystemNotice('Bạn còn xe kìa, gửi xe trước nhé 🛵');
        return true;
    }
    if (window.guest.dirty) {
        window.showSystemNotice('Tay còn bẩn — ra lavabo rửa tay trước nhé 🧼');
        return true;
    }
    return false;
};

// 4. Modal đơn giản
function blurEditor() {
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) active.blur();
}
window.toggleJukeboxModal = function (show) {
    if (show && window.requireParking && window.requireParking()) return;
    document.getElementById('jukebox-modal').classList.toggle('hidden', !show);
    if (!show) blurEditor();
};
window.toggleDrinksModal = function (show) {
    if (show && window.requireParking && window.requireParking()) return;
    document.getElementById('drinks-modal').classList.toggle('hidden', !show);
    if (!show) blurEditor();
};

// 4. Quầy pha chế: 3 món, mỗi món mở mini game riêng
function initDrinks() {
    const grid = document.getElementById('drink-grid');
    if (!grid) return;
    grid.textContent = '';

    DRINK_MENU.forEach(function (drink) {
        const card = document.createElement('div');
        card.className = 'drink-card';
        const icon = document.createElement('div');
        icon.className = 'drink-icon';
        icon.textContent = drink.icon;
        const info = document.createElement('div');
        info.className = 'drink-info';
        const title = document.createElement('strong');
        title.textContent = drink.name;
        const desc = document.createElement('p');
        desc.textContent = drink.desc;
        info.append(title, desc);
        const button = document.createElement('button');
        button.className = 'order-btn';
        button.type = 'button';
        button.textContent = 'Pha chế';
        button.addEventListener('click', function () { startDrink(drink); });
        card.append(icon, info, button);
        grid.appendChild(card);
    });

    const drinksButton = document.getElementById('btn-drinks');
    if (drinksButton) drinksButton.addEventListener('click', function () { window.toggleDrinksModal(true); });

    const closeButton = document.getElementById('minigame-close');
    if (closeButton) closeButton.addEventListener('click', function () { window.closeMiniGame(); });
}

/** Đóng mini game; chỉ mở lại menu đồ uống nếu vừa chơi game pha chế (không mở lại sau game WC). */
window.closeMiniGame = function () {
    const wasToilet = window.BiengMini && window.BiengMini.current && window.BiengMini.current() === 'toilet';
    if (window.BiengMini) window.BiengMini.close();
    if (!wasToilet) window.toggleDrinksModal(true);
};

function startDrink(drink) {
    if (drink.key === 'smoke' && !window.smokingSpotNear) {
        window.showSystemNotice('🚬 Hút thuốc phải ra khu hút thuốc ở ngoài cửa quán nhé!');
        return;
    }
    window.toggleDrinksModal(false);
    if (!window.BiengMini) {
        window.showSystemNotice('Quầy pha chế chưa sẵn sàng.');
        return;
    }
    window.BiengMini.open(drink.key, function () {
        const scene = window.getScene();
        if (drink.key === 'smoke') {
            window.updatePlayerStatus('Vừa hút thuốc 🚬');
            window.showSystemNotice('🚬 Xong một điếu. Nhớ đứng ngoài này hút thôi nhé!');
            if (window.BiengDuel) window.BiengDuel.addBadge('🚬');
            return;
        }
        if (scene) scene.holdDrink(drink.name);
        if (window.cafeNetwork) window.cafeNetwork.send({ type: 'drink_done', item: drink.name });
        window.showSystemNotice('☕ Xong rồi! Bạn đang cầm ly ' + drink.name + '.');
        if (window.cafeAudio) window.cafeAudio.playDing();
        setTimeout(function () { window.toggleDrinksModal(true); }, 700);
    });
}

// 5. Jukebox
function initJukebox() {
    const trackButtons = document.querySelectorAll('.track-btn');
    trackButtons.forEach(function (button, index) {
        button.addEventListener('click', function () {
            trackButtons.forEach(function (other) { other.classList.remove('active'); });
            button.classList.add('active');
            window.cafeAudio.setTrack(index);
            if (window.cafeNetwork) window.cafeNetwork.sendJukeboxChange(index);
        });
    });

    const musicSlider = document.getElementById('music-vol');
    const rainSlider = document.getElementById('rain-vol');
    if (musicSlider) {
        musicSlider.addEventListener('input', function (event) {
            if (window.cafeAudio.musicGain) window.cafeAudio.musicGain.gain.value = parseFloat(event.target.value);
        });
    }
    if (rainSlider) {
        rainSlider.addEventListener('input', function (event) {
            if (window.cafeAudio.rainGain) window.cafeAudio.rainGain.gain.value = parseFloat(event.target.value);
        });
    }

    const jukeboxButton = document.getElementById('btn-jukebox');
    if (jukeboxButton) jukeboxButton.addEventListener('click', function () { window.toggleJukeboxModal(true); });
}

// 6. Chat
function initChat() {
    const input = document.getElementById('chat-input');
    const sendButton = document.getElementById('chat-send-btn');

    function send() {
        const value = input.value.trim();
        if (value) {
            window.cafeNetwork.sendChat(value);
            input.value = '';
        }
    }

    sendButton.addEventListener('click', send);
    input.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') send();
        event.stopPropagation();
    });
}

window.appendChatMessage = function (sender, message) {
    const log = document.getElementById('chat-messages');
    if (!log) return;
    const line = document.createElement('div');
    line.className = 'chat-line';
    const who = document.createElement('span');
    who.className = 'chat-sender';
    who.textContent = String(sender) + ':';
    const words = document.createElement('span');
    words.className = 'chat-text';
    words.textContent = String(message);
    line.append(who, document.createTextNode(' '), words);
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
};

// 8. Điều khiển cảm ứng
function initMobileControls() {
    function bind(id, direction) {
        const element = document.getElementById(id);
        if (!element) return;
        const set = function (value) { window.mobileDpadState[direction] = value; };
        element.addEventListener('touchstart', function (event) { event.preventDefault(); set(true); }, { passive: false });
        element.addEventListener('touchend', function (event) { event.preventDefault(); set(false); }, { passive: false });
        element.addEventListener('mousedown', function (event) { event.preventDefault(); set(true); });
        element.addEventListener('mouseup', function (event) { event.preventDefault(); set(false); });
        element.addEventListener('mouseleave', function () { set(false); });
    }

    bind('dpad-up', 'up');
    bind('dpad-down', 'down');
    bind('dpad-left', 'left');
    bind('dpad-right', 'right');

    const action = document.getElementById('mobile-action-btn');
    if (action) {
        action.addEventListener('click', function () {
            const scene = window.getScene();
            if (scene) scene.handleInteract();
        });
    }
}

// 9. Toàn màn hình (quan trọng trên điện thoại: thanh địa chỉ che mất nút điều khiển)
function initFullscreen() {
    const button = document.getElementById('btn-fullscreen');
    if (!button) return;

    function active() {
        return !!(document.fullscreenElement || document.webkitFullscreenElement);
    }
    function sync() {
        const on = active();
        button.textContent = on ? '⛶ Thu nhỏ' : '⛶ Toàn màn hình';
        document.body.classList.toggle('is-fullscreen', on);
        setTimeout(function () {
            if (gameInstance && gameInstance.scale) gameInstance.scale.refresh();
        }, 250);
    }
    async function toggle() {
        try {
            if (active()) {
                await (document.exitFullscreen ? document.exitFullscreen() : document.webkitExitFullscreen());
            } else {
                const target = document.documentElement;
                await (target.requestFullscreen
                    ? target.requestFullscreen({ navigationUI: 'hide' })
                    : target.webkitRequestFullscreen());
                if (window.screen && screen.orientation && screen.orientation.lock) {
                    try { await screen.orientation.lock('landscape'); } catch (error) { /* iOS không cho khoá */ }
                }
            }
        } catch (error) {
            window.showSystemNotice('Trình duyệt này không cho bật toàn màn hình. Trên iPhone: nút Chia sẻ → "Thêm vào MH chính" để chơi không có thanh địa chỉ.');
        }
        sync();
    }

    button.addEventListener('click', toggle);
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    window.addEventListener('orientationchange', function () {
        setTimeout(function () {
            if (gameInstance && gameInstance.scale) gameInstance.scale.refresh();
        }, 300);
    });
    sync();
}

// Khởi động
window.addEventListener('DOMContentLoaded', function () {
    initEntry();
    initDrinks();
    initJukebox();
    initChat();
    initMobileControls();
    initFullscreen();

    if (window.cafeNetwork) {
        window.cafeNetwork.on('error', function (data) {
            if (data && data.message) window.showSystemNotice('⚠️ ' + data.message);
        });
    }
});

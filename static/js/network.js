/**
 * Cozy Pixel Cafe - WebSocket Networking Client
 * Có tự kết nối lại: server free (Render) ngủ 15 phút hoặc mạng chập chờn
 * thì client tự nối lại và join lại, người chơi không phải F5.
 */

class CafeNetwork {
    constructor() {
        this.socket = null;
        this.playerId = 'p_' + Math.random().toString(36).substring(2, 9);
        this.callbacks = {};
        this.connected = false;
        this.lastMoveSent = 0;
        this.profile = null;
        this.attempt = 0;
        this.reconnectTimer = null;
        this.manualClose = false;
    }

    on(event, callback) {
        if (!this.callbacks[event]) this.callbacks[event] = [];
        this.callbacks[event].push(callback);
    }

    emitEvent(event, data) {
        if (this.callbacks[event]) {
            this.callbacks[event].forEach(cb => cb(data));
        }
    }

    connect(playerProfile) {
        if (playerProfile) this.profile = playerProfile;
        this.manualClose = false;
        this.attempt = 0;
        this.open();
    }

    open() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const url = `${protocol}//${host}/ws/${this.playerId}`;

        try {
            this.socket = new WebSocket(url);
        } catch (error) {
            this.scheduleReconnect();
            return;
        }

        this.socket.onopen = () => {
            this.connected = true;
            this.attempt = 0;
            const profile = this.profile || {};
            this.send({
                type: 'join',
                name: profile.name || 'Khách',
                outfit: profile.outfit || {},
                vehicle: profile.vehicle || 'walk',
                x: profile.x ?? 400,
                y: profile.y ?? 440
            });
            this.emitEvent('connected', { id: this.playerId, reconnected: this.attempt > 0 });
        };

        this.socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.emitEvent(data.type, data);
            } catch (err) {
                console.error("Invalid WS message:", err);
            }
        };

        this.socket.onclose = () => {
            this.connected = false;
            this.emitEvent('disconnected', {});
            if (!this.manualClose) this.scheduleReconnect();
        };

        this.socket.onerror = (err) => {
            console.error("WS Error:", err);
        };
    }

    /** Nối lại với backoff tăng dần, tối đa 10 giây một lần. */
    scheduleReconnect() {
        if (this.reconnectTimer || this.manualClose) return;
        const delay = Math.min(10000, Math.round(1200 * Math.pow(1.6, this.attempt || 0)));
        this.attempt = (this.attempt || 0) + 1;
        this.emitEvent('reconnecting', { attempt: this.attempt, delay: delay });
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.open();
        }, delay);
    }

    disconnect() {
        this.manualClose = true;
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.socket) this.socket.close();
    }

    send(data) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(data));
        }
    }

    sendMove(x, y, direction, isMoving) {
        const rx = Math.round(x), ry = Math.round(y);
        if (this.profile) {
            this.profile.x = rx;
            this.profile.y = ry;
        }
        const now = Date.now();
        const last = this.lastSent;
        const changed = !last || last.x !== rx || last.y !== ry
            || last.direction !== direction || last.isMoving !== isMoving;
        // Nhẹ: đứng yên thì chỉ gửi keepalive 20 giây/lần; đang đi thì tối đa 20 gói/giây
        if (!changed && now - (this.lastMoveSent || 0) < 20000) return;
        if (changed && now - (this.lastMoveSent || 0) < 50) return;
        this.lastMoveSent = now;
        this.lastSent = { x: rx, y: ry, direction: direction, isMoving: isMoving };
        this.send({
            type: 'move',
            x: rx,
            y: ry,
            direction: direction,
            is_moving: isMoving
        });
    }

    sendSeat(seated, chairId, x, y) {
        this.send({
            type: 'seat',
            seated: seated,
            chair_id: chairId,
            x: x,
            y: y
        });
    }

    sendChat(text) {
        this.send({
            type: 'chat',
            text: text
        });
    }

    sendJukeboxChange(trackIndex) {
        this.send({
            type: 'jukebox_change',
            track: trackIndex
        });
    }
}

window.cafeNetwork = new CafeNetwork();

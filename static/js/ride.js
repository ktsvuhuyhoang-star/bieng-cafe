/**
 * RỦ ĐI CÙNG (v2) — người dẫn chở người theo vào quán.
 * Server giữ cặp leader/follower; client người theo khoá điều khiển và bám đuôi.
 */
(function () {
    'use strict';

    const state = { following: false, leaderId: null, leaderName: '', pending: null };

    function $(id) { return document.getElementById(id); }
    function myId() { return (window.cafeNetwork && window.cafeNetwork.playerId) || ''; }
    function notice(text) { if (window.showSystemNotice) window.showSystemNotice(text); }

    function invite(targetId) {
        if (!window.cafeNetwork || !targetId) return;
        if (window.guest && window.guest.parked && window.guest.vehicle !== 'walk') {
            notice('Bạn đã gửi xe rồi — phải còn xe mới rủ được nhé.');
            return;
        }
        window.cafeNetwork.send({ type: 'ride_invite', targetId: targetId });
    }

    function setFollowing(on, leaderId, leaderName) {
        state.following = !!on;
        state.leaderId = on ? leaderId : null;
        if (leaderName) state.leaderName = leaderName;
        const scene = window.getScene && window.getScene();
        if (scene && scene.setFollowing) scene.setFollowing(!!on, leaderId);
        const bar = $('follow-bar');
        const text = $('follow-bar-text');
        if (text) text.textContent = on ? '🛵 Đang đi cùng ' + state.leaderName : '';
        if (bar) bar.classList.toggle('hidden', !on);
    }

    function showInvite(data) {
        state.pending = data;
        const text = $('ride-invite-text');
        if (text) text.textContent = data.from_name + ' muốn chở bạn đi cà phê. Đồng ý lên xe không?';
        const modal = $('ride-invite');
        if (modal) modal.classList.remove('hidden');
    }

    function wireNetwork() {
        const net = window.cafeNetwork;
        if (!net) return;

        net.on('ride_invite', showInvite);

        net.on('ride_declined', function (data) {
            notice('😅 ' + (data.by_name || 'Người đó') + ' không đi cùng.');
        });

        net.on('ride_start', function (data) {
            if (data.follower === myId()) {
                setFollowing(true, data.leader, data.leader_name);
                notice('🛵 Bạn đang đi cùng ' + data.leader_name + '. Bấm "Hủy đi theo" để tách.');
            } else {
                notice('🛵 ' + data.follower_name + ' đã lên xe bạn.');
            }
        });

        net.on('ride_stop', function () {
            if (!state.following) return;
            setFollowing(false);
            notice('🛵 Đã tách khỏi nhóm, bạn tự do đi lại.');
        });
    }

    function wireUi() {
        const accept = $('ride-accept');
        if (accept) accept.addEventListener('click', function () {
            $('ride-invite').classList.add('hidden');
            if (state.pending && window.cafeNetwork) {
                window.cafeNetwork.send({ type: 'ride_answer', leaderId: state.pending.from, accept: true });
            }
            state.pending = null;
        });
        const decline = $('ride-decline');
        if (decline) decline.addEventListener('click', function () {
            $('ride-invite').classList.add('hidden');
            if (state.pending && window.cafeNetwork) {
                window.cafeNetwork.send({ type: 'ride_answer', leaderId: state.pending.from, accept: false });
            }
            state.pending = null;
        });
        const unbind = $('follow-unbind');
        if (unbind) unbind.addEventListener('click', function () {
            if (window.cafeNetwork) window.cafeNetwork.send({ type: 'ride_stop' });
            setFollowing(false);
            notice('🛵 Bạn đã tách ra, tự do đi lại.');
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        wireUi();
        wireNetwork();
    });

    window.BiengRide = {
        invite: invite,
        isFollowing: function () { return state.following; }
    };
})();

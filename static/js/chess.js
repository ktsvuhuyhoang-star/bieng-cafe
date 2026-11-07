/**
 * Cờ vua - bàn 8×8 trên canvas, hai người chơi chung một máy.
 * Luật ở chess-rules.js (window.ChessRules).
 */
(function () {
    'use strict';

    const CELL = 44;
    const MARGIN = 24;
    const SIZE = MARGIN * 2 + CELL * 8;
    const GLYPH = {
        w: { K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙' },
        b: { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟' }
    };
    const LABEL = { w: 'Trắng', b: 'Đen' };
    const FILES = 'abcdefgh';

    let canvas = null, ctx = null, statusEl = null;
    let game = null, selected = null, legal = [], over = false, history = [], lastMove = null;

    function rules() { return window.ChessRules; }
    function px(col) { return MARGIN + col * CELL; }
    function py(row) { return MARGIN + row * CELL; }
    function setStatus(text) { if (statusEl) statusEl.textContent = text; }
    function turnLabel() { return LABEL[game.turn]; }

    function reset() {
        game = rules().initial();
        selected = null; legal = []; over = false; history = []; lastMove = null;
        setStatus('Lượt của Trắng · bấm quân để xem nước đi.');
        draw();
    }

    function drawBoard() {
        ctx.fillStyle = '#3b2a1a';
        ctx.fillRect(0, 0, SIZE, SIZE);
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                ctx.fillStyle = (row + col) % 2 === 0 ? '#ecd9b0' : '#a9764a';
                ctx.fillRect(px(col) - CELL / 2, py(row) - CELL / 2, CELL, CELL);
            }
        }
        if (lastMove) {
            [lastMove.from, lastMove.to].forEach(function (index) {
                ctx.fillStyle = 'rgba(250,204,21,0.42)';
                ctx.fillRect(px(rules().colOf(index)) - CELL / 2, py(rules().rowOf(index)) - CELL / 2, CELL, CELL);
            });
        }
        ctx.fillStyle = 'rgba(255,243,212,0.8)';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let col = 0; col < 8; col++) ctx.fillText(FILES[col], px(col), SIZE - MARGIN / 2 + 2);
        for (let row = 0; row < 8; row++) ctx.fillText(String(8 - row), MARGIN / 2 - 2, py(row));
    }

    function drawPiece(row, col, piece) {
        const x = px(col), y = py(row);
        ctx.font = 'bold 32px "Segoe UI Symbol", "Noto Sans Symbols2", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 3;
        if (piece.c === 'w') {
            ctx.strokeStyle = '#1f2937';
            ctx.strokeText(GLYPH.w[piece.t], x, y + 1);
            ctx.fillStyle = '#fdfbf5';
            ctx.fillText(GLYPH.w[piece.t], x, y + 1);
        } else {
            ctx.strokeStyle = '#f8fafc';
            ctx.strokeText(GLYPH.b[piece.t], x, y + 1);
            ctx.fillStyle = '#111827';
            ctx.fillText(GLYPH.b[piece.t], x, y + 1);
        }
    }

    function draw() {
        if (!ctx || !game) return;
        drawBoard();

        legal.forEach(function (target) {
            const row = rules().rowOf(target), col = rules().colOf(target);
            ctx.beginPath();
            if (game.board[target]) {
                ctx.arc(px(col), py(row), CELL * 0.44, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(22,163,74,0.9)';
                ctx.lineWidth = 4;
                ctx.stroke();
            } else {
                ctx.arc(px(col), py(row), 6, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(22,163,74,0.65)';
                ctx.fill();
            }
        });

        if (selected !== null) {
            ctx.beginPath();
            ctx.arc(px(rules().colOf(selected)), py(rules().rowOf(selected)), CELL * 0.46, 0, Math.PI * 2);
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 3;
            ctx.stroke();
        }

        for (let i = 0; i < 64; i++) {
            if (game.board[i]) drawPiece(rules().rowOf(i), rules().colOf(i), game.board[i]);
        }

        if (!over && rules().inCheck(game, game.turn)) {
            const king = rules().kingSquare(game, game.turn);
            if (king >= 0) {
                ctx.beginPath();
                ctx.arc(px(rules().colOf(king)), py(rules().rowOf(king)), CELL * 0.46, 0, Math.PI * 2);
                ctx.strokeStyle = '#dc2626';
                ctx.lineWidth = 3;
                ctx.stroke();
            }
        }
    }

    function select(index) {
        selected = index;
        legal = rules().legalMoves(game, index);
        setStatus(legal.length ? 'Chọn ô đích (' + legal.length + ' nước).' : 'Quân này không có nước hợp lệ.');
    }

    function clearSelection() {
        selected = null;
        legal = [];
    }

    function play(from, to) {
        const snapshot = { game: rules().cloneState(game), lastMove: lastMove };
        const result = rules().apply(game, from, to);
        history.push(snapshot);
        game = result.state;
        lastMove = { from: from, to: to };
        clearSelection();
        over = false;

        const info = rules().status(game);
        if (info.mate) {
            over = true;
            setStatus('🏆 Chiếu bí! ' + LABEL[rules().other(game.turn)] + ' thắng.');
        } else if (info.stalemate) {
            over = true;
            setStatus('🤝 Hoà — ' + turnLabel() + ' hết nước đi nhưng không bị chiếu.');
        } else if (info.check) {
            setStatus('⚠️ Chiếu tướng! ' + turnLabel() + ' phải gỡ chiếu.');
        } else if (result.promotion) {
            setStatus('Tốt phong cấp thành Hậu ♕ · lượt của ' + turnLabel() + '.');
        } else {
            setStatus('Lượt của ' + turnLabel() + '.');
        }
        if (window.cafeAudio) window.cafeAudio.playDing();
        draw();
    }

    function undo() {
        if (!history.length) return;
        const previous = history.pop();
        game = previous.game;
        lastMove = previous.lastMove;
        over = false;
        clearSelection();
        setStatus('Đã lùi một nước · lượt của ' + turnLabel() + '.');
        draw();
    }

    function squareFrom(event) {
        const rect = canvas.getBoundingClientRect();
        const x = (event.clientX - rect.left) * (SIZE / rect.width);
        const y = (event.clientY - rect.top) * (SIZE / rect.height);
        const col = Math.round((x - MARGIN) / CELL);
        const row = Math.round((y - MARGIN) / CELL);
        if (row < 0 || row > 7 || col < 0 || col > 7) return -1;
        if (Math.hypot(x - px(col), y - py(row)) > CELL * 0.55) return -1;
        return rules().idx(row, col);
    }

    function onClick(event) {
        if (!game || over) return;
        const index = squareFrom(event);
        if (index < 0) return;

        if (selected !== null && legal.indexOf(index) !== -1) {
            play(selected, index);
            return;
        }
        const piece = game.board[index];
        if (piece && piece.c === game.turn) {
            if (selected === index) {
                clearSelection();
                setStatus('Lượt của ' + turnLabel() + '.');
            } else {
                select(index);
            }
            draw();
            return;
        }
        if (selected !== null) {
            clearSelection();
            setStatus('Lượt của ' + turnLabel() + '.');
            draw();
        }
    }

    function wire() {
        canvas = document.getElementById('chess-canvas');
        if (!canvas) return;
        canvas.width = SIZE;
        canvas.height = SIZE;
        ctx = canvas.getContext('2d');
        statusEl = document.getElementById('chess-status');

        canvas.addEventListener('click', onClick);
        const openButton = document.getElementById('btn-chess');
        if (openButton) {
            openButton.addEventListener('click', function () {
                if (window.requireParking && window.requireParking()) return;
                document.getElementById('chess-modal').classList.remove('hidden');
                draw();
                if (!over) setStatus('Lượt của ' + turnLabel() + '.');
            });
        }
        const newButton = document.getElementById('chess-new');
        if (newButton) newButton.addEventListener('click', reset);
        const undoButton = document.getElementById('chess-undo');
        if (undoButton) undoButton.addEventListener('click', undo);

        reset();
    }

    document.addEventListener('DOMContentLoaded', wire);
    window.BiengChess = { reset: reset, undo: undo, state: function () { return game; } };
})();

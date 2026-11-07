/**
 * Luật cờ vua — thuần logic, không phụ thuộc DOM.
 * Bàn 8×8, index = row * 8 + col. Hàng 0 ở trên (phe Đen), hàng 7 ở dưới (phe Trắng).
 * Quân: {c:'w'|'b', t:'P'|'N'|'B'|'R'|'Q'|'K'}.
 * State: {board, turn:'w'|'b', castling:{wK,wQ,bK,bQ}, ep: index|null}
 * Có đủ: nhập thành, bắt tốt qua đường, phong cấp (tự phong Hậu), chiếu, chiếu bí, hết nước.
 */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.ChessRules = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';

    const N = 8;
    const idx = (r, c) => r * N + c;
    const rowOf = (i) => Math.floor(i / N);
    const colOf = (i) => i % N;
    const inside = (r, c) => r >= 0 && r < N && c >= 0 && c < N;
    const other = (color) => (color === 'w' ? 'b' : 'w');
    const pawnDir = (color) => (color === 'w' ? -1 : 1);
    const startRow = (color) => (color === 'w' ? 6 : 1);
    const lastRow = (color) => (color === 'w' ? 0 : 7);

    function initial() {
        const board = new Array(64).fill(null);
        const back = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
        back.forEach(function (type, col) {
            board[idx(0, col)] = { c: 'b', t: type };
            board[idx(7, col)] = { c: 'w', t: type };
        });
        for (let col = 0; col < 8; col++) {
            board[idx(1, col)] = { c: 'b', t: 'P' };
            board[idx(6, col)] = { c: 'w', t: 'P' };
        }
        return { board: board, turn: 'w', castling: { wK: true, wQ: true, bK: true, bQ: true }, ep: null };
    }

    function cloneState(state) {
        return {
            board: state.board.map(function (piece) { return piece ? { c: piece.c, t: piece.t } : null; }),
            turn: state.turn,
            castling: { wK: state.castling.wK, wQ: state.castling.wQ, bK: state.castling.bK, bQ: state.castling.bQ },
            ep: state.ep
        };
    }

    function pieceAt(state, r, c) {
        return inside(r, c) ? state.board[idx(r, c)] : null;
    }

    /** Ô bị quân màu `by` tấn công (tốt chỉ tấn công chéo). */
    function attackSquares(state, from) {
        const piece = state.board[from];
        if (!piece) return [];
        const r = rowOf(from), c = colOf(from), color = piece.c;
        const out = [];
        const add = (rr, cc) => { if (inside(rr, cc)) out.push(idx(rr, cc)); };

        if (piece.t === 'P') {
            const dir = pawnDir(color);
            add(r + dir, c - 1);
            add(r + dir, c + 1);
            return out;
        }
        if (piece.t === 'N') {
            [[2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [1, -2], [-1, 2], [-1, -2]].forEach(function (m) {
                add(r + m[0], c + m[1]);
            });
            return out;
        }
        if (piece.t === 'K') {
            [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(function (m) {
                add(r + m[0], c + m[1]);
            });
            return out;
        }
        const slides = piece.t === 'R' ? [[1, 0], [-1, 0], [0, 1], [0, -1]]
            : piece.t === 'B' ? [[1, 1], [1, -1], [-1, 1], [-1, -1]]
                : piece.t === 'Q' ? [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] : [];
        slides.forEach(function (d) {
            let rr = r + d[0], cc = c + d[1];
            while (inside(rr, cc)) {
                out.push(idx(rr, cc));
                if (state.board[idx(rr, cc)]) break;
                rr += d[0]; cc += d[1];
            }
        });
        return out;
    }

    function attacked(state, square, byColor) {
        for (let i = 0; i < 64; i++) {
            const piece = state.board[i];
            if (!piece || piece.c !== byColor) continue;
            if (attackSquares(state, i).indexOf(square) !== -1) return true;
        }
        return false;
    }

    function kingSquare(state, color) {
        for (let i = 0; i < 64; i++) {
            const piece = state.board[i];
            if (piece && piece.t === 'K' && piece.c === color) return i;
        }
        return -1;
    }

    function inCheck(state, color) {
        const king = kingSquare(state, color);
        if (king < 0) return true;
        return attacked(state, king, other(color));
    }

    function addPawnMoves(state, from, out) {
        const piece = state.board[from];
        const r = rowOf(from), c = colOf(from), dir = pawnDir(piece.c);
        const one = r + dir;
        if (inside(one, c) && !state.board[idx(one, c)]) {
            out.push(idx(one, c));
            const two = r + dir * 2;
            if (r === startRow(piece.c) && !state.board[idx(two, c)]) out.push(idx(two, c));
        }
        [c - 1, c + 1].forEach(function (cc) {
            if (!inside(one, cc)) return;
            const target = state.board[idx(one, cc)];
            if (target && target.c !== piece.c) out.push(idx(one, cc));
            else if (!target && state.ep === idx(one, cc)) out.push(idx(one, cc));
        });
    }

    function addCastlingMoves(state, from, out) {
        const piece = state.board[from];
        if (piece.t !== 'K') return;
        const home = piece.c === 'w' ? 7 : 0;
        if (from !== idx(home, 4)) return;
        if (inCheck(state, piece.c)) return;
        const enemy = other(piece.c);
        const rights = state.castling;
        const kingSide = piece.c === 'w' ? rights.wK : rights.bK;
        const queenSide = piece.c === 'w' ? rights.wQ : rights.bQ;
        const rookH = state.board[idx(home, 7)];
        const rookA = state.board[idx(home, 0)];

        if (kingSide && rookH && rookH.t === 'R' && rookH.c === piece.c
            && !state.board[idx(home, 5)] && !state.board[idx(home, 6)]
            && !attacked(state, idx(home, 5), enemy) && !attacked(state, idx(home, 6), enemy)) {
            out.push(idx(home, 6));
        }
        if (queenSide && rookA && rookA.t === 'R' && rookA.c === piece.c
            && !state.board[idx(home, 1)] && !state.board[idx(home, 2)] && !state.board[idx(home, 3)]
            && !attacked(state, idx(home, 2), enemy) && !attacked(state, idx(home, 3), enemy)) {
            out.push(idx(home, 2));
        }
    }

    /** Nước đi thô (chưa lọc tự chiếu). */
    function movesFor(state, from) {
        const piece = state.board[from];
        if (!piece) return [];
        const r = rowOf(from), c = colOf(from), out = [];
        const add = (rr, cc) => {
            if (!inside(rr, cc)) return false;
            const target = state.board[idx(rr, cc)];
            if (target && target.c === piece.c) return false;
            out.push(idx(rr, cc));
            return !target;
        };

        if (piece.t === 'P') { addPawnMoves(state, from, out); return out; }
        if (piece.t === 'K') {
            [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(function (m) {
                add(r + m[0], c + m[1]);
            });
            addCastlingMoves(state, from, out);
            return out;
        }
        if (piece.t === 'N') {
            [[2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [1, -2], [-1, 2], [-1, -2]].forEach(function (m) {
                add(r + m[0], c + m[1]);
            });
            return out;
        }
        const slides = piece.t === 'R' ? [[1, 0], [-1, 0], [0, 1], [0, -1]]
            : piece.t === 'B' ? [[1, 1], [1, -1], [-1, 1], [-1, -1]]
                : [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
        slides.forEach(function (d) {
            let rr = r + d[0], cc = c + d[1];
            while (inside(rr, cc)) {
                if (!add(rr, cc)) break;
                rr += d[0]; cc += d[1];
            }
        });
        return out;
    }

    function clearRookRight(state, square) {
        if (square === idx(7, 7)) state.castling.wK = false;
        if (square === idx(7, 0)) state.castling.wQ = false;
        if (square === idx(0, 7)) state.castling.bK = false;
        if (square === idx(0, 0)) state.castling.bQ = false;
    }

    /** Áp nước đi, trả về state mới (tự phong Hậu). */
    function apply(state, from, to) {
        const next = cloneState(state);
        const piece = next.board[from];
        const captured = next.board[to];
        const dir = piece.t === 'P' ? pawnDir(piece.c) : 0;

        next.board[to] = piece;
        next.board[from] = null;

        // Bắt tốt qua đường
        if (piece.t === 'P' && !captured && state.ep === to) {
            const capRow = rowOf(to) - dir;
            next.board[idx(capRow, colOf(to))] = null;
        }

        // Nhập thành: di chuyển xe
        if (piece.t === 'K' && Math.abs(colOf(to) - colOf(from)) === 2) {
            const home = rowOf(from);
            if (colOf(to) === 6) {
                next.board[idx(home, 5)] = next.board[idx(home, 7)];
                next.board[idx(home, 7)] = null;
            } else if (colOf(to) === 2) {
                next.board[idx(home, 3)] = next.board[idx(home, 0)];
                next.board[idx(home, 0)] = null;
            }
        }

        // Phong cấp
        let promotion = null;
        if (piece.t === 'P' && rowOf(to) === lastRow(piece.c)) {
            next.board[to] = { c: piece.c, t: 'Q' };
            promotion = 'Q';
        }

        // Quyền nhập thành
        if (piece.t === 'K') {
            if (piece.c === 'w') { next.castling.wK = false; next.castling.wQ = false; }
            else { next.castling.bK = false; next.castling.bQ = false; }
        }
        if (piece.t === 'R') clearRookRight(next, from);
        clearRookRight(next, to);

        // Bắt tốt qua đường
        next.ep = null;
        if (piece.t === 'P' && Math.abs(rowOf(to) - rowOf(from)) === 2) {
            next.ep = idx((rowOf(from) + rowOf(to)) / 2, colOf(from));
        }

        next.turn = other(state.turn);
        return { state: next, captured: captured || null, promotion: promotion };
    }

    function legalMoves(state, from) {
        const piece = state.board[from];
        if (!piece) return [];
        return movesFor(state, from).filter(function (to) {
            const result = apply(state, from, to);
            return !inCheck(result.state, piece.c);
        });
    }

    function hasAnyMove(state, color) {
        for (let i = 0; i < 64; i++) {
            const piece = state.board[i];
            if (piece && piece.c === color && legalMoves(state, i).length > 0) return true;
        }
        return false;
    }

    function status(state) {
        const color = state.turn;
        const check = inCheck(state, color);
        const anyMove = hasAnyMove(state, color);
        return {
            check: check,
            mate: check && !anyMove,
            stalemate: !check && !anyMove,
            winner: (!anyMove && check) ? other(color) : null
        };
    }

    return {
        initial: initial, cloneState: cloneState, movesFor: movesFor, legalMoves: legalMoves,
        apply: apply, inCheck: inCheck, attacked: attacked, status: status,
        kingSquare: kingSquare, idx: idx, rowOf: rowOf, colOf: colOf, other: other,
        hasAnyMove: hasAnyMove
    };
});

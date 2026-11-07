"""Bieng Cafe 2D - quán cà phê 2D nhiều người chơi (bản 3.0).

Không còn đơn hàng thật, trạng thái đơn hay màn hình quầy bar.
Có: không gian quán, chat realtime, bảng tin + lời nhắn dùng chung,
quản trị bằng mật khẩu (kiểm tra ở server) và mặt bằng xuất bản dùng chung.

Chạy bằng runtime đi kèm: runtime\\python.exe server\\server.py --open --page /
Chuỗi console giữ ASCII để không lỗi bảng mã cmd; chuỗi gửi trình duyệt là tiếng Việt UTF-8.
"""
from __future__ import annotations
import argparse
import asyncio
import hashlib
import hmac
import json
import math
import mimetypes
import re
import select
import socket
import threading
import time
import uuid
import webbrowser
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit
from urllib.request import urlopen
from websockets.asyncio.server import serve
from websockets.exceptions import ConnectionClosed

ROOT = Path(__file__).resolve().parents[1]
STATIC = ROOT / 'static'
mimetypes.add_type('application/manifest+json', '.webmanifest')
mimetypes.add_type('image/svg+xml', '.svg')
PRODUCT = 'bieng-cafe-2d-portable'
VERSION = '3.1'
PROJECT_ID = hashlib.sha256(str(ROOT).casefold().encode()).hexdigest()[:20]
COLORS = {'shirt': '#d97706', 'hair': '#451a03', 'skin': '#fed7aa', 'pants': '#1e293b'}
VEHICLES = ('walk', 'bike', 'motorbike', 'car')
DUEL_GAMES = ('tug', 'rps')
DUEL_TUG_SECONDS = 8
DUEL_INVITE_SECONDS = 20
DUEL_MAX_DISTANCE = 140
RPS_BEATS = {'rock': 'scissors', 'scissors': 'paper', 'paper': 'rock'}
BADGES = ('🏆', '✌️', '☕', '🧼', '🚪', '🌟')

ADMIN_PASSWORD = '20101995'
MAX_POSTS, MAX_MESSAGES = 200, 500
MAX_TITLE, MAX_BODY, MAX_LINK = 140, 2000, 500
MAX_TEXT, MAX_NAME = 300, 60
MAX_LAYOUT_BYTES = 4_000_000
LINKS = ('http', 'https')


def text(value, maximum=100):
    return ''.join(c for c in str(value or '') if c >= ' ' or c in '\n\t')[:maximum]


def clean_name(value, maximum=MAX_NAME):
    name = re.sub(r'\s+', ' ', text(value, maximum * 2)).strip()
    return name[:maximum] or 'Khách'


def number(value, low, high, default):
    try:
        result = float(value)
        return max(low, min(high, result)) if math.isfinite(result) else default
    except (TypeError, ValueError):
        return default


def safe_link(value):
    """Chỉ nhận link http/https tuyệt đối; trả '' nếu không hợp lệ."""
    raw = text(value, MAX_LINK).strip()
    if not raw:
        return ''
    parts = urlsplit(raw)
    if parts.scheme.lower() not in LINKS or not parts.netloc:
        return ''
    return raw


def now_iso():
    return datetime.now().isoformat(timespec='seconds')


class Cafe:
    def __init__(self, folder):
        self.folder = Path(folder)
        self.folder.mkdir(parents=True, exist_ok=True)
        self.community_path = self.folder / 'community.json'
        self.layout_path = self.folder / 'layout.json'
        self.lock = threading.RLock()
        self.clients = {}
        self.players = {}
        self.jukebox = {'current_track': 0}
        self.duels = {}
        self.duel_seq = 0
        self.failures = {}
        self.community = self.load_community()
        self.sequence = {'post': self.max_id('P'), 'message': self.max_id('M')}
        self.layout = self.load_layout()
        self.loop = None

    # ---------- lưu trữ ----------
    @staticmethod
    def write_json(path, payload):
        temporary = path.with_suffix('.json.tmp')
        temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf8')
        temporary.replace(path)

    def load_community(self):
        data = {'posts': [], 'messages': [], 'muted': {}}
        try:
            stored = json.loads(self.community_path.read_text(encoding='utf-8-sig'))
        except FileNotFoundError:
            return data
        except (ValueError, OSError):
            return data
        if isinstance(stored, dict):
            data['posts'] = [p for p in stored.get('posts') or [] if isinstance(p, dict)]
            data['messages'] = [m for m in stored.get('messages') or [] if isinstance(m, dict)]
            data['muted'] = {k: v for k, v in (stored.get('muted') or {}).items() if isinstance(v, dict)}
        return data

    def save_community(self):
        self.write_json(self.community_path, {'schema': 'bieng-community', 'version': 1,
                                              'posts': self.community['posts'],
                                              'messages': self.community['messages'],
                                              'muted': self.community['muted']})

    def save_community_quietly(self):
        try:
            self.save_community()
        except OSError:
            pass

    def load_layout(self):
        try:
            data = json.loads(self.layout_path.read_text(encoding='utf-8-sig'))
            return data if isinstance(data, dict) else None
        except (FileNotFoundError, ValueError, OSError):
            return None

    def max_id(self, prefix):
        pattern = re.compile('^' + prefix + r'-(\d+)$')
        values = []
        for item in self.community['posts'] + self.community['messages']:
            match = pattern.match(str(item.get('id', '')))
            if match:
                values.append(int(match.group(1)))
        return max(values or [0])

    # ---------- bảng tin ----------
    def community_payload(self):
        posts = sorted(self.community['posts'],
                       key=lambda p: (bool(p.get('pinned')), str(p.get('created_at') or '')),
                       reverse=True)
        messages = sorted(self.community['messages'],
                          key=lambda m: str(m.get('created_at') or ''), reverse=True)
        return {'posts': posts, 'messages': messages,
                'muted': [str(v.get('name') or '') for v in self.community['muted'].values()]}

    def add_post(self, title, body, link, pinned=False):
        raw_link = str(link or '').strip()
        clean = safe_link(raw_link)
        if raw_link and not clean:
            raise ValueError('Chỉ nhận link http hoặc https.')
        if not text(title, MAX_TITLE).strip() and not text(body, MAX_BODY).strip():
            raise ValueError('Bài viết cần tiêu đề hoặc nội dung.')
        with self.lock:
            if len(self.community['posts']) >= MAX_POSTS:
                raise ValueError('Bảng tin đã đầy, hãy xoá bớt bài cũ.')
            self.sequence['post'] += 1
            post = {'id': 'P-' + str(self.sequence['post']), 'title': text(title, MAX_TITLE),
                    'body': text(body, MAX_BODY), 'link': clean, 'pinned': bool(pinned),
                    'author': 'Quản trị viên', 'created_at': now_iso(), 'updated_at': now_iso()}
            self.community['posts'].append(post)
            self.save_community()
            return post

    def update_post(self, post_id, fields):
        with self.lock:
            post = next((p for p in self.community['posts'] if p.get('id') == post_id), None)
            if post is None:
                raise KeyError(post_id)
            if 'title' in fields:
                post['title'] = text(fields['title'], MAX_TITLE)
            if 'body' in fields:
                post['body'] = text(fields['body'], MAX_BODY)
            if 'link' in fields:
                wanted = str(fields['link'] or '').strip()
                post['link'] = safe_link(wanted)
                if wanted and not post['link']:
                    raise ValueError('Chỉ nhận link http hoặc https.')
            if 'pinned' in fields:
                post['pinned'] = bool(fields['pinned'])
            post['updated_at'] = now_iso()
            self.save_community()
            return post

    def delete_post(self, post_id):
        with self.lock:
            before = len(self.community['posts'])
            self.community['posts'] = [p for p in self.community['posts'] if p.get('id') != post_id]
            if len(self.community['posts']) == before:
                raise KeyError(post_id)
            self.save_community()

    def add_message(self, name, body):
        with self.lock:
            if len(self.community['messages']) >= MAX_MESSAGES:
                self.community['messages'] = self.community['messages'][-(MAX_MESSAGES - 1):]
            self.sequence['message'] += 1
            message = {'id': 'M-' + str(self.sequence['message']), 'name': clean_name(name),
                       'text': text(body, MAX_TEXT).strip(), 'created_at': now_iso()}
            if not message['text']:
                raise ValueError('Lời nhắn trống.')
            self.community['messages'].append(message)
            self.save_community()
            return message

    def delete_message(self, message_id):
        with self.lock:
            before = len(self.community['messages'])
            self.community['messages'] = [m for m in self.community['messages'] if m.get('id') != message_id]
            if len(self.community['messages']) == before:
                raise KeyError(message_id)
            self.save_community()

    # ---------- mute chat ----------
    def is_muted(self, name):
        return clean_name(name).casefold() in self.community['muted']

    def set_mute(self, name, muted):
        key = clean_name(name).casefold()
        with self.lock:
            if muted:
                self.community['muted'][key] = {'name': clean_name(name), 'at': now_iso()}
            else:
                self.community['muted'].pop(key, None)
            self.save_community()
        return self.community_payload()

    # ---------- mặt bằng ----------
    def publish_layout(self, layout):
        if not isinstance(layout, dict) or layout.get('schema') != 'bieng-layout' or layout.get('version') != 1:
            raise ValueError('Tệp mặt bằng không đúng định dạng bieng-layout phiên bản 1.')
        instances = layout.get('instances')
        if not isinstance(instances, list) or not 0 < len(instances) <= 2000:
            raise ValueError('Danh sách vật thể không hợp lệ.')
        if not isinstance(layout.get('definitions'), dict) or not layout['definitions']:
            raise ValueError('Thiếu bảng definition của mặt bằng.')
        with self.lock:
            self.write_json(self.layout_path, layout)
            self.layout = layout
        return layout

    # ---------- gửi tin ----------
    async def _safe_send(self, ws, payload):
        try:
            await asyncio.wait_for(ws.send(payload), 2)
        except (ConnectionClosed, TimeoutError, RuntimeError):
            pass

    async def broadcast(self, payload, exclude=None):
        message = json.dumps(payload, ensure_ascii=False)
        peers = [ws for pid, ws in list(self.clients.items()) if pid != exclude]

        async def deliver(ws):
            try:
                await asyncio.wait_for(ws.send(message), 2)
            except (ConnectionClosed, TimeoutError):
                pass
        if peers:
            await asyncio.gather(*(deliver(ws) for ws in peers))

    def schedule(self, coroutine):
        """Đặt lịch gửi broadcast từ luồng HTTP (an toàn luồng)."""
        if not self.loop:
            return
        try:
            asyncio.run_coroutine_threadsafe(coroutine, self.loop)
        except RuntimeError:
            pass

    def announce_community(self, kind):
        payload = {'type': 'community', 'kind': kind}
        payload.update(self.community_payload())
        self.schedule(self.broadcast(payload))

    # ---------- đấu tay đôi (kéo co / oẳn tù tì) ----------
    def spawn(self, coroutine):
        try:
            asyncio.get_running_loop().create_task(coroutine)
        except RuntimeError:
            self.schedule(coroutine)

    async def send_error(self, ws, message):
        await self._safe_send(ws, json.dumps({'type': 'error', 'message': message}, ensure_ascii=False))

    async def send_to(self, pid, payload):
        connection = self.clients.get(pid)
        if connection:
            await self._safe_send(connection, json.dumps(payload, ensure_ascii=False))

    def duel_of(self, pid):
        for duel in list(self.duels.values()):
            if duel['state'] in ('pending', 'playing') and pid in (duel['a'], duel['b']):
                return duel
        return None

    async def duel_invite(self, ws, pid, data):
        target = text(data.get('to'), 64)
        game = data.get('game') if data.get('game') in DUEL_GAMES else 'tug'
        me, other = self.players.get(pid), self.players.get(target)
        if not me or not other or target == pid:
            return await self.send_error(ws, 'Không tìm thấy người chơi đó.')
        if self.duel_of(pid) or self.duel_of(target):
            return await self.send_error(ws, 'Một trong hai đang trong trận khác rồi.')
        if math.hypot(me['x'] - other['x'], me['y'] - other['y']) > DUEL_MAX_DISTANCE:
            return await self.send_error(ws, 'Đứng gần nhau hơn rồi thách đấu nhé.')
        self.duel_seq += 1
        duel = {'id': 'D-' + str(self.duel_seq), 'game': game, 'a': pid, 'b': target,
                'names': {pid: me['name'], target: other['name']},
                'state': 'pending', 'a_taps': 0, 'b_taps': 0,
                'a_choice': None, 'b_choice': None,
                'score': {pid: 0, target: 0}, 'round': 1}
        self.duels[duel['id']] = duel
        await self.send_to(target, {'type': 'duel_invite', 'id': duel['id'], 'game': game,
                                    'from': pid, 'from_name': me['name']})
        await self.send_to(pid, {'type': 'duel_sent', 'id': duel['id'], 'game': game,
                                 'to_name': other['name']})
        self.spawn(self._expire_duel(duel['id']))

    async def _expire_duel(self, duel_id):
        await asyncio.sleep(DUEL_INVITE_SECONDS)
        duel = self.duels.get(duel_id)
        if not duel or duel['state'] != 'pending':
            return
        await self._finish_duel(duel, None, 'timeout')

    async def duel_answer(self, ws, pid, data):
        duel = self.duels.get(text(data.get('id'), 20))
        if not duel or duel['b'] != pid or duel['state'] != 'pending':
            return
        if not data.get('accept'):
            return await self._finish_duel(duel, None, 'declined')
        duel['state'] = 'playing'
        if duel['game'] == 'tug':
            self.spawn(self._finish_tug(duel['id']))
        payload = {'type': 'duel_start', 'id': duel['id'], 'game': duel['game'],
                   'a': duel['a'], 'b': duel['b'], 'names': duel['names'],
                   'seconds': DUEL_TUG_SECONDS}
        await self.send_to(duel['a'], payload)
        await self.send_to(duel['b'], payload)

    async def duel_tap(self, ws, pid, data):
        duel = self.duels.get(text(data.get('id'), 20))
        if not duel or duel['state'] != 'playing' or duel['game'] != 'tug':
            return
        if pid == duel['a']:
            duel['a_taps'] += 1
        elif pid == duel['b']:
            duel['b_taps'] += 1
        else:
            return
        payload = {'type': 'duel_progress', 'id': duel['id'],
                   'a_taps': duel['a_taps'], 'b_taps': duel['b_taps']}
        await self.send_to(duel['a'], payload)
        await self.send_to(duel['b'], payload)

    async def duel_rps(self, ws, pid, data):
        duel = self.duels.get(text(data.get('id'), 20))
        choice = data.get('choice')
        if not duel or duel['state'] != 'playing' or duel['game'] != 'rps' or choice not in RPS_BEATS:
            return
        if pid == duel['a']:
            duel['a_choice'] = choice
        elif pid == duel['b']:
            duel['b_choice'] = choice
        else:
            return
        if not (duel['a_choice'] and duel['b_choice']):
            return
        a_choice, b_choice = duel['a_choice'], duel['b_choice']
        winner = None
        if RPS_BEATS[a_choice] == b_choice:
            winner = duel['a']
        elif RPS_BEATS[b_choice] == a_choice:
            winner = duel['b']
        if winner:
            duel['score'][winner] += 1
        duel['a_choice'] = duel['b_choice'] = None
        payload = {'type': 'duel_round', 'id': duel['id'], 'round': duel['round'],
                   'a_choice': a_choice, 'b_choice': b_choice, 'winner': winner,
                   'score': duel['score']}
        duel['round'] += 1
        await self.send_to(duel['a'], payload)
        await self.send_to(duel['b'], payload)
        if max(duel['score'].values()) >= 2:
            await self._finish_duel(duel, winner if duel['score'][winner] >= 2 else
                                    (duel['a'] if duel['score'][duel['a']] > duel['score'][duel['b']] else duel['b']),
                                    'score')

    async def _finish_tug(self, duel_id):
        await asyncio.sleep(DUEL_TUG_SECONDS)
        duel = self.duels.get(duel_id)
        if not duel or duel['state'] != 'playing':
            return
        if duel['a_taps'] == duel['b_taps']:
            winner = None
        else:
            winner = duel['a'] if duel['a_taps'] > duel['b_taps'] else duel['b']
        await self._finish_duel(duel, winner, 'time')

    async def _finish_duel(self, duel, winner, reason=''):
        duel['state'] = 'done'
        payload = {'type': 'duel_end', 'id': duel['id'], 'game': duel['game'],
                   'winner': winner, 'names': duel['names'], 'reason': reason,
                   'a_taps': duel['a_taps'], 'b_taps': duel['b_taps'], 'score': duel['score']}
        for participant in (duel['a'], duel['b']):
            await self.send_to(participant, payload)
        self.duels.pop(duel['id'], None)

    async def cancel_duel(self, pid):
        duel = self.duel_of(pid)
        if duel:
            await self._finish_duel(duel, None, 'left')

    # ---------- websocket ----------
    async def connect(self, ws):
        requested = unquote(urlsplit(ws.request.path).path).removeprefix('/ws/')
        if not ws.request.path.startswith('/ws/') or not re.fullmatch(r'[A-Za-z0-9_-]{1,64}', requested):
            await ws.close(1008, 'Invalid player ID')
            return
        if len(self.clients) >= 64:
            await ws.close(1013, 'Cafe is full')
            return
        pid = requested
        if pid in self.clients:
            await ws.close(1008, 'Player ID already connected')
            return
        self.clients[pid] = ws
        try:
            await ws.send(json.dumps({'type': 'welcome', 'your_id': pid, 'players': self.players,
                                      'jukebox': self.jukebox, 'version': VERSION,
                                      'community': self.community_payload()}, ensure_ascii=False))
            async for raw in ws:
                try:
                    data = json.loads(raw)
                    if not isinstance(data, dict):
                        continue
                    event = data.get('type')
                    if event == 'join':
                        if pid in self.players:
                            continue
                        outfit = data.get('outfit') if isinstance(data.get('outfit'), dict) else {}
                        outfit = {k: (outfit[k] if re.fullmatch(r'#[0-9A-Fa-f]{6}', str(outfit.get(k, ''))) else v)
                                  for k, v in COLORS.items()}
                        player = {'id': pid, 'name': clean_name(data.get('name') or 'Khach'), 'outfit': outfit,
                                  'x': number(data.get('x'), 0, 960, 180), 'y': number(data.get('y'), 0, 540, 140),
                                  'direction': 'down', 'is_moving': False, 'seated': False,
                                  'vehicle': data.get('vehicle') if data.get('vehicle') in VEHICLES else 'walk',
                                  'parked': (data.get('vehicle') if data.get('vehicle') in VEHICLES else 'walk') == 'walk',
                                  'park_x': None, 'park_y': None,
                                  'badges': [b for b in (data.get('badges') or []) if b in BADGES][:4],
                                  'muted': self.is_muted(data.get('name') or '')}
                        self.players[pid] = player
                        await self.broadcast({'type': 'player_join', 'player': player}, exclude=pid)
                    elif event == 'move' and pid in self.players:
                        player = self.players[pid]
                        player.update(x=number(data.get('x'), 0, 960, player['x']),
                                      y=number(data.get('y'), 0, 540, player['y']),
                                      direction=data.get('direction') if data.get('direction') in
                                      ['up', 'down', 'left', 'right'] else 'down',
                                      is_moving=bool(data.get('is_moving')))
                        await self.broadcast({'type': 'player_move', **player}, exclude=pid)
                    elif event == 'seat' and pid in self.players:
                        player = self.players[pid]
                        player.update(x=number(data.get('x'), 0, 960, player['x']),
                                      y=number(data.get('y'), 0, 540, player['y']),
                                      seated=bool(data.get('seated')), chair_id=text(data.get('chair_id'), 160),
                                      is_moving=False)
                        await self.broadcast({'type': 'player_seat', **player}, exclude=pid)
                    elif event == 'park' and pid in self.players:
                        player = self.players[pid]
                        if player.get('vehicle') == 'walk' or player.get('parked'):
                            continue
                        # Không giới hạn số chỗ: client gửi vị trí đỗ đã căn giữa dải
                        park_x = number(data.get('x'), 0, 960, player['x'])
                        park_y = number(data.get('y'), 0, 540, player['y'])
                        player.update(parked=True, park_x=park_x, park_y=park_y, is_moving=False)
                        await self._safe_send(ws, json.dumps({'type': 'park_ok',
                                                              'x': park_x, 'y': park_y},
                                                             ensure_ascii=False))
                        await self.broadcast({'type': 'player_park', 'id': pid, 'vehicle': player['vehicle'],
                                              'parked': True, 'x': park_x, 'y': park_y}, exclude=pid)
                    elif event == 'badges' and pid in self.players:
                        badges = [b for b in (data.get('badges') or []) if b in BADGES][:4]
                        self.players[pid]['badges'] = badges
                        await self.broadcast({'type': 'player_badges', 'id': pid, 'badges': badges}, exclude=pid)
                    elif event == 'duel_invite':
                        await self.duel_invite(ws, pid, data)
                    elif event == 'duel_answer':
                        await self.duel_answer(ws, pid, data)
                    elif event == 'duel_tap':
                        await self.duel_tap(ws, pid, data)
                    elif event == 'duel_rps':
                        await self.duel_rps(ws, pid, data)
                    elif event == 'chat' and pid in self.players:
                        message = text(data.get('text'), 500).strip()
                        if not message:
                            continue
                        name = self.players[pid]['name']
                        if self.is_muted(name):
                            await self._safe_send(ws, json.dumps(
                                {'type': 'error', 'message': 'Bạn đang bị tạm khoá chat bởi quản trị viên.'},
                                ensure_ascii=False))
                            continue
                        await self.broadcast({'type': 'chat', 'id': pid, 'name': name, 'text': message})
                    elif event == 'drink_done' and pid in self.players:
                        player = self.players[pid]
                        await self.broadcast({'type': 'drink_done', 'id': pid, 'name': player['name'],
                                              'item': text(data.get('item'), 60)})
                    elif event == 'jukebox_change' and pid in self.players:
                        track = int(number(data.get('track'), 0, 2, 0))
                        self.jukebox['current_track'] = track
                        await self.broadcast({'type': 'jukebox_sync', 'track': track,
                                              'by': self.players[pid]['name']})
                except (ValueError, TypeError, KeyError):
                    await self._safe_send(ws, json.dumps({'type': 'error', 'message': 'Dữ liệu không hợp lệ.'},
                                                         ensure_ascii=False))
        except ConnectionClosed:
            pass
        finally:
            self.clients.pop(pid, None)
            await self.cancel_duel(pid)
            player = self.players.pop(pid, None)
            if player:
                await self.broadcast({'type': 'player_leave', 'id': pid, 'name': player['name']})


class HTTP(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True


class Handler(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'
    rbufsize = 0
    server_version = 'BiengCafe2D/3.0'

    def log_message(self, format, *args):
        if args and str(args[1] if len(args) > 1 else '').startswith(('4', '5')):
            print('[HTTP]', format % args, flush=True)

    def respond(self, status, body=b'', mime='application/json; charset=utf-8'):
        if not isinstance(body, bytes):
            body = json.dumps(body, ensure_ascii=False).encode('utf8')
        self.send_response(status)
        self.send_header('Content-Type', mime)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(body)

    def do_HEAD(self):
        self.do_GET()

    # ---------- quyền quản trị ----------
    def admin_allowed(self):
        cafe = self.server.cafe
        ip = self.client_address[0]
        with cafe.lock:
            record = cafe.failures.get(ip)
            if record and record[0] >= 8 and time.time() - record[1] < 300:
                return 'throttled'
        supplied = self.headers.get('X-Admin-Password') or ''
        if hmac.compare_digest(str(supplied), ADMIN_PASSWORD):
            with cafe.lock:
                cafe.failures.pop(ip, None)
            return True
        with cafe.lock:
            record = cafe.failures.get(ip) or [0, time.time()]
            record[0] += 1
            cafe.failures[ip] = record
        return False

    def drain_body(self):
        """Đọc bỏ phần body còn lại để giữ kết nối HTTP/1.1 đồng bộ khi từ chối sớm."""
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if 0 < length <= MAX_LAYOUT_BYTES:
                while length > 0:
                    chunk = self.rfile.read(min(65536, length))
                    if not chunk:
                        break
                    length -= len(chunk)
        except (ValueError, OSError):
            self.close_connection = True

    def require_admin(self):
        allowed = self.admin_allowed()
        if allowed is True:
            return True
        self.drain_body()
        if allowed == 'throttled':
            self.respond(429, {'ok': False, 'error': 'Sai mật khẩu quá nhiều lần. Thử lại sau vài phút.'})
        else:
            self.respond(401, {'ok': False, 'error': 'Sai mật khẩu quản trị.'})
        return False

    def read_json(self, limit=65536):
        length = int(self.headers.get('Content-Length', '0'))
        if not 0 < length <= limit:
            raise ValueError('Kích thước dữ liệu không hợp lệ.')
        body = json.loads(self.rfile.read(length))
        if not isinstance(body, dict):
            raise ValueError('Dữ liệu phải là JSON object.')
        return body

    # ---------- GET ----------
    def do_GET(self):
        route = unquote(urlsplit(self.path).path)
        if self.headers.get('Upgrade', '').lower() == 'websocket':
            if not route.startswith('/ws/'):
                return self.respond(404, {'error': 'Not found'})
            origin = self.headers.get('Origin')
            if origin and urlsplit(origin).netloc != self.headers.get('Host'):
                return self.respond(403, {'error': 'Origin mismatch'})
            return self.websocket_proxy()
        cafe = self.server.cafe
        if route == '/api/health':
            return self.respond(200, {'app': PRODUCT, 'version': VERSION, 'project_id': PROJECT_ID,
                                      'port': self.server.server_port, 'players': len(cafe.players)})
        if route == '/api/admin/check':
            allowed = self.admin_allowed()
            if allowed is True:
                return self.respond(200, {'ok': True})
            if allowed == 'throttled':
                return self.respond(429, {'ok': False, 'error': 'Sai mật khẩu quá nhiều lần. Thử lại sau vài phút.'})
            return self.respond(401, {'ok': False, 'error': 'Sai mật khẩu quản trị.'})
        if route == '/api/community':
            with cafe.lock:
                return self.respond(200, cafe.community_payload())
        if route == '/api/layout':
            if cafe.layout is None:
                return self.respond(204, b'')
            return self.respond(200, cafe.layout)
        if route == '/':
            target = STATIC / 'index.html'
        elif route.startswith('/static/'):
            target = (STATIC / route[len('/static/'):]).resolve()
            if not target.is_relative_to(STATIC.resolve()):
                return self.respond(403, {'error': 'Forbidden'})
        else:
            return self.respond(404, {'error': 'Not found.'})
        if not target.is_file():
            return self.respond(404, {'error': 'File not found'})
        mime = mimetypes.guess_type(str(target))[0] or 'application/octet-stream'
        if target.suffix in ['.js', '.html', '.css', '.json', '.txt']:
            mime += '; charset=utf-8'
        try:
            self.respond(200, target.read_bytes(), mime)
        except (BrokenPipeError, ConnectionResetError):
            pass

    # ---------- POST ----------
    def do_POST(self):
        route = unquote(urlsplit(self.path).path)
        cafe = self.server.cafe
        try:
            if route == '/api/community/posts':
                if not self.require_admin():
                    return
                body = self.read_json()
                post = cafe.add_post(body.get('title'), body.get('body'), body.get('link'), body.get('pinned'))
                cafe.announce_community('posts')
                return self.respond(200, {'ok': True, 'post': post})
            if route == '/api/community/messages':
                body = self.read_json()
                message = cafe.add_message(body.get('name'), body.get('text'))
                cafe.announce_community('messages')
                return self.respond(200, {'ok': True, 'message': message})
            if route == '/api/community/mute':
                if not self.require_admin():
                    return
                body = self.read_json()
                payload = cafe.set_mute(body.get('name'), bool(body.get('muted')))
                cafe.schedule(cafe.broadcast({'type': 'community', 'kind': 'muted', **payload}))
                return self.respond(200, {'ok': True, 'muted': payload['muted']})
            if route == '/api/layout':
                if not self.require_admin():
                    return
                body = self.read_json(MAX_LAYOUT_BYTES)
                layout = body.get('layout') if isinstance(body.get('layout'), dict) else body
                cafe.publish_layout(layout)
                cafe.schedule(cafe.broadcast({'type': 'layout_published'}))
                return self.respond(200, {'ok': True})
            self.drain_body()
            return self.respond(404, {'ok': False, 'error': 'Not found'})
        except ValueError as exc:
            return self.respond(400, {'ok': False, 'error': str(exc)})
        except KeyError:
            return self.respond(404, {'ok': False, 'error': 'Không tìm thấy mục này'})
        except OSError:
            return self.respond(500, {'ok': False, 'error': 'Không ghi được tệp dữ liệu'})
        except Exception:
            return self.respond(500, {'ok': False, 'error': 'Lỗi máy chủ'})

    # ---------- PATCH ----------
    def do_PATCH(self):
        route = unquote(urlsplit(self.path).path)
        cafe = self.server.cafe
        match = re.fullmatch(r'/api/community/posts/(P-\d+)', route)
        if not match:
            return self.respond(404, {'ok': False, 'error': 'Not found'})
        if not self.require_admin():
            return
        try:
            body = self.read_json()
            fields = {key: body[key] for key in ('title', 'body', 'link', 'pinned') if key in body}
            post = cafe.update_post(match.group(1), fields)
        except ValueError as exc:
            return self.respond(400, {'ok': False, 'error': str(exc)})
        except KeyError:
            return self.respond(404, {'ok': False, 'error': 'Không tìm thấy bài viết'})
        except OSError:
            return self.respond(500, {'ok': False, 'error': 'Không ghi được tệp dữ liệu'})
        cafe.announce_community('posts')
        self.respond(200, {'ok': True, 'post': post})

    # ---------- DELETE ----------
    def do_DELETE(self):
        route = unquote(urlsplit(self.path).path)
        cafe = self.server.cafe
        post_match = re.fullmatch(r'/api/community/posts/(P-\d+)', route)
        message_match = re.fullmatch(r'/api/community/messages/(M-\d+)', route)
        if not post_match and not message_match:
            return self.respond(404, {'ok': False, 'error': 'Not found'})
        if not self.require_admin():
            return
        try:
            if post_match:
                cafe.delete_post(post_match.group(1))
                kind = 'posts'
            else:
                cafe.delete_message(message_match.group(1))
                kind = 'messages'
        except KeyError:
            return self.respond(404, {'ok': False, 'error': 'Không tìm thấy mục này'})
        except OSError:
            return self.respond(500, {'ok': False, 'error': 'Không ghi được tệp dữ liệu'})
        cafe.announce_community(kind)
        self.respond(200, {'ok': True})

    # ---------- websocket proxy ----------
    def websocket_proxy(self):
        self.close_connection = True
        self.connection.settimeout(None)
        try:
            with socket.create_connection(('127.0.0.1', self.server.ws_port), timeout=5) as backend:
                backend.settimeout(None)
                request = self.requestline + '\r\n' + ''.join(f'{key}: {value}\r\n'
                                                              for key, value in self.headers.items()) + '\r\n'
                backend.sendall(request.encode('latin1'))
                while True:
                    readable, _, _ = select.select([self.connection, backend], [], [], 60)
                    for source in readable:
                        chunk = source.recv(65536)
                        if not chunk:
                            return
                        (backend if source is self.connection else self.connection).sendall(chunk)
        except (OSError, ConnectionError):
            return


async def run(args):
    cafe = Cafe(args.data_dir or ROOT / 'data')
    cafe.loop = asyncio.get_running_loop()
    async with serve(cafe.connect, '127.0.0.1', 0, max_size=65536, ping_interval=20, ping_timeout=20) as ws:
        ws_port = ws.sockets[0].getsockname()[1]
        http = None
        for port in range(args.port, args.port + 40):
            try:
                http = HTTP((args.host, port), Handler)
                break
            except OSError:
                continue
        if http is None:
            raise RuntimeError('Khong tim thay cong trong. Dong ban game cu hoac chon --port khac.')
        http.cafe = cafe
        http.ws_port = ws_port
        worker = threading.Thread(target=http.serve_forever, daemon=True)
        worker.start()
        url = 'http://localhost:' + str(http.server_port)
        print('BIENG CAFE 2D ' + VERSION + '\nGame: ' + url + '/'
              + '\nBang tin, loi nhan, quan tri mat khau va mat bang dung chung da bat.'
              + '\nNhan Ctrl+C trong cua so nay de dung game.', flush=True)
        if args.open:
            webbrowser.open(url + args.page)
        try:
            await asyncio.Event().wait()
        finally:
            http.shutdown()
            http.server_close()
            worker.join(timeout=2)


def main():
    parser = argparse.ArgumentParser(description='Bieng Cafe 2D')
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=8000)
    parser.add_argument('--open', action='store_true')
    parser.add_argument('--page', choices=['/'], default='/')
    parser.add_argument('--data-dir', type=Path)
    args = parser.parse_args()
    if not 1024 <= args.port <= 65495:
        parser.error('Port must be 1024..65495')
    if args.open:
        for port in range(args.port, args.port + 40):
            try:
                with urlopen('http://127.0.0.1:' + str(port) + '/api/health', timeout=.1) as response:
                    health = json.load(response)
                if health.get('app') == PRODUCT and health.get('project_id') == PROJECT_ID:
                    webbrowser.open('http://localhost:' + str(port) + args.page)
                    return
            except Exception:
                pass
    try:
        asyncio.run(run(args))
    except KeyboardInterrupt:
        print('\nDa dung Bieng Cafe.', flush=True)


if __name__ == '__main__':
    main()

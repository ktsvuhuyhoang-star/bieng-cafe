/**
 * Cozy Pixel Cafe - Procedural Pixel Art Generator
 * Configured to match the exact floor plan of "MẶT BẰNG QUÁN CÀ PHÊ"
 */

const PixelArt = {
    drawRect(ctx, x, y, w, h, color) {
        ctx.fillStyle = color;
        ctx.fillRect(Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h));
    },

    generateAll(scene) {
        this.genFloor(scene);
        this.genSidewalk(scene);
        this.genWall(scene);
        this.genGlassWall(scene);
        this.genSofa(scene);
        this.genCheckeredRug(scene);
        this.genWallArt(scene);
        this.genCommunalTable(scene);
        this.genCounterParts(scene);
        this.genCoffeeMachine(scene);
        this.genTable(scene);
        this.genChairs(scene);
        this.genPlant(scene);
        this.genRug(scene);
        this.genHoangBeu(scene);
        this.genItems(scene);
        this.genVehicles(scene);
        this.genDoors(scene);
    },

    // 1. Indoor Warm Parquet Wood Floor
    genFloor(scene) {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');

        this.drawRect(ctx, 0, 0, 32, 32, '#b47346'); // warm golden oak floor from layout

        const planks = [
            { y: 0, h: 8, col1: '#bd7d50', col2: '#a4653a' },
            { y: 8, h: 8, col1: '#c9895c', col2: '#b47346' },
            { y: 16, h: 8, col1: '#bd7d50', col2: '#a4653a' },
            { y: 24, h: 8, col1: '#c9895c', col2: '#b47346' }
        ];

        planks.forEach(p => {
            this.drawRect(ctx, 0, p.y, 32, p.h, p.col1);
            this.drawRect(ctx, 0, p.y + p.h - 1, 32, 1, '#8c5028');
            this.drawRect(ctx, (p.y * 3) % 24, p.y + 2, 8, 1, p.col2);
        });

        this.drawRect(ctx, 16, 0, 1, 8, '#8c5028');
        this.drawRect(ctx, 8, 8, 1, 8, '#8c5028');
        this.drawRect(ctx, 24, 16, 1, 8, '#8c5028');
        this.drawRect(ctx, 12, 24, 1, 8, '#8c5028');

        scene.textures.addCanvas('floor', canvas);
    },

    // 2. Outdoor Sidewalk Pavement (Concrete / Sandstone)
    genSidewalk(scene) {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');

        this.drawRect(ctx, 0, 0, 32, 32, '#94a3b8');
        this.drawRect(ctx, 0, 0, 31, 31, '#cbd5e1');
        this.drawRect(ctx, 0, 0, 31, 1, '#f1f5f9');
        this.drawRect(ctx, 0, 0, 1, 31, '#f1f5f9');
        this.drawRect(ctx, 31, 0, 1, 32, '#64748b');
        this.drawRect(ctx, 0, 31, 32, 1, '#64748b');

        // speckles
        this.drawRect(ctx, 6, 8, 2, 2, '#94a3b8');
        this.drawRect(ctx, 20, 18, 2, 2, '#94a3b8');
        this.drawRect(ctx, 14, 24, 2, 2, '#64748b');

        scene.textures.addCanvas('sidewalk', canvas);
    },

    // 3. Concrete Architectural Walls (Grey plaster & dark top trim)
    genWall(scene) {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');

        this.drawRect(ctx, 0, 0, 32, 32, '#475569'); // architectural grey wall
        this.drawRect(ctx, 0, 0, 32, 4, '#334155');  // top edge
        this.drawRect(ctx, 0, 28, 32, 4, '#1e293b'); // baseboard
        this.drawRect(ctx, 4, 8, 24, 16, '#64748b'); // plaster panel
        this.drawRect(ctx, 4, 8, 24, 1, '#94a3b8');

        scene.textures.addCanvas('wall', canvas);
    },

    // 4. Glass Partition Wall with black frames
    genGlassWall(scene) {
        const canvas = document.createElement('canvas');
        canvas.width = 16;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');

        this.drawRect(ctx, 0, 0, 16, 32, '#1e293b'); // metal frame
        this.drawRect(ctx, 2, 1, 12, 30, '#38bdf8'); // light glass tint
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.fillRect(4, 2, 4, 28); // glass reflection streak

        scene.textures.addCanvas('glass_wall', canvas);
    },

    // 5. Green Leather Sofa (Top lounge)
    genSofa(scene) {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 36;
        const ctx = canvas.getContext('2d');

        // Dark green leather backrest
        this.drawRect(ctx, 2, 2, 60, 12, '#14532d');
        this.drawRect(ctx, 4, 4, 56, 8, '#166534');
        // Seat cushion
        this.drawRect(ctx, 2, 14, 60, 18, '#15803d');
        this.drawRect(ctx, 4, 16, 56, 14, '#16a34a');
        // Armrests
        this.drawRect(ctx, 0, 8, 6, 24, '#14532d');
        this.drawRect(ctx, 58, 8, 6, 24, '#14532d');
        // Tufting buttons
        for (let x = 12; x < 54; x += 14) {
            this.drawRect(ctx, x, 7, 2, 2, '#052e16');
            this.drawRect(ctx, x, 21, 2, 2, '#052e16');
        }

        scene.textures.addCanvas('sofa_green', canvas);
    },

    // 6. Checkered Rug (Green, Orange & Cream checkered pattern)
    genCheckeredRug(scene) {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 48;
        const ctx = canvas.getContext('2d');

        const tileSize = 8;
        const cols = 8;
        const rows = 6;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const isCenter = (r >= 2 && r <= 3 && c >= 3 && c <= 4);
                let col = ((r + c) % 2 === 0) ? '#166534' : '#fef08a';
                if (isCenter) col = '#ea580c'; // orange center
                this.drawRect(ctx, c * tileSize, r * tileSize, tileSize, tileSize, col);
            }
        }
        // Border
        this.drawRect(ctx, 0, 0, 64, 2, '#14532d');
        this.drawRect(ctx, 0, 46, 64, 2, '#14532d');
        this.drawRect(ctx, 0, 0, 2, 48, '#14532d');
        this.drawRect(ctx, 62, 0, 2, 48, '#14532d');

        scene.textures.addCanvas('rug_checkered', canvas);
    },

    // 7. Wall Art Posters (Orange & Red modern art)
    genWallArt(scene) {
        const canvas = document.createElement('canvas');
        canvas.width = 36;
        canvas.height = 18;
        const ctx = canvas.getContext('2d');

        // Black frame
        this.drawRect(ctx, 0, 0, 36, 18, '#0f172a');
        this.drawRect(ctx, 2, 2, 32, 14, '#f8fafc');
        // Art graphics (geometric modern circle & orange block)
        this.drawRect(ctx, 5, 4, 12, 10, '#ea580c');
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.arc(26, 9, 5, 0, Math.PI * 2);
        ctx.fill();

        scene.textures.addCanvas('wall_art', canvas);
    },

    // 8. Large Center Communal Table with Green Runner Strip
    genCommunalTable(scene) {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 120;
        const ctx = canvas.getContext('2d');

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(4, 8, 58, 114);

        // Rich Mahogany / Red-brown wood table top
        this.drawRect(ctx, 0, 0, 60, 116, '#7f1d1d');
        this.drawRect(ctx, 2, 2, 56, 112, '#991b1b');
        this.drawRect(ctx, 4, 4, 52, 108, '#881337');

        // Center Green Runner Strip (vạch xanh lá cây giữa bàn theo đúng ảnh)
        this.drawRect(ctx, 27, 10, 6, 96, '#10b981');
        this.drawRect(ctx, 29, 12, 2, 92, '#34d399');

        // Laptop / Table book decor
        this.drawRect(ctx, 12, 25, 10, 8, '#e2e8f0'); // notebook
        this.drawRect(ctx, 38, 70, 12, 9, '#334155'); // closed laptop

        scene.textures.addCanvas('communal_table', canvas);
    },

    // 9. Quầy Pha Chế (Modular Bar Counter Parts)
    genCounterParts(scene) {
        // Horizontal Counter (Dark Grey Granite & Warm Wood Trim)
        const cHoriz = document.createElement('canvas');
        cHoriz.width = 120;
        cHoriz.height = 36;
        const hctx = cHoriz.getContext('2d');
        this.drawRect(hctx, 0, 0, 120, 36, '#334155'); // Granite top
        this.drawRect(hctx, 0, 0, 120, 3, '#64748b');  // highlight
        this.drawRect(hctx, 0, 32, 120, 4, '#854d0e'); // warm wood front
        // speckled granite
        for (let x = 4; x < 116; x += 12) {
            this.drawRect(hctx, x, 8, 2, 2, '#94a3b8');
            this.drawRect(hctx, x + 6, 20, 2, 2, '#cbd5e1');
        }
        scene.textures.addCanvas('counter_horiz', canvasOr(cHoriz));

        // Vertical Counter
        const cVert = document.createElement('canvas');
        cVert.width = 36;
        cVert.height = 100;
        const vctx = cVert.getContext('2d');
        this.drawRect(vctx, 0, 0, 36, 100, '#334155');
        this.drawRect(vctx, 0, 0, 3, 100, '#64748b');
        this.drawRect(vctx, 32, 0, 4, 100, '#854d0e');
        scene.textures.addCanvas('counter_vert', canvasOr(cVert));

        // Angled Corner with Cash Register POS (Góc chéo quầy thu ngân)
        const cCorner = document.createElement('canvas');
        cCorner.width = 44;
        cCorner.height = 44;
        const crctx = cCorner.getContext('2d');
        this.drawRect(crctx, 0, 0, 44, 44, '#334155');
        this.drawRect(crctx, 2, 2, 40, 40, '#475569');
        // Modern Cashier POS monitor
        this.drawRect(crctx, 12, 10, 18, 14, '#0f172a');
        this.drawRect(crctx, 14, 12, 14, 10, '#38bdf8'); // glowing blue POS screen
        this.drawRect(crctx, 18, 24, 6, 4, '#0f172a');  // stand
        this.drawRect(crctx, 14, 28, 14, 4, '#1e293b'); // base
        scene.textures.addCanvas('counter_pos', canvasOr(cCorner));

        // Long Bar Bench (bàn dài áp tường)
        const bench = document.createElement('canvas');
        bench.width = 80;
        bench.height = 20;
        const bctx = bench.getContext('2d');
        this.drawRect(bctx, 0, 0, 80, 20, '#9a3412');
        this.drawRect(bctx, 2, 2, 76, 16, '#c2410c');
        this.drawRect(bctx, 2, 2, 76, 2, '#ea580c');
        scene.textures.addCanvas('wall_bench', canvasOr(bench));
    },

    // 10. Espresso Machine
    genCoffeeMachine(scene) {
        const canvas = document.createElement('canvas');
        canvas.width = 34;
        canvas.height = 34;
        const ctx = canvas.getContext('2d');

        // Shiny commercial espresso machine (silver & red)
        this.drawRect(ctx, 2, 4, 30, 26, '#cbd5e1');
        this.drawRect(ctx, 4, 6, 26, 10, '#dc2626'); // red front panel
        this.drawRect(ctx, 6, 18, 22, 10, '#94a3b8'); // spouts and tray
        // Dual group head spouts
        this.drawRect(ctx, 8, 16, 5, 6, '#334155');
        this.drawRect(ctx, 20, 16, 5, 6, '#334155');
        // Pressure dials
        this.drawRect(ctx, 8, 8, 4, 4, '#fbbf24');
        this.drawRect(ctx, 22, 8, 4, 4, '#f8fafc');
        scene.textures.addCanvas('espresso_machine', canvas);
    },

    // 11. Round Wooden Tables
    genTable(scene) {
        const canvas = document.createElement('canvas');
        canvas.width = 44;
        canvas.height = 44;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(22, 26, 20, 16, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#9a3412';
        ctx.beginPath();
        ctx.arc(22, 20, 18, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#c2410c';
        ctx.beginPath();
        ctx.arc(22, 19, 16, 0, Math.PI * 2);
        ctx.fill();

        this.drawRect(ctx, 20, 16, 4, 5, '#0284c7'); // tiny cafe vase
        this.drawRect(ctx, 20, 14, 4, 2, '#f43f5e');

        scene.textures.addCanvas('table', canvas);
    },

    // 12. Chairs (Wooden Stools, Green Chairs, Red Chairs, Bar Stools)
    genChairs(scene) {
        // Red cushioned chair
        this.genColoredChair(scene, 'chair_red', '#dc2626', '#b91c1c');
        // Green cushioned chair
        this.genColoredChair(scene, 'chair_green', '#15803d', '#166534');
        // Outdoor wooden chair
        this.genColoredChair(scene, 'chair_wood', '#d97706', '#b45309');

        // Round Bar Stool (for counter)
        const stool = document.createElement('canvas');
        stool.width = 22;
        stool.height = 22;
        const sctx = stool.getContext('2d');
        sctx.fillStyle = '#78350f';
        sctx.beginPath();
        sctx.arc(11, 11, 9, 0, Math.PI * 2);
        sctx.fill();
        sctx.fillStyle = '#b45309';
        sctx.beginPath();
        sctx.arc(11, 10, 7, 0, Math.PI * 2);
        sctx.fill();
        scene.textures.addCanvas('bar_stool', stool);
    },

    genColoredChair(scene, key, colorMain, colorDark) {
        const dirs = ['down', 'up', 'left', 'right'];
        dirs.forEach(dir => {
            const canvas = document.createElement('canvas');
            canvas.width = 24;
            canvas.height = 24;
            const ctx = canvas.getContext('2d');

            this.drawRect(ctx, 3, 3, 18, 18, '#451a03'); // wood frame
            this.drawRect(ctx, 5, 5, 14, 14, colorDark);
            this.drawRect(ctx, 6, 6, 12, 12, colorMain);

            if (dir === 'up') this.drawRect(ctx, 3, 2, 18, 4, '#1c1917');
            else if (dir === 'down') this.drawRect(ctx, 3, 18, 18, 4, '#1c1917');
            else if (dir === 'left') this.drawRect(ctx, 2, 3, 4, 18, '#1c1917');
            else if (dir === 'right') this.drawRect(ctx, 18, 3, 4, 18, '#1c1917');

            scene.textures.addCanvas(`${key}_${dir}`, canvas);
        });
    },

    // 13. Potted Plants
    genPlant(scene) {
        const canvas = document.createElement('canvas');
        canvas.width = 28;
        canvas.height = 36;
        const ctx = canvas.getContext('2d');

        this.drawRect(ctx, 6, 20, 16, 14, '#c2410c');
        this.drawRect(ctx, 4, 18, 20, 4, '#ea580c');

        const leaves = [
            { x: 12, y: 8, w: 8, h: 8, c: '#15803d' },
            { x: 4, y: 10, w: 8, h: 7, c: '#16a34a' },
            { x: 16, y: 11, w: 8, h: 7, c: '#22c55e' },
            { x: 10, y: 4, w: 8, h: 7, c: '#4ade80' }
        ];
        leaves.forEach(l => {
            this.drawRect(ctx, l.x, l.y, l.w, l.h, l.c);
            this.drawRect(ctx, l.x + 2, l.y + 2, l.w - 4, l.h - 4, '#86efac');
        });

        scene.textures.addCanvas('plant', canvas);
    },

    genRug(scene) {
        // default rug
    },

    // 14. CHỦ QUÁN HOÀNG BỆU (Chủ quán mập mạp, vui tính, đội nón barista, đeo tạp dề)
    genHoangBeu(scene) {
        const canvas = document.createElement('canvas');
        canvas.width = 36;
        canvas.height = 40;
        const ctx = canvas.getContext('2d');

        // Head & Barista Flat Cap (mũ nồi barista phong cách)
        this.drawRect(ctx, 10, 2, 16, 6, '#451a03'); // brown cap
        this.drawRect(ctx, 8, 6, 20, 3, '#78350f');  // cap brim
        // Chubby cheerful face
        this.drawRect(ctx, 9, 8, 18, 12, '#fed7aa');
        // Rosy cheeks
        this.drawRect(ctx, 10, 14, 3, 2, '#f87171');
        this.drawRect(ctx, 23, 14, 3, 2, '#f87171');
        // Smiling eyes
        this.drawRect(ctx, 12, 11, 3, 2, '#0f172a');
        this.drawRect(ctx, 21, 11, 3, 2, '#0f172a');
        // Jolly mustache & smile
        this.drawRect(ctx, 14, 15, 8, 3, '#451a03');
        this.drawRect(ctx, 16, 17, 4, 1, '#ef4444');

        // Chubby body in crisp white shirt & dark coffee apron
        this.drawRect(ctx, 6, 20, 24, 18, '#ffffff'); // white shirt
        this.drawRect(ctx, 9, 21, 18, 17, '#78350f'); // apron
        this.drawRect(ctx, 12, 21, 12, 5, '#1e293b'); // black neck tie
        // Apron pocket with coffee bean pin & gold name tag
        this.drawRect(ctx, 11, 28, 6, 6, '#542807');
        this.drawRect(ctx, 20, 24, 5, 2, '#facc15'); // Gold badge: "Hoàng Bệu"

        scene.textures.addCanvas('hoang_beu', canvas);
    },

    // 15. Food & Drinks
    genItems(scene) {
        const cup = document.createElement('canvas');
        cup.width = 16;
        cup.height = 16;
        const cctx = cup.getContext('2d');
        this.drawRect(cctx, 4, 6, 7, 7, '#f8fafc');
        this.drawRect(cctx, 11, 7, 2, 4, '#f8fafc');
        this.drawRect(cctx, 5, 7, 5, 3, '#78350f');
        this.drawRect(cctx, 5, 2, 1, 3, '#cbd5e1');
        this.drawRect(cctx, 8, 1, 1, 3, '#cbd5e1');
        scene.textures.addCanvas('item_coffee', cup);

        const tea = document.createElement('canvas');
        tea.width = 16;
        tea.height = 16;
        const tctx = tea.getContext('2d');
        this.drawRect(tctx, 4, 4, 8, 10, '#f97316');
        this.drawRect(tctx, 5, 5, 2, 2, '#ffedd5');
        this.drawRect(tctx, 8, 7, 2, 2, '#ffedd5');
        this.drawRect(tctx, 8, 1, 2, 4, '#10b981');
        scene.textures.addCanvas('item_tea', tea);

        const cake = document.createElement('canvas');
        cake.width = 16;
        cake.height = 16;
        const kctx = cake.getContext('2d');
        this.drawRect(kctx, 2, 10, 12, 4, '#e2e8f0');
        this.drawRect(kctx, 4, 6, 8, 5, '#d97706');
        this.drawRect(kctx, 6, 5, 4, 2, '#f59e0b');
        scene.textures.addCanvas('item_croissant', cake);
    },

    // 16. Phương tiện của khách — cùng khung 24×16, khác hình/màu để phân biệt
    genVehicles(scene) {
        const build = (key, paint) => {
            const canvas = document.createElement('canvas');
            canvas.width = 24;
            canvas.height = 16;
            paint(canvas.getContext('2d'));
            scene.textures.addCanvas(key, canvas);
        };

        build('vehicle_bike', (ctx) => {
            this.drawRect(ctx, 2, 5, 4, 6, '#1f2937');
            this.drawRect(ctx, 18, 5, 4, 6, '#1f2937');
            this.drawRect(ctx, 6, 7, 12, 2, '#0ea5e9');
            this.drawRect(ctx, 11, 3, 2, 10, '#0ea5e9');
            this.drawRect(ctx, 9, 2, 6, 2, '#f8fafc');
        });

        build('vehicle_motorbike', (ctx) => {
            this.drawRect(ctx, 2, 4, 5, 8, '#111827');
            this.drawRect(ctx, 17, 4, 5, 8, '#111827');
            this.drawRect(ctx, 6, 6, 12, 5, '#f97316');
            this.drawRect(ctx, 8, 4, 7, 3, '#fb923c');
            this.drawRect(ctx, 4, 2, 3, 3, '#f8fafc');
        });

        build('vehicle_car', (ctx) => {
            this.drawRect(ctx, 3, 3, 18, 11, '#1d4ed8');
            this.drawRect(ctx, 5, 4, 14, 9, '#3b82f6');
            this.drawRect(ctx, 8, 5, 8, 4, '#93c5fd');
            this.drawRect(ctx, 8, 10, 8, 2, '#bfdbfe');
            this.drawRect(ctx, 3, 2, 4, 3, '#111827');
            this.drawRect(ctx, 17, 2, 4, 3, '#111827');
            this.drawRect(ctx, 3, 12, 4, 3, '#111827');
            this.drawRect(ctx, 17, 12, 4, 3, '#111827');
        });
    },

    // 16. Restroom & Storage Doors
    genDoors(scene) {
        const door = document.createElement('canvas');
        door.width = 32;
        door.height = 48;
        const dctx = door.getContext('2d');

        this.drawRect(dctx, 0, 0, 32, 48, '#334155');
        this.drawRect(dctx, 2, 2, 28, 44, '#e2e8f0');
        this.drawRect(dctx, 4, 4, 24, 18, '#cbd5e1');
        this.drawRect(dctx, 4, 24, 24, 20, '#cbd5e1');
        this.drawRect(dctx, 24, 25, 3, 3, '#ca8a04'); // brass handle

        scene.textures.addCanvas('room_door', door);
    },

    generateCharacterSpritesheet(scene, textureKey, outfit) {
        const frameW = 24;
        const frameH = 32;
        const canvas = document.createElement('canvas');
        canvas.width = frameW * 3;
        canvas.height = frameH * 4;
        const ctx = canvas.getContext('2d');

        const skin = outfit.skin || '#fed7aa';
        const hair = outfit.hair || '#451a03';
        const shirt = outfit.shirt || '#d97706';
        const pants = outfit.pants || '#1e293b';

        for (let dir = 0; dir < 4; dir++) {
            for (let step = 0; step < 3; step++) {
                const ox = step * frameW;
                const oy = dir * frameH;
                const bob = (step === 1) ? -1 : 0;
                const legOffset = (step === 0) ? -2 : (step === 2 ? 2 : 0);

                if (dir === 0) { // Down
                    this.drawRect(ctx, ox + 6, oy + 4 + bob, 12, 6, hair);
                    this.drawRect(ctx, ox + 7, oy + 7 + bob, 10, 8, skin);
                    this.drawRect(ctx, ox + 8, oy + 10 + bob, 2, 2, '#0f172a');
                    this.drawRect(ctx, ox + 14, oy + 10 + bob, 2, 2, '#0f172a');
                    this.drawRect(ctx, ox + 7, oy + 4 + bob, 10, 4, hair);
                    this.drawRect(ctx, ox + 6, oy + 15 + bob, 12, 9, shirt);
                    this.drawRect(ctx, ox + 10, oy + 15 + bob, 4, 3, skin);
                    this.drawRect(ctx, ox + 4, oy + 16 + bob, 2, 6, shirt);
                    this.drawRect(ctx, ox + 18, oy + 16 + bob, 2, 6, shirt);
                    this.drawRect(ctx, ox + 7, oy + 24 + bob, 4, 6 + (step === 1 ? -1 : (step === 0 ? 1 : -1)), pants);
                    this.drawRect(ctx, ox + 13, oy + 24 + bob, 4, 6 + (step === 1 ? -1 : (step === 2 ? 1 : -1)), pants);
                    this.drawRect(ctx, ox + 6, oy + 30 + bob, 5, 2, '#0f172a');
                    this.drawRect(ctx, ox + 13, oy + 30 + bob, 5, 2, '#0f172a');
                } else if (dir === 1) { // Left
                    this.drawRect(ctx, ox + 7, oy + 4 + bob, 10, 10, hair);
                    this.drawRect(ctx, ox + 5, oy + 8 + bob, 6, 7, skin);
                    this.drawRect(ctx, ox + 6, oy + 10 + bob, 2, 2, '#0f172a');
                    this.drawRect(ctx, ox + 6, oy + 15 + bob, 11, 9, shirt);
                    this.drawRect(ctx, ox + 8 + legOffset, oy + 17 + bob, 3, 6, shirt);
                    this.drawRect(ctx, ox + 8 + legOffset, oy + 22 + bob, 3, 2, skin);
                    this.drawRect(ctx, ox + 7 + legOffset, oy + 24 + bob, 4, 6, pants);
                    this.drawRect(ctx, ox + 11 - legOffset, oy + 24 + bob, 4, 6, pants);
                    this.drawRect(ctx, ox + 5 + legOffset, oy + 30 + bob, 6, 2, '#0f172a');
                    this.drawRect(ctx, ox + 10 - legOffset, oy + 30 + bob, 6, 2, '#0f172a');
                } else if (dir === 2) { // Right
                    this.drawRect(ctx, ox + 7, oy + 4 + bob, 10, 10, hair);
                    this.drawRect(ctx, ox + 13, oy + 8 + bob, 6, 7, skin);
                    this.drawRect(ctx, ox + 16, oy + 10 + bob, 2, 2, '#0f172a');
                    this.drawRect(ctx, ox + 7, oy + 15 + bob, 11, 9, shirt);
                    this.drawRect(ctx, ox + 13 - legOffset, oy + 17 + bob, 3, 6, shirt);
                    this.drawRect(ctx, ox + 13 - legOffset, oy + 22 + bob, 3, 2, skin);
                    this.drawRect(ctx, ox + 8 - legOffset, oy + 24 + bob, 4, 6, pants);
                    this.drawRect(ctx, ox + 12 + legOffset, oy + 24 + bob, 4, 6, pants);
                    this.drawRect(ctx, ox + 8 - legOffset, oy + 30 + bob, 6, 2, '#0f172a');
                    this.drawRect(ctx, ox + 13 + legOffset, oy + 30 + bob, 6, 2, '#0f172a');
                } else if (dir === 3) { // Up
                    this.drawRect(ctx, ox + 6, oy + 4 + bob, 12, 11, hair);
                    this.drawRect(ctx, ox + 6, oy + 15 + bob, 12, 9, shirt);
                    this.drawRect(ctx, ox + 4, oy + 16 + bob, 2, 6, shirt);
                    this.drawRect(ctx, ox + 18, oy + 16 + bob, 2, 6, shirt);
                    this.drawRect(ctx, ox + 7, oy + 24 + bob, 4, 6 + (step === 0 ? 1 : -1), pants);
                    this.drawRect(ctx, ox + 13, oy + 24 + bob, 4, 6 + (step === 2 ? 1 : -1), pants);
                    this.drawRect(ctx, ox + 7, oy + 30 + bob, 4, 2, '#0f172a');
                    this.drawRect(ctx, ox + 13, oy + 30 + bob, 4, 2, '#0f172a');
                }
            }
        }

        if (scene.textures.exists(textureKey)) {
            scene.textures.remove(textureKey);
        }
        scene.textures.addSpriteSheet(textureKey, canvas, { frameWidth: frameW, frameHeight: frameH });
    }
};

function canvasOr(c) { return c; }
window.PixelArt = PixelArt;

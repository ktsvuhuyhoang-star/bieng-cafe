/**
 * Cozy Cafe Ambient Audio Synthesizer
 * Uses Web Audio API - 100% self-contained, no external mp3s needed
 */
class CafeAudio {
    constructor() {
        this.ctx = null;
        this.rainNode = null;
        this.rainGain = null;
        this.musicGain = null;
        this.masterGain = null;
        this.isRainPlaying = false;
        this.isMusicPlaying = false;
        this.musicTimer = null;
        this.currentTrack = 0;
        this.tracks = [
            { name: "Lofi Cafe Rain", bpm: 72 },
            { name: "Midnight Espresso (Jazz Piano)", bpm: 64 },
            { name: "Morning Sunshine (Chill Acoustic)", bpm: 80 }
        ];
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = 0.5;
            this.masterGain.connect(this.ctx.destination);

            this.rainGain = this.ctx.createGain();
            this.rainGain.gain.value = 0.25;
            this.rainGain.connect(this.masterGain);

            this.musicGain = this.ctx.createGain();
            this.musicGain.gain.value = 0.3;
            this.musicGain.connect(this.masterGain);
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    startRain() {
        if (!this.ctx) this.init();
        if (this.isRainPlaying) return;

        // Generate pink noise for soft cafe rain
        const bufferSize = this.ctx.sampleRate * 2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            b0 = 0.99886 * b0 + white * 0.0555179;
            b1 = 0.99332 * b1 + white * 0.0750759;
            b2 = 0.96900 * b2 + white * 0.1538520;
            b3 = 0.86650 * b3 + white * 0.3104856;
            b4 = 0.55000 * b4 + white * 0.5329522;
            b5 = -0.7616 * b5 - white * 0.0168980;
            data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
            b6 = white * 0.115926;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        noise.loop = true;

        // Low-pass filter to simulate sound inside a cozy warm room
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 850;

        noise.connect(filter);
        filter.connect(this.rainGain);
        noise.start();

        this.rainNode = noise;
        this.isRainPlaying = true;
    }

    stopRain() {
        if (this.rainNode) {
            try { this.rainNode.stop(); } catch(e) {}
            this.rainNode = null;
        }
        this.isRainPlaying = false;
    }

    startLofiMusic() {
        if (!this.ctx) this.init();
        if (this.isMusicPlaying) return;
        this.isMusicPlaying = true;
        this.playChordProgression();
    }

    playChordProgression() {
        if (!this.isMusicPlaying) return;

        // Soothing Lofi Jazz Chords: Cmaj7 -> Am7 -> Dm7 -> G7
        const chordProgressions = [
            [ [261.63, 329.63, 392.00, 493.88], [220.00, 261.63, 329.63, 392.00], [293.66, 349.23, 440.00, 523.25], [196.00, 246.94, 293.66, 349.23] ],
            [ [220.00, 261.63, 329.63, 392.00], [174.61, 220.00, 261.63, 329.63], [196.00, 246.94, 293.66, 349.23], [164.81, 196.00, 246.94, 293.66] ],
            [ [261.63, 329.63, 392.00, 523.25], [349.23, 440.00, 523.25, 659.25], [293.66, 349.23, 440.00, 523.25], [196.00, 246.94, 293.66, 392.00] ]
        ];

        const chords = chordProgressions[this.currentTrack % chordProgressions.length];
        let step = 0;

        const nextChord = () => {
            if (!this.isMusicPlaying) return;
            const currentChord = chords[step % chords.length];
            step++;

            const now = this.ctx.currentTime;
            currentChord.forEach((freq, idx) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();

                // Warm mellow electric piano/rhodes timbre
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, now + idx * 0.04);

                gain.gain.setValueAtTime(0.001, now + idx * 0.04);
                gain.gain.linearRampToValueAtTime(0.08, now + idx * 0.04 + 0.1);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.04 + 2.4);

                osc.connect(gain);
                gain.connect(this.musicGain);

                osc.start(now + idx * 0.04);
                osc.stop(now + idx * 0.04 + 2.5);
            });

            this.musicTimer = setTimeout(nextChord, 2600);
        };

        nextChord();
    }

    stopMusic() {
        this.isMusicPlaying = false;
        if (this.musicTimer) {
            clearTimeout(this.musicTimer);
            this.musicTimer = null;
        }
    }

    setTrack(index) {
        this.currentTrack = index % this.tracks.length;
        if (this.isMusicPlaying) {
            this.stopMusic();
            this.startLofiMusic();
        }
    }

    playDing() {
        if (!this.ctx) this.init();
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now); // A5 note
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 1.2);
    }
}

window.cafeAudio = new CafeAudio();

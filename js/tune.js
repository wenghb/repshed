/* Tune Player — Loop Player with Scrollable Waveform */

// ── State ───────────────────────────────────────────────
const state = {
    audioCtx: null,
    audioBuffer: null,
    audioElement: null,
    duration: 0,
    playing: false,
    speed: 1,
    loopEnabled: false,
    loopStart: null,  // seconds
    loopEnd: null,    // seconds
    countInEnabled: true,  // beep before loop start
    countInBPM: 120,       // tempo for count-in
    // Waveform viewport (in seconds)
    viewWindow: 30,
    viewStart: 0,
    // Waveform drag
    dragging: false,
    dragStartX: 0,
    dragStartTime: 0,  // time at drag start position
    // Scroll drag
    scrollDragging: false,
    scrollDragLastX: 0,
    // Speed Trainer
    trainerEnabled: false,
    trainerStartSpeed: 0.5,
    trainerTargetSpeed: 1.0,
    trainerStep: 0.05,
    trainerLoopsPerStep: 3,
    trainerCurrentLoopCount: 0,
    trainerReachedTarget: false,
};

const canvas = document.getElementById('waveform');
const ctx = canvas.getContext('2d');
let animId = null;
let rawPeaks = null;  // high-resolution peaks from audio buffer

// ── Colors ──────────────────────────────────────────────
const COLORS = {
    bg: '#1a1d27',
    wave: '#6366f1',
    waveLight: '#818cf8',
    playhead: '#ef4444',
    loopRegion: 'rgba(34, 197, 94, 0.15)',
    loopBorder: 'rgba(34, 197, 94, 0.6)',
    played: '#818cf8',
    unplayed: '#3b3f54',
    tick: 'rgba(255,255,255,0.12)',
    tickText: 'rgba(255,255,255,0.35)',
};

// ── Upload ──────────────────────────────────────────────
const uploadArea = document.getElementById('upload-area');
const fileInput = document.getElementById('file-input');

uploadArea.addEventListener('click', () => fileInput.click());
uploadArea.addEventListener('dragover', e => { e.preventDefault(); uploadArea.classList.add('drag-over'); });
uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over'));
uploadArea.addEventListener('drop', e => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    if (e.dataTransfer.files.length) loadFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', () => { if (fileInput.files.length) loadFile(fileInput.files[0]); });

async function loadFile(file) {
    const validTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/flac', 'audio/webm'];
    const validExts = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.webm', '.opus'];
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!validTypes.includes(file.type) && !validExts.includes(ext)) {
        toast('Please select an audio file (MP3, WAV, OGG, M4A, etc.)', 'error');
        return;
    }

    const url = URL.createObjectURL(file);

    if (!state.audioCtx) {
        state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    try {
        const arrayBuf = await file.arrayBuffer();
        state.audioBuffer = await state.audioCtx.decodeAudioData(arrayBuf);
        state.duration = state.audioBuffer.duration;
    } catch (err) {
        toast('Failed to decode audio: ' + err.message, 'error');
        return;
    }

    if (state.audioElement) {
        state.audioElement.pause();
        URL.revokeObjectURL(state.audioElement.src);
    }
    const audio = new Audio(url);
    audio.preservesPitch = true;
    state.audioElement = audio;
    state.playing = false;
    state.loopStart = null;
    state.loopEnd = null;
    state.loopEnabled = false;
    state.viewStart = 0;

    // Clamp view window to track duration
    if (state.viewWindow > state.duration) {
        state.viewWindow = state.duration;
    }

    document.getElementById('track-name').textContent = file.name;
    document.getElementById('track-duration').textContent = formatTime(state.duration);

    uploadArea.classList.add('hidden');
    document.getElementById('player-section').classList.remove('hidden');

    generatePeaks();
    startAnimLoop();
    updateLoopInfo();
    updateLoopButton();
    updateViewWindowDisplay();
}

// ── Peak Generation (high-res, once) ────────────────────
function generatePeaks() {
    const rawData = state.audioBuffer.getChannelData(0);
    // ~4 peaks per pixel at max zoom — store lots of peaks
    const totalPeaks = 4000;
    const blockSize = Math.floor(rawData.length / totalPeaks);
    const peaks = new Float32Array(totalPeaks);

    for (let i = 0; i < totalPeaks; i++) {
        let sum = 0;
        const start = i * blockSize;
        for (let j = 0; j < blockSize; j++) {
            sum += Math.abs(rawData[start + j] || 0);
        }
        peaks[i] = sum / blockSize;
    }

    const max = Math.max(...peaks) || 1;
    for (let i = 0; i < peaks.length; i++) peaks[i] /= max;

    rawPeaks = peaks;
}

// ── Waveform Drawing (viewport-aware) ───────────────────
function drawWaveform() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    if (!rawPeaks || !state.duration) return;

    const viewStart = state.viewStart;
    const viewEnd = Math.min(viewStart + state.viewWindow, state.duration);
    const viewDur = viewEnd - viewStart;
    const mid = h / 2;

    ctx.clearRect(0, 0, w, h);

    // Helper: time → x pixel
    const timeToX = t => ((t - viewStart) / viewDur) * w;
    // Helper: x pixel → time
    // (stored globally for mouse handlers)
    state._xToTime = x => viewStart + (x / w) * viewDur;

    // ── Draw time grid ticks ──
    const tickInterval = getTickInterval(viewDur);
    const firstTick = Math.ceil(viewStart / tickInterval) * tickInterval;
    ctx.strokeStyle = COLORS.tick;
    ctx.lineWidth = 1;
    ctx.fillStyle = COLORS.tickText;
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    for (let t = firstTick; t <= viewEnd; t += tickInterval) {
        const x = timeToX(t);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
        ctx.fillText(formatTime(t), x, h - 4);
    }

    // ── Draw loop region ──
    if (state.loopStart !== null && state.loopEnd !== null) {
        const x1 = Math.max(0, timeToX(state.loopStart));
        const x2 = Math.min(w, timeToX(state.loopEnd));
        if (x2 > 0 && x1 < w) {
            ctx.fillStyle = COLORS.loopRegion;
            ctx.fillRect(x1, 0, x2 - x1, h);

            // Determine which edge is active (being dragged or hovered)
            const activeEdge = _edgeDragging || _touchEdgeDragging || _hoveredEdge;

            // Left edge (A)
            const aActive = activeEdge === 'start';
            ctx.strokeStyle = aActive ? '#22c55e' : COLORS.loopBorder;
            ctx.lineWidth = aActive ? 4 : 2;
            if (x1 >= 0) { ctx.beginPath(); ctx.moveTo(x1, 0); ctx.lineTo(x1, h); ctx.stroke(); }

            // Right edge (B)
            const bActive = activeEdge === 'end';
            ctx.strokeStyle = bActive ? '#22c55e' : COLORS.loopBorder;
            ctx.lineWidth = bActive ? 4 : 2;
            if (x2 <= w) { ctx.beginPath(); ctx.moveTo(x2, 0); ctx.lineTo(x2, h); ctx.stroke(); }

            // Draw drag handles — bigger when active
            const aHandleH = aActive ? 20 : 14;
            const aHandleW = aActive ? 12 : 8;
            const bHandleH = bActive ? 20 : 14;
            const bHandleW = bActive ? 12 : 8;

            // Left handle (A)
            ctx.fillStyle = aActive ? '#22c55e' : COLORS.loopBorder;
            if (x1 >= 0) {
                ctx.beginPath();
                ctx.moveTo(x1, 0); ctx.lineTo(x1 + aHandleW, 0); ctx.lineTo(x1, aHandleH); ctx.closePath(); ctx.fill();
                ctx.beginPath();
                ctx.moveTo(x1, h); ctx.lineTo(x1 + aHandleW, h); ctx.lineTo(x1, h - aHandleH); ctx.closePath(); ctx.fill();
            }
            // Right handle (B)
            ctx.fillStyle = bActive ? '#22c55e' : COLORS.loopBorder;
            if (x2 <= w) {
                ctx.beginPath();
                ctx.moveTo(x2, 0); ctx.lineTo(x2 - bHandleW, 0); ctx.lineTo(x2, bHandleH); ctx.closePath(); ctx.fill();
                ctx.beginPath();
                ctx.moveTo(x2, h); ctx.lineTo(x2 - bHandleW, h); ctx.lineTo(x2, h - bHandleH); ctx.closePath(); ctx.fill();
            }

            // Label A/B on handles when active
            if (aActive && x1 >= 0) {
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 10px monospace';
                ctx.textAlign = 'left';
                ctx.fillText('A', x1 + 3, mid - 2);
            }
            if (bActive && x2 <= w) {
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 10px monospace';
                ctx.textAlign = 'right';
                ctx.fillText('B', x2 - 3, mid - 2);
            }
        }
    }

    // ── Draw waveform bars ──
    const currentTime = state.audioElement ? state.audioElement.currentTime : 0;
    const peaksLen = rawPeaks.length;

    for (let px = 0; px < w; px++) {
        const t = viewStart + (px / w) * viewDur;
        const frac = t / state.duration;
        const idx = Math.floor(frac * peaksLen);
        const amp = (idx >= 0 && idx < peaksLen) ? rawPeaks[idx] : 0;
        const barH = amp * (mid - 14);  // leave room for tick text

        ctx.fillStyle = t <= currentTime ? COLORS.played : COLORS.unplayed;
        ctx.fillRect(px, mid - barH, 1, barH);
        ctx.fillRect(px, mid, 1, barH);
    }

    // ── Center line ──
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, mid);
    ctx.lineTo(w, mid);
    ctx.stroke();

    // ── Playhead ──
    const playX = timeToX(currentTime);
    if (playX >= -2 && playX <= w + 2) {
        ctx.strokeStyle = COLORS.playhead;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(playX, 0);
        ctx.lineTo(playX, h);
        ctx.stroke();
        ctx.fillStyle = COLORS.playhead;
        ctx.beginPath();
        ctx.arc(playX, mid, 4, 0, Math.PI * 2);
        ctx.fill();
    }

    // ── Minimap (overview bar at top) ──
    drawMinimap(w);
}

function drawMinimap(canvasW) {
    const mmH = 6;
    const mmY = 2;

    // Full track background
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(0, mmY, canvasW, mmH);

    // Viewport indicator
    const vStartFrac = state.viewStart / state.duration;
    const vEndFrac = Math.min((state.viewStart + state.viewWindow) / state.duration, 1);
    ctx.fillStyle = 'rgba(99, 102, 241, 0.4)';
    ctx.fillRect(vStartFrac * canvasW, mmY, (vEndFrac - vStartFrac) * canvasW, mmH);

    // Loop region on minimap
    if (state.loopStart !== null && state.loopEnd !== null) {
        const ls = (state.loopStart / state.duration) * canvasW;
        const le = (state.loopEnd / state.duration) * canvasW;
        ctx.fillStyle = 'rgba(34, 197, 94, 0.35)';
        ctx.fillRect(ls, mmY, le - ls, mmH);
    }

    // Playhead on minimap
    if (state.audioElement) {
        const px = (state.audioElement.currentTime / state.duration) * canvasW;
        ctx.fillStyle = COLORS.playhead;
        ctx.fillRect(px - 1, mmY, 2, mmH);
    }
}

function getTickInterval(viewDur) {
    if (viewDur <= 5) return 0.5;
    if (viewDur <= 15) return 1;
    if (viewDur <= 30) return 2;
    if (viewDur <= 60) return 5;
    if (viewDur <= 180) return 10;
    if (viewDur <= 600) return 30;
    return 60;
}

// ── Auto-scroll viewport to follow playhead ─────────────
function autoScrollViewport() {
    if (!state.audioElement || state.dragging || state.scrollDragging || _countInPlaying) return;
    const t = state.audioElement.currentTime;
    const viewEnd = state.viewStart + state.viewWindow;
    const margin = state.viewWindow * 0.15;  // 15% margin before edge

    // If playhead is near right edge or past it, scroll
    if (t > viewEnd - margin) {
        state.viewStart = Math.min(t - state.viewWindow * 0.3, state.duration - state.viewWindow);
    }
    // If playhead is before left edge (e.g. loop restart), scroll
    if (t < state.viewStart) {
        state.viewStart = Math.max(0, t - state.viewWindow * 0.1);
    }
    state.viewStart = Math.max(0, state.viewStart);
}

// ── Animation Loop ──────────────────────────────────────
function startAnimLoop() {
    if (animId) cancelAnimationFrame(animId);
    function loop() {
        autoScrollViewport();
        drawWaveform();
        updateScrollbar();
        updateCurrentTime();
        updateTimeLabels();
        checkLoop();
        animId = requestAnimationFrame(loop);
    }
    animId = requestAnimationFrame(loop);
}

function updateCurrentTime() {
    if (!state.audioElement) return;
    document.getElementById('current-time').textContent = formatTimeMs(state.audioElement.currentTime);
}

function updateTimeLabels() {
    if (!state.duration) return;
    document.getElementById('time-start').textContent = formatTime(state.viewStart);
    document.getElementById('time-end').textContent = formatTime(Math.min(state.viewStart + state.viewWindow, state.duration));
}

function checkLoop() {
    if (!state.audioElement || !state.loopEnabled) return;
    if (state.loopStart === null || state.loopEnd === null) return;
    if (state.audioElement.currentTime >= state.loopEnd) {
        state.audioElement.currentTime = state.loopStart;

        // Speed Trainer: count loops and auto-increase speed
        if (state.trainerEnabled && !state.trainerReachedTarget) {
            state.trainerCurrentLoopCount++;
            updateTrainerStatus();
            if (state.trainerCurrentLoopCount >= state.trainerLoopsPerStep) {
                state.trainerCurrentLoopCount = 0;
                const newSpeed = Math.round((state.speed + state.trainerStep) * 100) / 100;
                if (newSpeed >= state.trainerTargetSpeed) {
                    setSpeed(state.trainerTargetSpeed);
                    state.trainerReachedTarget = true;
                    updateTrainerStatus();
                    toast('🎯 Target speed reached!', 'success');
                } else {
                    setSpeed(newSpeed);
                    updateTrainerStatus();
                }
            }
        }
    }
}

// ── Count-in Beep (Web Audio oscillator) ────────────────
let _countInPlaying = false;

function playCountIn(callback) {
    if (_countInPlaying) return;
    _countInPlaying = true;

    if (!state.audioCtx) {
        state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    const ctx = state.audioCtx;
    const beats = 5;
    const interval = 60 / state.countInBPM;

    for (let i = 0; i < beats; i++) {
        const startTime = ctx.currentTime + i * interval;
        const isLast = (i === beats - 1);
        const freq = isLast ? 1200 : 800;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.3, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + 0.1);
    }

    setTimeout(() => {
        _countInPlaying = false;
        if (callback) callback();
    }, beats * interval * 1000);
}

// ── Playback Controls ───────────────────────────────────
function togglePlay() {
    if (!state.audioElement) return;
    if (_countInPlaying) return;  // ignore during count-in

    if (state.playing) {
        state.audioElement.pause();
        state.playing = false;
        document.getElementById('btn-play').textContent = '▶';
    } else {
        // Jump to loop start if needed
        if (state.loopEnabled && state.loopStart !== null) {
            if (state.audioElement.currentTime < state.loopStart || state.audioElement.currentTime >= state.loopEnd) {
                state.audioElement.currentTime = state.loopStart;
            }
        }

        if (state.countInEnabled && state.loopEnabled && state.loopStart !== null) {
            // Count-in before playing
            document.getElementById('btn-play').textContent = '🔔';
            playCountIn(() => {
                if (!state.audioElement) return;
                state.audioElement.play();
                state.playing = true;
                document.getElementById('btn-play').textContent = '⏸';
            });
        } else {
            state.audioElement.play();
            state.playing = true;
            document.getElementById('btn-play').textContent = '⏸';
        }
    }
}

function restartTrack() {
    if (!state.audioElement) return;
    if (_countInPlaying) return;

    const target = (state.loopEnabled && state.loopStart !== null) ? state.loopStart : 0;
    state.audioElement.currentTime = target;

    if (state.countInEnabled && state.playing) {
        state.audioElement.pause();
        document.getElementById('btn-play').textContent = '🔔';
        playCountIn(() => {
            if (!state.audioElement) return;
            state.audioElement.currentTime = target;
            state.audioElement.play();
            state.playing = true;
            document.getElementById('btn-play').textContent = '⏸';
        });
    }
}

function skip(seconds) {
    if (!state.audioElement) return;
    state.audioElement.currentTime = Math.max(0, Math.min(state.duration, state.audioElement.currentTime + seconds));
}

function toggleLoop() {
    if (state.loopStart === null || state.loopEnd === null) {
        toast('Select a region on the waveform first', 'error');
        return;
    }
    state.loopEnabled = !state.loopEnabled;
    updateLoopButton();
    updateLoopInfo();
}

function updateLoopButton() {
    const btn = document.getElementById('btn-loop');
    btn.classList.toggle('active', state.loopEnabled);
}

// ── Loop Selection ──────────────────────────────────────
function setLoopFromHere() {
    if (!state.audioElement) return;
    state.loopStart = state.audioElement.currentTime;
    if (state.loopEnd === null || state.loopEnd <= state.loopStart) {
        state.loopEnd = Math.min(state.loopStart + 10, state.duration);
    }
    state.loopEnabled = true;
    updateLoopButton();
    updateLoopInfo();
}

function setLoopToHere() {
    if (!state.audioElement) return;
    state.loopEnd = state.audioElement.currentTime;
    if (state.loopStart === null || state.loopStart >= state.loopEnd) {
        state.loopStart = Math.max(0, state.loopEnd - 10);
    }
    state.loopEnabled = true;
    updateLoopButton();
    updateLoopInfo();
}

function clearLoop() {
    state.loopStart = null;
    state.loopEnd = null;
    state.loopEnabled = false;
    updateLoopButton();
    updateLoopInfo();
}

function toggleCountIn() {
    state.countInEnabled = !state.countInEnabled;
    updateCountInButton();
}

function updateCountInButton() {
    const btn = document.getElementById('btn-countin');
    if (state.countInEnabled) {
        btn.classList.remove('btn-outline');
        btn.textContent = '🔔 Count-in ON';
    } else {
        btn.classList.add('btn-outline');
        btn.textContent = '🔕 Count-in OFF';
    }
}

function updateLoopInfo() {
    const badge = document.getElementById('loop-badge');
    const hint = document.querySelector('.loop-hint');
    const adjust = document.getElementById('loop-adjust');
    const startInput = document.getElementById('loop-start-input');
    const endInput = document.getElementById('loop-end-input');

    if (state.loopStart !== null && state.loopEnd !== null) {
        badge.textContent = `Loop: ${formatTime(state.loopStart)} → ${formatTime(state.loopEnd)} (${formatTime(state.loopEnd - state.loopStart)})`;
        badge.classList.toggle('active', state.loopEnabled);
        hint.textContent = state.loopEnabled ? 'Loop is active' : 'Loop paused — click 🔁 to enable';
        adjust.style.display = '';
        startInput.value = formatTimeMs(state.loopStart);
        endInput.value = formatTimeMs(state.loopEnd);
    } else {
        badge.textContent = 'No loop selected';
        badge.classList.remove('active');
        hint.textContent = 'Click and drag on the waveform to select a loop region';
        adjust.style.display = 'none';
    }
}

// ── Loop Fine Adjust ────────────────────────────────────
function nudgeLoop(point, delta) {
    if (state.loopStart === null || state.loopEnd === null) return;
    if (point === 'start') {
        state.loopStart = Math.max(0, Math.min(state.loopEnd - 0.1, state.loopStart + delta));
    } else {
        state.loopEnd = Math.min(state.duration, Math.max(state.loopStart + 0.1, state.loopEnd + delta));
    }
    state.loopEnabled = true;
    updateLoopButton();
    updateLoopInfo();
}

function setLoopTime(point, str) {
    const t = parseTimeStr(str);
    if (t === null) return;
    if (point === 'start') {
        state.loopStart = Math.max(0, Math.min(state.loopEnd !== null ? state.loopEnd - 0.1 : state.duration, t));
    } else {
        state.loopEnd = Math.min(state.duration, Math.max(state.loopStart !== null ? state.loopStart + 0.1 : 0, t));
    }
    if (state.loopStart === null) state.loopStart = 0;
    if (state.loopEnd === null) state.loopEnd = state.duration;
    state.loopEnabled = true;
    updateLoopButton();
    updateLoopInfo();
}

function parseTimeStr(str) {
    // Accepts: "1:23.4", "1:23", "83.4", "83"
    str = str.trim();
    const colonMatch = str.match(/^(\d+):(\d+(?:\.\d+)?)$/);
    if (colonMatch) {
        return parseInt(colonMatch[1]) * 60 + parseFloat(colonMatch[2]);
    }
    const numMatch = str.match(/^(\d+(?:\.\d+)?)$/);
    if (numMatch) {
        return parseFloat(numMatch[1]);
    }
    return null;
}

// ── Waveform Mouse Interaction ──────────────────────────
// Near loop edge → drag that edge
// Otherwise → drag to create new loop, or click to seek
// Middle/Shift+drag → scroll viewport
// Scroll wheel → pan viewport

const EDGE_GRAB_PX = 10;

function getEdgeNear(x) {
    if (state.loopStart === null || state.loopEnd === null || !state._xToTime) return null;
    const w = canvas.clientWidth;
    const viewDur = state.viewWindow;
    const viewStart = state.viewStart;
    const timeToX = t => ((t - viewStart) / viewDur) * w;

    const xA = timeToX(state.loopStart);
    const xB = timeToX(state.loopEnd);

    if (Math.abs(x - xA) <= EDGE_GRAB_PX) return 'start';
    if (Math.abs(x - xB) <= EDGE_GRAB_PX) return 'end';
    return null;
}

let _edgeDragging = null;
let _hoveredEdge = null;  // for visual highlight on hover

// Double-click on waveform = clear loop
canvas.addEventListener('dblclick', e => {
    if (state.loopStart !== null && state.loopEnd !== null) {
        clearLoop();
    }
});

canvas.addEventListener('mousedown', e => {
    if (!state.audioElement) return;
    e.preventDefault();

    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
        state.scrollDragging = true;
        state.scrollDragLastX = e.offsetX;
        canvas.style.cursor = 'grabbing';
        return;
    }

    const edge = getEdgeNear(e.offsetX);
    if (edge) {
        _edgeDragging = edge;
        canvas.style.cursor = 'col-resize';
        return;
    }

    state.dragging = true;
    state.dragStartX = e.offsetX;
    state.dragStartTime = state._xToTime ? state._xToTime(e.offsetX) : 0;
});

// Single mousemove handler for all modes
canvas.addEventListener('mousemove', e => {
    // Edge dragging
    if (_edgeDragging && state._xToTime) {
        const t = Math.max(0, Math.min(state.duration, state._xToTime(e.offsetX)));
        if (_edgeDragging === 'start') {
            state.loopStart = Math.min(t, state.loopEnd - 0.1);
        } else {
            state.loopEnd = Math.max(t, state.loopStart + 0.1);
        }
        updateLoopInfo();
        return;
    }

    // Viewport scroll drag
    if (state.scrollDragging) {
        const dx = e.offsetX - state.scrollDragLastX;
        const w = canvas.clientWidth;
        const timeDelta = -(dx / w) * state.viewWindow;
        state.viewStart = Math.max(0, Math.min(state.duration - state.viewWindow, state.viewStart + timeDelta));
        state.scrollDragLastX = e.offsetX;
        return;
    }

    // Loop selection drag
    if (state.dragging && state._xToTime) {
        const t1 = state.dragStartTime;
        const t2 = state._xToTime(e.offsetX);
        state.loopStart = Math.max(0, Math.min(t1, t2));
        state.loopEnd = Math.min(state.duration, Math.max(t1, t2));
        updateLoopInfo();
        return;
    }

    // Hover — update cursor and edge highlight
    if (state.audioElement) {
        const edge = getEdgeNear(e.offsetX);
        _hoveredEdge = edge;
        canvas.style.cursor = edge ? 'col-resize' : 'crosshair';
    }
});

canvas.addEventListener('mouseup', e => {
    if (_edgeDragging) {
        _edgeDragging = null;
        state.loopEnabled = true;
        updateLoopButton();
        updateLoopInfo();
        return;
    }

    if (state.scrollDragging) {
        state.scrollDragging = false;
        canvas.style.cursor = 'crosshair';
        return;
    }
    if (!state.dragging || !state._xToTime) return;
    state.dragging = false;

    const t1 = state.dragStartTime;
    const t2 = state._xToTime(e.offsetX);

    if (Math.abs(t2 - t1) < 0.15) {
        state.audioElement.currentTime = Math.max(0, Math.min(state.duration, t2));
    } else {
        state.loopStart = Math.max(0, Math.min(t1, t2));
        state.loopEnd = Math.min(state.duration, Math.max(t1, t2));
        state.loopEnabled = true;
        updateLoopButton();
        updateLoopInfo();
    }
});

canvas.addEventListener('mouseleave', () => {
    if (_edgeDragging) {
        _edgeDragging = null;
        state.loopEnabled = true;
        updateLoopButton();
        updateLoopInfo();
    }
});

// Scroll wheel to pan viewport
canvas.addEventListener('wheel', e => {
    if (!state.audioElement) return;
    e.preventDefault();
    const scrollAmount = (e.deltaY > 0 ? 1 : -1) * state.viewWindow * 0.15;
    state.viewStart = Math.max(0, Math.min(state.duration - state.viewWindow, state.viewStart + scrollAmount));
}, { passive: false });

// ── Touch support ───────────────────────────────────────
// 1 finger: edge drag or loop select or seek
// 2 fingers: pan viewport left/right

let _touchEdgeDragging = null;
let _touchPanning = false;
let _touchPanLastX = 0;
let _touchStartedAs1F = false;

// Prevent Safari zoom/rotate gestures on the canvas
canvas.addEventListener('gesturestart', e => e.preventDefault(), { passive: false });
canvas.addEventListener('gesturechange', e => e.preventDefault(), { passive: false });
canvas.addEventListener('gestureend', e => e.preventDefault(), { passive: false });

canvas.addEventListener('touchstart', e => {
    if (!state.audioElement) return;
    e.preventDefault();
    e.stopPropagation();

    if (e.touches.length >= 2) {
        // Immediately enter pan mode
        _touchPanning = true;
        _touchEdgeDragging = null;
        state.dragging = false;
        _touchStartedAs1F = false;
        _touchPanLastX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        return;
    }

    if (e.touches.length === 1) {
        _touchStartedAs1F = true;
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;

        const edge = getEdgeNear(x);
        if (edge) {
            _touchEdgeDragging = edge;
            return;
        }

        state.dragging = true;
        state.dragStartX = x;
        state.dragStartTime = state._xToTime ? state._xToTime(x) : 0;
    }
}, { passive: false });

canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    e.stopPropagation();

    // Detect 2+ fingers at any point → switch to pan
    if (e.touches.length >= 2) {
        if (!_touchPanning) {
            // Switch from whatever mode to pan
            _touchPanning = true;
            _touchEdgeDragging = null;
            state.dragging = false;
            _touchPanLastX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        }
        // Do pan
        const mid = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const dx = mid - _touchPanLastX;
        const w = canvas.clientWidth;
        const timeDelta = -(dx / w) * state.viewWindow;
        state.viewStart = Math.max(0, Math.min(state.duration - state.viewWindow, state.viewStart + timeDelta));
        _touchPanLastX = mid;
        return;
    }

    // Edge drag (1 finger)
    if (_touchEdgeDragging && state._xToTime && e.touches.length === 1) {
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const t = Math.max(0, Math.min(state.duration, state._xToTime(x)));
        if (_touchEdgeDragging === 'start') {
            state.loopStart = Math.min(t, state.loopEnd - 0.1);
        } else {
            state.loopEnd = Math.max(t, state.loopStart + 0.1);
        }
        updateLoopInfo();
        return;
    }

    // Loop selection drag (1 finger)
    if (state.dragging && state._xToTime && e.touches.length === 1) {
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const t1 = state.dragStartTime;
        const t2 = state._xToTime(x);
        state.loopStart = Math.max(0, Math.min(t1, t2));
        state.loopEnd = Math.min(state.duration, Math.max(t1, t2));
        updateLoopInfo();
    }
}, { passive: false });

canvas.addEventListener('touchend', e => {
    e.preventDefault();

    // If was panning and all fingers lifted
    if (_touchPanning) {
        if (e.touches.length === 0) {
            _touchPanning = false;
            _touchStartedAs1F = false;
        }
        return;
    }

    if (_touchEdgeDragging) {
        _touchEdgeDragging = null;
        state.loopEnabled = true;
        updateLoopButton();
        updateLoopInfo();
        return;
    }

    if (!state.dragging || !state._xToTime) return;
    state.dragging = false;
    const touch = e.changedTouches[0];
    const rect = canvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const t1 = state.dragStartTime;
    const t2 = state._xToTime(x);

    if (Math.abs(t2 - t1) < 0.15) {
        state.audioElement.currentTime = Math.max(0, Math.min(state.duration, t2));
    } else {
        state.loopStart = Math.max(0, Math.min(t1, t2));
        state.loopEnd = Math.min(state.duration, Math.max(t1, t2));
        state.loopEnabled = true;
        updateLoopButton();
        updateLoopInfo();
    }
});

canvas.addEventListener('touchcancel', () => {
    _touchPanning = false;
    _touchEdgeDragging = null;
    _touchStartedAs1F = false;
    state.dragging = false;
});

// ── Speed Control ───────────────────────────────────────
const speedSlider = document.getElementById('speed-slider');
const speedInput = document.getElementById('speed-input');
const speedBtns = document.querySelectorAll('.speed-btn');

speedBtns.forEach(btn => {
    btn.addEventListener('click', () => setSpeed(parseFloat(btn.dataset.speed)));
});

speedSlider.addEventListener('input', () => setSpeed(parseFloat(speedSlider.value)));

speedInput.addEventListener('change', () => {
    let v = parseFloat(speedInput.value);
    if (isNaN(v)) v = 1;
    v = Math.max(0.1, Math.min(2, v));
    setSpeed(v);
});
speedInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.target.blur(); }
});

function setSpeed(speed) {
    speed = Math.round(speed * 100) / 100;  // round to 2 decimal
    state.speed = speed;
    if (state.audioElement) state.audioElement.playbackRate = speed;
    speedSlider.value = speed;
    speedInput.value = speed.toFixed(2);

    speedBtns.forEach(btn => {
        btn.classList.toggle('active', Math.abs(parseFloat(btn.dataset.speed) - speed) < 0.005);
    });
}

// ── View Window Control ─────────────────────────────────
const viewSlider = document.getElementById('view-window-slider');
const viewInput = document.getElementById('view-window-input');

function updateViewWindowDisplay() {
    viewSlider.max = Math.ceil(state.duration);
    viewSlider.value = state.viewWindow;
    viewInput.value = Math.round(state.viewWindow);
}

viewSlider.addEventListener('input', () => {
    let v = parseFloat(viewSlider.value);
    v = Math.max(2, Math.min(state.duration, v));
    state.viewWindow = v;
    viewInput.value = Math.round(v);
    clampViewport();
});

viewInput.addEventListener('change', () => {
    let v = parseFloat(viewInput.value);
    if (isNaN(v)) v = 30;
    v = Math.max(2, Math.min(state.duration, v));
    state.viewWindow = v;
    viewSlider.value = v;
    viewInput.value = Math.round(v);
    clampViewport();
});
viewInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') e.target.blur();
});

function clampViewport() {
    if (state.viewStart + state.viewWindow > state.duration) {
        state.viewStart = Math.max(0, state.duration - state.viewWindow);
    }
}

// ── Scroll Bar (drag to pan viewport) ───────────────────
const scrollTrack = document.getElementById('scroll-track');
const scrollThumb = document.getElementById('scroll-thumb');
let scrollDragState = null;

function updateScrollbar() {
    if (!state.duration) return;
    const trackW = scrollTrack.clientWidth;
    const thumbFrac = Math.min(1, state.viewWindow / state.duration);
    const thumbW = Math.max(24, thumbFrac * trackW);
    const startFrac = state.viewStart / state.duration;
    const maxLeft = trackW - thumbW;
    scrollThumb.style.width = thumbW + 'px';
    scrollThumb.style.left = (startFrac * maxLeft / (1 - thumbFrac || 1)) + 'px';
}

// Thumb drag
scrollThumb.addEventListener('mousedown', e => {
    e.preventDefault();
    e.stopPropagation();
    scrollDragState = { startX: e.clientX, startViewStart: state.viewStart };
    scrollThumb.classList.add('dragging');
});

// Track click = jump
scrollTrack.addEventListener('mousedown', e => {
    if (e.target === scrollThumb) return;
    const rect = scrollTrack.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    state.viewStart = Math.max(0, Math.min(state.duration - state.viewWindow, frac * state.duration - state.viewWindow / 2));
});

document.addEventListener('mousemove', e => {
    if (!scrollDragState) return;
    const trackW = scrollTrack.clientWidth;
    const dx = e.clientX - scrollDragState.startX;
    const timeDelta = (dx / trackW) * state.duration;
    state.viewStart = Math.max(0, Math.min(state.duration - state.viewWindow, scrollDragState.startViewStart + timeDelta));
});

document.addEventListener('mouseup', () => {
    if (scrollDragState) {
        scrollDragState = null;
        scrollThumb.classList.remove('dragging');
    }
});

// Touch support for scrollbar
scrollThumb.addEventListener('touchstart', e => {
    e.preventDefault();
    e.stopPropagation();
    const touch = e.touches[0];
    scrollDragState = { startX: touch.clientX, startViewStart: state.viewStart };
    scrollThumb.classList.add('dragging');
}, { passive: false });

scrollTrack.addEventListener('touchstart', e => {
    if (e.target === scrollThumb) return;
    const rect = scrollTrack.getBoundingClientRect();
    const touch = e.touches[0];
    const frac = (touch.clientX - rect.left) / rect.width;
    state.viewStart = Math.max(0, Math.min(state.duration - state.viewWindow, frac * state.duration - state.viewWindow / 2));
}, { passive: true });

document.addEventListener('touchmove', e => {
    if (!scrollDragState) return;
    const touch = e.touches[0];
    const trackW = scrollTrack.clientWidth;
    const dx = touch.clientX - scrollDragState.startX;
    const timeDelta = (dx / trackW) * state.duration;
    state.viewStart = Math.max(0, Math.min(state.duration - state.viewWindow, scrollDragState.startViewStart + timeDelta));
}, { passive: true });

document.addEventListener('touchend', () => {
    if (scrollDragState) {
        scrollDragState = null;
        scrollThumb.classList.remove('dragging');
    }
});

// ── Volume ──────────────────────────────────────────────
const volumeSlider = document.getElementById('volume-slider');
volumeSlider.addEventListener('input', () => {
    if (state.audioElement) state.audioElement.volume = parseFloat(volumeSlider.value);
});

// ── Close Track ─────────────────────────────────────────
function closeTrack() {
    if (state.audioElement) {
        state.audioElement.pause();
        URL.revokeObjectURL(state.audioElement.src);
        state.audioElement = null;
    }
    state.playing = false;
    state.audioBuffer = null;
    state.loopStart = null;
    state.loopEnd = null;
    state.loopEnabled = false;
    state.viewStart = 0;
    state.viewWindow = 30;
    rawPeaks = null;

    if (animId) cancelAnimationFrame(animId);

    document.getElementById('player-section').classList.add('hidden');
    document.getElementById('upload-area').classList.remove('hidden');
    document.getElementById('btn-play').textContent = '▶';
    fileInput.value = '';
}

// ── Keyboard Shortcuts ──────────────────────────────────
document.addEventListener('keydown', e => {
    if (!state.audioElement) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    switch (e.code) {
        case 'Space':
            e.preventDefault();
            togglePlay();
            break;
        case 'ArrowLeft':
            e.preventDefault();
            skip(e.shiftKey ? -1 : -5);
            break;
        case 'ArrowRight':
            e.preventDefault();
            skip(e.shiftKey ? 1 : 5);
            break;
        case 'BracketLeft':
            e.preventDefault();
            setLoopFromHere();
            break;
        case 'BracketRight':
            e.preventDefault();
            setLoopToHere();
            break;
        case 'KeyL':
            e.preventDefault();
            if (state.loopStart !== null && state.loopEnd !== null) toggleLoop();
            break;
        case 'KeyT':
            e.preventDefault();
            toggleTrainer();
            break;
        case 'Minus':
        case 'NumpadSubtract':
            e.preventDefault();
            setSpeed(Math.max(0.1, state.speed - 0.01));
            break;
        case 'Equal':
        case 'NumpadAdd':
            e.preventDefault();
            setSpeed(Math.min(2, state.speed + 0.01));
            break;
    }
});

// ── Window resize ───────────────────────────────────────
window.addEventListener('resize', () => {
    if (rawPeaks) drawWaveform();
});

// ── Speed Trainer ───────────────────────────────────────
function toggleTrainer() {
    const panel = document.getElementById('trainer-panel');
    const btn = document.getElementById('btn-trainer-toggle');
    if (panel.classList.contains('hidden')) {
        panel.classList.remove('hidden');
        btn.classList.add('active');
    } else {
        panel.classList.add('hidden');
        btn.classList.remove('active');
        if (state.trainerEnabled) stopTrainer();
    }
}

function startTrainer() {
    if (!state.loopEnabled || state.loopStart === null || state.loopEnd === null) {
        toast('Set a loop region first', 'error');
        return;
    }

    // Read values from inputs
    state.trainerStartSpeed = parseFloat(document.getElementById('trainer-start').value) || 0.5;
    state.trainerTargetSpeed = parseFloat(document.getElementById('trainer-target').value) || 1.0;
    state.trainerStep = parseFloat(document.getElementById('trainer-step').value) || 0.05;
    state.trainerLoopsPerStep = parseInt(document.getElementById('trainer-loops').value) || 3;

    // Validate
    if (state.trainerStartSpeed >= state.trainerTargetSpeed) {
        toast('Start speed must be less than target speed', 'error');
        return;
    }
    if (state.trainerStep <= 0) {
        toast('Step must be positive', 'error');
        return;
    }

    state.trainerEnabled = true;
    state.trainerCurrentLoopCount = 0;
    state.trainerReachedTarget = false;

    // Set starting speed
    setSpeed(state.trainerStartSpeed);

    // Auto-play if not already
    if (!state.playing) {
        togglePlay();
    }

    updateTrainerUI();
    updateTrainerStatus();
    toast('🏋️ Speed trainer started!', 'success');
}

function stopTrainer() {
    state.trainerEnabled = false;
    state.trainerCurrentLoopCount = 0;
    state.trainerReachedTarget = false;
    updateTrainerUI();
    updateTrainerStatus();
}

function updateTrainerUI() {
    const startBtn = document.getElementById('btn-trainer-start');
    const stopBtn = document.getElementById('btn-trainer-stop');
    const inputs = document.querySelectorAll('#trainer-panel .trainer-input');

    if (state.trainerEnabled) {
        startBtn.classList.add('hidden');
        stopBtn.classList.remove('hidden');
        inputs.forEach(el => el.disabled = true);
    } else {
        startBtn.classList.remove('hidden');
        stopBtn.classList.add('hidden');
        inputs.forEach(el => el.disabled = false);
    }
}

function updateTrainerStatus() {
    const statusEl = document.getElementById('trainer-status');
    if (!state.trainerEnabled) {
        statusEl.textContent = '';
        return;
    }

    if (state.trainerReachedTarget) {
        statusEl.textContent = `🎯 Target reached! Playing at ${state.trainerTargetSpeed.toFixed(2)}×`;
        statusEl.className = 'trainer-status reached';
    } else {
        const totalSteps = Math.ceil((state.trainerTargetSpeed - state.trainerStartSpeed) / state.trainerStep);
        const currentStep = Math.floor((state.speed - state.trainerStartSpeed) / state.trainerStep) + 1;
        const loopsLeft = state.trainerLoopsPerStep - state.trainerCurrentLoopCount;
        statusEl.textContent = `Step ${currentStep}/${totalSteps} · ${state.speed.toFixed(2)}× · ${loopsLeft} loop${loopsLeft !== 1 ? 's' : ''} until next ↑`;
        statusEl.className = 'trainer-status active';
    }
}

// ── Helpers ─────────────────────────────────────────────
function formatTime(s) {
    if (!s || s < 0) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
}

function formatTimeMs(s) {
    if (!s || s < 0) return '0:00.0';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    const ms = Math.floor((s % 1) * 10);
    return `${m}:${sec.toString().padStart(2, '0')}.${ms}`;
}

function toast(msg, type = 'info') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
}

// ErrotParrot 6.0 - The Ultimate Finished System
const state = {
    lessons: [],
    unlockedLessons: [1, 2, 3, 4, 5],
    completedLessons: [],
    currentLesson: null,
    currentPhraseIndex: 0,
    isRecording: false,
    audioBlob: null,
    
    // User State
    userLevel: 1,
    userExp: 0,
    userEnergy: 5,
    lastEnergyUpdate: Date.now(),
    totalXp: 0,
    streak: 0,
    lastActiveDay: null,
    
    // Config
    ttsSpeed: '1.0',
    voice: 'male',
    leaderMode: 'ai',
    currentType: 'all'
};

const ui = {
    screens: {
        list: document.getElementById('screen-lessons'),
        active: document.getElementById('screen-active'),
        premium: document.getElementById('modal-premium')
    },
    hud: {
        lvl: document.getElementById('hud-lvl'),
        energy: document.getElementById('hud-energy'),
        progressBar: document.getElementById('progress-bar')
    },
    list: document.getElementById('lesson-list'),
    search: document.getElementById('lesson-search'),
    tabs: document.querySelectorAll('.tab-btn'),
    active: {
        phraseCounter: document.getElementById('current-phrase-num'),
        karaoke: document.getElementById('karaoke-text'),
        translation: document.getElementById('translation-text'),
        feedback: document.getElementById('feedback-overlay'),
        correction: document.getElementById('correction-display'),
        tip: document.getElementById('feedback-tip'),
        btnRecord: document.getElementById('btn-record'),
        btnListen: document.getElementById('btn-listen'),
        btnNext: document.getElementById('btn-next'),
        btnBack: document.getElementById('btn-back')
    },
    inputs: {
        speed: document.getElementById('select-speed'),
        voice: document.getElementById('select-voice'),
        leader: document.getElementById('select-leader')
    }
};

async function init() {
    loadState();
    try {
        const res = await fetch('lessons.json');
        state.lessons = await res.json();
        renderLessons();
    } catch (e) { console.error("Init failed", e); }
    
    setInterval(energyLoop, 1000);
    updateHUD();
    bindEvents();
}

function loadState() {
    const saved = localStorage.getItem('ep_master_save');
    if (saved) {
        Object.assign(state, JSON.parse(saved));
    } else {
        // Initial setup: Unlock all 220 lessons for first-time use
        state.unlockedLessons = Array.from({length: 220}, (_, i) => i + 1);
        saveState();
    }
}

function saveState() {
    const toSave = { ...state };
    delete toSave.lessons;
    localStorage.setItem('ep_master_save', JSON.stringify(toSave));
}

function energyLoop() {
    if (state.userEnergy >= 5) return;
    const now = Date.now();
    if (now - state.lastEnergyUpdate >= 600000) { // 10 mins per energy
        state.userEnergy++;
        state.lastEnergyUpdate = now;
        updateHUD();
        saveState();
    }
}

function updateHUD() {
    if (ui.hud.lvl) ui.hud.lvl.textContent = state.userLevel;
    if (ui.hud.energy) ui.hud.energy.textContent = state.userEnergy;
    saveState();
}

function bindEvents() {
    ui.active.btnBack.onclick = () => switchScreen('list');
    ui.active.btnRecord.onclick = handleRecord;
    ui.active.btnListen.onclick = () => {
        const p = state.currentLesson.phrases[state.currentPhraseIndex];
        playTTS(p.en);
    };
    ui.active.btnNext.onclick = nextPhrase;
    
    ui.tabs.forEach(btn => {
        btn.onclick = () => {
            ui.tabs.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.currentType = btn.dataset.type;
            renderLessons();
        };
    });

    if (ui.inputs.speed) ui.inputs.speed.onchange = (e) => state.ttsSpeed = e.target.value;
    if (ui.inputs.voice) ui.inputs.voice.onchange = (e) => state.voice = e.target.value;
    if (ui.inputs.leader) ui.inputs.leader.onchange = (e) => state.leaderMode = e.target.value;
    
    if (ui.search) ui.search.oninput = () => renderLessons();
}

function renderLessons() {
    let filtered = state.lessons;
    if (state.currentType !== 'all') filtered = filtered.filter(l => l.type === state.currentType);
    const query = ui.search?.value.toLowerCase();
    if (query) filtered = filtered.filter(l => l.topic.toLowerCase().includes(query));

    ui.list.innerHTML = filtered.map(l => {
        const isLocked = !state.unlockedLessons.includes(l.id);
        const isDone = state.completedLessons.includes(l.id);
        return `
            <div class="topic-card ${isLocked ? 'locked' : ''}" onclick="${isLocked ? 'showPremium()' : `startLesson(${l.id})`}">
                <div class="topic-icon">${isDone ? '✅' : l.icon}</div>
                <div class="topic-info">
                    <div class="topic-type-tag">${l.type.toUpperCase()}</div>
                    <h4>${l.topic} ${isLocked ? '🔒' : ''}</h4>
                    <p>50 Phrases Mastery</p>
                </div>
            </div>
        `;
    }).join('');
}

function showPremium() {
    ui.screens.premium.classList.remove('hidden');
}

function startLesson(id) {
    if (state.userEnergy < 1) { alert("Need energy!"); return; }
    state.currentLesson = state.lessons.find(l => l.id === id);
    state.currentPhraseIndex = 0;
    state.userEnergy--;
    state.lastEnergyUpdate = Date.now();
    updateHUD();
    switchScreen('active');
    renderPhrase();
}

function renderPhrase() {
    const p = state.currentLesson.phrases[state.currentPhraseIndex];
    ui.active.phraseCounter.textContent = state.currentPhraseIndex + 1;
    ui.hud.progressBar.style.width = `${((state.currentPhraseIndex + 1) / 50) * 100}%`;
    
    if (state.currentLesson.type === 'challenge') {
        ui.active.karaoke.innerHTML = `<div class="mission-box">🎯 MISSION: ${p.mission}</div>`;
        ui.active.translation.textContent = p.context;
    } else {
        ui.active.karaoke.innerHTML = p.en.split(' ').map(w => `<span class="word">${w}</span>`).join(' ');
        ui.active.translation.textContent = p.my;
        playTTS(p.en);
    }
    
    ui.active.feedback.classList.add('hidden');
    ui.active.btnNext.classList.add('hidden');
    ui.active.btnRecord.classList.remove('hidden');
}

function nextPhrase() {
    gainExp(10);
    state.currentPhraseIndex++;
    if (state.currentPhraseIndex >= 50) {
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
        if (!state.completedLessons.includes(state.currentLesson.id)) {
            state.completedLessons.push(state.currentLesson.id);
            state.unlockedLessons.push(state.currentLesson.id + 1);
        }
        alert("Lesson Complete!");
        switchScreen('list');
        renderLessons();
    } else {
        renderPhrase();
    }
}

function gainExp(amt) {
    state.userExp += amt;
    state.totalXp += amt;
    const nextLevel = state.userLevel * 200;
    if (state.userExp >= nextLevel) {
        state.userLevel++;
        state.userExp = 0;
        alert("Level Up! Level " + state.userLevel);
    }
    updateHUD();
}

async function handleRecord() {
    if (state.isRecording) { mediaRecorder.stop(); return; }
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        const audioChunks = [];
        state.isRecording = true;
        ui.active.btnRecord.classList.add('recording');
        
        mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
        mediaRecorder.onstop = async () => {
            state.isRecording = false;
            ui.active.btnRecord.classList.remove('recording');
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            const formData = new FormData();
            formData.append('audio', audioBlob);
            
            const p = state.currentLesson.phrases[state.currentPhraseIndex];
            if (state.currentLesson.type === 'challenge') {
                formData.append('scenario', p.mission);
                formData.append('history', '[]');
                const res = await fetch('/api/chat', { method: 'POST', body: formData });
                showChallengeFeedback(await res.json());
            } else {
                formData.append('originalText', p.en);
                const res = await fetch('/api/score', { method: 'POST', body: formData });
                showFeedback(await res.json());
            }
        };
        mediaRecorder.start();
    } catch (e) { alert("Mic error"); }
}

function showFeedback(data) {
    ui.active.feedback.className = `feedback-overlay ${data.passed ? 'correct' : 'wrong'}`;
    ui.active.feedback.classList.remove('hidden');
    ui.active.correction.innerHTML = data.corrections || (data.passed ? "Perfect!" : "Try again");
    ui.active.tip.textContent = data.feedback;
    if (data.passed) {
        ui.active.btnNext.classList.remove('hidden');
        ui.active.btnRecord.classList.add('hidden');
    }
}

function showChallengeFeedback(data) {
    const passed = data.score > 60;
    ui.active.feedback.className = `feedback-overlay ${passed ? 'correct' : 'wrong'}`;
    ui.active.feedback.classList.remove('hidden');
    ui.active.correction.innerHTML = `<div>${data.userText}</div>`;
    ui.active.tip.textContent = data.feedback;
    if (passed) {
        ui.active.btnNext.classList.remove('hidden');
        ui.active.btnRecord.classList.add('hidden');
    }
}

async function playTTS(text) {
    const res = await fetch('/api/tts', { 
        method: 'POST', 
        body: JSON.stringify({ text, speed: state.ttsSpeed, voice: state.voice }) 
    });
    const data = await res.json();
    const audio = new Audio("data:audio/mp3;base64," + data.audio);
    if (data.alignment && state.currentLesson.type !== 'challenge') {
        const words = ui.active.karaoke.querySelectorAll('.word');
        audio.ontimeupdate = () => {
            const cur = audio.currentTime;
            data.alignment.forEach((align, i) => {
                if (cur >= align.start && cur <= align.end) {
                    words.forEach(w => w.classList.remove('active'));
                    if (words[i]) words[i].classList.add('active');
                }
            });
        };
    }
    audio.play();
}

function switchScreen(name) {
    Object.values(ui.screens).forEach(s => s.classList.add('hidden'));
    ui.screens[name].classList.remove('hidden');
}

function closeAllModals() {
    ui.screens.premium.classList.add('hidden');
}

init();
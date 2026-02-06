
const state = {
    lessons: [],
    unlockedLessons: [1],
    completedLessons: [],
    currentLesson: null,
    currentPhraseIndex: 0,
    isRecording: false,
    audioBlob: null,
    
    // User Stats
    userLevel: 1,
    userExp: 0,
    userEnergy: 5,
    lastEnergyUpdate: Date.now(),
    totalXp: 0,
    
    // Settings
    ttsSpeed: '1.0',
    voice: 'male',
    leaderMode: 'ai',
    currentType: 'all',

    // Runtime
    startTime: Date.now()
};

const ui = {
    btnBack: document.getElementById('btn-back-main'),
    progressBar: document.getElementById('progress-bar'),
    hudEnergy: document.getElementById('hud-energy'),
    hudLvl: document.getElementById('hud-lvl'),
    lessonList: document.getElementById('lesson-list'),
    lessonSearch: document.getElementById('lesson-search'),
    tabs: document.querySelectorAll('.tab-btn'),
    screens: {
        lessons: document.getElementById('screen-lessons'),
        active: document.getElementById('screen-active'),
        premium: document.getElementById('modal-premium')
    },
    active: {
        counter: document.getElementById('current-phrase-num'),
        karaoke: document.getElementById('karaoke-text'),
        translation: document.getElementById('translation-text'),
        feedback: document.getElementById('feedback-overlay'),
        feedbackIcon: document.getElementById('feedback-icon'),
        feedbackLabel: document.getElementById('feedback-label'),
        correction: document.getElementById('correction-display'),
        tip: document.getElementById('feedback-tip'),
        btnNextStep: document.getElementById('btn-next-step'),
        btnRecord: document.getElementById('btn-record'),
        btnListen: document.getElementById('btn-listen'),
        selectSpeed: document.getElementById('select-speed'),
        selectVoice: document.getElementById('select-voice'),
        selectLeader: document.getElementById('select-leader')
    }
};

let mediaRecorder;

async function init() {
    loadState();
    try {
        const res = await fetch('lessons.json');
        state.lessons = await res.json();
        
        // Safety: If somehow unlockedLessons is empty
        if (state.unlockedLessons.length === 0) state.unlockedLessons = [1];
        
        renderLessons();
    } catch (e) {
        console.error("Failed to load lessons", e);
    }
    
    updateHUD();
    bindEvents();
    setInterval(energyLoop, 60000); // Check energy every minute
}

function loadState() {
    const saved = localStorage.getItem('errotparrot_v6_state');
    if (saved) {
        const data = JSON.parse(saved);
        Object.assign(state, data);
    }
}

function saveState() {
    const toSave = { ...state };
    delete toSave.lessons; // Don't save 11,000 phrases to localStorage
    localStorage.setItem('errotparrot_v6_state', JSON.stringify(toSave));
}

function updateHUD() {
    ui.hudEnergy.textContent = state.userEnergy;
    ui.hudLvl.textContent = state.userLevel;
    
    // Progress bar logic: if in lesson, show lesson progress, otherwise show XP progress
    if (state.currentLesson) {
        const progress = (state.currentPhraseIndex / 50) * 100;
        ui.progressBar.style.width = `${progress}%`;
    } else {
        const xpProgress = (state.userExp / (state.userLevel * 200)) * 100;
        ui.progressBar.style.width = `${xpProgress}%`;
    }
}

function energyLoop() {
    if (state.userEnergy < 5) {
        const now = Date.now();
        const elapsed = now - state.lastEnergyUpdate;
        const gain = Math.floor(elapsed / 600000); // 10 mins per energy
        if (gain > 0) {
            state.userEnergy = Math.min(5, state.userEnergy + gain);
            state.lastEnergyUpdate = now;
            updateHUD();
            saveState();
        }
    }
}

function bindEvents() {
    ui.btnBack.onclick = () => switchScreen('lessons');
    
    ui.lessonSearch.oninput = () => renderLessons();
    
    ui.tabs.forEach(tab => {
        tab.onclick = () => {
            ui.tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            state.currentType = tab.dataset.type;
            renderLessons();
        };
    });

    ui.active.btnRecord.onclick = handleRecord;
    ui.active.btnListen.onclick = () => {
        const phrase = state.currentLesson.phrases[state.currentPhraseIndex];
        if (phrase.en) playTTS(phrase.en);
    };
    ui.active.btnNextStep.onclick = nextPhrase;

    ui.active.selectSpeed.onchange = (e) => state.ttsSpeed = e.target.value;
    ui.active.selectVoice.onchange = (e) => state.voice = e.target.value;
    ui.active.selectLeader.onchange = (e) => state.leaderMode = e.target.value;
}

function renderLessons() {
    let filtered = state.lessons;
    if (state.currentType !== 'all') {
        filtered = filtered.filter(l => l.type === state.currentType);
    }
    
    const query = ui.lessonSearch.value.toLowerCase();
    if (query) {
        filtered = filtered.filter(l => l.topic.toLowerCase().includes(query));
    }

    ui.lessonList.innerHTML = filtered.map(l => {
        const isLocked = !state.unlockedLessons.includes(l.id);
        const isCompleted = state.completedLessons.includes(l.id);
        
        return `
            <div class="topic-card ${isLocked ? 'locked' : ''}" onclick="startLesson(${l.id})">
                <div class="topic-icon">${isCompleted ? '✅' : l.icon}</div>
                <div class="topic-info">
                    <div class="topic-type-tag">${l.type}</div>
                    <h4>${l.topic}</h4>
                    <p>${isLocked ? 'Locked' : '50 Mastery Phrases'}</p>
                </div>
            </div>
        `;
    }).join('');
}

function startLesson(id) {
    if (!state.unlockedLessons.includes(id)) {
        ui.screens.premium.classList.remove('hidden');
        return;
    }
    
    if (state.userEnergy < 1) {
        ui.screens.premium.classList.remove('hidden');
        return;
    }

    state.currentLesson = state.lessons.find(l => l.id === id);
    state.currentPhraseIndex = 0;
    state.startTime = Date.now();
    
    state.userEnergy--;
    state.lastEnergyUpdate = Date.now();
    
    switchScreen('active');
    renderPhrase();
    updateHUD();
}

function renderPhrase() {
    const p = state.currentLesson.phrases[state.currentPhraseIndex];
    ui.active.counter.textContent = state.currentPhraseIndex + 1;
    
    if (state.currentLesson.type === 'challenge') {
        ui.active.karaoke.innerHTML = `<div class="mission-box">${p.mission}</div>`;
        ui.active.translation.textContent = p.context;
    } else {
        ui.active.karaoke.innerHTML = p.en.split(' ').map(w => `<span class="word">${w}</span>`).join(' ');
        ui.active.translation.textContent = p.my;
        playTTS(p.en);
    }

    ui.active.feedback.classList.add('hidden');
    ui.active.btnNextStep.classList.add('hidden');
    ui.active.btnRecord.classList.remove('hidden');
    updateHUD();
}

async function handleRecord() {
    if (state.isRecording) {
        mediaRecorder.stop();
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        const chunks = [];

        state.isRecording = true;
        ui.active.btnRecord.classList.add('recording');
        ui.active.btnRecord.textContent = "Stop";

        mediaRecorder.ondataavailable = e => chunks.push(e.data);
        mediaRecorder.onstop = async () => {
            state.isRecording = false;
            ui.active.btnRecord.classList.remove('recording');
            ui.active.btnRecord.textContent = "Recording...";
            
            const audioBlob = new Blob(chunks, { type: 'audio/webm' });
            const formData = new FormData();
            formData.append('audio', audioBlob);
            
            const phrase = state.currentLesson.phrases[state.currentPhraseIndex];
            
            try {
                if (state.currentLesson.type === 'challenge') {
                    formData.append('scenario', phrase.mission);
                    formData.append('history', JSON.stringify([]));
                    formData.append('leaderMode', state.leaderMode);
                    formData.append('startTime', state.startTime);
                    formData.append('duration', "30"); // 30 mins session
                    
                    const res = await fetch('/api/chat', { method: 'POST', body: formData });
                    const data = await res.json();
                    showChallengeFeedback(data);
                } else {
                    formData.append('originalText', phrase.en);
                    const res = await fetch('/api/score', { method: 'POST', body: formData });
                    const data = await res.json();
                    showPhraseFeedback(data);
                }
            } catch (e) {
                alert("Evaluation failed. Check connection.");
                ui.active.btnRecord.textContent = "🎤 Record";
            }
        };

        mediaRecorder.start();
    } catch (e) {
        alert("Microphone access denied.");
    }
}

function showPhraseFeedback(data) {
    const isPassed = data.passed || data.score > 70;
    
    ui.active.feedback.className = `feedback-overlay ${isPassed ? 'correct' : 'wrong'}`;
    ui.active.feedbackIcon.textContent = isPassed ? "✅" : "❌";
    ui.active.feedbackLabel.textContent = isPassed ? "Excellent!" : "Not quite...";
    ui.active.correction.innerHTML = data.corrections || data.transcript;
    ui.active.tip.textContent = data.feedback;
    
    ui.active.feedback.classList.remove('hidden');
    ui.active.btnRecord.textContent = "🎤 Record";
    
    if (isPassed) {
        ui.active.btnNextStep.classList.remove('hidden');
        ui.active.btnRecord.classList.add('hidden');
    }
}

function showChallengeFeedback(data) {
    const isPassed = data.score > 60;
    
    ui.active.feedback.className = `feedback-overlay ${isPassed ? 'correct' : 'wrong'}`;
    ui.active.feedbackIcon.textContent = isPassed ? "🎯" : "⚠️";
    ui.active.feedbackLabel.textContent = isPassed ? "Mission Success!" : "Keep trying";
    ui.active.correction.innerHTML = `"${data.userText}"`;
    ui.active.tip.textContent = data.feedback;
    
    ui.active.feedback.classList.remove('hidden');
    ui.active.btnRecord.textContent = "🎤 Record";

    if (isPassed) {
        ui.active.btnNextStep.classList.remove('hidden');
        ui.active.btnRecord.classList.add('hidden');
    }
}

function nextPhrase() {
    gainExp(15);
    state.currentPhraseIndex++;
    
    if (state.currentPhraseIndex >= 50) {
        completeLesson();
    } else {
        renderPhrase();
    }
}

function completeLesson() {
    confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 }
    });

    if (!state.completedLessons.includes(state.currentLesson.id)) {
        state.completedLessons.push(state.currentLesson.id);
        const nextId = state.currentLesson.id + 1;
        if (!state.unlockedLessons.includes(nextId)) {
            state.unlockedLessons.push(nextId);
        }
    }

    alert("Lesson Completed! +100 XP");
    gainExp(100);
    switchScreen('lessons');
    renderLessons();
    saveState();
}

function gainExp(amt) {
    state.userExp += amt;
    state.totalXp += amt;
    const threshold = state.userLevel * 200;
    if (state.userExp >= threshold) {
        state.userLevel++;
        state.userExp -= threshold;
        alert(`LEVEL UP! You are now Level ${state.userLevel}`);
    }
    updateHUD();
    saveState();
}

async function playTTS(text) {
    try {
        const res = await fetch('/api/tts', {
            method: 'POST',
            body: JSON.stringify({ 
                text, 
                speed: state.ttsSpeed, 
                voice: state.voice 
            })
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
    } catch (e) {
        console.error("TTS failed", e);
    }
}

function switchScreen(name) {
    Object.values(ui.screens).forEach(s => s.classList.add('hidden'));
    ui.screens[name].classList.remove('hidden');
    
    if (name === 'lessons') {
        state.currentLesson = null;
        ui.btnBack.classList.add('hidden');
    } else {
        ui.btnBack.classList.remove('hidden');
    }
    updateHUD();
}

function closeAllModals() {
    Object.values(ui.screens).forEach(s => {
        if (s.id.startsWith('modal')) s.classList.add('hidden');
    });
}

init();

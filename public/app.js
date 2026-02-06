const state = {
    lessons: [],
    unlockedLessons: [1, 2, 3, 4, 5],
    completedLessons: [],
    currentLesson: null,
    currentPhraseIndex: 0,
    isRecording: false,
    audioBlob: null,
    isPremium: false,
    
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

let ui = {};
let mediaRecorder;

document.addEventListener('DOMContentLoaded', () => {
    // Initialize UI references safely
    ui = {
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
            energy: document.getElementById('modal-energy'),
            ad: document.getElementById('modal-ad'),
            adrian: document.getElementById('modal-adrian')
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
        },
        btnWatchAd: document.getElementById('btn-watch-ad'),
        inputRedeem: document.getElementById('input-redeem'),
        btnRedeem: document.getElementById('btn-redeem')
    };

    // Ensure everything is hidden initially
    closeAllModals();
    switchScreen('lessons');
    
    init();
});

async function init() {
    loadState();
    
    try {
        const res = await fetch('lessons.json');
        state.lessons = await res.json();
        renderLessons();
    } catch (e) {
        console.error("Failed to load lessons", e);
    }
    
    updateHUD();
    bindEvents();
    setInterval(energyLoop, 60000);
}

function loadState() {
    const saved = localStorage.getItem('errorparrot_master_v1');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            const persistentKeys = ['unlockedLessons', 'completedLessons', 'isPremium', 'userLevel', 'userExp', 'userEnergy', 'lastEnergyUpdate', 'totalXp', 'ttsSpeed', 'voice', 'leaderMode'];
            persistentKeys.forEach(key => {
                if (data[key] !== undefined) state[key] = data[key];
            });
        } catch(e) { console.error("Load state failed", e); }
    }
    // Enforce defaults if missing/corrupt
    if (!state.unlockedLessons || state.unlockedLessons.length === 0) {
        state.unlockedLessons = [1, 2, 3, 4, 5];
    }
    if (typeof state.isPremium !== 'boolean') state.isPremium = false;
    
    saveState();
}

function saveState() {
    const toSave = { ...state };
    delete toSave.lessons;
    delete toSave.currentLesson;
    delete toSave.isRecording;
    delete toSave.audioBlob;
    localStorage.setItem('errorparrot_master_v1', JSON.stringify(toSave));
}

function updateHUD() {
    if (ui.hudEnergy) ui.hudEnergy.textContent = state.userEnergy;
    if (ui.hudLvl) ui.hudLvl.textContent = state.userLevel;
    
    if (ui.progressBar) {
        if (state.currentLesson) {
            const progress = (state.currentPhraseIndex / 50) * 100;
            ui.progressBar.style.width = `${progress}%`;
        } else {
            const threshold = state.userLevel * 200;
            const xpProgress = (state.userExp / threshold) * 100;
            ui.progressBar.style.width = `${xpProgress}%`;
        }
    }
}

function energyLoop() {
    if (state.userEnergy < 5) {
        const now = Date.now();
        const elapsed = now - state.lastEnergyUpdate;
        const gain = Math.floor(elapsed / 600000);
        if (gain > 0) {
            state.userEnergy = Math.min(5, state.userEnergy + gain);
            state.lastEnergyUpdate = now;
            updateHUD();
            saveState();
        }
    }
}

function bindEvents() {
    if (ui.btnBack) ui.btnBack.onclick = () => switchScreen('lessons');
    if (ui.lessonSearch) ui.lessonSearch.oninput = () => renderLessons();
    
    if (ui.tabs) ui.tabs.forEach(tab => {
        tab.onclick = () => {
            ui.tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            state.currentType = tab.dataset.type;
            renderLessons();
        };
    });

    if (ui.active.btnRecord) ui.active.btnRecord.onclick = handleRecord;
    if (ui.active.btnListen) ui.active.btnListen.onclick = () => {
        const phrase = state.currentLesson?.phrases[state.currentPhraseIndex];
        if (phrase?.en) playTTS(phrase.en);
    };
    if (ui.active.btnNextStep) ui.active.btnNextStep.onclick = nextPhrase;

    if (ui.active.selectSpeed) ui.active.selectSpeed.onchange = (e) => state.ttsSpeed = e.target.value;
    if (ui.active.selectVoice) ui.active.selectVoice.onchange = (e) => state.voice = e.target.value;
    if (ui.active.selectLeader) ui.active.selectLeader.onchange = (e) => state.leaderMode = e.target.value;

    if (ui.btnWatchAd) ui.btnWatchAd.onclick = simulateAd;
    if (ui.btnRedeem) ui.btnRedeem.onclick = handleRedeem;
}

async function handleRedeem() {
    if (!ui.inputRedeem) return;
    const code = ui.inputRedeem.value.trim();
    if (!code) return;
    
    try {
        const res = await fetch('/api/admin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'redeem', code })
        });
        const data = await res.json();
        if (data.success) {
            state.isPremium = true;
            alert("Premium features successfully activated!");
            ui.inputRedeem.value = '';
            closeAllModals();
            renderLessons();
            saveState();
        } else {
            alert(data.error || "Invalid code");
        }
    } catch (e) {
        alert("Service unavailable");
    }
}

function renderLessons() {
    if (!ui.lessonList) return;
    
    let filtered = state.lessons || [];
    if (state.currentType !== 'all') {
        filtered = filtered.filter(l => l.type === state.currentType);
    }
    
    if (ui.lessonSearch) {
        const query = ui.lessonSearch.value.toLowerCase();
        if (query) {
            filtered = filtered.filter(l => l.topic.toLowerCase().includes(query));
        }
    }

    ui.lessonList.innerHTML = filtered.map(l => {
        const isCompleted = state.completedLessons.includes(l.id);
        const isAdrian = l.topic.toLowerCase().includes("adrian") || l.topic.toLowerCase().includes("teacher");
        const isLocked = !state.unlockedLessons.includes(l.id) && !state.isPremium;
        
        let statusText = '50 Mastery Phrases';
        if (isAdrian && !state.isPremium) statusText = 'Premium Activation Required ⭐';
        else if (isLocked) statusText = 'Unlock with 5s Ad';

        return `
            <div class="topic-card ${isLocked || (isAdrian && !state.isPremium) ? 'locked' : ''}" onclick="startLesson(${l.id})">
                <div class="topic-icon">${isCompleted ? '✅' : l.icon}</div>
                <div class="topic-info">
                    <div class="topic-type-tag">${l.type} ${isAdrian ? '⭐' : ''}</div>
                    <h4>${l.topic}</h4>
                    <p>${statusText}</p>
                </div>
            </div>
        `;
    }).join('');
}

function startLesson(id) {
    const lesson = state.lessons.find(l => l.id === id);
    if (!lesson) return;

    const isAdrian = lesson.topic.toLowerCase().includes("adrian") || lesson.topic.toLowerCase().includes("teacher");

    // Adrian Check
    if (isAdrian && !state.isPremium) {
        if (ui.screens.adrian) {
            ui.screens.adrian.classList.remove('hidden');
            ui.screens.adrian.style.display = 'flex'; // Force show
        }
        return;
    }

    // Ad Check for lessons > 5
    if (id > 5 && !state.unlockedLessons.includes(id) && !state.isPremium) {
        state.pendingLessonId = id;
        if (ui.screens.ad) {
            ui.screens.ad.classList.remove('hidden');
            ui.screens.ad.style.display = 'flex'; // Force show
        }
        return;
    }
    
    // Energy Check
    if (state.userEnergy < 1) {
        if (ui.screens.energy) {
            ui.screens.energy.classList.remove('hidden');
            ui.screens.energy.style.display = 'flex'; // Force show
        }
        return;
    }

    state.currentLesson = lesson;
    state.currentPhraseIndex = 0;
    state.startTime = Date.now();
    
    state.userEnergy--;
    state.lastEnergyUpdate = Date.now();
    
    switchScreen('active');
    renderPhrase();
    updateHUD();
}

function simulateAd() {
    if (!ui.btnWatchAd) return;
    ui.btnWatchAd.disabled = true;
    let count = 5;
    const timer = setInterval(() => {
        ui.btnWatchAd.textContent = `Unlocking in ${count}s...`;
        count--;
        if (count < 0) {
            clearInterval(timer);
            if (!state.unlockedLessons.includes(state.pendingLessonId)) {
                state.unlockedLessons.push(state.pendingLessonId);
            }
            ui.btnWatchAd.disabled = false;
            ui.btnWatchAd.textContent = "Watch Ad (5s)";
            closeAllModals();
            startLesson(state.pendingLessonId);
            renderLessons();
            saveState();
        }
    }, 1000);
}

function renderPhrase() {
    const p = state.currentLesson.phrases[state.currentPhraseIndex];
    if (ui.active.counter) ui.active.counter.textContent = state.currentPhraseIndex + 1;
    
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
        if (mediaRecorder) mediaRecorder.stop();
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
            ui.active.btnRecord.textContent = "Analyzing...";
            
            const audioBlob = new Blob(chunks, { type: 'audio/webm' });
            const formData = new FormData();
            formData.append('audio', audioBlob);
            
            const phrase = state.currentLesson.phrases[state.currentPhraseIndex];
            
            try {
                if (state.currentLesson.type === 'challenge') {
                    formData.append('scenario', phrase.mission);
                    formData.append('history', JSON.stringify([]));
                    formData.append('userRole', 'Student');
                    formData.append('aiRole', 'Teacher Adrian');
                    formData.append('leaderMode', state.leaderMode);
                    formData.append('startTime', state.startTime);
                    formData.append('duration', "30");
                    
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
                alert("Connection error.");
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
    ui.active.feedbackLabel.textContent = isPassed ? "Excellent!" : "Try Again";
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
    ui.active.feedbackLabel.textContent = isPassed ? "Success!" : "Keep Talking";
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
    confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
    if (!state.completedLessons.includes(state.currentLesson.id)) {
        state.completedLessons.push(state.currentLesson.id);
    }
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
    }
    updateHUD();
    saveState();
}

async function playTTS(text) {
    try {
        const res = await fetch('/api/tts', {
            method: 'POST',
            body: JSON.stringify({ text, speed: state.ttsSpeed, voice: state.voice })
        });
        const data = await res.json();
        const audio = new Audio("data:audio/mp3;base64," + data.audio);
        if (data.alignment && state.currentLesson?.type !== 'challenge') {
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
    } catch (e) {}
}

function switchScreen(name) {
    Object.values(ui.screens).forEach(s => {
        if (s) s.classList.add('hidden');
    });
    if (ui.screens[name]) ui.screens[name].classList.remove('hidden');
    
    if (name === 'lessons') {
        state.currentLesson = null;
        if (ui.btnBack) ui.btnBack.classList.add('hidden');
    } else {
        if (ui.btnBack) ui.btnBack.classList.remove('hidden');
    }
    updateHUD();
}

function closeAllModals() {
    if (ui.screens.energy) {
        ui.screens.energy.classList.add('hidden');
        ui.screens.energy.style.display = 'none'; // Ensure hidden
    }
    if (ui.screens.ad) {
        ui.screens.ad.classList.add('hidden');
        ui.screens.ad.style.display = 'none';
    }
    if (ui.screens.adrian) {
        ui.screens.adrian.classList.add('hidden');
        ui.screens.adrian.style.display = 'none';
    }
}

window.closeAllModals = closeAllModals;
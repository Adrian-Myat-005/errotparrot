
const state = {
    lessons: [],
    unlockedLessons: [1, 2, 3, 4, 5],
    completedLessons: [],
    lessonProgress: {},
    savedPhrases: [],
    currentLesson: null,
    currentPhraseIndex: 0,
    isRecording: false,
    audioBlob: null,
    audioUrl: null,
    isPremium: false,
    lastLessonId: null,
    chatHistory: [],
    
    userLevel: 1,
    userExp: 0,
    userEnergy: 50,
    lastRefillDate: null,
    totalXp: 0,
    streak: 0,
    lastActiveDay: null,
    
    ttsSpeed: '1.0',
    voice: 'male',
    leaderMode: 'ai',
    sessionDuration: '5',
    currentType: 'all',
    startTime: Date.now()
};

let ui = {};
let mediaRecorder;

function closeAllModals() {
    ['modal-energy', 'modal-ad', 'modal-adrian'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.classList.add('hidden'); el.style.display = 'none'; }
    });
}

function switchScreen(name) {
    // Force hide all screens first
    const screens = ['screen-lessons', 'screen-active'];
    screens.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.add('hidden');
            el.style.display = 'none';
        }
    });

    // Force show target screen
    const target = document.getElementById('screen-' + name);
    if (target) {
        target.classList.remove('hidden');
        target.style.display = 'flex'; // Critical fix
    }
    
    const backBtn = document.getElementById('btn-back-main');
    if (backBtn) {
        if (name === 'lessons') backBtn.classList.add('hidden');
        else backBtn.classList.remove('hidden');
    }

    if (name === 'lessons') {
        state.currentLesson = null;
        renderDashboard();
        renderLessons();
    }
}

async function init() {
    // 1. Map UI Elements IMMEDIATELY
    ui = {
        progressBar: document.getElementById('progress-bar'),
        hudEnergy: document.getElementById('hud-energy'),
        hudLvl: document.getElementById('hud-lvl'),
        lessonList: document.getElementById('lesson-list'),
        lessonSearch: document.getElementById('lesson-search'),
        tabs: document.querySelectorAll('.tab-btn'),
        dashboard: {
            streak: document.getElementById('stat-streak'),
            xp: document.getElementById('stat-xp'),
            done: document.getElementById('stat-done'),
            btnResume: document.getElementById('btn-resume'),
            btnShowActivation: document.getElementById('btn-show-activation')
        },
        active: {
            counter: document.getElementById('current-phrase-num'),
            grammarNote: document.getElementById('grammar-note'),
            karaoke: document.getElementById('karaoke-text'),
            translation: document.getElementById('translation-text'),
            chatHistory: document.getElementById('chat-history'),
            feedback: document.getElementById('feedback-overlay'),
            feedbackIcon: document.getElementById('feedback-icon'),
            feedbackLabel: document.getElementById('feedback-label'),
            correction: document.getElementById('correction-display'),
            tip: document.getElementById('feedback-tip'),
            btnRelisten: document.getElementById('btn-relisten'),
            btnNextStep: document.getElementById('btn-next-step'),
            btnRetryStep: document.getElementById('btn-retry-step'),
            btnRecord: document.getElementById('btn-record'),
            btnListen: document.getElementById('btn-listen'),
            btnSavePhrase: document.getElementById('btn-save-phrase'),
            selectSpeed: document.getElementById('select-speed'),
            selectVoice: document.getElementById('select-voice'),
            selectLeader: document.getElementById('select-leader'),
            selectDuration: document.getElementById('select-duration')
        },
        btnWatchAd: document.getElementById('btn-watch-ad'),
        inputRedeem: document.getElementById('input-redeem'),
        btnRedeem: document.getElementById('btn-redeem')
    };

    // 2. Force Visibility
    if (ui.lessonList) ui.lessonList.innerHTML = '<div style="padding:40px; text-align:center; color:#888;">Loading content...</div>';
    closeAllModals();
    switchScreen('lessons');

    // 3. Load Data
    loadState();
    checkDailyRefill();
    updateStreak();

    try {
        const res = await fetch('lessons.json?v=' + Date.now());
        if (!res.ok) throw new Error("Fetch failed");
        state.lessons = await res.json();
        renderLessons();
        renderDashboard();
    } catch (e) {
        console.error("Critical Error", e);
        if (ui.lessonList) ui.lessonList.innerHTML = `<div style="padding:20px; color:red; text-align:center;">Failed to load. <button onclick="location.reload()">Retry</button></div>`;
    }
    
    updateHUD();
    bindEvents();
    setInterval(energyLoop, 60000);
}

function loadState() {
    try {
        const saved = localStorage.getItem('errorparrot_master_v1');
        if (saved) {
            const data = JSON.parse(saved);
            Object.keys(data).forEach(k => { if (state[k] !== undefined) state[k] = data[k]; });
        }
    } catch(e) {}
    if (!state.unlockedLessons || state.unlockedLessons.length === 0) state.unlockedLessons = [1, 2, 3, 4, 5];
    if (typeof state.isPremium !== 'boolean') state.isPremium = false;
    if (!state.lessonProgress) state.lessonProgress = {};
    if (!state.savedPhrases) state.savedPhrases = [];
}

function saveState() {
    const toSave = { ...state };
    delete toSave.lessons;
    delete toSave.currentLesson;
    delete toSave.isRecording;
    delete toSave.audioBlob;
    delete toSave.audioUrl;
    delete toSave.chatHistory;
    localStorage.setItem('errorparrot_master_v1', JSON.stringify(toSave));
}

function checkDailyRefill() {
    const today = new Date().toDateString();
    if (state.lastRefillDate !== today) {
        state.userEnergy = 50;
        state.lastRefillDate = today;
        saveState();
    }
}

function updateStreak() {
    const now = new Date();
    const today = now.toDateString();
    if (state.lastActiveDay !== today) {
        if (state.lastActiveDay) {
            const lastDate = new Date(state.lastActiveDay);
            const diff = (now - lastDate) / (1000 * 60 * 60 * 24);
            if (diff > 1.5) state.streak = 0;
        }
        state.streak++;
        state.lastActiveDay = today;
        saveState();
    }
}

function renderDashboard() {
    if (ui.dashboard.streak) ui.dashboard.streak.textContent = state.streak;
    if (ui.dashboard.xp) ui.dashboard.xp.textContent = formatNum(state.totalXp);
    if (ui.dashboard.done) ui.dashboard.done.textContent = state.completedLessons.length;
}

function formatNum(n) {
    if (n >= 1000) return (n/1000).toFixed(1) + 'k';
    return n;
}

function updateHUD() {
    if (ui.hudEnergy) ui.hudEnergy.textContent = state.userEnergy;
    if (ui.hudLvl) ui.hudLvl.textContent = state.userLevel;
    if (ui.progressBar) {
        let p = state.currentLesson ? (state.currentPhraseIndex / 50) * 100 : (state.userExp / (state.userLevel * 200)) * 100;
        ui.progressBar.style.width = Math.min(100, p) + '%';
    }
}

function energyLoop() {
    if (state.userEnergy < 50) {
        const now = Date.now();
        const elapsed = now - state.lastEnergyUpdate;
        const gain = Math.floor(elapsed / 600000);
        if (gain > 0) {
            state.userEnergy = Math.min(50, state.userEnergy + gain);
            state.lastEnergyUpdate = now;
            updateHUD();
            saveState();
        }
    }
}

function bindEvents() {
    const backBtn = document.getElementById('btn-back-main');
    if (backBtn) backBtn.onclick = () => switchScreen('lessons');
    if (ui.dashboard.btnResume) ui.dashboard.btnResume.onclick = resumeLearning;
    if (ui.dashboard.btnShowActivation) ui.dashboard.btnShowActivation.onclick = () => {
        const el = document.getElementById('modal-adrian');
        if (el) { el.classList.remove('hidden'); el.style.display = 'flex'; }
    };

    if (ui.lessonSearch) ui.lessonSearch.oninput = () => renderLessons();
    
    ui.tabs.forEach(t => t.onclick = () => {
        ui.tabs.forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        state.currentType = t.dataset.type;
        renderLessons();
    });

    if (ui.active.btnRecord) ui.active.btnRecord.onclick = handleRecord;
    if (ui.active.btnListen) ui.active.btnListen.onclick = () => {
        const p = state.currentLesson?.phrases[state.currentPhraseIndex];
        if (p?.en) playTTS(p.en);
    };
    if (ui.active.btnNextStep) ui.active.btnNextStep.onclick = nextPhrase;
    if (ui.active.btnRetryStep) ui.active.btnRetryStep.onclick = () => {
        ui.active.feedback.classList.add('hidden');
        renderPhrase();
    };
    if (ui.active.btnRelisten) ui.active.btnRelisten.onclick = () => {
        if (state.audioUrl) (new Audio(state.audioUrl)).play();
    };
    if (ui.active.btnSavePhrase) ui.active.btnSavePhrase.onclick = toggleSavePhrase;
    if (ui.btnWatchAd) ui.btnWatchAd.onclick = simulateAd;
    if (ui.btnRedeem) ui.btnRedeem.onclick = handleRedeem;
    if (ui.active.selectDuration) ui.active.selectDuration.onchange = (e) => state.sessionDuration = e.target.value;
}

function toggleSavePhrase() {
    const p = state.currentLesson.phrases[state.currentPhraseIndex];
    const idx = state.savedPhrases.findIndex(x => x.en === p.en);
    if (idx > -1) {
        state.savedPhrases.splice(idx, 1);
        ui.active.btnSavePhrase.textContent = '☆';
    } else {
        state.savedPhrases.push({...p});
        ui.active.btnSavePhrase.textContent = '⭐';
    }
    saveState();
}

function resumeLearning() {
    if (state.lastLessonId) {
        const last = state.lessons.find(l => l.id === state.lastLessonId);
        if (last && !state.completedLessons.includes(last.id)) {
            startLesson(last.id);
            return;
        }
    }
    const next = state.lessons.find(l => !state.completedLessons.includes(l.id));
    if (next) startLesson(next.id);
}

async function handleRedeem() {
    const code = ui.inputRedeem.value.trim();
    if (!code) return;
    try {
        const res = await fetch('/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'redeem', code }) });
        const data = await res.json();
        if (data.success) {
            state.isPremium = true;
            alert("Unlocked! Enjoy Tr. Adrian Premium.");
            ui.inputRedeem.value = '';
            closeAllModals();
            renderLessons();
            saveState();
        } else alert(data.error || "Invalid Code");
    } catch(e) { alert("Service error"); }
}

function renderLessons() {
    if (!ui.lessonList) return;
    if (state.currentType === 'memory') { renderMemoryBank(); return; }

    let filtered = state.lessons || [];
    if (state.currentType === 'teacher') {
        filtered = filtered.filter(l => l.topic.toLowerCase().includes("adrian") || l.topic.toLowerCase().includes("teacher"));
    } else if (state.currentType !== 'all') {
        filtered = filtered.filter(l => l.type === state.currentType);
    }
    
    const query = ui.lessonSearch?.value.toLowerCase();
    if (query) filtered = filtered.filter(l => l.topic.toLowerCase().includes(query));

    let html = '';
    filtered.forEach((l, index) => {
        if (state.currentType === 'all' && index % 10 === 0) html += `<div class="unit-header">Unit ${Math.floor(l.id / 10) + 1} Path</div>`;
        const isCompleted = state.completedLessons.includes(l.id);
        const isAdrian = l.topic.toLowerCase().includes("adrian") || l.topic.toLowerCase().includes("teacher");
        const isLocked = !state.unlockedLessons.includes(l.id) && !state.isPremium;
        const progress = state.lessonProgress[l.id] || 0;
        let status = progress > 0 ? `Resume at Step ${progress+1}` : '50 Shadowing Phrases';
        if (isAdrian && !state.isPremium) status = 'Premium Required ⭐';
        else if (isLocked) status = 'Unlock with 5s Ad 📺';
        else if (isCompleted) status = 'Mastered ✅';

        html += `
            <div class="topic-card ${isAdrian ? 'premium-teacher' : ''} ${isLocked || (isAdrian && !state.isPremium) ? 'locked' : ''}" onclick="startLesson(${l.id})">
                <div class="topic-icon">${isAdrian ? '👨‍🏫' : (isCompleted ? '✅' : l.icon)}</div>
                <div class="topic-info">
                    <div class="topic-type-tag ${l.type}">${l.type} ${isAdrian ? 'PREMIUM' : ''}</div>
                    <h4>${l.topic}</h4>
                    <p>${status}</p>
                </div>
            </div>
        `;
    });
    ui.lessonList.innerHTML = html || '<div style="padding:60px; text-align:center; color:#aaa; font-weight:700;">No lessons found.</div>';
}

function renderMemoryBank() {
    if (state.savedPhrases.length === 0) {
        ui.lessonList.innerHTML = `<div style="padding:80px 40px; text-align:center;"><div style="font-size:4rem; margin-bottom:20px;">⭐</div><h3 style="color:#4b4b4b;">Memory Bank is Empty</h3></div>`;
        return;
    }
    let html = '<div class="unit-header">SAVED FOR REVIEW</div>';
    state.savedPhrases.forEach((p, i) => {
        html += `<div class="memory-item"><div class="topic-icon" onclick="playTTS('${p.en.replace(/'/g, "\\'")}')" style="background:var(--secondary); color:white; border:none; width:50px; height:50px; font-size:1.4rem;">🔊</div><div class="topic-info"><h4>${p.en}</h4><p>${p.my || ''}</p></div><div onclick="removeSavedPhrase(${i})" style="color:#ff4b4b; padding:10px; cursor:pointer;">✕</div></div>`;
    });
    ui.lessonList.innerHTML = html;
}

window.removeSavedPhrase = (i) => { state.savedPhrases.splice(i, 1); saveState(); renderMemoryBank(); };

function startLesson(id) {
    const lesson = state.lessons.find(l => l.id === id);
    if (!lesson) return;
    const isAdrian = lesson.topic.toLowerCase().includes("adrian") || lesson.topic.toLowerCase().includes("teacher");

    if (isAdrian && !state.isPremium) {
        const el = document.getElementById('modal-adrian');
        if (el) { el.classList.remove('hidden'); el.style.display = 'flex'; }
        return;
    }
    if (id > 5 && !state.unlockedLessons.includes(id) && !state.isPremium) {
        state.pendingLessonId = id;
        const el = document.getElementById('modal-ad');
        if (el) { el.classList.remove('hidden'); el.style.display = 'flex'; }
        return;
    }
    if (state.userEnergy < 1) {
        const el = document.getElementById('modal-energy');
        if (el) { el.classList.remove('hidden'); el.style.display = 'flex'; }
        return;
    }

    state.currentLesson = lesson;
    state.lastLessonId = id;
    state.currentPhraseIndex = state.lessonProgress[id] || 0;
    state.chatHistory = [];
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
        if (count-- < 0) {
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
    if (!state.currentLesson) return;
    const p = state.currentLesson.phrases[state.currentPhraseIndex];
    if (ui.active.counter) ui.active.counter.textContent = state.currentPhraseIndex + 1;
    
    ui.active.grammarNote.classList.add('hidden');
    ui.active.translation.classList.remove('hidden');
    ui.active.chatHistory.classList.add('hidden');
    
    if (state.currentLesson.type === 'grammar') {
        ui.active.grammarNote.classList.remove('hidden');
        ui.active.grammarNote.innerHTML = `<strong>Grammar Tip:</strong> ${state.currentLesson.explanation || 'Focus on correct structure.'}`;
    }
    
    if (state.currentLesson.type === 'test' || state.currentLesson.type === 'exam') {
        ui.active.karaoke.innerHTML = `<div class="mission-box">📝 ASSESSMENT<br>Listen and repeat.</div>`;
        ui.active.translation.classList.add('hidden');
    } else if (state.currentLesson.type === 'challenge') {
        ui.active.karaoke.innerHTML = `<div class="mission-box">${p.mission}</div>`;
        ui.active.translation.textContent = p.context;
        if (state.currentLesson.topic.toLowerCase().includes("adrian")) {
            ui.active.chatHistory.classList.remove('hidden');
            renderChatHistory();
        }
    } else {
        ui.active.karaoke.innerHTML = p.en.split(/\s+/).map(w => `<span class="word">${w}</span>`).join(' ');
        ui.active.translation.textContent = p.my;
        playTTS(p.en);
    }
    
    ui.active.feedback.classList.add('hidden');
    ui.active.btnNextStep.classList.add('hidden');
    ui.active.btnRetryStep.classList.add('hidden');
    ui.active.btnRecord.classList.remove('hidden');
    updateHUD();
}

function renderChatHistory() {
    if (!ui.active.chatHistory) return;
    if (state.chatHistory.length === 0) {
        ui.active.chatHistory.innerHTML = '<div style="color:#aaa; font-style:italic; padding:10px;">Start speaking to begin the conversation...</div>';
        return;
    }
    let html = '';
    state.chatHistory.forEach(msg => {
        const type = msg.role === 'assistant' ? 'teacher' : 'student';
        html += `<div class="chat-bubble ${type}">${msg.content}</div>`;
    });
    ui.active.chatHistory.innerHTML = html;
    const container = document.querySelector('.practice-main');
    if (container) container.scrollTop = container.scrollHeight;
}

async function handleRecord() {
    if (state.isRecording) { if (mediaRecorder) mediaRecorder.stop(); return; }
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        const chunks = [];
        state.isRecording = true;
        ui.active.btnRecord.classList.add('recording');
        ui.active.btnRecord.textContent = "STOP";
        mediaRecorder.ondataavailable = e => chunks.push(e.data);
        mediaRecorder.onstop = async () => {
            state.isRecording = false;
            ui.active.btnRecord.classList.remove('recording');
            ui.active.btnRecord.textContent = "RECORD";
            const blob = new Blob(chunks, { type: 'audio/webm' });
            if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
            state.audioUrl = URL.createObjectURL(blob);
            const formData = new FormData();
            formData.append('audio', blob);
            const phrase = state.currentLesson.phrases[state.currentPhraseIndex];
            const isAdrian = state.currentLesson.topic.toLowerCase().includes("adrian");

            try {
                if (state.currentLesson.type === 'challenge') {
                    formData.append('scenario', phrase.mission);
                    formData.append('history', JSON.stringify(state.chatHistory));
                    formData.append('duration', state.sessionDuration);
                    const res = await fetch('/api/chat', { method: 'POST', body: formData });
                    const data = await res.json();
                    state.chatHistory.push({ role: 'user', content: data.userText });
                    state.chatHistory.push({ role: 'assistant', content: data.aiResponse });
                    renderChatHistory();
                    playTTS(data.aiResponse);
                    showChallengeFeedback(data);
                } else {
                    formData.append('originalText', phrase.en);
                    const res = await fetch('/api/score', { method: 'POST', body: formData });
                    showPhraseFeedback(await res.json());
                }
            } catch (e) { alert("Mic or Network error"); }
        };
        mediaRecorder.start();
    } catch (e) { alert("Mic Access Denied"); }
}

function showPhraseFeedback(data) {
    const isPassed = data.score > (state.currentLesson.type === 'exam' ? 85 : 70);
    ui.active.feedback.className = `feedback-overlay ${isPassed ? 'correct' : 'wrong'}`;
    ui.active.feedbackIcon.textContent = isPassed ? "✅" : "❌";
    ui.active.feedbackLabel.textContent = isPassed ? "Excellent!" : "Not Enough";
    ui.active.correction.innerHTML = data.corrections || data.transcript;
    ui.active.tip.textContent = data.feedback;
    ui.active.feedback.classList.remove('hidden');
    if (state.currentLesson.type === 'test' || state.currentLesson.type === 'exam') {
        const p = state.currentLesson.phrases[state.currentPhraseIndex];
        ui.active.karaoke.innerHTML = p.en.split(/\s+/).map(w => `<span class="word">${w}</span>`).join(' ');
        ui.active.translation.textContent = p.my;
        ui.active.translation.classList.remove('hidden');
    }
    if (isPassed) { ui.active.btnNextStep.classList.remove('hidden'); ui.active.btnRetryStep.classList.add('hidden'); ui.active.btnRecord.classList.add('hidden'); }
    else { ui.active.btnNextStep.classList.add('hidden'); ui.active.btnRetryStep.classList.remove('hidden'); }
}

function showChallengeFeedback(data) {
    const isPassed = data.score > 60;
    ui.active.feedback.className = `feedback-overlay ${isPassed ? 'correct' : 'wrong'}`;
    ui.active.feedbackIcon.textContent = isPassed ? "🎯" : "⚠️";
    ui.active.feedbackLabel.textContent = isPassed ? "Success!" : "Not Quite";
    ui.active.correction.innerHTML = `"${data.userText}"`;
    ui.active.tip.textContent = data.feedback;
    ui.active.feedback.classList.remove('hidden');
    if (isPassed) { ui.active.btnNextStep.classList.remove('hidden'); ui.active.btnRetryStep.classList.add('hidden'); ui.active.btnRecord.classList.add('hidden'); }
    else { ui.active.btnNextStep.classList.add('hidden'); ui.active.btnRetryStep.classList.remove('hidden'); }
}

function nextPhrase() {
    gainExp(15);
    state.currentPhraseIndex++;
    state.lessonProgress[state.currentLesson.id] = state.currentPhraseIndex;
    if (state.currentPhraseIndex >= 50) {
        state.lessonProgress[state.currentLesson.id] = 0;
        completeLesson();
    } else {
        renderPhrase();
        saveState();
    }
}

function completeLesson() {
    if (typeof confetti === 'function') confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
    if (!state.completedLessons.includes(state.currentLesson.id)) state.completedLessons.push(state.currentLesson.id);
    gainExp(100);
    switchScreen('lessons');
    saveState();
}

function gainExp(amt) {
    state.userExp += amt;
    state.totalXp += amt;
    const threshold = state.userLevel * 200;
    if (state.userExp >= threshold) { state.userLevel++; state.userExp -= threshold; }
    updateHUD();
    saveState();
}

async function playTTS(text) {
    try {
        const res = await fetch('/api/tts', { method: 'POST', body: JSON.stringify({ text, speed: state.ttsSpeed, voice: state.voice }) });
        const data = await res.json();
        const audio = new Audio("data:audio/mp3;base64," + data.audio);
        if (data.alignment && state.currentLesson?.type !== 'challenge') {
            const words = ui.active.karaoke.querySelectorAll('.word');
            let lastIdx = -1;
            audio.ontimeupdate = () => {
                const cur = audio.currentTime;
                const activeIdx = data.alignment.findIndex(align => cur >= align.start && cur <= align.end);
                if (activeIdx !== lastIdx && activeIdx !== -1) {
                    words.forEach((w, i) => {
                        w.classList.remove('active');
                        if (i < activeIdx) w.classList.add('played');
                    });
                    if (words[activeIdx]) words[activeIdx].classList.add('active');
                    lastIdx = activeIdx;
                }
            };
            audio.onended = () => { words.forEach(w => { w.classList.remove('active'); w.classList.remove('played'); }); };
        }
        audio.play();
    } catch (e) {}
}

window.closeAllModals = closeAllModals;
document.addEventListener('DOMContentLoaded', init);

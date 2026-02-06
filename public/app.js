const state = {
    lessons: [],
    unlockedLessons: [1, 2, 3, 4, 5],
    completedLessons: [],
    savedPhrases: [],
    currentLesson: null,
    currentPhraseIndex: 0,
    isRecording: false,
    audioBlob: null,
    audioUrl: null,
    isPremium: false,
    
    // Stats
    userLevel: 1,
    userExp: 0,
    userEnergy: 5,
    lastEnergyUpdate: Date.now(),
    totalXp: 0,
    streak: 0,
    lastActiveDay: null,
    
    // Settings
    ttsSpeed: '1.0',
    voice: 'male',
    leaderMode: 'ai',
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
    ['screen-lessons', 'screen-active'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
    const target = document.getElementById('screen-' + name);
    if (target) target.classList.remove('hidden');
    
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

document.addEventListener('DOMContentLoaded', () => {
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
            selectLeader: document.getElementById('select-leader')
        },
        btnWatchAd: document.getElementById('btn-watch-ad'),
        inputRedeem: document.getElementById('input-redeem'),
        btnRedeem: document.getElementById('btn-redeem')
    };
    init();
});

async function init() {
    loadState();
    updateStreak();
    closeAllModals();
    switchScreen('lessons');
    
    try {
        const res = await fetch('lessons.json');
        if (!res.ok) throw new Error("Net Error");
        state.lessons = await res.json();
        renderLessons();
        renderDashboard();
    } catch (e) {
        console.error("Lessons failed", e);
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
            Object.assign(state, data);
        } catch(e) {}
    }
    if (!state.unlockedLessons || state.unlockedLessons.length === 0) state.unlockedLessons = [1, 2, 3, 4, 5];
    if (typeof state.isPremium !== 'boolean') state.isPremium = false;
    if (!state.savedPhrases) state.savedPhrases = [];
}

function saveState() {
    const toSave = { ...state };
    delete toSave.lessons;
    delete toSave.currentLesson;
    delete toSave.isRecording;
    delete toSave.audioBlob;
    delete toSave.audioUrl;
    localStorage.setItem('errorparrot_master_v1', JSON.stringify(toSave));
}

function updateStreak() {
    const now = new Date();
    const today = now.toDateString();
    if (state.lastActiveDay !== today) {
        if (state.lastActiveDay) {
            const lastDate = new Date(state.lastActiveDay);
            const diffDays = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));
            if (diffDays > 1) state.streak = 0;
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
        let p = 0;
        if (state.currentLesson) p = (state.currentPhraseIndex / 50) * 100;
        else p = (state.userExp / (state.userLevel * 200)) * 100;
        ui.progressBar.style.width = Math.min(100, p) + '%';
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
    const backBtn = document.getElementById('btn-back-main');
    if (backBtn) backBtn.onclick = () => switchScreen('lessons');
    if (ui.dashboard.btnResume) ui.dashboard.btnResume.onclick = resumeLearning;
    if (ui.dashboard.btnShowActivation) ui.dashboard.btnShowActivation.onclick = () => {
        const el = document.getElementById('modal-adrian');
        el.classList.remove('hidden'); el.style.display = 'flex';
    };

    if (ui.lessonSearch) ui.lessonSearch.oninput = () => renderLessons();
    
    ui.tabs.forEach(t => t.onclick = () => {
        ui.tabs.forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        state.currentType = t.dataset.type;
        renderLessons();
    });

    ui.active.btnRecord.onclick = handleRecord;
    ui.active.btnListen.onclick = () => {
        const p = state.currentLesson?.phrases[state.currentPhraseIndex];
        if (p?.en) playTTS(p.en);
    };
    ui.active.btnNextStep.onclick = nextPhrase;
    ui.active.btnRetryStep.onclick = () => {
        ui.active.feedback.classList.add('hidden');
        renderPhrase();
    };
    ui.active.btnRelisten.onclick = () => {
        if (state.audioUrl) {
            const audio = new Audio(state.audioUrl);
            audio.play();
        }
    };
    ui.active.btnSavePhrase.onclick = toggleSavePhrase;
    if (ui.btnWatchAd) ui.btnWatchAd.onclick = simulateAd;
    if (ui.btnRedeem) ui.btnRedeem.onclick = handleRedeem;
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
    const next = state.lessons.find(l => !state.completedLessons.includes(l.id));
    if (next) startLesson(next.id);
    else alert("Congrats! Everything is mastered.");
}

async function handleRedeem() {
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
    if (state.currentType !== 'all') filtered = filtered.filter(l => l.type === state.currentType);
    const query = ui.lessonSearch?.value.toLowerCase();
    if (query) filtered = filtered.filter(l => l.topic.toLowerCase().includes(query));

    let html = '';
    filtered.forEach((l, index) => {
        if (index % 10 === 0) html += `<div class="unit-header">Unit ${Math.floor(l.id / 10) + 1} Path</div>`;
        
        const isCompleted = state.completedLessons.includes(l.id);
        const isAdrian = l.topic.toLowerCase().includes("adrian") || l.topic.toLowerCase().includes("teacher");
        const isLocked = !state.unlockedLessons.includes(l.id) && !state.isPremium;
        
        let status = '50 Shadowing Phrases';
        if (isAdrian && !state.isPremium) status = 'Premium Activation Required ⭐';
        else if (isLocked) status = 'Watch 5s Ad to Unlock 📺';
        else if (isCompleted) status = 'Mastered - Keep it up! ✅';

        html += `
            <div class="topic-card ${isLocked || (isAdrian && !state.isPremium) ? 'locked' : ''}" onclick="startLesson(${l.id})">
                <div class="topic-icon">${isCompleted ? '✅' : l.icon}</div>
                <div class="topic-info">
                    <div class="topic-type-tag ${l.type}">${l.type}</div>
                    <h4>${l.topic}</h4>
                    <p>${status}</p>
                </div>
            </div>
        `;
    });
    ui.lessonList.innerHTML = html || '<div style="padding:60px; text-align:center; color:#aaa; font-weight:700;">No lessons found in this section.</div>';
}

function renderMemoryBank() {
    if (state.savedPhrases.length === 0) {
        ui.lessonList.innerHTML = `
            <div style="padding:80px 40px; text-align:center;">
                <div style="font-size:4rem; margin-bottom:20px;">⭐</div>
                <h3 style="color:#4b4b4b; margin-bottom:10px;">Memory Bank is Empty</h3>
                <p style="color:#aaa; font-weight:600; line-height:1.5;">Difficult phrases you save during practice will appear here for review.</p>
            </div>`;
        return;
    }
    
    let html = '<div class="unit-header">YOUR SAVED PHRASES</div>';
    state.savedPhrases.forEach((p, i) => {
        html += `
            <div class="memory-item">
                <div class="topic-icon" onclick="playTTS('${p.en.replace(/'/g, "\\'")}')" style="cursor:pointer; background:var(--secondary); color:white; border:none; width:50px; height:50px; font-size:1.4rem;">🔊</div>
                <div class="topic-info">
                    <h4 style="font-size:1.1rem; color:#4b4b4b;">${p.en}</h4>
                    <p style="color:#777; font-weight:600; margin-top:4px;">${p.my || p.mission || ''}</p>
                </div>
                <div onclick="removeSavedPhrase(${i})" style="cursor:pointer; font-size:1.4rem; color:#ff4b4b; padding:5px;">✕</div>
            </div>
        `;
    });
    ui.lessonList.innerHTML = html;
}

window.removeSavedPhrase = (i) => {
    state.savedPhrases.splice(i, 1);
    saveState();
    renderMemoryBank();
};

function startLesson(id) {
    const lesson = state.lessons.find(l => l.id === id);
    if (!lesson) return;
    const isAdrian = lesson.topic.toLowerCase().includes("adrian") || lesson.topic.toLowerCase().includes("teacher");

    if (isAdrian && !state.isPremium) {
        const el = document.getElementById('modal-adrian'); el.classList.remove('hidden'); el.style.display = 'flex';
        return;
    }
    if (id > 5 && !state.unlockedLessons.includes(id) && !state.isPremium) {
        state.pendingLessonId = id;
        const el = document.getElementById('modal-ad'); el.classList.remove('hidden'); el.style.display = 'flex';
        return;
    }
    if (state.userEnergy < 1) {
        const el = document.getElementById('modal-energy'); el.classList.remove('hidden'); el.style.display = 'flex';
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
    ui.btnWatchAd.disabled = true;
    let count = 5;
    const timer = setInterval(() => {
        ui.btnWatchAd.textContent = `Unlocking... ${count}s`;
        if (count-- < 0) {
            clearInterval(timer);
            if (!state.unlockedLessons.includes(state.pendingLessonId)) state.unlockedLessons.push(state.pendingLessonId);
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
    ui.active.counter.textContent = state.currentPhraseIndex + 1;
    
    const isSaved = state.savedPhrases.some(x => x.en === p.en);
    ui.active.btnSavePhrase.textContent = isSaved ? '⭐' : '☆';

    ui.active.grammarNote.classList.add('hidden');
    ui.active.translation.classList.remove('hidden');
    ui.active.btnListen.classList.remove('hidden');
    
    if (state.currentLesson.type === 'grammar') {
        ui.active.grammarNote.classList.remove('hidden');
        ui.active.grammarNote.innerHTML = `<strong>Curriculum Note:</strong> ${state.currentLesson.explanation || 'Master the structure below.'}`;
    }
    
    if (state.currentLesson.type === 'test' || state.currentLesson.type === 'exam') {
        ui.active.karaoke.innerHTML = `<div class="mission-box">📝 ASSESSMENT<br><span style="font-size:0.9rem; opacity:0.8;">Listen carefully and repeat perfectly.</span></div>`;
        ui.active.translation.classList.add('hidden');
    } else if (state.currentLesson.type === 'challenge') {
        ui.active.karaoke.innerHTML = `<div class="mission-box">${p.mission}</div>`;
        ui.active.translation.textContent = p.context;
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

async function handleRecord() {
    if (state.isRecording) { if (mediaRecorder) mediaRecorder.stop(); return; }
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        const chunks = [];
        state.isRecording = true;
        ui.active.btnRecord.classList.add('recording');
        ui.active.btnRecord.textContent = "Recording...";
        mediaRecorder.ondataavailable = e => chunks.push(e.data);
        mediaRecorder.onstop = async () => {
            state.isRecording = false;
            ui.active.btnRecord.classList.remove('recording');
            ui.active.btnRecord.textContent = "Analyzing...";
            const blob = new Blob(chunks, { type: 'audio/webm' });
            if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
            state.audioUrl = URL.createObjectURL(blob);
            const formData = new FormData();
            formData.append('audio', blob);
            const phrase = state.currentLesson.phrases[state.currentPhraseIndex];
            try {
                if (state.currentLesson.type === 'challenge') {
                    formData.append('scenario', phrase.mission);
                    formData.append('history', '[]');
                    formData.append('userRole', 'Student');
                    formData.append('aiRole', 'Teacher Adrian');
                    const res = await fetch('/api/chat', { method: 'POST', body: formData });
                    showChallengeFeedback(await res.json());
                } else {
                    formData.append('originalText', phrase.en);
                    const res = await fetch('/api/score', { method: 'POST', body: formData });
                    showPhraseFeedback(await res.json());
                }
            } catch (e) { alert("Net Error"); ui.active.btnRecord.textContent = "🎤 Record"; }
        };
        mediaRecorder.start();
    } catch (e) { alert("Mic Access Denied"); }
}

function showPhraseFeedback(data) {
    const isPassed = data.score > (state.currentLesson.type === 'exam' ? 85 : 70);
    ui.active.feedback.className = `feedback-overlay ${isPassed ? 'correct' : 'wrong'}`;
    ui.active.feedbackIcon.textContent = isPassed ? "✅" : "❌";
    ui.active.feedbackLabel.textContent = isPassed ? "Pass!" : "Keep Trying";
    ui.active.correction.innerHTML = data.corrections || data.transcript;
    ui.active.tip.textContent = data.feedback;
    ui.active.feedback.classList.remove('hidden');
    ui.active.btnRecord.textContent = "🎤 Record";
    
    if (state.currentLesson.type === 'test' || state.currentLesson.type === 'exam') {
        const p = state.currentLesson.phrases[state.currentPhraseIndex];
        ui.active.karaoke.innerHTML = p.en.split(/\s+/).map(w => `<span class="word">${w}</span>`).join(' ');
        ui.active.translation.textContent = p.my;
        ui.active.translation.classList.remove('hidden');
    }

    if (isPassed) { 
        ui.active.btnNextStep.classList.remove('hidden'); 
        ui.active.btnRetryStep.classList.add('hidden');
        ui.active.btnRecord.classList.add('hidden'); 
    } else {
        ui.active.btnNextStep.classList.add('hidden');
        ui.active.btnRetryStep.classList.remove('hidden');
    }
}

function showChallengeFeedback(data) {
    const isPassed = data.score > 60;
    ui.active.feedback.className = `feedback-overlay ${isPassed ? 'correct' : 'wrong'}`;
    ui.active.feedbackIcon.textContent = isPassed ? "🎯" : "⚠️";
    ui.active.feedbackLabel.textContent = isPassed ? "Good!" : "Not Quite";
    ui.active.correction.innerHTML = `"${data.userText}"`;
    ui.active.tip.textContent = data.feedback;
    ui.active.feedback.classList.remove('hidden');
    ui.active.btnRecord.textContent = "🎤 Record";
    if (isPassed) { 
        ui.active.btnNextStep.classList.remove('hidden'); 
        ui.active.btnRetryStep.classList.add('hidden');
        ui.active.btnRecord.classList.add('hidden'); 
    } else {
        ui.active.btnNextStep.classList.add('hidden');
        ui.active.btnRetryStep.classList.remove('hidden');
    }
}

function nextPhrase() {
    gainExp(15);
    state.currentPhraseIndex++;
    if (state.currentPhraseIndex >= 50) completeLesson();
    else renderPhrase();
}

function completeLesson() {
    confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
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
window.onload = () => init();
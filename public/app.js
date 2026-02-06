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
        if (el) {
            el.classList.add('hidden');
            el.style.display = 'none';
        }
    });
}

function switchScreen(name) {
    const screens = {
        'lessons': document.getElementById('screen-lessons'),
        'active': document.getElementById('screen-active')
    };
    
    Object.values(screens).forEach(el => {
        if (el) {
            el.classList.add('hidden');
            el.style.display = 'none';
        }
    });

    const target = screens[name];
    if (target) {
        target.classList.remove('hidden');
        target.style.display = 'flex';
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
            grammarTestArea: document.getElementById('grammar-test-area'),
            grammarQuestion: document.getElementById('grammar-question'),
            grammarOptions: document.getElementById('grammar-options'),
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

    loadState();
    checkDailyRefill();
    updateStreak();
    closeAllModals();
    switchScreen('lessons');
    updateHUD();
    bindEvents();

    try {
        const res = await fetch('lessons.json?v=' + Date.now());
        const data = await res.json();
        state.lessons = data;
        renderLessons();
        renderDashboard();
    } catch (e) {}

    setInterval(energyLoop, 60000);
}

function loadState() {
    try {
        const saved = localStorage.getItem('errorparrot_master_v1');
        if (saved) {
            const data = JSON.parse(saved);
            Object.keys(data).forEach(k => {
                if (data[k] !== null && data[k] !== undefined) state[k] = data[k];
            });
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
        else {
            const threshold = state.userLevel * 200;
            p = (state.userExp / threshold) * 100;
        }
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
    
    const restartBtn = document.getElementById('btn-restart-lesson');
    if (restartBtn) restartBtn.onclick = () => {
        if (confirm("Restart this lesson from Step 1?")) {
            state.currentPhraseIndex = 0;
            state.lessonProgress[state.currentLesson.id] = 0;
            renderPhrase();
            saveState();
        }
    };
    if (ui.dashboard.btnResume) ui.dashboard.btnResume.onclick = resumeLearning;
    if (ui.dashboard.btnShowActivation) ui.dashboard.btnShowActivation.onclick = () => {
        const el = document.getElementById('modal-adrian');
        if (el) { el.classList.remove('hidden'); el.style.display = 'flex'; }
    };

    if (ui.lessonSearch) ui.lessonSearch.oninput = () => renderLessons();
    
    if (ui.tabs) {
        ui.tabs.forEach(t => t.onclick = () => {
            ui.tabs.forEach(x => x.classList.remove('active'));
            t.classList.add('active');
            state.currentType = t.dataset.type;
            renderLessons();
        });
    }

    if (ui.active.btnRecord) ui.active.btnRecord.onclick = handleRecord;
    if (ui.active.btnListen) ui.active.btnListen.onclick = () => {
        const p = state.currentLesson?.phrases[state.currentPhraseIndex];
        if (p?.en) playTTS(p.en);
    };
    if (ui.active.btnNextStep) ui.active.btnNextStep.onclick = nextPhrase;
    if (ui.active.btnRetryStep) ui.active.btnRetryStep.onclick = () => {
        ui.active.feedback.classList.remove('active');
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
            alert("Unlocked!");
            closeAllModals();
            renderLessons();
            saveState();
        }
    } catch(e) {}
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
        if (state.currentType === 'all' && index % 10 === 0) html += `<div class="unit-header" style="margin: 20px 24px 8px; font-weight: 800; color: var(--text-light); text-transform: uppercase; font-size: 0.8rem;">Unit ${Math.floor(l.id / 10) + 1} Path</div>`;
        const isCompleted = state.completedLessons.includes(l.id);
        const isAdrian = l.topic.toLowerCase().includes("adrian") || l.topic.toLowerCase().includes("teacher");
        const isLocked = !state.unlockedLessons.includes(l.id) && !state.isPremium;
        const progress = state.lessonProgress[l.id] || 0;
        let status = progress > 0 ? `Resume at Step ${progress+1}` : '50 Practice Phrases';
        if (isAdrian && !state.isPremium) status = 'Premium Required ⭐';
        else if (isLocked) status = 'Unlock with 5s Ad 📺';
        else if (isCompleted) status = 'Mastered ✅';

        html += `
            <div class="topic-card ${isAdrian ? 'premium-teacher' : ''} ${isLocked || (isAdrian && !state.isPremium) ? 'locked' : ''}" 
                 onclick="startLesson(${l.id})"
                 style="animation-delay: ${index * 0.05}s">
                <div class="topic-icon">${isAdrian ? '👨‍🏫' : (isCompleted ? '✅' : l.icon)}</div>
                <div class="topic-info">
                    <div class="topic-type-tag" style="font-size: 0.7rem; font-weight: 800; text-transform: uppercase; background: var(--bg); padding: 2px 8px; border-radius: 6px; margin-bottom: 4px; display: inline-block;">${l.type}</div>
                    <h4>${l.topic}</h4>
                    <p>${status}</p>
                </div>
            </div>
        `;
    });
    ui.lessonList.innerHTML = html || '<div style="padding:60px; text-align:center; color:var(--text-muted); font-weight:700;">No content found.</div>';
}

function renderMemoryBank() {
    if (state.savedPhrases.length === 0) {
        ui.lessonList.innerHTML = `
            <div style="padding:100px 40px; text-align:center;">
                <div style="font-size:4rem; margin-bottom:20px;">⭐</div>
                <h3 style="color:var(--text-muted); font-weight:800;">Memory Bank is Empty</h3>
            </div>`;
        return;
    }
    let html = '<div class="unit-header" style="padding: 20px 24px 10px; font-weight:800; color:var(--text-muted); font-size:0.8rem; text-transform:uppercase;">SAVED FOR REVIEW</div>';
    state.savedPhrases.forEach((p, i) => {
        html += `
            <div class="topic-card" style="margin: 0 24px 16px; animation-delay: ${i * 0.05}s;">
                <button class="topic-icon" onclick="playTTS('${p.en.replace(/'/g, "\\'")}')" style="background:var(--secondary-soft); color:var(--secondary); border:none; cursor:pointer;">🔊</button>
                <div class="topic-info" style="flex:1;">
                    <h4 style="margin-bottom:4px; font-size:1.1rem;">${p.en}</h4>
                    <p style="color:var(--text-muted);">${p.my || ''}</p>
                </div>
                <button onclick="removeSavedPhrase(${i})" class="icon-btn" style="color:var(--danger); width: 44px; height: 44px; font-size: 1.2rem;">✕</button>
            </div>`;
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
    if (!state.currentLesson) return;
    const p = state.currentLesson.phrases[state.currentPhraseIndex];
    if (ui.active.counter) ui.active.counter.textContent = state.currentPhraseIndex + 1;
    
    ui.active.grammarNote.classList.add('hidden');
    ui.active.grammarTestArea.classList.add('hidden');
    ui.active.translation.classList.remove('hidden');
    ui.active.chatHistory.classList.add('hidden');
    ui.active.btnListen.classList.remove('hidden');
    ui.active.btnRecord.classList.remove('hidden');
    ui.active.karaoke.classList.remove('hidden');
    
    if (state.currentLesson.type === 'grammar') {
        ui.active.grammarNote.classList.remove('hidden');
        ui.active.grammarNote.innerHTML = `<strong>Grammar Focus:</strong> ${state.currentLesson.explanation || 'Learn this structure.'}`;
        ui.active.btnListen.classList.add('hidden');
        ui.active.btnRecord.classList.add('hidden');
        ui.active.karaoke.classList.add('hidden');
        ui.active.translation.classList.add('hidden');
        renderGrammarTest(p);
    } else if (state.currentLesson.type === 'test' || state.currentLesson.type === 'exam') {
        ui.active.karaoke.innerHTML = `<div class="mission-box" style="background:var(--bg); padding:20px; border-radius:20px; font-weight:800; color:var(--text-muted);">📝 ASSESSMENT<br>Repeat after hearing.</div>`;
        ui.active.translation.classList.add('hidden');
    } else if (state.currentLesson.type === 'challenge') {
        ui.active.karaoke.innerHTML = `<div class="mission-box" style="background:var(--bg); padding:20px; border-radius:20px; font-weight:800; color:var(--text);">${p.mission}<br><span style="font-size:0.8rem; font-weight:600; opacity:0.7;">Pass Criteria: natural flow, score > 60.</span></div>`;
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
    
    ui.active.feedback.classList.remove('active');
    ui.active.btnNextStep.style.display = 'none';
    ui.active.btnRetryStep.style.display = 'none';
    ui.active.btnRecord.classList.remove('hidden');
    updateHUD();
}

function renderGrammarTest(p) {
    ui.active.grammarTestArea.classList.remove('hidden');
    const words = p.en.split(/\s+/);
    const correct = p.en;
    
    ui.active.grammarQuestion.textContent = "Correct translation for: " + (p.my || "this sentence");
    
    const options = [correct];
    options.push(words.slice().reverse().join(' ')); 
    options.push(words.slice(1).join(' ') + ' ' + words[0]); 
    options.sort(() => Math.random() - 0.5);
    
    ui.active.grammarOptions.innerHTML = options.map(opt => `
        <button class="btn-pro" style="background:white; color:var(--text); border:1px solid var(--border); margin-bottom:10px; text-transform:none;" onclick="handleGrammarAnswer(this, '${opt.replace(/'/g, "\\'")}', '${correct.replace(/'/g, "\\'")}')">
            ${opt}
        </button>
    `).join('');
}

window.handleGrammarAnswer = (btn, selected, correct) => {
    const isCorrect = selected === correct;
    if (isCorrect) {
        btn.style.background = 'var(--primary)';
        btn.style.color = 'white';
        ui.active.btnNextStep.style.display = 'flex';
        gainExp(10);
    } else {
        btn.style.background = 'var(--danger)';
        btn.style.color = 'white';
        alert("Try again! Look at the structure.");
    }
};

function renderChatHistory() {
    if (!ui.active.chatHistory) return;
    if (state.chatHistory.length === 0) {
        ui.active.chatHistory.innerHTML = '<div style="color:#aaa; font-style:italic; padding:20px; text-align:center;">Say something to start...</div>';
        return;
    }
    let html = '';
    state.chatHistory.forEach(msg => {
        const isAI = msg.role === 'assistant';
        html += `
            <div style="display:flex; justify-content:${isAI ? 'flex-start' : 'flex-end'}; margin-bottom:12px;">
                <div style="max-width:80%; padding:12px 16px; border-radius:18px; background:${isAI ? 'var(--bg)' : 'var(--secondary)'}; color:${isAI ? 'var(--text)' : 'white'}; font-weight:600; font-size:0.95rem;">
                    ${msg.content}
                </div>
            </div>
        `;
    });
    ui.active.chatHistory.innerHTML = html;
    const container = document.querySelector('.practice-main');
    if (container) container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
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
    const isPassed = data.score >= (state.currentLesson.type === 'exam' ? 85 : 70);
    const overlay = ui.active.feedback;
    overlay.className = `feedback-overlay active ${isPassed ? 'correct' : 'wrong'}`;
    
    ui.active.feedbackIcon.innerHTML = `${isPassed ? '✅' : '❌'} <span style="font-weight:900;">${data.score}%</span>`;
    ui.active.feedbackLabel.textContent = isPassed ? "Mastered!" : "Not Quite";
    ui.active.correction.innerHTML = data.corrections || data.transcript;
    ui.active.tip.textContent = data.feedback;
    
    if (isPassed) { 
        ui.active.btnNextStep.style.display = 'flex'; 
        ui.active.btnRetryStep.style.display = 'none'; 
        ui.active.btnRecord.classList.add('hidden');
    } else { 
        ui.active.btnNextStep.style.display = 'none'; 
        ui.active.btnRetryStep.style.display = 'flex'; 
    }
}

function showChallengeFeedback(data) {
    const isPassed = data.score > 60;
    const overlay = ui.active.feedback;
    overlay.className = `feedback-overlay active ${isPassed ? 'correct' : 'wrong'}`;
    
    ui.active.feedbackIcon.innerHTML = `${isPassed ? '🎯' : '⚠️'} <span style="font-weight:900;">${data.score}%</span>`;
    ui.active.feedbackLabel.textContent = isPassed ? "Success!" : "Keep Trying";
    ui.active.correction.innerHTML = `"${data.userText}"`;
    ui.active.tip.textContent = data.feedback;
    
    if (isPassed) { 
        ui.active.btnNextStep.style.display = 'flex'; 
        ui.active.btnRetryStep.style.display = 'none'; 
        ui.active.btnRecord.classList.add('hidden');
    } else { 
        ui.active.btnNextStep.style.display = 'none'; 
        ui.active.btnRetryStep.style.display = 'flex'; 
    }
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
        const listenBtn = ui.active.btnListen;
        if (listenBtn) listenBtn.classList.add('playing');
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
            audio.onended = () => { words.forEach(w => { w.classList.remove('active'); w.classList.remove('played'); }); if (listenBtn) listenBtn.classList.remove('playing'); };
        } else {
            audio.onended = () => { if (listenBtn) listenBtn.classList.remove('playing'); };
        }
        audio.play();
    } catch (e) { if (ui.active.btnListen) ui.active.btnListen.classList.remove('playing'); }
}

window.closeAllModals = closeAllModals;
document.addEventListener('DOMContentLoaded', init);
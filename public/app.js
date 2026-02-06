// ErrotParrot 3.0 - Professional Core
const state = {
    lessons: [],
    unlockedLessons: [1, 2, 3, 4, 5],
    completedLessons: [],
    currentLesson: null,
    currentLineIndex: 0,
    currentQuizIndex: 0,
    modeIndex: 0,
    modes: [], 
    audioBlob: null,
    chatHistory: [],
    isAISpeaking: false,
    isLoading: false,
    
    // User State
    isPremium: false,
    subscriptionType: 'free', 
    subscriptionExpiry: null,
    userApiKey: '',
    userLevel: 1,
    userExp: 0,
    userEnergy: 5, 
    lastEnergyUpdate: Date.now(),
    
    // Streak & Stats
    streak: 0,
    lastActiveDay: null,
    totalXp: 0,
    
    // Config
    discussionDuration: 2,
    sessionStartTime: null,
    autoPlay: true,
    isDarkMode: false,
    adVideoId: 'dQw4w9WgXcQ',
    leaderMode: 'ai',
    voice: 'male',
    ttsSpeed: '1.0'
};

const CONFIG = {
    free: { maxEnergy: 5, regenMins: 60, label: 'Free Plan' },
    'api-license': { maxEnergy: 9999, regenMins: 0, label: 'API License' }, 
    'pro-access': { maxEnergy: 60, regenMins: 20, label: 'Pro Access' }
};

const ui = {
    hud: {
        lvl: document.getElementById('hud-lvl'),
        xpBar: document.getElementById('hud-xp-bar'),
        streak: document.getElementById('hud-streak'),
        energy: document.getElementById('hud-energy'),
        energyTimer: document.getElementById('hud-energy-timer')
    },
    stats: {
        completed: document.getElementById('stat-completed'),
        xp: document.getElementById('stat-xp'),
        rank: document.getElementById('stat-rank')
    },
    screens: {
        list: document.getElementById('screen-lessons'),
        active: document.getElementById('screen-active'),
        premium: document.getElementById('modal-premium'),
        admin: document.getElementById('modal-admin'),
        levelup: document.getElementById('modal-levelup'),
        ad: document.getElementById('modal-ad')
    },
    lesson: {
        list: document.getElementById('lesson-list'),
        search: document.getElementById('lesson-search'),
        tabs: document.querySelectorAll('.tab-btn')
    },
    active: {
        title: document.getElementById('active-title'),
        badge: document.getElementById('active-badge'),
        chatBox: document.getElementById('chat-box'),
        chatList: document.getElementById('chat-list'),
        shadowBox: document.getElementById('shadow-box'),
        shadowText: document.getElementById('shadow-text'),
        grammarBox: document.getElementById('grammar-box'),
        grammarNotes: document.getElementById('grammar-notes'),
        grammarQuiz: document.getElementById('grammar-quiz'),
        role: document.getElementById('active-role'),
        controls: document.getElementById('active-controls'),
        feedback: document.getElementById('active-feedback'),
        durSlider: document.getElementById('duration-slider'),
        durDisplay: document.getElementById('duration-display'),
        typing: document.getElementById('ai-typing'),
        btnStartQuiz: document.getElementById('btn-start-quiz'),
        scoreDisplay: document.getElementById('score-display'),
        scoreVal: document.getElementById('score-val'),
        correctionBox: document.getElementById('correction-box'),
        correctionText: document.getElementById('correction-text')
    },
    btns: {
        record: document.getElementById('btn-record'),
        listen: document.getElementById('btn-listen'),
        relistenUser: document.getElementById('btn-relisten-user'),
        next: document.getElementById('btn-next'),
        back: document.getElementById('btn-back'),
        premium: document.getElementById('btn-premium-nav')
    },
    inputs: {
        apiKey: document.getElementById('input-api-key'),
        code: document.getElementById('input-redeem-code'),
        adminCodeType: document.getElementById('admin-code-type'),
        adminAdUrl: document.getElementById('admin-ad-url'),
        leader: document.getElementById('select-leader'),
        voice: document.getElementById('select-voice'),
        speed: document.getElementById('select-speed')
    },
    ad: {
        timer: document.getElementById('ad-timer'),
        iframe: document.getElementById('ad-iframe'),
        claim: document.getElementById('btn-ad-claim')
    }
};

let mediaRecorder = null;
let audioChunks = [];
let activeAudio = null;

// --- INITIALIZATION ---
async function init() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('unlock') === 'admin_parrot') {
        localStorage.setItem('errotparrot_admin', 'true');
        alert("Admin Mode Unlocked");
    }
    if (localStorage.getItem('errotparrot_admin') === 'true') {
        document.getElementById('btn-admin-float').classList.remove('hidden');
    }

    try {
        const res = await fetch('lessons.json');
        const lessonsData = await res.json();
        // IMPORTANT: Load lessons FIRST, then load state without overwriting them
        state.lessons = lessonsData;
        loadState(); // This function now skips overwriting state.lessons
        renderLessons();
    } catch (e) { console.error("Load failed", e); }

    setInterval(energyLoop, 1000);
    updateHUD();
    bindEvents();
    window.startTeacherMode = startTeacherMode;
}

function loadState() {
    const saved = localStorage.getItem('ep_save_v4');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            // DO NOT Object.assign(state, data) because it might overwrite state.lessons
            // Manual merge of persisted user data only
            state.unlockedLessons = data.unlockedLessons || [1, 2, 3, 4, 5];
            state.completedLessons = data.completedLessons || [];
            state.subscriptionType = data.subscriptionType || 'free';
            state.subscriptionExpiry = data.subscriptionExpiry || null;
            state.userApiKey = data.userApiKey || '';
            state.userLevel = data.userLevel || 1;
            state.userExp = data.userExp || 0;
            state.userEnergy = data.userEnergy !== undefined ? data.userEnergy : 5;
            state.lastEnergyUpdate = data.lastEnergyUpdate || Date.now();
            state.streak = data.streak || 0;
            state.lastActiveDay = data.lastActiveDay || null;
            state.totalXp = data.totalXp || 0;
            state.isDarkMode = data.isDarkMode || false;
            state.adVideoId = data.adVideoId || 'dQw4w9WgXcQ';
            state.leaderMode = data.leaderMode || 'ai';
            state.voice = data.voice || 'male';
            state.ttsSpeed = data.ttsSpeed || '1.0';
            state.isPremium = state.subscriptionType !== 'free';

            if (state.subscriptionExpiry && Date.now() > state.subscriptionExpiry) {
                state.subscriptionType = 'free';
                state.subscriptionExpiry = null;
                state.isPremium = false;
            }
            
            const today = new Date().toDateString();
            if (state.lastActiveDay && state.lastActiveDay !== today) {
                const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
                if (state.lastActiveDay !== yesterday.toDateString()) state.streak = 0;
            }
        } catch (e) { console.error("Corrupt save"); }
    }
    ui.inputs.apiKey.value = state.userApiKey;
    if (ui.inputs.adminAdUrl) ui.inputs.adminAdUrl.value = state.adVideoId;
    if (ui.inputs.leader) ui.inputs.leader.value = state.leaderMode;
    if (ui.inputs.voice) ui.inputs.voice.value = state.voice;
    if (ui.inputs.speed) ui.inputs.speed.value = state.ttsSpeed;
}

function saveState() {
    // Save everything except the large lessons array
    const toSave = { ...state };
    delete toSave.lessons; 
    localStorage.setItem('ep_save_v4', JSON.stringify(toSave));
}

function energyLoop() {
    if (state.subscriptionExpiry && Date.now() > state.subscriptionExpiry) {
        state.subscriptionType = 'free'; state.subscriptionExpiry = null;
        state.isPremium = false;
        updateHUD(); saveState();
    }

    const tier = CONFIG[state.subscriptionType];
    if (state.userEnergy >= tier.maxEnergy) {
        ui.hud.energyTimer.style.display = 'none'; return;
    }

    const now = Date.now();
    const diff = now - state.lastEnergyUpdate;
    const regenMs = tier.regenMins * 60 * 1000;

    if (diff >= regenMs) {
        const gained = Math.floor(diff / regenMs);
        state.userEnergy = Math.min(tier.maxEnergy, state.userEnergy + gained);
        state.lastEnergyUpdate = now - (diff % regenMs);
        saveState(); updateHUD();
    } else {
        const remaining = regenMs - diff;
        const mins = Math.floor(remaining / 60000);
        const secs = Math.floor((remaining % 60000) / 1000);
        ui.hud.energyTimer.textContent = `${mins}:${secs.toString().padStart(2,'0')}`;
        ui.hud.energyTimer.style.display = 'inline';
    }
}

function updateHUD() {
    ui.hud.lvl.textContent = state.userLevel;
    ui.hud.energy.textContent = state.userEnergy;
    ui.hud.streak.textContent = state.streak;
    ui.hud.xpBar.style.width = `${Math.min(100, (state.userExp / (state.userLevel * 100)) * 100)}%`;

    ui.stats.completed.textContent = state.completedLessons.length;
    ui.stats.xp.textContent = state.totalXp;
    
    const ranks = ["Newbie", "Beginner", "Learner", "Speaker", "Pro", "Expert", "Master", "Parrot King"];
    ui.stats.rank.textContent = ranks[Math.min(ranks.length-1, Math.floor(state.userLevel / 5))];

    const timerBadge = document.getElementById('premium-time-left');
    if (state.subscriptionType !== 'free' && state.subscriptionExpiry) {
        ui.btns.premium.textContent = "👑 " + CONFIG[state.subscriptionType].label;
        ui.btns.premium.classList.add('is-pro');
        const diff = state.subscriptionExpiry - Date.now();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        timerBadge.textContent = days > 0 ? `${days}d left` : 'Expiring';
        timerBadge.classList.remove('hidden');
    } else {
        ui.btns.premium.textContent = "Get Premium";
        ui.btns.premium.classList.remove('is-pro');
        timerBadge.classList.add('hidden');
    }
}

function setLoading(active) {
    state.isLoading = active;
    ui.btns.record.disabled = active;
}

function startTeacherMode() {
    if (state.subscriptionType === 'free') { openModal('premium'); return; }
    if (state.userEnergy < 2) { alert("Need 2 Energy"); return; }
    state.userEnergy -= 2;
    state.currentLesson = { id: 'teacher', type: 'teacher', title: 'Tr. Adrian', lines: [] };
    state.modeIndex = 0; state.modes = ['Teacher Chat']; state.chatHistory = []; state.sessionStartTime = Date.now();
    updateHUD(); switchScreen('active'); renderActiveScreen();
    
    if (state.leaderMode === 'ai') {
        const greeting = "Hello! I am Tr. Adrian. I'm excited to help you practice English today. What would you like to talk about?";
        addChatMessage('ai', greeting); playTTS(greeting, 'B', true); 
        state.chatHistory.push({ role: "assistant", content: greeting });
    } else {
        addChatMessage('ai', "I'm ready when you are! You can start the conversation on any topic you like.");
    }
}

function startLesson(id) {
    const isFullPremium = state.subscriptionType === 'pro-access';
    if (!isFullPremium && !state.unlockedLessons.includes(id)) { showAdModal(id); return; }
    
    state.currentLesson = state.lessons.find(l => l.id === id);
    state.currentLineIndex = 0; state.currentQuizIndex = 0; state.modeIndex = 0;
    state.chatHistory = []; state.sessionStartTime = Date.now();
    
    if (state.currentLesson.type === 'grammar') state.modes = ['Study'];
    else if (state.currentLesson.type === 'conversation') state.modes = ['Shadowing', 'RolePlay'];
    else if (state.currentLesson.type === 'exam') state.modes = ['Exam Shadowing'];

    const today = new Date().toDateString();
    if (state.lastActiveDay !== today) { state.streak++; state.lastActiveDay = today; }
    
    updateHUD(); saveState(); switchScreen('active'); renderActiveScreen();
}

function showAdModal(lessonId) {
    const isLicenseUser = state.subscriptionType === 'api-license';
    ui.ad.iframe.src = `https://www.youtube.com/embed/${state.adVideoId}?autoplay=1&mute=1&controls=0&disablekb=1&modestbranding=1&rel=0`;
    openModal('ad'); ui.ad.claim.classList.add('hidden'); ui.ad.timer.classList.remove('hidden');
    let seconds = isLicenseUser ? 10 : 30;
    ui.ad.timer.textContent = seconds + "s";
    
    if (window.adInterval) clearInterval(window.adInterval);
    window.adInterval = setInterval(() => {
        seconds--; ui.ad.timer.textContent = seconds + "s";
        if (seconds <= 0) {
            clearInterval(window.adInterval); ui.ad.timer.classList.add('hidden');
            ui.ad.claim.classList.remove('hidden');
            ui.ad.claim.onclick = () => {
                state.unlockedLessons.push(lessonId); saveState();
                closeAllModals(); renderLessons(); startLesson(lessonId);
            };
        }
    }, 1000);
}

function renderActiveScreen() {
    const l = state.currentLesson;
    const mode = state.modes[state.modeIndex];
    ui.active.title.textContent = l.title;
    ui.active.badge.textContent = mode.toUpperCase();
    
    ui.active.chatBox.classList.add('hidden'); ui.active.shadowBox.classList.add('hidden');
    ui.active.grammarBox.classList.add('hidden'); ui.active.controls.classList.add('hidden');
    ui.active.feedback.classList.add('hidden'); ui.btns.next.classList.add('hidden');
    ui.active.scoreDisplay.classList.add('hidden'); ui.active.correctionBox.classList.add('hidden');
    ui.btns.relistenUser.classList.add('hidden');

    if (mode === 'Study') {
        ui.active.grammarBox.classList.remove('hidden');
        ui.active.grammarNotes.innerHTML = `<strong>Lesson Notes</strong><br>${l.notes}<br><br><strong>Examples:</strong><br>${l.examples.map(ex => `• ${ex.en} (${ex.my})`).join('<br>')}`;
        ui.active.btnStartQuiz.classList.remove('hidden');
        ui.active.grammarQuiz.classList.add('hidden');
    } else if (mode === 'RolePlay' || mode === 'Teacher Chat') {
        ui.active.chatBox.classList.remove('hidden'); ui.active.controls.classList.remove('hidden');
        ui.btns.listen.classList.add('hidden');
        if (state.chatHistory.length === 0 && mode === 'RolePlay') {
            ui.active.chatList.innerHTML = '';
            addChatMessage('ai', l.lines[0].text);
            playTTS(l.lines[0].text, 'A', true);
            state.chatHistory.push({role: "system", content: "Init"});
        }
    } else {
        ui.active.shadowBox.classList.remove('hidden'); ui.active.controls.classList.remove('hidden');
        ui.btns.listen.classList.remove('hidden');
        const line = l.lines[state.currentLineIndex];
        ui.active.role.textContent = line.role;
        const displayContainer = document.createElement('span');
        displayContainer.className = 'msg-content';
        displayContainer.innerHTML = (mode === 'Exam Shadowing' ? "???" : line.text).split(' ').map(w => `<span class="word">${w}</span>`).join(' ');
        ui.active.shadowText.innerHTML = '';
        ui.active.shadowText.appendChild(displayContainer);
        
        if (mode === 'Shadowing') {
            const transBtn = document.createElement('button');
            transBtn.className = 'btn-relisten'; transBtn.innerHTML = '🌐';
            transBtn.onclick = async () => { 
                const res = await fetch('/api/translate', { method:'POST', body: JSON.stringify({word: line.text, lang:'my'}), headers:{'Content-Type':'application/json'}});
                const d = await res.json(); alert(d.translation);
            };
            ui.active.shadowText.appendChild(transBtn);
        }

        if (state.autoPlay) setTimeout(() => playTTS(line.text, line.role, true, displayContainer), 500);
    }
}

function handleStartQuiz() {
    state.currentQuizIndex = 0; ui.active.btnStartQuiz.classList.add('hidden');
    ui.active.grammarQuiz.classList.remove('hidden'); renderQuizQuestion();
}

function renderQuizQuestion() {
    const q = state.currentLesson.quiz[state.currentQuizIndex];
    document.getElementById('quiz-question').textContent = q.q;
    document.getElementById('quiz-options').innerHTML = q.options.map((opt, i) => `<button class="option-btn" onclick="checkAnswer(${i})">${opt}</button>`).join('');
}

window.checkAnswer = (idx) => {
    const q = state.currentLesson.quiz[state.currentQuizIndex];
    const btns = document.querySelectorAll('.option-btn');
    if (idx === q.correct) {
        btns[idx].classList.add('correct'); gainExp(10);
        setTimeout(() => {
            state.currentQuizIndex++;
            if (state.currentQuizIndex < state.currentLesson.quiz.length) renderQuizQuestion();
            else { finishLesson(); }
        }, 800);
    } else btns[idx].classList.add('wrong');
};

async function handleRecord() {
    if (state.isLoading) return;
    if (ui.btns.record.classList.contains('recording')) { mediaRecorder.stop(); return; }
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream); audioChunks = [];
        ui.btns.record.classList.add('recording'); ui.btns.record.textContent = "Stop";
        mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
        mediaRecorder.onstop = async () => {
            ui.btns.record.classList.remove('recording'); ui.btns.record.textContent = "🎤 Record";
            setLoading(true);
            state.audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            ui.btns.relistenUser.classList.remove('hidden');
            
            const formData = new FormData(); formData.append('audio', state.audioBlob, 'audio.webm');
            formData.append('tier', state.subscriptionType); formData.append('userApiKey', state.userApiKey);
            const isTeacher = state.currentLesson?.id === 'teacher';
            const mode = state.modes[state.modeIndex];
            
            try {
                if (mode === 'Shadowing' || mode === 'Exam Shadowing') {
                    formData.append('originalText', state.currentLesson.lines[state.currentLineIndex].text);
                    const res = await fetch('/api/score', { method: 'POST', body: formData });
                    handleResult(await res.json());
                } else {
                    formData.append('history', JSON.stringify(state.chatHistory));
                    formData.append('scenario', isTeacher ? "English Teacher" : state.currentLesson.title);
                    formData.append('duration', state.discussionDuration);
                    formData.append('leaderMode', state.leaderMode);
                    ui.active.typing.classList.remove('hidden');
                    const res = await fetch('/api/chat', { method: 'POST', body: formData });
                    ui.active.typing.classList.add('hidden');
                    const data = await res.json();
                    addChatMessage('user', data.userText); addChatMessage('ai', data.aiResponse);
                    playTTS(data.aiResponse, 'B', true);
                    state.chatHistory.push({ role: "user", content: data.userText }, { role: "assistant", content: data.aiResponse });
                }
            } catch(e) { alert("Error connecting to AI"); }
            finally { setLoading(false); }
        };
        mediaRecorder.start();
    } catch (e) { alert("Microphone Error"); }
}

function handleResult(data) {
    if (data.score !== undefined) {
        ui.active.scoreVal.textContent = data.score;
        ui.active.scoreDisplay.classList.remove('hidden');
    }
    
    if (data.corrections) {
        ui.active.correctionText.innerHTML = data.corrections;
        ui.active.correctionBox.classList.remove('hidden');
    }

    if (data.passed) {
        ui.active.feedback.innerHTML = `<span style="color:var(--success)">✅ ${data.feedback}</span>`;
        ui.active.feedback.classList.remove('hidden'); gainExp(15); ui.btns.next.classList.remove('hidden');
    } else {
        ui.active.feedback.innerHTML = `<span style="color:var(--danger)">❌ ${data.feedback}</span>`;
        ui.active.feedback.classList.remove('hidden');
    }
}

function gainExp(amount) {
    state.userExp += amount; state.totalXp += amount;
    const needed = state.userLevel * 100;
    if (state.userExp >= needed) {
        state.userLevel++; state.userExp -= needed;
        state.userEnergy = CONFIG[state.subscriptionType].maxEnergy;
        openModal('levelup');
    }
    saveState(); updateHUD();
}

function finishLesson() {
    if (state.currentLesson.id !== 'teacher' && !state.completedLessons.includes(state.currentLesson.id)) {
        state.completedLessons.push(state.currentLesson.id);
    }
    alert("Lesson Complete!"); switchScreen('list'); renderLessons();
}

function addChatMessage(role, text) {
    const div = document.createElement('div'); div.className = `chat-msg ${role}`;
    const span = document.createElement('span'); span.className = 'msg-content';
    span.innerHTML = text.split(' ').map(w => `<span class="word">${w}</span>`).join(' ');
    div.appendChild(span);
    const row = document.createElement('div'); row.style.display = 'flex'; row.style.gap = '10px';
    if (role === 'ai') {
        const relisten = document.createElement('button'); relisten.className = 'btn-relisten'; relisten.innerHTML = '🔊';
        relisten.onclick = () => playTTS(text, 'B', true, span);
        const trans = document.createElement('button'); trans.className = 'btn-relisten'; trans.innerHTML = '🌐';
        trans.onclick = async () => { trans.innerHTML = '...'; const res = await fetch('/api/translate', { method:'POST', body: JSON.stringify({word: text, lang:'my'}), headers:{'Content-Type':'application/json'}}); const d = await res.json(); alert(d.translation); trans.innerHTML = '🌐'; };
        row.appendChild(relisten); row.appendChild(trans);
    }
    div.appendChild(row); ui.active.chatList.appendChild(div);
    ui.active.chatList.scrollTop = ui.active.chatList.scrollHeight; return span;
}

async function playTTS(text, role, isKaraoke = false, container = null) {
    if (activeAudio) activeAudio.pause();
    const isTeacher = state.currentLesson?.id === 'teacher';
    try {
        const res = await fetch('/api/tts', { 
            method: 'POST', 
            body: JSON.stringify({ 
                text, 
                role, 
                voice: isTeacher ? state.voice : null, 
                speed: state.ttsSpeed 
            }) 
        });
        const data = await res.json(); activeAudio = new Audio("data:audio/mp3;base64," + data.audio);
        if (isKaraoke && data.alignment) {
            const words = (container || ui.active.chatList.lastElementChild?.querySelector('.msg-content')).querySelectorAll('.word');
            activeAudio.ontimeupdate = () => {
                const cur = activeAudio.currentTime;
                data.alignment.forEach((align, i) => {
                    if (cur >= align.start && cur <= align.end) {
                        words.forEach(w => w.classList.remove('active')); if (words[i]) words[i].classList.add('active');
                    }
                });
            };
        }
        activeAudio.play();
    } catch(e) {}
}

function bindEvents() {
    ui.btns.record.onclick = handleRecord;
    ui.btns.listen.onclick = () => playTTS(state.currentLesson.lines[state.currentLineIndex].text, state.currentLesson.lines[state.currentLineIndex].role, true);
    ui.btns.relistenUser.onclick = () => {
        if (state.audioBlob) {
            if (activeAudio) activeAudio.pause();
            const url = URL.createObjectURL(state.audioBlob);
            activeAudio = new Audio(url);
            activeAudio.play();
        }
    };
    ui.btns.next.onclick = () => {
        state.currentLineIndex++;
        if (state.currentLineIndex >= state.currentLesson.lines.length) {
            state.modeIndex++; state.currentLineIndex = 0;
            if (state.modeIndex >= state.modes.length) { finishLesson(); return; }
        }
        renderActiveScreen();
    };
    ui.btns.back.onclick = () => switchScreen('list');
    ui.btns.premium.onclick = () => openModal('premium');
    ui.active.btnStartQuiz.onclick = handleStartQuiz;

    document.getElementById('btn-admin-gen').onclick = async () => {
        const type = ui.inputs.adminCodeType.value;
        const res = await fetch('/api/admin', { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ action: 'generate', type, password: 'admin123' }) 
        });
        const data = await res.json();
        document.getElementById('admin-result').textContent = data.code || "Error";
    };

    document.getElementById('btn-redeem-submit').onclick = async () => {
        const code = ui.inputs.code.value;
        const res = await fetch('/api/admin', { method: 'POST', body: JSON.stringify({ action: 'redeem', code }), headers: {'Content-Type': 'application/json'} });
        const data = await res.json();
        if (data.success) {
            state.subscriptionType = data.type; state.subscriptionExpiry = data.expiry;
            state.userEnergy = CONFIG[data.type].maxEnergy; state.isPremium = true;
            saveState(); updateHUD(); renderLessons(); closeAllModals();
            alert("Premium Unlocked!");
        } else { alert("Invalid Code"); }
    };

    document.getElementById('btn-admin-save-ad').onclick = () => {
        state.adVideoId = ui.inputs.adminAdUrl.value; saveState(); alert("Saved");
    };

    if (ui.inputs.leader) ui.inputs.leader.onchange = (e) => { state.leaderMode = e.target.value; saveState(); };
    if (ui.inputs.voice) ui.inputs.voice.onchange = (e) => { state.voice = e.target.value; saveState(); };
    if (ui.inputs.speed) ui.inputs.speed.onchange = (e) => { state.ttsSpeed = e.target.value; saveState(); };

    ui.lesson.search.oninput = (e) => renderLessons(state.lessons.filter(l => l.title.toLowerCase().includes(e.target.value.toLowerCase())));
    ui.lesson.tabs.forEach(t => t.onclick = (e) => {
        ui.lesson.tabs.forEach(x => x.classList.remove('active')); e.target.classList.add('active');
        renderLessons(state.lessons.filter(l => e.target.dataset.type === 'all' || l.type === e.target.dataset.type));
    });
}

function renderLessons(list = state.lessons) {
    const isFullPremium = state.subscriptionType === 'pro-access';
    ui.lesson.list.innerHTML = list.map(l => {
        const isLocked = !isFullPremium && !state.unlockedLessons.includes(l.id);
        const isDone = state.completedLessons.includes(l.id);
        return `
            <div class="lesson-card ${isLocked ? 'locked' : ''}" onclick="startLesson(${l.id})">
                <div class="card-icon">${isDone ? '✅' : (l.type === 'conversation' ? '💬' : l.type === 'grammar' ? '📘' : '🏆')}</div>
                <div class="card-info">
                    <h4>${l.title}</h4>
                    <p>${l.type.toUpperCase()} ${isLocked ? '🔒' : ''}</p>
                </div>
            </div>
        `;
    }).join('');
}

function switchScreen(name) {
    Object.values(ui.screens).forEach(s => s?.classList.add('hidden'));
    ui.screens[name === 'list' ? 'list' : 'active'].classList.remove('hidden');
    closeAllModals();
}

function openModal(name) { ui.screens[name].classList.remove('hidden'); }
function closeAllModals() {
    Object.values(ui.screens).forEach(s => { if(s.classList.contains('modal-overlay')) s.classList.add('hidden'); });
    ui.ad.iframe.src = "";
    if (window.adInterval) clearInterval(window.adInterval);
}

init();
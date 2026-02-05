// ErrotParrot 3.0 - Professional Core
const state = {
    lessons: [],
    currentLesson: null,
    currentLineIndex: 0,
    modeIndex: 0, // 0=Shadowing, 1=RolePlay
    modes: ['Shadowing', 'RolePlay'],
    audioBlob: null,
    chatHistory: [],
    isAISpeaking: false,
    targetLang: 'my',
    
    // User State
    isPremium: false,
    subscriptionType: 'free', // 'free' | 'api-license' | 'pro-access'
    userApiKey: '',
    userLevel: 1,
    userExp: 0,
    userEnergy: 5, // PROFIT: Reduced from 10
    lastEnergyUpdate: Date.now(),
    
    // Session Config
    discussionDuration: 2,
    sessionStartTime: null,
    autoPlay: true,
    currentType: 'all',
    
    // Admin & System
    adminPassword: '',
    isDarkMode: false,
    
    // Teacher Bot State
    lastTeacherSession: null // timestamp
};

// Configuration
const CONFIG = {
    free: { maxEnergy: 5, regenMins: 60, label: 'Free Plan' }, // PROFIT: STRICT TUNING
    'api-license': { maxEnergy: 9999, regenMins: 0, label: 'API License' }, 
    'pro-access': { maxEnergy: 100, regenMins: 10, label: 'Pro Access' }
};

// UI References
const ui = {
    screens: {
        list: document.getElementById('screen-lessons'),
        active: document.getElementById('screen-active'),
        premium: document.getElementById('modal-premium'),
        admin: document.getElementById('modal-admin'),
        levelup: document.getElementById('modal-levelup')
    },
    hud: {
        lvl: document.getElementById('hud-lvl'),
        xpBar: document.getElementById('hud-xp-bar'),
        energy: document.getElementById('hud-energy'),
        energyTimer: document.getElementById('hud-energy-timer')
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
        role: document.getElementById('active-role'),
        controls: document.getElementById('active-controls'),
        feedback: document.getElementById('active-feedback'),
        durSlider: document.getElementById('duration-slider'),
        durDisplay: document.getElementById('duration-display'),
        typing: document.getElementById('ai-typing')
    },
    btns: {
        record: document.getElementById('btn-record'),
        listen: document.getElementById('btn-listen'),
        next: document.getElementById('btn-next'),
        back: document.getElementById('btn-back'),
        theme: document.getElementById('btn-theme'),
        admin: document.getElementById('btn-admin-float'),
        premium: document.getElementById('btn-premium-nav')
    },
    inputs: {
        apiKey: document.getElementById('input-api-key'),
        code: document.getElementById('input-redeem-code'),
        adminCodeType: document.getElementById('admin-code-type')
    }
};

let mediaRecorder = null;
let audioChunks = [];
let activeAudio = null;

// --- INITIALIZATION ---
async function init() {
    // 1. Admin Security Check
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('unlock') === 'admin_parrot') {
        localStorage.setItem('errotparrot_admin', 'true');
        alert("Admin Mode Unlocked");
    }
    
    if (localStorage.getItem('errotparrot_admin') === 'true') {
        ui.btns.admin.classList.remove('hidden');
    }

    // 2. Load Content
    try {
        const res = await fetch('lessons.json');
        state.lessons = await res.json();
        renderLessons();
    } catch (e) {
        console.error("Critical: Could not load lessons");
    }

    // 3. Load User State
    loadState();
    
    // 4. Start Loops
    setInterval(energyLoop, 1000);
    updateHUD();

    // 5. Event Binding
    bindEvents();
    
    window.startTeacherMode = startTeacherMode;
}

function loadState() {
    const saved = localStorage.getItem('ep_save_v3');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            state.userLevel = data.userLevel || 1;
            state.userExp = data.userExp || 0;
            state.subscriptionType = data.subscriptionType || 'free';
            state.userApiKey = data.userApiKey || '';
            state.isDarkMode = data.isDarkMode || false;
            state.lastTeacherSession = data.lastTeacherSession || null;
            
            const max = CONFIG[state.subscriptionType].maxEnergy;
            state.userEnergy = Math.min(max, data.userEnergy !== undefined ? data.userEnergy : 5);
            state.lastEnergyUpdate = data.lastEnergyUpdate || Date.now();

            if (state.isDarkMode) document.body.classList.add('dark');
            if (state.subscriptionType !== 'free') state.isPremium = true;
            ui.inputs.apiKey.value = state.userApiKey;
        } catch (e) {
            console.warn("State reset due to corruption");
            localStorage.removeItem('ep_save_v3');
        }
    }
}

function saveState() {
    localStorage.setItem('ep_save_v3', JSON.stringify({
        userLevel: state.userLevel,
        userExp: state.userExp,
        subscriptionType: state.subscriptionType,
        userApiKey: ui.inputs.apiKey.value,
        userEnergy: state.userEnergy,
        lastEnergyUpdate: state.lastEnergyUpdate,
        isDarkMode: state.isDarkMode,
        lastTeacherSession: state.lastTeacherSession
    }));
}

// --- CORE LOGIC ---

function energyLoop() {
    const tier = CONFIG[state.subscriptionType];
    if (state.userEnergy >= tier.maxEnergy) {
        ui.hud.energyTimer.style.display = 'none';
        return;
    }

    const now = Date.now();
    const diff = now - state.lastEnergyUpdate;
    const regenMs = tier.regenMins * 60 * 1000;

    if (diff >= regenMs) {
        const gained = Math.floor(diff / regenMs);
        state.userEnergy = Math.min(tier.maxEnergy, state.userEnergy + gained);
        state.lastEnergyUpdate = now - (diff % regenMs);
        saveState();
        updateHUD();
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
    
    const xpNeeded = state.userLevel * 100;
    const pct = Math.min(100, (state.userExp / xpNeeded) * 100);
    ui.hud.xpBar.style.width = `${pct}%`;

    if (state.subscriptionType !== 'free') {
        ui.btns.premium.textContent = "👑 " + CONFIG[state.subscriptionType].label;
        ui.btns.premium.classList.add('is-pro');
    } else {
        ui.btns.premium.textContent = "Get Premium";
        ui.btns.premium.classList.remove('is-pro');
    }
}

function startTeacherMode() {
    const isFree = state.subscriptionType === 'free';
    const aiStarts = document.getElementById('check-ai-starts').checked;
    
    if (isFree) {
        const today = new Date().toDateString();
        const last = state.lastTeacherSession ? new Date(state.lastTeacherSession).toDateString() : null;
        
        if (today === last) {
            alert("⚠️ Free Plan Limit: One session with Tr. Adrian per day.\nUpgrade to Premium for unlimited access!");
            openModal('premium');
            return;
        }
        
        if (state.userEnergy < 3) {
            alert("Not enough energy (Need 3)");
            openModal('premium');
            return;
        }
        state.userEnergy -= 3;
    } else {
        if (state.userEnergy < 1) {
             openModal('premium');
             return;
        }
        state.userEnergy -= 1;
    }

    state.currentLesson = { 
        id: 'teacher', 
        type: 'teacher', 
        title: 'Tr. Adrian', 
        lines: [] 
    };
    state.modeIndex = 0;
    state.modes = ['Teacher Chat'];
    state.chatHistory = [];
    state.sessionStartTime = Date.now();
    state.lastTeacherSession = Date.now();
    saveState();
    updateHUD();

    renderActiveScreen();
    switchScreen('active');
    
    if (aiStarts) {
        const greeting = "Hello! I am Tr. Adrian. I'm excited to help you practice English today. What would you like to talk about?";
        addChatMessage('ai', greeting);
        playTTS(greeting, 'B', true); 
        state.chatHistory.push({ role: "assistant", content: greeting });
    } else {
        ui.active.feedback.textContent = "Your turn! Tap record to start the conversation with Tr. Adrian.";
        ui.active.feedback.classList.remove('hidden');
    }
}

function startLesson(id) {
    if (state.userEnergy <= 0) {
        openModal('premium');
        return;
    }

    state.userEnergy -= 1;
    saveState();
    updateHUD();

    state.currentLesson = state.lessons.find(l => l.id === id);
    state.currentLineIndex = 0;
    state.modeIndex = 0;
    state.modes = ['Shadowing', 'RolePlay'];
    state.chatHistory = [];
    state.sessionStartTime = Date.now();

    renderActiveScreen();
    switchScreen('active');
}

function renderActiveScreen() {
    const l = state.currentLesson;
    const isTeacher = l.type === 'teacher';
    const isExam = l.type === 'exam';
    const isRoleplay = state.modes[state.modeIndex] === 'RolePlay' || isTeacher;

    ui.active.title.textContent = l.title;
    ui.active.badge.textContent = isTeacher ? "TR. ADRIAN" : (isExam ? "EXAM MODE" : state.modes[state.modeIndex]);
    ui.active.feedback.classList.add('hidden');
    ui.btns.next.classList.add('hidden');
    
    if (isTeacher) {
        const isFree = state.subscriptionType === 'free';
        ui.active.durSlider.max = isFree ? 5 : 30;
        ui.active.durSlider.value = isFree ? 5 : 10;
        ui.active.durDisplay.textContent = ui.active.durSlider.value;
        state.discussionDuration = ui.active.durSlider.value;
    }

    if (l.explanation && state.currentLineIndex === 0) {
        ui.active.feedback.innerHTML = `<div style="text-align:left; font-size:0.85rem; color:var(--text); background:var(--bg); padding:10px; border-radius:10px; border-left:4px solid var(--primary); margin-bottom:10px;">
            <strong>💡 Grammar Tip:</strong><br>${l.explanation}
        </div>`;
        ui.active.feedback.classList.remove('hidden');
    }

    if (isRoleplay) {
        ui.active.shadowBox.classList.add('hidden');
        ui.active.chatBox.classList.remove('hidden');
        ui.active.durSlider.parentElement.classList.remove('hidden');
        ui.btns.listen.classList.add('hidden');
        
        if (!isTeacher && state.chatHistory.length === 0) {
            ui.active.chatList.innerHTML = '';
            addChatMessage('ai', l.lines[0].text);
            playTTS(l.lines[0].text, 'A', true);
            state.chatHistory.push({role: "system", content: "Init"});
        } else if (isTeacher && state.chatHistory.length === 0) {
             ui.active.chatList.innerHTML = ''; 
        }
    } else {
        ui.active.shadowBox.classList.remove('hidden');
        ui.active.chatBox.classList.add('hidden');
        ui.active.durSlider.parentElement.classList.add('hidden');
        ui.btns.listen.classList.remove('hidden');

        const line = l.lines[state.currentLineIndex];
        ui.active.role.textContent = line.role;
        ui.active.shadowText.textContent = isExam ? "???" : line.text;
        
        if (state.autoPlay && !isExam) {
            setTimeout(() => playTTS(line.text, line.role), 500);
        }
    }
}

async function handleRecord() {
    if (ui.btns.record.classList.contains('recording')) {
        mediaRecorder.stop();
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        
        ui.btns.record.classList.add('recording');
        ui.btns.record.textContent = "Stop";
        
        mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
        mediaRecorder.onstop = async () => {
            ui.btns.record.classList.remove('recording');
            ui.btns.record.textContent = "🎤 Record";
            ui.active.feedback.textContent = "Analyzing...";
            ui.active.feedback.classList.remove('hidden');

            const blob = new Blob(audioChunks, { type: 'audio/webm' });
            const formData = new FormData();
            formData.append('audio', blob, 'audio.webm');
            formData.append('tier', state.subscriptionType);
            formData.append('userApiKey', ui.inputs.apiKey.value);
            
            const isTeacher = state.currentLesson && state.currentLesson.type === 'teacher';

            if (!isTeacher && state.modes[state.modeIndex] === 'Shadowing') {
                formData.append('originalText', state.currentLesson.lines[state.currentLineIndex].text);
                const res = await fetch('/api/score', { method: 'POST', body: formData });
                handleResult(await res.json());
            } else {
                formData.append('history', JSON.stringify(state.chatHistory));
                formData.append('scenario', isTeacher ? "English Teacher" : state.currentLesson.title);
                formData.append('userRole', "Student");
                formData.append('aiRole', "Teacher");
                formData.append('startTime', state.sessionStartTime);
                formData.append('duration', isTeacher ? state.discussionDuration : ui.active.durSlider.value);
                
                ui.active.typing.classList.remove('hidden');
                const res = await fetch('/api/chat', { method: 'POST', body: formData });
                ui.active.typing.classList.add('hidden');
                
                const data = await res.json();
                if (data.error) { alert(data.error); return; }
                
                addChatMessage('user', data.userText);
                addChatMessage('ai', data.aiResponse);
                playTTS(data.aiResponse, isTeacher ? 'B' : 'A', true);
                
                state.chatHistory.push({ role: "user", content: data.userText });
                state.chatHistory.push({ role: "assistant", content: data.aiResponse });
            }
        };
        mediaRecorder.start();
    } catch (e) {
        alert("Microphone Error: " + e.message);
    }
}

function handleResult(data) {
    ui.active.feedback.textContent = "";
    if (data.passed) {
        ui.active.feedback.innerHTML = `<span style="color:var(--success)">✅ ${data.feedback}</span>`;
        gainExp(15);
        ui.btns.next.classList.remove('hidden');
    } else {
        ui.active.feedback.innerHTML = `<span style="color:var(--danger)">❌ ${data.feedback}</span>`;
    }
}

function gainExp(amount) {
    state.userExp += amount;
    const needed = state.userLevel * 100;
    if (state.userExp >= needed) {
        state.userLevel++;
        state.userExp -= needed;
        state.userEnergy = CONFIG[state.subscriptionType].maxEnergy;
        openModal('levelup');
        confetti({ particleCount: 200, spread: 100 });
    }
    saveState();
    updateHUD();
}

function addChatMessage(role, text) {
    const div = document.createElement('div');
    div.className = `chat-msg ${role}`;
    
    // Karaoke Container
    const textSpan = document.createElement('span');
    textSpan.className = 'msg-content';
    textSpan.innerHTML = text.split(' ').map(w => `<span class="word">${w}</span>`).join(' ');
    div.appendChild(textSpan);

    if (role === 'ai') {
        const relistenBtn = document.createElement('button');
        relistenBtn.className = 'btn-relisten';
        relistenBtn.innerHTML = '🔊 Re-listen';
        relistenBtn.onclick = () => playTTS(text, 'B', true, textSpan);
        div.appendChild(relistenBtn);
    }

    ui.active.chatList.appendChild(div);
    ui.active.chatList.scrollTop = ui.active.chatList.scrollHeight;
    return textSpan;
}

async function playTTS(text, role, isKaraoke = false, karaokeContainer = null) {
    if (activeAudio) activeAudio.pause();
    try {
        const res = await fetch('/api/tts', { 
            method: 'POST', 
            body: JSON.stringify({ text, role }) 
        });
        const data = await res.json();
        activeAudio = new Audio("data:audio/mp3;base64," + data.audio);
        
        if (isKaraoke && data.alignment) {
            const words = (karaokeContainer || ui.active.chatList.lastElementChild.querySelector('.msg-content')).querySelectorAll('.word');
            activeAudio.ontimeupdate = () => {
                const cur = activeAudio.currentTime;
                data.alignment.forEach((align, i) => {
                    if (cur >= align.start && cur <= align.end) {
                        words.forEach(w => w.classList.remove('active'));
                        if (words[i]) words[i].classList.add('active');
                    }
                });
            };
            activeAudio.onended = () => words.forEach(w => w.classList.remove('active'));
        }
        
        activeAudio.play();
    } catch(e) {}
}

function bindEvents() {
    ui.btns.record.onclick = handleRecord;
    ui.btns.listen.onclick = () => {
        const l = state.currentLesson;
        playTTS(l.lines[state.currentLineIndex].text, l.lines[state.currentLineIndex].role);
    };
    ui.btns.next.onclick = () => {
        state.currentLineIndex++;
        if (state.currentLineIndex >= state.currentLesson.lines.length) {
            state.modeIndex++;
            state.currentLineIndex = 0;
            if (state.modeIndex >= state.modes.length) {
                alert("Lesson Complete!");
                switchScreen('list');
                return;
            }
        }
        renderActiveScreen();
    };
    ui.btns.back.onclick = () => switchScreen('list');
    ui.btns.premium.onclick = () => openModal('premium');
    ui.active.durSlider.oninput = (e) => {
        ui.active.durDisplay.textContent = e.target.value;
        state.discussionDuration = e.target.value;
    };
    
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
        const res = await fetch('/api/admin', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ action: 'redeem', code })
        });
        const data = await res.json();
        if (data.success) {
            state.subscriptionType = data.type;
            state.userEnergy = CONFIG[data.type].maxEnergy;
            alert("Unlocked: " + CONFIG[data.type].label);
            closeAllModals();
            saveState();
            updateHUD();
        } else {
            alert("Invalid Code");
        }
    };
    
    ui.lesson.search.oninput = (e) => {
        const q = e.target.value.toLowerCase();
        const filtered = state.lessons.filter(l => l.title.toLowerCase().includes(q));
        renderLessons(filtered);
    };
    
    ui.lesson.tabs.forEach(t => t.onclick = (e) => {
        ui.lesson.tabs.forEach(x => x.classList.remove('active'));
        e.target.classList.add('active');
        const type = e.target.dataset.type;
        const filtered = state.lessons.filter(l => type === 'all' || l.type === type);
        renderLessons(filtered);
    });
}

function renderLessons(list = state.lessons) {
    ui.lesson.list.innerHTML = list.map(l => `
        <div class="lesson-card" onclick="startLesson(${l.id})">
            <div class="card-icon">${l.type === 'conversation' ? '💬' : l.type === 'grammar' ? '📘' : l.type === 'exam' ? '🏆' : '🎓'}</div>
            <div class="card-info">
                <h4>${l.title}</h4>
                <p>${l.lines.length} lines • ${l.type.toUpperCase()}</p>
            </div>
        </div>
    `).join('');
}

function switchScreen(name) {
    Object.values(ui.screens).forEach(s => s?.classList.add('hidden'));
    if (name === 'list') ui.screens.list.classList.remove('hidden');
    if (name === 'active') ui.screens.active.classList.remove('hidden');
    closeAllModals();
}

function openModal(name) { ui.screens[name].classList.remove('hidden'); }
function closeAllModals() {
    ui.screens.premium.classList.add('hidden');
    ui.screens.admin.classList.add('hidden');
    ui.screens.levelup.classList.add('hidden');
}

init();

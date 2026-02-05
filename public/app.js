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
    userEnergy: 10, // Default for free
    lastEnergyUpdate: Date.now(),
    
    // Session Config
    discussionDuration: 2,
    sessionStartTime: null,
    autoPlay: true,
    currentType: 'all',
    
    // Admin & System
    adminPassword: '',
    isDarkMode: false
};

// Configuration
const CONFIG = {
    free: { maxEnergy: 10, regenMins: 30, label: 'Free Plan' },
    'api-license': { maxEnergy: 9999, regenMins: 0, label: 'API License' }, // Infinite for BYO Key
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
}

function loadState() {
    const saved = localStorage.getItem('ep_save_v3');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            // Merge saved data carefully
            state.userLevel = data.userLevel || 1;
            state.userExp = data.userExp || 0;
            state.subscriptionType = data.subscriptionType || 'free';
            state.userApiKey = data.userApiKey || '';
            state.isDarkMode = data.isDarkMode || false;
            
            // Energy Math: Ensure it doesn't exceed current tier max
            const max = CONFIG[state.subscriptionType].maxEnergy;
            state.userEnergy = Math.min(max, data.userEnergy !== undefined ? data.userEnergy : 10);
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
        userApiKey: state.userApiKey,
        userEnergy: state.userEnergy,
        lastEnergyUpdate: state.lastEnergyUpdate,
        isDarkMode: state.isDarkMode
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
    
    // XP Bar Math
    const xpNeeded = state.userLevel * 100;
    const pct = Math.min(100, (state.userExp / xpNeeded) * 100);
    ui.hud.xpBar.style.width = `${pct}%`;

    // Premium UI State
    if (state.subscriptionType !== 'free') {
        ui.btns.premium.textContent = "👑 " + CONFIG[state.subscriptionType].label;
        ui.btns.premium.classList.add('is-pro');
    } else {
        ui.btns.premium.textContent = "Get Premium";
        ui.btns.premium.classList.remove('is-pro');
    }
}

function startLesson(id) {
    if (state.userEnergy <= 0) {
        openModal('premium');
        return;
    }

    // Deduct Energy
    state.userEnergy -= 1;
    saveState();
    updateHUD();

    state.currentLesson = state.lessons.find(l => l.id === id);
    state.currentLineIndex = 0;
    state.modeIndex = 0;
    state.chatHistory = [];
    state.sessionStartTime = Date.now();

    renderActiveScreen();
    switchScreen('active');
}

function renderActiveScreen() {
    const l = state.currentLesson;
    const isExam = l.type === 'exam';
    const isRoleplay = state.modes[state.modeIndex] === 'RolePlay';

    ui.active.title.textContent = l.title;
    ui.active.badge.textContent = isExam ? "EXAM MODE" : state.modes[state.modeIndex];
    ui.active.feedback.classList.add('hidden');
    ui.btns.next.classList.add('hidden');

    // Toggle Views
    if (isRoleplay) {
        ui.active.shadowBox.classList.add('hidden');
        ui.active.chatBox.classList.remove('hidden');
        ui.active.durSlider.parentElement.classList.remove('hidden');
        ui.btns.listen.classList.add('hidden'); // No listen in RP
        
        // Init Chat
        if (state.chatHistory.length === 0) {
            ui.active.chatList.innerHTML = '';
            addChatMessage('ai', l.lines[0].text);
            playTTS(l.lines[0].text, 'A');
            state.chatHistory.push({role: "system", content: "Init"}); // Placeholder
        }
    } else {
        // Shadowing
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

// --- RECORDING & API ---

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
            
            // Meta Data
            formData.append('tier', state.subscriptionType);
            formData.append('userApiKey', state.userApiKey); // Only used if tier=api-license
            
            // Scenario Data
            if (state.modes[state.modeIndex] === 'Shadowing') {
                formData.append('originalText', state.currentLesson.lines[state.currentLineIndex].text);
                const res = await fetch('/api/score', { method: 'POST', body: formData });
                handleResult(await res.json());
            } else {
                // Roleplay
                formData.append('history', JSON.stringify(state.chatHistory));
                formData.append('scenario', state.currentLesson.title);
                formData.append('userRole', 'B');
                formData.append('aiRole', 'A');
                formData.append('startTime', state.sessionStartTime);
                formData.append('duration', state.discussionDuration);
                
                ui.active.typing.classList.remove('hidden');
                const res = await fetch('/api/chat', { method: 'POST', body: formData });
                ui.active.typing.classList.add('hidden');
                
                const data = await res.json();
                if (data.error) { alert(data.error); return; }
                
                addChatMessage('user', data.userText);
                addChatMessage('ai', data.aiResponse);
                playTTS(data.aiResponse, 'A');
                
                // Update History
                state.chatHistory.push({ role: "user", content: data.userText });
                state.chatHistory.push({ role: "assistant", content: data.aiResponse });
            }
        };
        mediaRecorder.start();
    } catch (e) {
        alert("Microphone Error");
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

// --- HELPERS ---

function gainExp(amount) {
    state.userExp += amount;
    const needed = state.userLevel * 100;
    if (state.userExp >= needed) {
        state.userLevel++;
        state.userExp -= needed;
        state.userEnergy = CONFIG[state.subscriptionType].maxEnergy; // Refill
        openModal('levelup');
        confetti({ particleCount: 200, spread: 100 });
    }
    saveState();
    updateHUD();
}

function addChatMessage(role, text) {
    const div = document.createElement('div');
    div.className = `chat-msg ${role}`;
    div.innerText = text;
    ui.active.chatList.appendChild(div);
    ui.active.chatList.scrollTop = ui.active.chatList.scrollHeight;
}

async function playTTS(text, role) {
    if (activeAudio) activeAudio.pause();
    try {
        const res = await fetch('/api/tts', { 
            method: 'POST', 
            body: JSON.stringify({ text, role }) 
        });
        const data = await res.json();
        activeAudio = new Audio("data:audio/mp3;base64," + data.audio);
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
            // Next Mode? Or Finish?
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
    ui.active.durSlider.oninput = (e) => ui.active.durDisplay.textContent = e.target.value;
    
    // Admin Code Gen
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
    
    // Redeem
    document.getElementById('btn-redeem').onclick = async () => {
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
    }
    
    // Filtering
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
    ui.lesson.list.innerHTML = list.slice(0,50).map(l => `
        <div class="lesson-card" onclick="startLesson(${l.id})">
            <div class="card-icon">${l.type === 'conversation' ? '💬' : l.type === 'grammar' ? '📘' : '🏆'}</div>
            <div class="card-info">
                <h4>${l.title}</h4>
                <p>${l.lines.length} lines • ${l.type.toUpperCase()}</p>
            </div>
        </div>
    `).join('');
}

function switchScreen(name) {
    // Hide all
    Object.values(ui.screens).forEach(s => s?.classList.add('hidden'));
    
    if (name === 'list') ui.screens.list.classList.remove('hidden');
    if (name === 'active') ui.screens.active.classList.remove('hidden');
    
    closeAllModals();
}

function openModal(name) {
    ui.screens[name].classList.remove('hidden');
}

function closeAllModals() {
    ui.screens.premium.classList.add('hidden');
    ui.screens.admin.classList.add('hidden');
    ui.screens.levelup.classList.add('hidden');
}

// Start
init();

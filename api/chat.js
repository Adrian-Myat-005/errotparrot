const Groq = require('groq-sdk');
const multer = require('multer');
const fs = require('fs');
const os = require('os');
const path = require('path');

const storage = multer.diskStorage({
    destination: os.tmpdir(),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || '.webm';
        cb(null, file.fieldname + '-' + Date.now() + ext);
    }
});
const upload = multer({ storage: storage });

const runMiddleware = (req, res, fn) => {
    return new Promise((resolve, reject) => {
        fn(req, res, (result) => {
            if (result instanceof Error) return reject(result);
            return resolve(result);
        });
    });
};

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    try {
        await runMiddleware(req, res, upload.single('audio'));
        const audioFile = req.file;
        let { history, scenario, userRole, aiRole, userApiKey, tier, duration, startTime, leaderMode } = req.body;

        // Set defaults if missing
        history = history || "[]";
        scenario = scenario || "General Conversation";
        duration = duration || "30";
        startTime = startTime || Date.now().toString();
        leaderMode = leaderMode || "ai";

        if (!audioFile) {
            return res.status(400).json({ error: 'Missing audio file' });
        }

        let apiKey;
        if (tier === 'api-license') {
            if (!userApiKey || userApiKey.trim() === '') {
                if (fs.existsSync(audioFile.path)) fs.unlinkSync(audioFile.path);
                return res.status(401).json({ error: 'Valid Groq API Key required.' });
            }
            apiKey = userApiKey;
        } else {
            apiKey = process.env.GROQ_API_KEY;
        }

        if (!apiKey) {
            if (fs.existsSync(audioFile.path)) fs.unlinkSync(audioFile.path);
            return res.status(500).json({ error: "Server API Key not configured." });
        }

        const elapsedMinutes = (Date.now() - parseInt(startTime)) / 60000;
        if (elapsedMinutes > parseInt(duration)) {
            if (fs.existsSync(audioFile.path)) fs.unlinkSync(audioFile.path);
            return res.status(403).json({ error: 'Session time limit reached.' });
        }

        const groq = new Groq({ apiKey });

        try {
            const transcription = await groq.audio.transcriptions.create({
                file: fs.createReadStream(audioFile.path),
                model: "whisper-large-v3-turbo",
            });
            const userText = transcription.text;

            const leadership = leaderMode === 'ai' 
                ? "LEAD: You are the leader. Ask engaging questions, introduce new sub-topics related to the scenario, and keep the momentum."
                : "FOLLOW: The student is the leader. Answer their questions and support their chosen direction, but still offer corrections.";

            let systemContent = `You are a real human in: ${scenario}. Roleplay as ${aiRole || 'the partner'}. 
                    STRICT: No AI jargon. Speak naturally. Short responses (1-2 sentences).`;

            if (scenario.includes("Teacher") || scenario.includes("Adrian")) {
                systemContent = `You are Tr. Adrian, a highly adaptive and proactive English teacher. 
                1. ${leadership}
                2. ANALYZE: Carefully evaluate the student's grammar, vocabulary, and logical consistency. If they say something factually wrong or nonsensical, point it out gently.
                3. ADAPT: Adjust your complexity. If they are basic, use simple words. If advanced, use idioms and complex structures.
                4. CORRECT: Politely correct mistakes in a "Teacher Tip" style.
                5. ANTI-LOOP: NEVER repeat the same questions, phrases, or topics. Keep a mental map of what has been discussed and move forward.
                6. LOGIC: Your responses must be 100% logically sound and contextually relevant.
                7. LIMIT: 2-3 sentences max. No AI-style preamble (e.g., "That's a great question!"). Get straight to the point. Be human.`;
            }

            const chatHistory = JSON.parse(history);
            const limitedHistory = chatHistory.slice(-10);

            const messages = [
                { 
                    role: "system", 
                    content: `${systemContent}
                    Return ONLY JSON:
                    {
                        "userText": "${userText}",
                        "aiResponse": "string",
                        "score": number,
                        "feedback": "human-like tip",
                        "passed": boolean
                    }`
                },
                ...limitedHistory
            ];

            const completion = await groq.chat.completions.create({
                messages,
                model: "llama-3.1-8b-instant",
                response_format: { type: "json_object" },
                max_tokens: 300
            });

            const data = JSON.parse(completion.choices[0].message.content);
            if (fs.existsSync(audioFile.path)) fs.unlinkSync(audioFile.path);
            return res.json(data);

        } catch (groqError) {
            if (fs.existsSync(audioFile.path)) fs.unlinkSync(audioFile.path);
            return res.status(503).json({ error: "AI error. If you use your own key, check its validity/balance." });
        }
    } catch (error) {
        res.status(500).json({ error: "Failed to process audio." });
    }
};

module.exports.config = { api: { bodyParser: false } };

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
        const { history, scenario, userRole, aiRole, userApiKey, tier, duration, startTime } = req.body;

        if (!audioFile || !history) {
            if (audioFile && fs.existsSync(audioFile.path)) fs.unlinkSync(audioFile.path);
            return res.status(400).json({ error: 'Missing data' });
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

            const messages = [
                { 
                    role: "system", 
                    content: `You are a real human in: ${scenario}. Roleplay as ${aiRole}. 
                    STRICT: No AI jargon. Speak naturally. Short responses (1-2 sentences).
                    Return ONLY JSON:
                    {
                        "userText": "${userText}",
                        "aiResponse": "string",
                        "score": number,
                        "feedback": "human-like tip",
                        "missedWords": ["list", "of", "actual", "wrong", "words"],
                        "passed": boolean
                    }`
                },
                ...JSON.parse(history)
            ];

            const completion = await groq.chat.completions.create({
                messages,
                model: "llama-3.3-70b-versatile",
                response_format: { type: "json_object" }
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

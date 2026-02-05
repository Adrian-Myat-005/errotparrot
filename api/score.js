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
        const { originalText, userApiKey, tier } = req.body;

        if (!audioFile || !originalText) {
            if (audioFile && fs.existsSync(audioFile.path)) fs.unlinkSync(audioFile.path);
            return res.status(400).json({ error: 'Missing data' });
        }

        // Tier Logic for scoring
        let apiKey;
        if (tier === 'api-license') {
            if (!userApiKey) {
                if (fs.existsSync(audioFile.path)) fs.unlinkSync(audioFile.path);
                return res.status(401).json({ error: 'API Key required.' });
            }
            apiKey = userApiKey;
        } else {
            apiKey = process.env.GROQ_API_KEY;
        }

        const groq = new Groq({ apiKey });

        try {
            const transcription = await groq.audio.transcriptions.create({
                file: fs.createReadStream(audioFile.path),
                model: "whisper-large-v3-turbo",
            });
            const transcript = transcription.text;

            const prompt = `
            Coach speech. Target: "${originalText}". Said: "${transcript}".
            Return ONLY JSON:
            {
                "score": number,
                "feedback": "1 friendly sentence",
                "missedWords": ["list", "of", "errors"],
                "passed": boolean
            }`;

            const completion = await groq.chat.completions.create({
                messages: [{ role: "user", content: prompt }],
                model: "llama-3.3-70b-versatile",
                response_format: { type: "json_object" }
            });

            const data = JSON.parse(completion.choices[0].message.content);
            data.transcript = transcript;

            if (fs.existsSync(audioFile.path)) fs.unlinkSync(audioFile.path);
            return res.json(data);

        } catch (groqError) {
            if (fs.existsSync(audioFile.path)) fs.unlinkSync(audioFile.path);
            return res.status(503).json({ error: "Service busy. Check your key if using License mode." });
        }
    } catch (error) {
        res.status(500).json({ error: "Score failed" });
    }
};

module.exports.config = { api: { bodyParser: false } };
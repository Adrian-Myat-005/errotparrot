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
            Evaluate speech for a friendly shadowing app. 
            Target Phrase: "${originalText}"
            User Spoke: "${transcript}"

            HUMANIZED GUIDELINES:
            1. Be very encouraging. If they got the main idea, they should pass.
            2. Ignore capitalization, punctuation, and minor Whisper artifacts.
            3. Do NOT punish for natural speech variations or minor stumbles.
            4. Focus on the 'flow' and core vocabulary.
            5. Provide an HTML string for 'corrections':
               - Correct words: <span class='correct-word'>
               - Challenging words: <span class='wrong'> (NO underlines allowed)
            6. A score of 65+ is a PASS for regular lessons.

            Return ONLY JSON:
            {
                "score": number (0-100),
                "feedback": "1 charm and friendly sentence",
                "corrections": "HTML string",
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
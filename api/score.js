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
        const { originalText, userApiKey, tier, lessonType, prompt: grammarPrompt } = req.body;

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

            if (lessonType === 'grammar_speaking') {
                prompt = `
                Evaluate a grammar transformation task. 
                Focus ONLY on the grammar rule. IGNORE pronunciation, accents, and minor typos.
                
                Task Instruction: "${grammarPrompt}"
                Target Answer (Transformed): "${originalText}"
                User Spoke: "${transcript}"

                STRICT EVALUATION CRITERIA:
                1. GRAMMAR FIRST: If the user included the key transformation (e.g., added "not"/"don't" for negation, or used "Verb + Subject" for questions), they MUST PASS with SCORE 100.
                2. LENIENCY: Treat the User's Speech as if it was autocorrected. Do not penalize for mispronounced words if the grammar structure is visible.
                3. SHADOWING: Only fail if they repeat the base phrase from the Instruction exactly without any transformation (e.g., saying "The soup is thick" when told to negate it).
                4. NEGATION CHECK: If the task is 'Negate' and they did NOT say "not", "no", "don't", "can't", etc., they FAIL.
                
                Return ONLY JSON:
                {
                    "score": 100 (if grammar is correct) or 0 (if they shadowed),
                    "feedback": "1 short sentence on the grammar rule used",
                    "corrections": "Clean HTML string",
                    "passed": boolean
                }`;
            } else {
                prompt = `
                Evaluate speech for a friendly but professional shadowing app. 
                Target Phrase: "${originalText}"
                User Spoke: "${transcript}"

                GUIDELINES:
                1. Be encouraging but ensure learning. If they missed key words or changed the meaning, they must NOT pass.
                2. Ignore minor technical artifacts (punctuation, capitalization).
                3. Focus on: Core vocabulary, phonetic similarity, and natural flow.
                4. If the score is < 70, provide a specific "Teacher Tip" on what to improve.
                5. Provide HTML string for 'corrections' using:
                   - <span class='correct-word'> for good words
                   - <span class='wrong'> for mistakes (No underlines)

                Return ONLY JSON:
                {
                    "score": number (0-100),
                    "feedback": "1 friendly but constructive sentence",
                    "corrections": "HTML string",
                    "passed": boolean (true if score >= 70)
                }`;
            }

            const completion = await groq.chat.completions.create({
                messages: [{ role: "user", content: prompt }],
                model: "llama-3.1-8b-instant",
                response_format: { type: "json_object" },
                max_tokens: 300
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
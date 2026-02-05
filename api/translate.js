const Groq = require('groq-sdk');

module.exports = async (req, res) => {
    const { word, lang } = req.body;

    if (!word || !lang) {
        return res.status(400).json({ error: 'Missing word or lang' });
    }

    const groqKey = process.env.GROQ_API_KEY;
    const groq = new Groq({ apiKey: groqKey });

    const langNames = {
        'my': 'Burmese (Myanmar)',
        'zh': 'Chinese',
        'ja': 'Japanese'
    };

    try {
        const prompt = `Translate the following English text into natural ${langNames[lang]}: "${word}"
        Return ONLY the translated text. No explanation or notes.`;

        const completion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "llama-3.3-70b-versatile",
            max_tokens: 100
        });

        const translation = completion.choices[0].message.content.trim();
        return res.json({ translation });
    } catch (error) {
        console.error("Translation Error:", error);
        return res.status(500).json({ error: "Translation failed" });
    }
};

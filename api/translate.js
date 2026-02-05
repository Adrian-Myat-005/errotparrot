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
        const prompt = `Provide a dictionary-style translation for the English word: "${word}" into ${langNames[lang]}. 
        Return ONLY the translated word or short phrase. No explanation.`;

        const completion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "llama-3.3-70b-versatile",
            max_tokens: 20
        });

        const translation = completion.choices[0].message.content.trim();
        return res.json({ translation });
    } catch (error) {
        console.error("Translation Error:", error);
        return res.status(500).json({ error: "Translation failed" });
    }
};

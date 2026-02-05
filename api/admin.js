const fs = require('fs');
const path = require('path');
const os = require('os');

const CODES_FILE = path.join(os.tmpdir(), 'premium_codes.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

const getCodes = () => {
    try {
        if (!fs.existsSync(CODES_FILE)) return {};
        return JSON.parse(fs.readFileSync(CODES_FILE, 'utf8'));
    } catch (e) { return {}; }
};

const saveCodes = (codes) => {
    try { fs.writeFileSync(CODES_FILE, JSON.stringify(codes, null, 2)); } catch (e) {}
};

module.exports = async (req, res) => {
    const { action, type, code, password } = req.body;

    if (action === 'generate') {
        if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Unauthorized' });
        const newCode = 'EP-' + Math.random().toString(36).substr(2, 9).toUpperCase();
        const codes = getCodes();
        codes[newCode] = { type, redeemed: false };
        saveCodes(codes);
        return res.json({ code: newCode });
    }

    if (action === 'redeem') {
        if (code === 'ADMIN-FREE-ACCESS') {
            return res.json({ success: true, type: 'full-mode' });
        }
        const codes = getCodes();
        if (codes[code] && !codes[code].redeemed) {
            codes[code].redeemed = true;
            saveCodes(codes);
            return res.json({ success: true, type: codes[code].type });
        }
        return res.status(400).json({ success: false, error: 'Invalid or used code' });
    }
    res.status(400).json({ error: 'Invalid action' });
};

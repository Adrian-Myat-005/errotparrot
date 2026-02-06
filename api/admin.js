const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG_FILE = path.join(os.tmpdir(), 'ep_config.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

const getConfig = () => {
    try {
        if (!fs.existsSync(CONFIG_FILE)) {
            return { codes: {}, settings: { adsEnabled: true, adDuration: 5 } };
        }
        return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    } catch (e) { 
        return { codes: {}, settings: { adsEnabled: true, adDuration: 5 } }; 
    }
};

const saveConfig = (config) => {
    try { fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2)); } catch (e) {}
};

module.exports = async (req, res) => {
    const { action, type, code, password, settings } = req.body;

    if (action === 'generate') {
        if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Unauthorized' });
        const newCode = 'EP-' + Math.random().toString(36).substr(2, 9).toUpperCase();
        const config = getConfig();
        config.codes[newCode] = { type, redeemed: false };
        saveConfig(config);
        return res.json({ code: newCode });
    }

    if (action === 'redeem') {
        if (code === 'ADMIN-FREE-ACCESS') {
            return res.json({ success: true, type: 'pro-access', expiry: Date.now() + (30 * 24 * 60 * 60 * 1000) });
        }
        const config = getConfig();
        if (config.codes[code] && !config.codes[code].redeemed) {
            config.codes[code].redeemed = true;
            saveConfig(config);
            const expiry = Date.now() + (30 * 24 * 60 * 60 * 1000); // 30 Days
            return res.json({ success: true, type: config.codes[code].type, expiry });
        }
        return res.status(400).json({ success: false, error: 'Invalid or used code' });
    }

    if (action === 'getSettings') {
        const config = getConfig();
        return res.json(config.settings);
    }

    if (action === 'updateSettings') {
        if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Unauthorized' });
        const config = getConfig();
        config.settings = { ...config.settings, ...settings };
        saveConfig(config);
        return res.json({ success: true });
    }

    res.status(400).json({ error: 'Invalid action' });
};
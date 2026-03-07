const fs = require('fs');

const data = JSON.parse(fs.readFileSync('public/lessons.json', 'utf8'));

// Filter out ALL lessons that are grammar-related to start fresh
const filtered = data.filter(l => !(l.category === 'grammar' || l.topic.includes('Grammar')));

fs.writeFileSync('public/lessons.json', JSON.stringify(filtered, null, 2));
console.log("Cleaned old grammar lessons. Remaining lessons:", filtered.length);

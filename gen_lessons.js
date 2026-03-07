const phase1 = [
    "The sink is full.", "The rag is wet.", "The pan is heavy.", "The oven is clean.", "The juice is cold.",
    "The soup is thick.", "The knife is dirty.", "The bowl is red.", "The stove is hot.", "The milk is bad.",
    "The fruit is sweet.", "The meat is tough.", "The chef is busy.", "The food is cold.", "The plates are dry.",
    "The cups are small.", "The apples are green.", "The dishes are clean.", "The carrots are hard.", "The beans are soft.",
    "I have a blender.", "You have a spatula.", "We have some cheese.", "They have a toaster.", "He has a frying pan.",
    "She has a grater.", "I have the recipe.", "You have the butter.", "We have fresh garlic.", "They have red onions.",
    "He has a cutting board.", "She has a big oven.", "I have some flour.", "You have the olive oil.", "We have a trash can.",
    "They have cold ice.", "He has a coffee mug.", "She has a wine glass.", "I have the pepper grinder.", "You have the paper towels.",
    "I grate the cheese.", "You mash the potatoes.", "We freeze the meat.", "They melt the butter.", "I crack the eggs.",
    "You squeeze the lemon.", "We crush the garlic.", "They drain the pasta.", "I spray the pan.", "You spread the jam.",
    "He grates the cheese.", "She mashes the potatoes.", "It tastes very spicy.", "He melts the butter.", "She cracks the egg.",
    "He squeezes the lemon.", "She crushes the garlic.", "He drains the pasta.", "She sprays the pan.", "He spreads the jam.",
    "I can grate cheese.", "You can melt butter.", "We can crack eggs.", "They can drain pasta.", "He can flip pancakes.",
    "She can roast chicken.", "I can grill fish.", "You can stack plates.", "We can plug in blenders.", "They can sweep crumbs.",
    "I will grate cheese.", "You will melt butter.", "We will crack eggs.", "They will drain pasta.", "He will flip pancakes.",
    "She will roast chicken.", "I will grill fish.", "You will stack plates.", "We will plug in blenders.", "They will sweep crumbs."
];

const phase2 = [
    "I am cutting the vegetables.", "You are washing the plates.", "He is cooking the rice.", "She is boiling the water.", "It is burning in the oven.",
    "We are eating the dinner.", "They are drinking the tea.", "I am wiping the counter.", "You are mixing the salad.", "He is peeling the potatoes.",
    "I cleaned the stove.", "You wiped the counter.", "He boiled the eggs.", "She baked the bread.", "It tasted very good.",
    "We washed the cups.", "They mixed the food.", "I peeled the lemon.", "You chopped the meat.", "He sliced the cheese.",
    "I bought fresh fruit.", "You ate the warm bread.", "He drank the cold water.", "She made the coffee.", "It fell on the floor.",
    "We cut the cake.", "They set the table.", "I found the spoon.", "You left the kitchen.", "He put the pan away.",
    "I have finished the cooking.", "You have emptied the trash.", "He has cleaned the sink.", "She has washed the fruit.", "It has boiled over.",
    "We have eaten the pizza.", "They have baked the cookies.", "I have cut the bread.", "You have stirred the soup.", "He has bought the milk.",
    "I am going to cook dinner.", "You are going to bake a cake.", "He is going to wash the floor.", "She is going to chop the garlic.", "It is going to taste great.",
    "We are going to buy groceries.", "They are going to eat soon.", "I am going to boil the pasta.", "You are going to clean the fridge.", "He is going to slice the meat."
];

const irregularPast = {
    "bought": "buy", "ate": "eat", "drank": "drink", "made": "make", "fell": "fall",
    "cut": "cut", "set": "set", "found": "find", "left": "leave", "put": "put",
    "took": "take", "brought": "bring", "gave": "give", "swept": "sweep", "kept": "keep",
    "chose": "choose", "broke": "break", "forgot": "forget", "built": "build", "fed": "feed"
};

function getBaseVerb(v) {
    if (irregularPast[v]) return irregularPast[v];
    if (v.endsWith("ied")) return v.replace(/ied$/, "y");
    if (v.endsWith("pped")) return v.replace(/pped$/, "p");
    if (v.endsWith("tted")) return v.replace(/tted$/, "t");
    if (v.endsWith("ed")) {
        // e.g. baked -> bake, boiled -> boil. Just strip 'd' or 'ed' based on root. Hard to do perfectly without a dict, but we'll try:
        let root = v.replace(/ed$/, "");
        if (["bak", "tast", "slic", "wip", "clos"].includes(root)) return root + "e"; 
        return root;
    }
    if (v.endsWith("es")) {
        if (v === "mashes") return "mash";
        if (v === "crushes") return "crush";
        if (v === "grates") return "grate";
        if (v === "squeezes") return "squeeze";
        return v.replace(/s$/, ""); // falls back to stripping 's'
    }
    if (v.endsWith("s")) return v.replace(/s$/, "");
    return v;
}

function negate(s) {
    let res = s.replace(/\.$/, "");
    // Aux verbs first
    if (res.match(/\b(is|are|am|can|will)\b/)) {
        res = res.replace(/\bis\b/, "is not")
                 .replace(/\bare\b/, "are not")
                 .replace(/\bam\b/, "am not")
                 .replace(/\bcan\b/, "cannot")
                 .replace(/\bwill\b/, "will not");
    } else if (res.match(/\b(have|has) (finished|emptied|cleaned|washed|boiled|eaten|baked|cut|stirred|bought|made|set|found|left|put|taken|brought|given|swept|kept|chosen|broken|forgotten|built|fed)\b/)) {
        res = res.replace(/\bhave\b/, "have not").replace(/\bhas\b/, "has not");
    } else if (res.match(/\b(have|has)\b/)) {
        res = res.replace(/\bhave\b/, "do not have").replace(/\bhas\b/, "does not have");
    } else {
        // Simple present and past
        let match = res.match(/^(I|You|He|She|It|We|They) (\w+)(.*)$/);
        if (match) {
            let pron = match[1];
            let verb = match[2];
            let rest = match[3];
            
            // Is it past tense? (ed or irregular)
            if (verb.endsWith("ed") || irregularPast[verb]) {
                res = pron + " did not " + getBaseVerb(verb) + rest;
            } else {
                // Present tense
                let aux = (pron === "He" || pron === "She" || pron === "It") ? "does not" : "do not";
                res = pron + " " + aux + " " + getBaseVerb(verb) + rest;
            }
        }
    }
    
    // Capitalize first letter just in case
    return res.charAt(0).toUpperCase() + res.slice(1) + ".";
}

function interrogative(s) {
    let res = s.replace(/\.$/, "");
    // Aux verbs
    if (res.match(/\b(is|are|am|can|will)\b/)) {
        let match = res.match(/^(The \w+|I|You|He|She|It|We|They) (is|are|am|can|will) (.*)$/);
        if (match) {
            res = match[2] + " " + match[1].toLowerCase() + " " + match[3];
        }
    } else if (res.match(/\b(have|has) (finished|emptied|cleaned|washed|boiled|eaten|baked|cut|stirred|bought)\b/)) {
         let match = res.match(/^(I|You|He|She|It|We|They) (have|has) (.*)$/);
         if (match) res = match[2] + " " + match[1].toLowerCase() + " " + match[3];
    } else if (res.match(/\b(have|has)\b/)) {
         let match = res.match(/^(I|You|He|She|It|We|They) (have|has) (.*)$/);
         if (match) {
             let aux = match[2] === "has" ? "does" : "do";
             res = aux + " " + match[1].toLowerCase() + " have " + match[3];
         }
    } else {
        let match = res.match(/^(I|You|He|She|It|We|They) (\w+)(.*)$/);
        if (match) {
            let pron = match[1];
            let verb = match[2];
            let rest = match[3];
            
            if (verb.endsWith("ed") || irregularPast[verb]) {
                res = "did " + pron.toLowerCase() + " " + getBaseVerb(verb) + rest;
            } else {
                let aux = (pron === "He" || pron === "She" || pron === "It") ? "does" : "do";
                res = aux + " " + pron.toLowerCase() + " " + getBaseVerb(verb) + rest;
            }
        }
    }
    
    return res.charAt(0).toUpperCase() + res.slice(1) + "?";
}

const lessons = [];
let lessonId = 201;

function createBatches(phrases, titlePrefix, icon) {
    for (let i = 0; i < phrases.length; i += 5) {
        lessons.push({
            id: lessonId++,
            type: "grammar_speaking",
            category: "grammar",
            topic: `${titlePrefix} (Part ${Math.floor(i/5) + 1})`,
            icon: icon,
            phrases: phrases.slice(i, i + 5)
        });
    }
}

const p1Neg = phase1.map(s => ({ en: negate(s), my: "Negate: " + s }));
const p1Int = phase1.map(s => ({ en: interrogative(s), my: "Question: " + s }));
const p2Neg = phase2.map(s => ({ en: negate(s), my: "Negate: " + s }));
const p2Int = phase2.map(s => ({ en: interrogative(s), my: "Question: " + s }));

createBatches(p1Neg, "Grammar: Phase 1 Negation", "🚫");
createBatches(p1Int, "Grammar: Phase 1 Questions", "❓");
createBatches(p2Neg, "Grammar: Phase 2 Negation", "🚫");
createBatches(p2Int, "Grammar: Phase 2 Questions", "❓");

const fs = require('fs');
const existing = JSON.parse(fs.readFileSync('public/lessons.json', 'utf8'));
const filtered = existing.filter(l => l.type !== "grammar_speaking");
const merged = [...filtered, ...lessons];
fs.writeFileSync('public/lessons.json', JSON.stringify(merged, null, 2));
console.log("Written updated robust grammar lessons in blocks of 5.");

// Quick manual assertion check
console.log(negate("She mashes the potatoes.")); // She does not mash the potatoes.
console.log(negate("He boiled the eggs.")); // He did not boil the eggs.
console.log(interrogative("You wiped the counter.")); // Did you wipe the counter?

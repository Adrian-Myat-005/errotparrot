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

function negate(s) {
    let res = s.replace(/\.$/, "");
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
    } else if (res.match(/\b(grate|mash|freeze|melt|crack|squeeze|crush|drain|spray|spread|season|flip|roast|grill|sort|stack|unroll|plug|soak|sweep)\b/)) {
        let match = res.match(/^(I|You|We|They) (.*)$/);
        if (match) res = match[1] + " do not " + match[2];
    } else if (res.match(/^(He|She|It) (.*)s\b/)) {
        let match = res.match(/^(He|She|It) (\w+)s(.*)$/);
        if (match) res = match[1] + " does not " + match[2] + match[3];
    } else if (res.match(/\b(cleaned|wiped|boiled|baked|tasted|washed|mixed|peeled|chopped|sliced|bought|ate|drank|made|fell|cut|set|found|left|put)\b/)) {
        let match = res.match(/^(I|You|He|She|It|We|They) (\w+)(.*)$/);
        if (match) {
            let verb = match[2];
            if (verb === "bought") verb = "buy";
            else if (verb === "ate") verb = "eat";
            else if (verb === "drank") verb = "drink";
            else if (verb === "made") verb = "make";
            else if (verb === "fell") verb = "fall";
            else if (verb === "cut") verb = "cut";
            else if (verb === "set") verb = "set";
            else if (verb === "found") verb = "find";
            else if (verb === "left") verb = "leave";
            else if (verb === "put") verb = "put";
            else verb = verb.replace(/ed$/, "").replace(/ied$/, "y").replace(/pped$/, "p").replace(/tted$/, "t").replace(/ed$/, ""); 
            res = match[1] + " did not " + verb + match[3];
        }
    }
    return res.trim() + ".";
}

function interrogative(s) {
    let res = s.replace(/\.$/, "");
    if (res.match(/\b(is|are|am|can|will)\b/)) {
        let match = res.match(/^(The \w+|I|You|He|She|It|We|They) (is|are|am|can|will) (.*)$/);
        if (match) {
            res = match[2].charAt(0).toUpperCase() + match[2].slice(1) + " " + match[1].charAt(0).toLowerCase() + match[1].slice(1) + " " + match[3];
        }
    } else if (res.match(/\b(have|has) (finished|emptied|cleaned|washed|boiled|eaten|baked|cut|stirred|bought)\b/)) {
         let match = res.match(/^(I|You|He|She|It|We|They) (have|has) (.*)$/);
         if (match) res = match[2].charAt(0).toUpperCase() + match[2].slice(1) + " " + match[1].toLowerCase() + " " + match[3];
    } else if (res.match(/\b(have|has)\b/)) {
         let match = res.match(/^(I|You|He|She|It|We|They) (have|has) (.*)$/);
         if (match) {
             let aux = match[2] === "has" ? "Does" : "Do";
             res = aux + " " + match[1].toLowerCase() + " have " + match[3];
         }
    } else if (res.match(/\b(grate|mash|freeze|melt|crack|squeeze|crush|drain|spray|spread|season|flip|roast|grill|sort|stack|unroll|plug|soak|sweep)s?\b/)) {
        let match = res.match(/^(I|You|He|She|It|We|They) (\w+)(.*)$/);
        if (match) {
            let aux = (match[1] === "He" || match[1] === "She" || match[1] === "It") ? "Does" : "Do";
            let verb = match[2].replace(/s$/, "");
            res = aux + " " + match[1].toLowerCase() + " " + verb + match[3];
        }
    } else if (res.match(/\b(cleaned|wiped|boiled|baked|tasted|washed|mixed|peeled|chopped|sliced|bought|ate|drank|made|fell|cut|set|found|left|put)\b/)) {
        let match = res.match(/^(I|You|He|She|It|We|They) (\w+)(.*)$/);
        if (match) {
            let verb = match[2];
            if (verb === "bought") verb = "buy";
            else if (verb === "ate") verb = "eat";
            else if (verb === "drank") verb = "drink";
            else if (verb === "made") verb = "make";
            else if (verb === "fell") verb = "fall";
            else if (verb === "cut") verb = "cut";
            else if (verb === "set") verb = "set";
            else if (verb === "found") verb = "find";
            else if (verb === "left") verb = "leave";
            else if (verb === "put") verb = "put";
            else verb = verb.replace(/ed$/, "").replace(/ied$/, "y").replace(/pped$/, "p").replace(/tted$/, "t");
            res = "Did " + match[1].toLowerCase() + " " + verb + match[3];
        }
    }
    return res.trim() + "?";
}

let allPhrases = [...phase1, ...phase2];
let issues = [];

allPhrases.forEach(p => {
    let n = negate(p);
    let q = interrogative(p);
    
    // Check for bad outputs (undefined, unchanged, double periods)
    if (!n || n === p || n.includes("undefined") || n.includes("..") || n.match(/s\s+not/)) issues.push(`Negation Issue: ${p} -> ${n}`);
    if (!q || q === p || q.includes("undefined") || q.includes("??") || !q.endsWith('?')) issues.push(`Question Issue: ${p} -> ${q}`);
    
    // Basic formatting checks
    if (n[0] !== n[0].toUpperCase()) issues.push(`Capitalization: ${n}`);
    if (q[0] !== q[0].toUpperCase()) issues.push(`Capitalization: ${q}`);
});

console.log("Found " + issues.length + " issues.");
console.log(issues.join('\n'));

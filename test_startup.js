
const fs = require('fs');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

const html = fs.readFileSync('public/index.html', 'utf8');
const js = fs.readFileSync('public/app.js', 'utf8');

const dom = new JSDOM(html, {
  runScripts: "dangerously",
  resources: "usable",
  url: "http://localhost/"
});

const { window } = dom;
const { document } = window;

// Mock localStorage
const localStorageMock = (function() {
  let store = {};
  return {
    getItem: function(key) {
      return store[key] || null;
    },
    setItem: function(key, value) {
      store[key] = value.toString();
    },
    clear: function() {
      store = {};
    }
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Mock fetch
window.fetch = async (url) => {
    if (url === 'lessons.json') {
        return {
            json: async () => [
                { id: 1, type: "speaking", topic: "Test Lesson 1", icon: "T" },
                { id: 211, type: "challenge", topic: "Tr. Adrian: Test", icon: "A" }
            ]
        };
    }
    return { json: async () => ({}) };
};

// Execute script
try {
    eval(js);
    
    // Check initial state
    console.log("Checking initial state...");
    const adrianModal = document.getElementById('modal-adrian');
    const isHidden = adrianModal.classList.contains('hidden');
    console.log(`Is Adrian Modal Hidden on Init? ${isHidden}`);
    
    if (!isHidden) {
        console.error("FAIL: Adrian Modal is VISIBLE on startup!");
    } else {
        console.log("PASS: Adrian Modal is hidden on startup.");
    }

} catch (e) {
    console.error("Script Execution Error:", e);
}

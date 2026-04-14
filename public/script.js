const quoteEl = document.getElementById('quote');
const inputEl = document.getElementById('input');
const wpmEl = document.getElementById('wpm');
const accuracyEl = document.getElementById('accuracy');
const mistakesEl = document.getElementById('mistakes');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const targetWpmEl = document.getElementById('targetWpm');
const bestScoreEl = document.getElementById('bestScore');
const resultMessageEl = document.getElementById('resultMessage');
const playerIcon = document.getElementById('playerIcon');
const trackLine = document.querySelector('.track-line');

const playerNameEl = document.getElementById('playerName');
const quoteWordCountEl = document.getElementById('quoteWordCount');
const quoteModeEl = document.getElementById('quoteMode');
const leaderboardEl = document.getElementById('leaderboard');
const historyEl = document.getElementById('history');
const badgesEl = document.getElementById('badges');
const difficultyBtns = document.querySelectorAll('.difficulty-btn');



/**
 * IMPORTANT:
 * Change this if your backend runs on another port or host.
 * Example local backend:
 * http://localhost:3000
 */
const API_BASE_URL = 'http://localhost:3000/api';

const fallbackQuotes = [
  "Every expert was once a beginner who kept going.",
  "Focus on progress, not perfection, and keep moving forward.",
  "Practice makes perfect, and consistency builds speed over time.",
  "Small daily improvements are the key to long term results.",
  "Success is built through patience discipline and the willingness to keep improving even when progress feels slow.",
  "Confidence grows when you continue practicing consistently and learn from mistakes instead of giving up too early.",
  "Real improvement comes from focused effort repeated daily until what once felt difficult becomes natural and easy."
];

const STORAGE_KEYS = {
  highScore: 'highScore',
  playerName: 'fastfingerPlayerName',
  badges: 'fastfingerBadges'
};

const badgeDefinitions = [
  { id: 'first_race', name: 'First Race', desc: 'Complete your first typing test.' },
  { id: 'speed_40', name: '40 WPM Club', desc: 'Reach 40 WPM in a session.' },
  { id: 'speed_60', name: '60 WPM Club', desc: 'Reach 60 WPM in a session.' },
  { id: 'accuracy_95', name: 'Sharp Accuracy', desc: 'Finish with at least 95% accuracy.' },
  { id: 'long_quote', name: 'Long Haul', desc: 'Complete a quote with 100+ words.' }
];

let quote = '';
let totalTyped = 0;
let totalMistakes = 0;
let testStarted = false;
let startTime = null;
let highScore = Number(localStorage.getItem(STORAGE_KEYS.highScore)) || 0;

let quoteWords = [];
let currentWordIndex = 0;
let currentDifficulty = 'easy';
let currentQuoteIsLong = false;
let targetWPM = 0;

bestScoreEl.innerText = highScore;

init();

async function init() {
  targetWPM = generateTargetWPM();
  targetWpmEl.innerText = targetWPM;
  quoteModeEl.innerText = capitalize(currentDifficulty);

  const savedName = localStorage.getItem(STORAGE_KEYS.playerName);
  if (savedName) {
    playerNameEl.value = savedName;
  }

  playerNameEl.addEventListener('input', async () => {
    localStorage.setItem(STORAGE_KEYS.playerName, getPlayerName());
    await renderLeaderboard();
    await renderHistory();
  });

  difficultyBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      difficultyBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      currentDifficulty = btn.dataset.mode;
      targetWPM = generateTargetWPM();
      targetWpmEl.innerText = targetWPM;
      quoteModeEl.innerText = capitalize(currentDifficulty);
    });
  });

  await renderLeaderboard();
  await renderHistory();
  renderBadges();
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getPlayerName() {
  const name = playerNameEl.value.trim();
  return name || 'Guest';
}

function getWordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function generateTargetWPM() {
  if (currentDifficulty === 'hard') return Math.floor(Math.random() * 36) + 45;
  if (currentDifficulty === 'medium') return Math.floor(Math.random() * 31) + 35;
  return Math.floor(Math.random() * 26) + 25;
}



function getRandomFallbackQuote() {
  return fallbackQuotes[Math.floor(Math.random() * fallbackQuotes.length)];
}

function buildLongFallbackQuote(minWords = 100) {
  let longQuote = '';

  while (getWordCount(longQuote) < minWords) {
    longQuote += ' ' + getRandomFallbackQuote();
  }

  return longQuote.trim();
}

function getLongChance() {
  if (currentDifficulty === 'hard') return 0.55;
  if (currentDifficulty === 'medium') return 0.4;
  return 0.10;
}

async function fetchQuote() {
  quoteEl.innerText = 'Loading quote...';
  quoteWordCountEl.innerText = '0';
  inputEl.value = '';
  inputEl.disabled = true;

  try {
    const response = await fetch(`${API_BASE_URL}/quote?difficulty=${currentDifficulty}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch quote: ${response.status}`);
    }

    const data = await response.json();

    quote = data.quote;
    currentQuoteIsLong = data.isLong;

    finishQuoteSetup();
  } catch (error) {
    console.error('Error fetching quote from backend:', error);

    const shouldBeLong = Math.random() < getLongChance();
    currentQuoteIsLong = shouldBeLong;

    if (shouldBeLong) {
      quote = buildLongFallbackQuote(100);
    } else {
      quote = getRandomFallbackQuote();
    }

    finishQuoteSetup();
  }
}

function finishQuoteSetup() {
  setupWords();
  renderQuote();
  quoteWordCountEl.innerText = quoteWords.length;
  quoteModeEl.innerText = `${capitalize(currentDifficulty)}${currentQuoteIsLong ? ' • Long' : ''}`;
  inputEl.disabled = false;
  inputEl.focus();
}

function setupWords() {
  quoteWords = quote.split(/\s+/);
  currentWordIndex = 0;
}

function renderQuote() {
  quoteEl.innerHTML = '';

  quoteWords.forEach((word, index) => {
    const span = document.createElement('span');
    span.innerText = word + ' ';
    span.classList.add('word');

    if (index < currentWordIndex) {
      span.classList.add('completed-word');
    } else if (index === currentWordIndex) {
      span.classList.add('current-word');
    }

    quoteEl.appendChild(span);
  });

  updatePlayerProgressByWords();
}

function resetStats() {
  totalTyped = 0;
  totalMistakes = 0;
  testStarted = false;
  startTime = null;

  targetWPM = generateTargetWPM();
  targetWpmEl.innerText = targetWPM;

  wpmEl.innerText = '0';
  accuracyEl.innerText = '0';
  mistakesEl.innerText = '0';
  resultMessageEl.innerText = '';
  resultMessageEl.className = '';
  inputEl.value = '';
  inputEl.disabled = true;

  updatePlayerProgressByWords();
}

function getCurrentInputMistakes() {
  const currentWord = quoteWords[currentWordIndex] || '';
  const typed = inputEl.value.trim();
  let mistakes = 0;

  for (let i = 0; i < typed.length; i++) {
    if (typed[i] !== currentWord[i]) {
      mistakes++;
    }
  }

  return mistakes;
}

function updateLiveStats() {
  const completedWordsCount = currentWordIndex;
  const currentTypedWord = inputEl.value.trim() ? 1 : 0;
  const wordsTyped = completedWordsCount + currentTypedWord;

  const elapsedMinutes = startTime ? (Date.now() - startTime) / 1000 / 60 : 0;

  const wpm = elapsedMinutes > 0
    ? Math.round(wordsTyped / elapsedMinutes)
    : 0;

  const currentInputMistakes = getCurrentInputMistakes();
  const displayedMistakes = totalMistakes + currentInputMistakes;

  const accuracy = totalTyped > 0
    ? Math.max(0, Math.round(((totalTyped - displayedMistakes) / totalTyped) * 100))
    : 0;

  wpmEl.innerText = wpm;
  accuracyEl.innerText = accuracy;
  mistakesEl.innerText = displayedMistakes;
}

async function showResults() {
  const wordsTyped = quoteWords.length;
  const elapsedMinutes = startTime ? (Date.now() - startTime) / 1000 / 60 : 0;

  const wpm = elapsedMinutes > 0
    ? Math.round(wordsTyped / elapsedMinutes)
    : 0;

  const accuracy = totalTyped > 0
    ? Math.max(0, Math.round(((totalTyped - totalMistakes) / totalTyped) * 100))
    : 0;

  wpmEl.innerText = wpm;
  accuracyEl.innerText = accuracy;
  mistakesEl.innerText = totalMistakes;

  if (wpm > highScore) {
    highScore = wpm;
    localStorage.setItem(STORAGE_KEYS.highScore, highScore);
    bestScoreEl.innerText = highScore;
  }

  if (wpm >= targetWPM) {
    resultMessageEl.innerText = `You win! You beat the target with ${wpm} WPM.`;
    resultMessageEl.className = 'win';
  } else {
    resultMessageEl.innerText = `You lose! Your score was ${wpm} WPM. Try again.`;
    resultMessageEl.className = 'lose';
  }

  unlockBadges(wpm, accuracy);

  await saveSessionToBackend(wpm, accuracy);
  await renderLeaderboard();
  await renderHistory();
  renderBadges();
}

function updatePlayerProgressByWords() {
  if (!playerIcon || !trackLine) return;

  const iconWidth = playerIcon.offsetWidth;
  const trackWidth = trackLine.clientWidth;
  const maxTravel = Math.max(trackWidth - iconWidth, 0);

  let progressRatio = 0;

  if (quoteWords.length > 0) {
    const currentWord = quoteWords[currentWordIndex] || '';
    const typedLength = inputEl.value.trim().length;
    const currentWordLength = currentWord.length || 1;
    const partialProgress = Math.min(typedLength / currentWordLength, 1);

    progressRatio = (currentWordIndex + partialProgress) / quoteWords.length;
  }

  const moveX = Math.min(progressRatio, 1) * maxTravel;
  playerIcon.style.transform = `translate(${moveX}px, -50%)`;
}

function updateWordHighlight() {
  const wordElements = quoteEl.querySelectorAll('.word');

  wordElements.forEach((el) => {
    el.classList.remove('typing-correct', 'typing-wrong', 'current-word');
  });

  wordElements.forEach((el, index) => {
    if (index < currentWordIndex) {
      el.classList.add('completed-word');
    } else {
      el.classList.remove('completed-word');
    }
  });

  const currentWordEl = wordElements[currentWordIndex];
  const currentWord = quoteWords[currentWordIndex] || '';
  const typed = inputEl.value.trim();

  if (currentWordEl) {
    currentWordEl.classList.add('current-word');

    if (typed.length > 0) {
      if (currentWord.startsWith(typed)) {
        currentWordEl.classList.add('typing-correct');
      } else {
        currentWordEl.classList.add('typing-wrong');
      }
    }
  }
}

async function finishTest() {
  inputEl.disabled = true;
  inputEl.value = '';
  currentWordIndex = quoteWords.length;
  updatePlayerProgressByWords();
  await showResults();
}

function readJSON(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function unlockBadges(wpm, accuracy) {
  const unlocked = new Set(readJSON(STORAGE_KEYS.badges, []));

  unlocked.add('first_race');
  if (wpm >= 40) unlocked.add('speed_40');
  if (wpm >= 60) unlocked.add('speed_60');
  if (accuracy >= 95) unlocked.add('accuracy_95');
  if (quoteWords.length >= 100) unlocked.add('long_quote');

  saveJSON(STORAGE_KEYS.badges, [...unlocked]);
}

function renderBadges() {
  const unlocked = new Set(readJSON(STORAGE_KEYS.badges, []));

  badgesEl.innerHTML = badgeDefinitions.map(badge => `
    <div class="badge-card ${unlocked.has(badge.id) ? 'unlocked' : ''}">
      <span class="badge-name">${badge.name}</span>
      <span class="badge-desc">${badge.desc}</span>
    </div>
  `).join('');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.innerText = text;
  return div.innerHTML;
}

/* =========================
   BACKEND FUNCTIONS
========================= */

async function saveSessionToBackend(wpm, accuracy) {
  const payload = {
    name: getPlayerName(),
    wpm,
    accuracy,
    mistakes: totalMistakes,
    difficulty: currentDifficulty,
    words: quoteWords.length
  };

  try {
    const response = await fetch(`${API_BASE_URL}/scores`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Failed to save score: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error saving session to backend:', error);
  }
}

async function fetchLeaderboardFromBackend() {
  try {
    const response = await fetch(`${API_BASE_URL}/leaderboard`);

    if (!response.ok) {
      throw new Error(`Failed to fetch leaderboard: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return [];
  }
}

async function fetchHistoryFromBackend(name) {
  try {
    const response = await fetch(`${API_BASE_URL}/history/${encodeURIComponent(name)}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch history: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching history:', error);
    return [];
  }
}

async function renderLeaderboard() {
  const leaderboard = await fetchLeaderboardFromBackend();

  if (!leaderboard.length) {
    leaderboardEl.innerHTML = '<div class="empty-state">No scores yet. Complete a test to create the leaderboard.</div>';
    return;
  }

  leaderboardEl.innerHTML = leaderboard
    .map((entry, index) => `
      <div class="list-item">
        <strong>#${index + 1} ${escapeHtml(entry.name)}</strong>
        ${entry.wpm} WPM
        <span class="list-meta">${entry.accuracy}% accuracy • ${capitalize(entry.difficulty)} • ${entry.words} words</span>
      </div>
    `)
    .join('');
}

async function renderHistory() {
  const name = getPlayerName();
  const history = await fetchHistoryFromBackend(name);

  if (!history.length) {
    historyEl.innerHTML = '<div class="empty-state">No session history yet.</div>';
    return;
  }

  historyEl.innerHTML = history
    .map((entry) => `
      <div class="list-item">
        <strong>${entry.wpm} WPM</strong>
        <span class="list-meta">
          ${escapeHtml(entry.name)} •
          ${entry.accuracy}% accuracy •
          ${entry.mistakes} mistakes •
          ${new Date(entry.createdAt).toLocaleString()}
        </span>
      </div>
    `)
    .join('');
}

/* =========================
   TEST CONTROL
========================= */

async function startTest() {
  resetStats();
  await fetchQuote();
}

inputEl.addEventListener('input', async () => {
  if (!testStarted && inputEl.value.length > 0) {
    testStarted = true;
    startTime = Date.now();
  }

  totalTyped++;

  const currentWord = quoteWords[currentWordIndex] || '';
  const typedValue = inputEl.value;
  const trimmedTyped = typedValue.trim();
  const isLastWord = currentWordIndex === quoteWords.length - 1;

  if (isLastWord && trimmedTyped === currentWord) {
    updateWordHighlight();
    updateLiveStats();
    updatePlayerProgressByWords();
    await finishTest();
    return;
  }

  if (typedValue.endsWith(' ')) {
    if (trimmedTyped === currentWord) {
      currentWordIndex++;
      inputEl.value = '';

      if (currentWordIndex >= quoteWords.length) {
        await finishTest();
        return;
      }

      renderQuote();
    } else {
      totalMistakes++;
    }
  }

  updateWordHighlight();
  updateLiveStats();
  updatePlayerProgressByWords();
});

startBtn.addEventListener('click', startTest);
restartBtn.addEventListener('click', startTest);

window.addEventListener('resize', () => {
  updatePlayerProgressByWords();
});
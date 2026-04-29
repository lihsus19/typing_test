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

const accountBtn = document.getElementById('accountBtn');
const playerStatusEl = document.getElementById('playerStatus');
const quoteWordCountEl = document.getElementById('quoteWordCount');
const quoteModeEl = document.getElementById('quoteMode');
const leaderboardEl = document.getElementById('leaderboard');
const historyEl = document.getElementById('history');
const badgesEl = document.getElementById('badges');
const difficultyBtns = document.querySelectorAll('.difficulty-btn');

const API_BASE_URL = '/api';

const fallbackQuotes = [
  'Every expert was once a beginner who kept going.',
  'Focus on progress, not perfection, and keep moving forward.',
  'Practice makes perfect, and consistency builds speed over time.',
  'Small daily improvements are the key to long term results.',
  'Success is built through patience discipline and the willingness to keep improving even when progress feels slow.',
  'Confidence grows when you continue practicing consistently and learn from mistakes instead of giving up too early.',
  'Real improvement comes from focused effort repeated daily until what once felt difficult becomes natural and easy.'
];

const STORAGE_KEYS = {
  highScore: 'highScore',
  badges: 'fastfingerBadges'
};

const badgeDefinitions = [
  { id: 'first_race', name: 'First Race', desc: 'Complete your first typing test.' },
  { id: 'speed_40', name: '40 WPM Club', desc: 'Reach 40 WPM in a session.' },
  { id: 'speed_60', name: '60 WPM Club', desc: 'Reach 60 WPM in a session.' },
  { id: 'accuracy_95', name: 'Sharp Accuracy', desc: 'Finish with at least 95% accuracy.' },
  { id: 'long_quote', name: 'Long Haul', desc: 'Complete a quote with 100+ words.' }
];

let resultChart = null;
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

  accountBtn?.addEventListener('click', () => {
    window.location.href = 'login.html';
  });

  difficultyBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      difficultyBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      currentDifficulty = btn.dataset.mode;
      targetWPM = generateTargetWPM();
      targetWpmEl.innerText = targetWPM;
      quoteModeEl.innerText = capitalize(currentDifficulty);
    });
  });

  startBtn?.addEventListener('click', startTest);
  restartBtn?.addEventListener('click', restartTest);

  inputEl?.addEventListener('input', handleTypingInput);
  inputEl?.addEventListener('keydown', (event) => {
    if (event.key === 'Tab') {
      event.preventDefault();
    }
  });

  await syncUserFromServer();
  updatePlayerStatus();
  await renderLeaderboard();
  await renderHistory();
  renderBadges();
}

async function syncUserFromServer() {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      credentials: 'include'
    });

    if (!response.ok) return;

    const data = await response.json();

    if (data.user) {
      localStorage.setItem('fastfingerUser', JSON.stringify(data.user));
    } else {
      localStorage.removeItem('fastfingerUser');
    }
  } catch (error) {
    console.error('Could not sync user:', error);
  }
}

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('fastfingerUser'));
  } catch {
    return null;
  }
}

function updatePlayerStatus() {
  const user = getStoredUser();

  if (user?.name) {
    playerStatusEl.textContent = `Logged in as ${user.name}`;
  } else {
    playerStatusEl.textContent = 'Playing as Guest';
  }
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getPlayerName() {
  const user = getStoredUser();
  return user?.name || 'Guest';
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
    longQuote += ` ${getRandomFallbackQuote()}`;
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

    quote = shouldBeLong ? buildLongFallbackQuote(100) : getRandomFallbackQuote();
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
    span.innerText = `${word} `;
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

function startTest() {
  const container = document.getElementById('chartContainer');

  if (resultChart) {
    resultChart.destroy();
    resultChart = null;
  }

  if (container) {
    container.style.display = 'none';
  }

  resetStats();
  fetchQuote();
}

function restartTest() {
  startTest();
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
  createResultChart(wpm, accuracy, totalMistakes);
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

  badgesEl.innerHTML = badgeDefinitions.map((badge) => `
    <div class="badge-card ${unlocked.has(badge.id) ? 'unlocked' : ''}">
      <span class="badge-name">${badge.name}</span>
      <span class="badge-desc">${badge.desc}</span>
    </div>
  `).join('');
}

function createResultChart(wpm, accuracy, mistakes) {
  const canvas = document.getElementById('resultChart');
  const container = document.getElementById('chartContainer');

  if (!canvas || !container) return;

  const ctx = canvas.getContext('2d');
  container.style.display = 'block';

  if (resultChart) {
    resultChart.destroy();
  }

  resultChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['WPM', 'Accuracy %'],
      datasets: [{
        label: 'Result',
        data: [wpm, accuracy],
        borderWidth: 1,
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        title: {
          display: true,
          text: `Mistakes: ${mistakes}`
        }
      },
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.innerText = text;
  return div.innerHTML;
}

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
      credentials: 'include',
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
    const response = await fetch(`${API_BASE_URL}/leaderboard`, {
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch leaderboard: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return [];
  }
}

async function fetchHistoryFromBackend() {
  try {
    const response = await fetch(`${API_BASE_URL}/history/me`, {
      credentials: 'include'
    });

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
    leaderboardEl.innerHTML = '<p class="empty-state">No scores yet.</p>';
    return;
  }

  leaderboardEl.innerHTML = leaderboard.map((entry, index) => `
    <div class="list-row">
      <span class="list-rank">#${index + 1}</span>
      <span class="list-name">${escapeHtml(entry.name)}</span>
      <span class="list-score">${entry.wpm} WPM</span>
    </div>
  `).join('');
}

async function renderHistory() {
  const history = await fetchHistoryFromBackend();

  if (!history.length) {
    historyEl.innerHTML = '<p class="empty-state">No history yet.</p>';
    return;
  }

  historyEl.innerHTML = history.map((entry) => `
    <div class="list-row history-row">
      <span class="list-name">${escapeHtml(entry.name)}</span>
      <span class="list-score">${entry.wpm} WPM</span>
      <span class="list-meta">${entry.accuracy}%</span>
    </div>
  `).join('');
}

function handleTypingInput() {
  if (!testStarted) {
    testStarted = true;
    startTime = Date.now();
  }

  const typed = inputEl.value;
  totalTyped++;

  const currentWord = quoteWords[currentWordIndex] || '';

  if (typed.endsWith(' ')) {
    const typedWord = typed.trim();

    if (typedWord === currentWord) {
      currentWordIndex++;
      inputEl.value = '';

      if (currentWordIndex >= quoteWords.length) {
        finishTest();
        return;
      }
    } else {
      totalMistakes++;
    }
  }

  updateLiveStats();
  updateWordHighlight();
  updatePlayerProgressByWords();

  const lastWord = quoteWords[currentWordIndex];
  const cleanTyped = inputEl.value.trim();

  if (
    currentWordIndex === quoteWords.length - 1 &&
    cleanTyped === lastWord
  ) {
    finishTest();
  }
}
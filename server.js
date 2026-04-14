const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;
const QUOTE_API_KEY = process.env.QUOTE_API_KEY;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('MongoDB connected');
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error.message);
  });

const scoreSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 20
  },
  wpm: {
    type: Number,
    required: true,
    min: 0,
    max: 250
  },
  accuracy: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  mistakes: {
    type: Number,
    required: true,
    min: 0,
    max: 10000
  },
  difficulty: {
    type: String,
    required: true,
    enum: ['easy', 'medium', 'hard']
  },
  words: {
    type: Number,
    required: true,
    min: 1,
    max: 1000
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Score = mongoose.model('Score', scoreSchema);

const fallbackQuotes = [
  'Every expert was once a beginner who kept going.',
  'Focus on progress, not perfection, and keep moving forward.',
  'Practice makes perfect, and consistency builds speed over time.',
  'Small daily improvements are the key to long term results.',
  'Success is built through patience discipline and the willingness to keep improving even when progress feels slow.',
  'Confidence grows when you continue practicing consistently and learn from mistakes instead of giving up too early.',
  'Real improvement comes from focused effort repeated daily until what once felt difficult becomes natural and easy.'
];

function sanitizeName(name) {
  if (!name || typeof name !== 'string') return 'Guest';
  return name.trim().replace(/[<>]/g, '').slice(0, 20) || 'Guest';
}

function getWordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
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

function getLongChance(difficulty) {
  if (difficulty === 'hard') return 0.55;
  if (difficulty === 'medium') return 0.4;
  return 0.1;
}

async function fetchSingleApiQuote() {
  const response = await fetch('https://api.api-ninjas.com/v1/quotes', {
    headers: {
      'X-Api-Key': QUOTE_API_KEY
    }
  });

  if (!response.ok) {
    throw new Error(`Quote API failed: ${response.status}`);
  }

  const data = await response.json();

  if (!Array.isArray(data) || !data[0] || !data[0].quote) {
    throw new Error('Invalid quote response');
  }

  return data[0].quote.trim();
}

app.get('/api/quote', async (req, res) => {
  const difficulty = ['easy', 'medium', 'hard'].includes(req.query.difficulty)
    ? req.query.difficulty
    : 'easy';

  try {
    const shouldBeLong = Math.random() < getLongChance(difficulty);

    let quote = '';

    if (!shouldBeLong) {
      quote = await fetchSingleApiQuote();
    } else {
      while (getWordCount(quote) < 100) {
        const nextQuote = await fetchSingleApiQuote();
        quote += ' ' + nextQuote;
      }
      quote = quote.trim();
    }

    res.json({
      quote,
      isLong: shouldBeLong,
      wordCount: getWordCount(quote)
    });
  } catch (error) {
    console.error('Quote fetch error:', error.message);

    const shouldBeLong = Math.random() < getLongChance(difficulty);
    const quote = shouldBeLong
      ? buildLongFallbackQuote(100)
      : getRandomFallbackQuote();

    res.json({
      quote,
      isLong: shouldBeLong,
      wordCount: getWordCount(quote)
    });
  }
});

app.post('/api/scores', async (req, res) => {
  try {
    const {
      name,
      wpm,
      accuracy,
      mistakes,
      difficulty,
      words
    } = req.body;

    const cleanName = sanitizeName(name);

    if (
      typeof wpm !== 'number' ||
      typeof accuracy !== 'number' ||
      typeof mistakes !== 'number' ||
      typeof words !== 'number' ||
      !['easy', 'medium', 'hard'].includes(difficulty)
    ) {
      return res.status(400).json({ error: 'Invalid score data.' });
    }

    if (wpm < 0 || wpm > 250 || accuracy < 0 || accuracy > 100 || mistakes < 0 || words < 1) {
      return res.status(400).json({ error: 'Score values out of range.' });
    }

    const score = new Score({
      name: cleanName,
      wpm,
      accuracy,
      mistakes,
      difficulty,
      words
    });

    await score.save();

    res.status(201).json({
      message: 'Score saved successfully.',
      score
    });
  } catch (error) {
    console.error('Save score error:', error.message);
    res.status(500).json({ error: 'Failed to save score.' });
  }
});

app.get('/api/leaderboard', async (req, res) => {
  try {
    const leaderboard = await Score.find()
      .sort({ wpm: -1, accuracy: -1, createdAt: -1 })
      .limit(8)
      .lean();

    res.json(leaderboard);
  } catch (error) {
    console.error('Leaderboard error:', error.message);
    res.status(500).json({ error: 'Failed to load leaderboard.' });
  }
});

app.get('/api/history/:name', async (req, res) => {
  try {
    const name = sanitizeName(req.params.name);

    const history = await Score.find({ name })
      .sort({ createdAt: -1 })
      .limit(8)
      .lean();

    res.json(history);
  } catch (error) {
    console.error('History error:', error.message);
    res.status(500).json({ error: 'Failed to load history.' });
  }
});

app.get('/api/stats/:name', async (req, res) => {
  try {
    const name = sanitizeName(req.params.name);

    const scores = await Score.find({ name }).lean();

    if (!scores.length) {
      return res.json({
        bestWPM: 0,
        averageWPM: 0,
        totalTests: 0
      });
    }

    const bestWPM = Math.max(...scores.map(score => score.wpm));
    const averageWPM = Math.round(
      scores.reduce((sum, score) => sum + score.wpm, 0) / scores.length
    );

    res.json({
      bestWPM,
      averageWPM,
      totalTests: scores.length
    });
  } catch (error) {
    console.error('Stats error:', error.message);
    res.status(500).json({ error: 'Failed to load stats.' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});


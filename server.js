const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;
const QUOTE_API_KEY = process.env.QUOTE_API_KEY;
const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('MongoDB connected');
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error.message);
  });

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 20
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  passwordHash: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

const scoreSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
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

const User = mongoose.model('User', userSchema);
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
    longQuote += ` ${getRandomFallbackQuote()}`;
  }
  return longQuote.trim();
}

function getLongChance(difficulty) {
  if (difficulty === 'hard') return 0.55;
  if (difficulty === 'medium') return 0.4;
  return 0.1;
}

function getUserFromToken(req) {
  try {
    const token = req.cookies.token;
    if (!token) return null;
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
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

/* =========================
   AUTH ROUTES
========================= */

app.post('/api/auth/signup', async (req, res) => {
  try {
    const name = sanitizeName(req.body.name);
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '').trim();

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'All fields are required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: 'Email already in use.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      passwordHash
    });

    const token = jwt.sign(
      {
        userId: user._id,
        name: user.name,
        email: user.email
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false
    });

    res.status(201).json({
      message: 'Account created successfully.',
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Signup error:', error.message);
    res.status(500).json({ error: 'Failed to sign up.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '').trim();

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      {
        userId: user._id,
        name: user.name,
        email: user.email
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false
    });

    res.json({
      message: 'Login successful.',
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ error: 'Failed to log in.' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out.' });
});

app.get('/api/auth/me', async (req, res) => {
  try {
    const decoded = getUserFromToken(req);

    if (!decoded) {
      return res.json({ user: null });
    }

    const user = await User.findById(decoded.userId).select('_id name email');

    if (!user) {
      return res.json({ user: null });
    }

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    res.json({ user: null });
  }
});

/* =========================
   QUOTE ROUTE
========================= */

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
        quote += ` ${nextQuote}`;
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

/* =========================
   SCORE ROUTES
========================= */

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
    const authUser = getUserFromToken(req);

    if (
      typeof wpm !== 'number' ||
      typeof accuracy !== 'number' ||
      typeof mistakes !== 'number' ||
      typeof words !== 'number' ||
      !['easy', 'medium', 'hard'].includes(difficulty)
    ) {
      return res.status(400).json({ error: 'Invalid score data.' });
    }

    if (
      wpm < 0 ||
      wpm > 250 ||
      accuracy < 0 ||
      accuracy > 100 ||
      mistakes < 0 ||
      words < 1
    ) {
      return res.status(400).json({ error: 'Score values out of range.' });
    }

    const score = new Score({
      userId: authUser ? authUser.userId : null,
      name: authUser ? sanitizeName(authUser.name) : cleanName,
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

app.get('/api/history/me', async (req, res) => {
  try {
    const authUser = getUserFromToken(req);

    if (authUser?.userId) {
      const history = await Score.find({ userId: authUser.userId })
        .sort({ createdAt: -1 })
        .limit(8)
        .lean();

      return res.json(history);
    }

    const history = await Score.find({ name: 'Guest' })
      .sort({ createdAt: -1 })
      .limit(8)
      .lean();

    res.json(history);
  } catch (error) {
    console.error('History error:', error.message);
    res.status(500).json({ error: 'Failed to load history.' });
  }
});

app.get('/api/stats/me', async (req, res) => {
  try {
    const authUser = getUserFromToken(req);

    const query = authUser?.userId
      ? { userId: authUser.userId }
      : { name: 'Guest' };

    const scores = await Score.find(query).lean();

    if (!scores.length) {
      return res.json({
        bestWPM: 0,
        averageWPM: 0,
        totalTests: 0
      });
    }

    const bestWPM = Math.max(...scores.map((score) => score.wpm));
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
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const Parser = require('rss-parser');
const cheerio = require('cheerio');
const { URL } = require('url');
const OpenAI = require('openai');
require('dotenv').config();

// Initialize app and constants
const app = express();
const PORT = process.env.PORT || 3000;
const USERS_FILE = path.join(__dirname, 'data', 'users.json');
const rssParser = new Parser();
const { marked } = require('marked');

// Configure marked
marked.setOptions({
  breaks: true,
  headerIds: false,
  mangle: false
});

// Configuration objects
const axiosConfig = {
    timeout: 5000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
};

const openai = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultHeaders: {
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "AI Chatbot"
    }
});

// Middleware Configuration
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));
app.use(express.static('public'));
app.use('/bootstrap', express.static(
    path.join(__dirname, 'node_modules/bootstrap/dist')
));

// Utility Functions
const makeAbsoluteUrl = (imgPath, baseUrl) => {
    try {
        const url = new URL(imgPath, baseUrl);
        if (url.hostname !== new URL(baseUrl).hostname) {
            url.protocol = 'https:';
        }
        return url.href;
    } catch {
        return null;
    }
};

const isValidImage = (url) => {
    if (!url) return false;
    const imageRegex = /\.(jpg|jpeg|png|webp|gif)(?:[?#]|$)/i;
    const platformRegex = /ytimg\.com|vimeocdn\.com/i;
    return (imageRegex.test(url) && !/logo|icon|avatar/i.test(url)) || platformRegex.test(url);
};

// News Scraping Functions
async function findContentImage(url) {
    try {
        const response = await axios.get(url, axiosConfig);
        const $ = cheerio.load(response.data);
        
        const images = [
            $('meta[property="og:image"]').attr('content'),
            $('meta[name="twitter:image"]').attr('content'),
            $('img.wp-post-image').attr('src'),
            $('article img').first().attr('src'),
            $('.post-content img').first().attr('src'),
            $('.article-image img').first().attr('src'),
            $('body img').first().attr('src')
        ].filter(img => img && isValidImage(img))
         .map(img => makeAbsoluteUrl(img, url));

        return images[0] || $('meta[property="og:logo"]').attr('content') || null;
    } catch (error) {
        console.error(`Content fetch failed for ${url}:`, error.message);
        return null;
    }
}

async function scrapeCBSNews() {
    const url = 'https://www.cbsnews.com/tag/airbnb/';
    try {
        const response = await axios.get(url, axiosConfig);
        const $ = cheerio.load(response.data);
        const articles = [];

        $('.item--type-article').each((i, el) => {
            const $el = $(el);
            const title = $el.find('.item__hed').text().trim();
            const articleUrl = $el.find('a').attr('href');
            const absoluteUrl = articleUrl ? new URL(articleUrl, url).href : null;
            const image = $el.find('img').attr('src');
            const description = $el.find('.item__dek').text().trim();
            const dateText = $el.find('time').attr('datetime');

            if (title && absoluteUrl) {
                articles.push({
                    title,
                    url: absoluteUrl,
                    image: image ? makeAbsoluteUrl(image, url) : null,
                    source: 'CBS News',
                    description,
                    publishedAt: dateText ? new Date(dateText).toLocaleDateString() : null
                });
            }
        });

        return articles.slice(0, 14);
    } catch (error) {
        console.error('CBS News scrape failed:', error.message);
        return [];
    }
}

// Authentication Routes
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/dashboard', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.post('/signup', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).send('Username and password are required');
    }

    try {
        const users = await getUsers();
        if (users[username]) return res.status(400).send('Username already exists');
        
        const hashedPassword = await bcrypt.hash(password, 10);
        users[username] = { password: hashedPassword };
        await saveUsers(users);
        res.redirect('/login');
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).send('Error registering user');
    }
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).send('Username and password are required');
    }

    try {
        const users = await getUsers();
        const user = users[username];

        if (!user) {
            return res.status(401).send('Invalid username or password');
        }

        const passwordMatch = await bcrypt.compare(password, user.password);

        if (!passwordMatch) {
            return res.status(401).send('Invalid username or password');
        }

        req.session.user = username;
        res.redirect('/dashboard');
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).send('Internal server error');
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Logout error:', err);
            return res.status(500).send('Error logging out');
        }
        res.redirect('/login');
    });
});

// News Route
app.get('/business-news', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const [airbnbFeed, cbsArticles] = await Promise.all([
            rssParser.parseURL('https://news.airbnb.com/feed/').then(feed => 
                Promise.all(feed.items.map(async item => ({
                    title: item.title,
                    url: item.link,
                    image: await findContentImage(item.link),
                    source: 'Airbnb Newsroom',
                    description: item.contentSnippet,
                    publishedAt: new Date(item.isoDate).toLocaleDateString()
                })))
            ),
            scrapeCBSNews()
        ]);

        res.json([...airbnbFeed, ...cbsArticles]);
    } catch (error) {
        console.error('News fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch business news' });
    }
});

// Chat Routes
app.get('/chat', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    res.sendFile(path.join(__dirname, 'public', 'chatbot.html'));
});

const onboardingQuestions = [
    {
        id: 1,
        question: "💰 What's your budget for this project?",
        key: 'budget',
        options: ["Under PHP 50k", "PHP 50k - PHP 250k", "PHP 250k - PHP 500k", "PHP 500k+"]
    },
    {
        id: 2,
        question: "🧑‍🤝‍🧑 Who is your target audience?",
        key: 'audience',
        options: ['Families', 'Couples', 'Business Travelers', 'Backpackers']
    },
    {
        id: 3,
        question: "🖥️ Which platform are you using/planning to use?",
        key: 'platform',
        options: ['Airbnb Only', 'Airbnb + VRBO', 'Multiple Platforms', 'Custom Website']
    },
    {
        id: 4,
        question: "📍 Where is your business/target market located?",
        key: 'location',
        options: ['Urban City', 'Suburban Area', 'Rural Location', 'Vacation Destination']
    },
    {
        id: 5,
        question: "🛠️ Any extra features/add-ons wanted?",
        key: 'features',
        options: ['Smart Home Tech', 'Premium Photography', 'Concierge Services', 'Experience Packages']
    }
];

app.post('/chat', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const { answers, lastMessage } = req.body;
        
        const prompt = `Act as an Hotel Businessman & Airbnb expert assistant. The user provided these specific answers:
            ${Object.entries(answers).map(([key, value]) => {
            const question = onboardingQuestions.find(q => q.key === key)?.question || key;
            return `- **${question}**: ${value}`
            }).join('\n')}

            Current conversation context: ${lastMessage}

            Generate SPECIFIC recommendations based on their selections including:
            1. Pricing strategy for their budget and location
            2. Marketing tactics for their target audience
            3. Platform optimization for their chosen platform(s)
            4. Must-have features based on their selections
            5. Local compliance considerations

            Format with markdown using:
            **Bold** for key terms
            - Bullet points
            ## Section headers
            *Italic* for important notes`;

        const completion = await openai.chat.completions.create({
            model: "google/gemini-pro",
            messages: [{ 
                role: "user", 
                content: prompt 
            }],
            temperature: 0.7
        });

        const rawContent = completion.choices[0]?.message?.content || "I couldn't generate a response. Please try again.";
        
        res.json({
            text: rawContent, 
            formatted: marked.parse(rawContent) 
        });
        
    } catch (error) {
        console.error('Chat Error:', error);
        res.status(500).json({ 
            text: "Sorry, I'm having trouble processing that. Could you try rephrasing?",
            formatted: marked.parse("**Oops!** Please try your question again or rephrase it.")
        });
    }
});

// Core Routes
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// Helper Functions
async function getUsers() {
    try {
        const data = await fs.readFile(USERS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            await fs.writeFile(USERS_FILE, '{}');
            return {};
        }
        console.error('Error reading users file:', error);
        return {};
    }
}

async function saveUsers(users) {
    try {
        await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
    } catch (error) {
        console.error('Error saving users file:', error);
        throw error;
    }
}

app.get('/api/user', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    res.json({ username: req.session.user });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).send('Something went wrong!');
});

// Server Initialization
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    // Ensure data directory exists
    fs.mkdir(path.join(__dirname, 'data'), { recursive: true }).catch(console.error);
});
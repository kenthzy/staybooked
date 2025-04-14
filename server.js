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
const PORT = 3000;
const USERS_FILE = path.join(__dirname, 'data', 'users.json');
const rssParser = new Parser();

// Configuration objects

const { marked } = require('marked');

// Configure marked
marked.setOptions({
  breaks: true,
  headerIds: false,
  mangle: false
});

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
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
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
    try {
        const users = await getUsers();
        if (users[username]) return res.send('Username already exists');
        
        users[username] = { password: await bcrypt.hash(password, 10) };
        await saveUsers(users);
        res.redirect('/login');
    } catch (error) {
        res.status(500).send('Error registering user');
    }
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const users = await getUsers();
        const user = users[username];
        
        if (user && await bcrypt.compare(password, user.password)) {
            req.session.user = username;
            return res.redirect('/dashboard');
        }
        res.send('Invalid username or password');
    } catch (error) {
        res.status(500).send('Login error');
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// News Route
app.get('/business-news', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const airbnbFeed = await rssParser.parseURL('https://news.airbnb.com/feed/');
        const pressReleases = await Promise.all(
            airbnbFeed.items.map(async item => ({
                title: item.title,
                url: item.link,
                image: await findContentImage(item.link),
                source: 'Airbnb Newsroom',
                description: item.contentSnippet,
                publishedAt: new Date(item.isoDate).toLocaleDateString()
            }))
        );

        const cbsArticles = await scrapeCBSNews();
        res.json([...pressReleases, ...cbsArticles]);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch business news' });
    }
});

// Chat Routes
app.get('/chat', (req, res) => res.sendFile(path.join(__dirname, 'public', 'chatbot.html')));

// Conversation flow configuration
const onboardingQuestions = [
    {
        id: 1,
        question: "💰 What's your budget for this project?",
        key: 'budget',
        options: ['Under Php1k', 'Php1k-Php5k', 'Php5k-Php10k', 'Php10k+']
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
    try {
        const { answers, lastMessage } = req.body;
        
        const prompt = `Act as an Airbnb expert assistant. Format responses using markdown with:
        - **Bold** for key terms/prices
        - Bullet points for lists
        - ## Headers for sections
        - *Italic* for special notes
        
        The user provided these answers:
        ${JSON.stringify(answers)}
        
        Current conversation: ${lastMessage}
        
        Provide advice focusing on:
        - Market-specific pricing
        - Audience engagement
        - Platform optimization
        - Local regulations
        - Feature recommendations`;

        const completion = await openai.chat.completions.create({
            model: "google/gemini-pro",
            messages: [{ 
                role: "user", 
                content: prompt 
            }]
        });

        const rawContent = completion.choices[0].message.content;
        
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
        return JSON.parse(await fs.readFile(USERS_FILE, 'utf8'));
    } catch (error) {
        return {};
    }
}

async function saveUsers(users) {
    await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
}

// Server Initialization
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
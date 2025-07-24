const GOOGLE_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRAJhMLSkrHlICOabG493SP5WSQ1kUbbCnoAIgJGdD3TUzhBY1Fyn5-PQ9LuVKzf5YO6LHAlQkW3Dos/pub?output=csv';
let allNewsArticles = []; // To store all fetched news
let autoRefreshIntervalId; // Used for setInterval
const AUTO_REFRESH_INTERVAL_MS = 300000; // 5 minutes


// --- CSV Parsing ---
function parseCSV(csv) {
    const lines = csv.split('\n').filter(line => line.trim() !== '');
    if (lines.length === 0) return [];

    const headers = parseCSVLine(lines[0]).map(h => h.trim());
    const data = [];

    for (let i = 1; i < lines.length; i++) {
        const fields = parseCSVLine(lines[i]);
        if (fields.length !== headers.length) {
            console.warn(`Skipping malformed row: ${lines[i]}`);
            continue;
        }
        const row = {};
        for (let j = 0; j < headers.length; j++) {
            row[headers[j]] = fields[j] !== undefined ? fields[j].trim() : '';
        }
        data.push(row);
    }
    return data;
}

function parseCSVLine(line) {
    const result = [];
    let current = '', inQuote = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuote = !inQuote;
        } else if (char === ',' && !inQuote) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);
    return result;
}

function formatNewspaperDateline(dateString) {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        if (isNaN(date)) throw new Error('Invalid date');
        return date.toLocaleString('en-US', {
            month: 'long', day: 'numeric', year: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: true
        });
    } catch (e) {
        console.error('Date format error:', e);
        return 'Invalid Date';
    }
}

async function fetchNews() {
    const newsContainer = document.getElementById('news-columns');
    const skeletonWrapper = document.querySelector('.skeleton-wrapper');
    if (!newsContainer) return console.error("#news-columns not found");

    if (skeletonWrapper) skeletonWrapper.style.display = 'block';
    newsContainer.innerHTML = '';

    try {
        const res = await fetch(GOOGLE_SHEET_URL);
        const csv = await res.text();
        const newsData = parseCSV(csv);

        console.log("News data loaded:", newsData);

        allNewsArticles = newsData.filter(row => row.Headline && row.Headline.trim() !== '');
        displayNews(allNewsArticles);
    } catch (err) {
        console.error("Fetch error:", err);
        newsContainer.innerHTML = '<p>Failed to retrieve news. Please try again.</p>';
        if (skeletonWrapper) skeletonWrapper.style.display = 'none';
    }
}

function displayNews(articles) {
    const newsContainer = document.getElementById('news-columns');
    const skeletonWrapper = document.querySelector('.skeleton-wrapper');
    if (!newsContainer) return;

    newsContainer.innerHTML = '';
    if (skeletonWrapper) skeletonWrapper.style.display = 'none';

    if (!articles || articles.length === 0) {
        newsContainer.innerHTML = '<p>No news articles found.</p>';
        return;
    }

    articles.sort((a, b) => new Date(b['Published Time']) - new Date(a['Published Time']));

    articles.forEach((article, i) => {
        const headline = article['Headline'] || '';
        const summary = article['Summary'] || '';
        let url = article['URL'] || '#';
        const published = article['Published Time'] || 'N/A';
        const tickers = article['Tickers'] || '';

        url = url.replace(/^"|"$/g, '').trim();
        if (!url.startsWith('http')) url = 'https://' + url;
        try { new URL(url); } catch { url = '#'; }

        const isBreaking = i === 0;
        const articleDiv = document.createElement('div');
        articleDiv.classList.add('news-article');

        articleDiv.innerHTML = `
            ${isBreaking ? '<span class="breaking-ribbon">BREAKING</span>' : ''}
            <h2><a href="${url}" target="_blank" rel="noopener noreferrer">${headline}</a></h2>
            <span class="article-dateline">${formatNewspaperDateline(published)}</span>
            <p>${summary ? summary.substring(0, 300) + '...' : 'No summary available.'}</p>
            ${summary.length > 300 ? `<a href="${url}" class="read-more-button" target="_blank">Read More</a>` : ''}
            ${tickers ? `<div class="news-meta"><span>Tickers: ${tickers}</span></div>` : ''}
        `;

        newsContainer.appendChild(articleDiv);
    });
}

function startAutoRefresh() {
    if (autoRefreshIntervalId) clearInterval(autoRefreshIntervalId);
    autoRefreshIntervalId = setInterval(fetchNews, AUTO_REFRESH_INTERVAL_MS);
}

window.onload = () => {
    fetchNews();
    startAutoRefresh();
};

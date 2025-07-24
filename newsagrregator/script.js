const GOOGLE_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRAJhMLSkrHlICOabG493SP5WSQ1kUbbCnoAIgJGdD3TUzhBY1Fyn5-PQ9LuVKzf5YO6LHAlQkW3Dos/pub?output=csv';
let allNewsArticles = [];
let autoRefreshIntervalId;
const AUTO_REFRESH_INTERVAL_MS = 300000;
const MAX_SUMMARY_LENGTH = 250;

// --- Robust CSV Parsing ---
// Advanced CSV line parser using state machine logic
function parseCSVLine(line) {
    const result = [];
    let field = '';
    let insideQuotes = false;
    let i = 0;

    while (i < line.length) {
        const char = line[i];

        if (insideQuotes) {
            if (char === '"') {
                if (i + 1 < line.length && line[i + 1] === '"') {
                    field += '"';
                    i++;
                } else {
                    insideQuotes = false;
                }
            } else {
                field += char;
            }
        } else {
            if (char === '"') {
                insideQuotes = true;
            } else if (char === ',') {
                result.push(field);
                field = '';
            } else {
                field += char;
            }
        }

        i++;
    }

    result.push(field);
    return result.map(f => f.trim());
}

function parseCSV(csv) {
    const lines = csv.split(/\r?\n/).filter(l => l.trim() !== '');
    if (lines.length < 2) return [];

    const headers = parseCSVLine(lines[0]);
    const data = [];

    for (let i = 1; i < lines.length; i++) {
        const row = parseCSVLine(lines[i]);
        if (row.length === headers.length) {
            const obj = {};
            for (let j = 0; j < headers.length; j++) {
                obj[headers[j]] = row[j];
            }
            data.push(obj);
        } else {
            console.warn(`DEBUG: Skipping malformed CSV row (column mismatch): "${lines[i]}" - Expected ${headers.length} columns, got ${row.length}`);
        }
    }

    console.log("DEBUG: Raw CSV Header Line:", lines[0]);
    console.log("DEBUG: Parsed Headers (from parseCSVLine):", headers);
    return data;
}

function formatNewspaperDateline(dateString) {
    if (!dateString || typeof dateString !== 'string') return 'N/A';
    try {
        let cleaned = dateString.trim();
        if (cleaned.endsWith('Z')) cleaned = cleaned.slice(0, -1);
        if (cleaned.includes('.')) cleaned = cleaned.split('.')[0];
        if (cleaned.startsWith('"') && cleaned.endsWith('"')) cleaned = cleaned.slice(1, -1);
        let date = new Date(cleaned);
        if (isNaN(date)) {
            date = new Date(cleaned.replace('T', ' '));
        }
        if (isNaN(date)) throw new Error('Invalid date after parsing attempt');
        const options = { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true };
        return date.toLocaleString('en-US', options);
    } catch (e) {
        console.error("DEBUG: Date format error for input:", dateString, "Error:", e);
        return 'Invalid Date';
    }
}

// --- Main Fetch & Display ---

async function fetchNews() {
    const newsContainer = document.getElementById('news-columns');
    const skeletonWrapper = document.querySelector('.skeleton-wrapper');
    if (!newsContainer) return;

    if (skeletonWrapper) skeletonWrapper.style.display = 'block';
    newsContainer.innerHTML = '';

    try {
        const response = await fetch(GOOGLE_SHEET_URL);
        const csvText = await response.text();
        console.log("DEBUG: Fetched CSV Text (first 500 chars):", csvText.slice(0, 500));

        const newsData = parseCSV(csvText);
        console.log("DEBUG: Parsed News Data (first 3 articles):", newsData.slice(0, 3));
        console.log("DEBUG: Total Parsed Articles:", newsData.length);

        allNewsArticles = newsData.filter(article => article.Headline && article.Headline.trim() !== '');
        console.log("DEBUG: Filtered Articles (passing Headline check):", allNewsArticles.length);

        displayNews(allNewsArticles);
    } catch (error) {
        console.error('Error fetching news:', error);
        newsContainer.innerHTML = '<p>Failed to retrieve news. Please try refreshing.</p>';
        if (skeletonWrapper) skeletonWrapper.style.display = 'none';
    }
}

function displayNews(articles) {
    const newsContainer = document.getElementById('news-columns');
    const skeletonWrapper = document.querySelector('.skeleton-wrapper');
    if (!newsContainer) return;

    newsContainer.innerHTML = '';
    if (skeletonWrapper) skeletonWrapper.style.display = 'none';

    if (articles.length === 0) {
        newsContainer.innerHTML = '<p>No news articles found.</p>';
        return;
    }

    articles.sort((a, b) => new Date(b['Published Time']) - new Date(a['Published Time']));

    articles.forEach((article, index) => {
        const headline = article.Headline || '';
        const summary = article.Summary || '';
        let url = (article.URL || '').replace(/^"|"$/g, '').trim();
        const publishedTime = article['Published Time'] || 'N/A';
        const tickers = article.Tickers || 'N/A';
        const imageUrl = article['Image URL'] || '';

        if (!url.startsWith('http')) url = 'https://' + url;
        try { new URL(url); } catch { url = '#'; }

        const isBreaking = index === 0;
        const breakingHtml = isBreaking ? '<span class="breaking-ribbon">BREAKING</span>' : '';
        const readMoreHtml = summary.length > MAX_SUMMARY_LENGTH && url !== '#' ?
            `<a href="${url}" target="_blank" class="read-more-button">Read More</a>` : '';

        const articleDiv = document.createElement('div');
        articleDiv.classList.add('news-article');
        articleDiv.innerHTML = `
            ${breakingHtml}
            <h2><a href="${url}" target="_blank">${headline}</a></h2>
            <span class="article-dateline">${formatNewspaperDateline(publishedTime)}</span>
            <p>${summary.substring(0, MAX_SUMMARY_LENGTH)}${summary.length > MAX_SUMMARY_LENGTH ? '...' : ''}</p>
            ${readMoreHtml}
            ${tickers !== 'N/A' ? `<div class="news-meta"><span>Tickers: ${tickers}</span></div>` : ''}
        `;

        console.log(`DEBUG: Rendering Article #${index}: Headline="${headline}", Tickers="${tickers}"`);
        newsContainer.appendChild(articleDiv);
    });
}

function startAutoRefresh() {
    if (autoRefreshIntervalId) clearInterval(autoRefreshIntervalId);
    autoRefreshIntervalId = setInterval(fetchNews, AUTO_REFRESH_INTERVAL_MS);
    console.log(`Auto-refresh started (every ${AUTO_REFRESH_INTERVAL_MS / 60000} minutes).`);
}

window.onload = () => {
    fetchNews();
    startAutoRefresh();
};

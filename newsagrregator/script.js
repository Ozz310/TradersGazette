const GOOGLE_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRAJhMLSkrHlICOabG493SP5WSQ1kUbbCnoAIgJGdD3TUzhBY1Fyn5-PQ9LuVKzf5YO6LHAlQkW3Dos/pub?output=csv';
let allNewsArticles = [];
let autoRefreshIntervalId;
const AUTO_REFRESH_INTERVAL_MS = 300000; // 5 minutes
const MAX_SUMMARY_LENGTH = 300;

// --- Helper Functions ---

function parseCSV(csv) {
    const lines = csv.split('\n').filter(line => line.trim() !== '');
    if (lines.length === 0) return [];

    const headers = parseCSVLine(lines[0]).map(h => h.trim());
    const data = [];

    for (let i = 1; i < lines.length; i++) {
        const rowFields = parseCSVLine(lines[i]);
        if (rowFields.length === headers.length) {
            const row = {};
            for (let j = 0; j < headers.length; j++) {
                row[headers[j]] = rowFields[j] || '';
            }
            data.push(row);
        } else {
            console.warn(`Skipping malformed row: Expected ${headers.length} columns, got ${rowFields.length}`, lines[i]);
        }
    }

    return data;
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];

        if (char === '"' && inQuotes && nextChar === '"') {
            current += '"';
            i++; // skip next
        } else if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}

function formatNewspaperDateline(dateString) {
    if (!dateString || typeof dateString !== 'string') return 'N/A';
    try {
        let cleaned = dateString.trim().replace(/^"|"$/g, '');
        if (cleaned.endsWith('Z')) cleaned = cleaned.slice(0, -1);
        if (cleaned.includes('.')) cleaned = cleaned.split('.')[0];

        let date = new Date(cleaned);
        if (isNaN(date)) {
            date = new Date(cleaned.replace('T', ' '));
        }
        if (isNaN(date)) throw new Error('Invalid date');

        return date.toLocaleString('en-US', {
            month: 'long', day: 'numeric', year: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: true
        });
    } catch (e) {
        console.error("Date parse error:", dateString, e);
        return 'Invalid Date';
    }
}

// --- Main Fetch & Display Functions ---

async function fetchNews() {
    const newsContainer = document.getElementById('news-columns');
    const skeletonWrapper = document.querySelector('.skeleton-wrapper');

    if (!newsContainer) {
        console.error("Element #news-columns not found.");
        return;
    }

    if (skeletonWrapper) skeletonWrapper.style.display = 'block';
    newsContainer.innerHTML = '';

    try {
        const response = await fetch(GOOGLE_SHEET_URL);
        const csvText = await response.text();
        console.log("DEBUG: Fetched CSV sample:", csvText.substring(0, 500));

        const newsData = parseCSV(csvText);
        console.log("DEBUG: Parsed Articles (first 3):", newsData.slice(0, 3));

        allNewsArticles = newsData.filter(article => article.Headline?.trim() !== '');
        displayNews(allNewsArticles);
    } catch (err) {
        console.error("Error fetching news:", err);
        newsContainer.innerHTML = '<p>Failed to load news. Please try again later.</p>';
        if (skeletonWrapper) skeletonWrapper.style.display = 'none';
    }
}

function displayNews(articles) {
    const newsContainer = document.getElementById('news-columns');
    const skeletonWrapper = document.querySelector('.skeleton-wrapper');

    if (!newsContainer) return;

    if (skeletonWrapper) skeletonWrapper.style.display = 'none';
    newsContainer.innerHTML = '';

    if (articles.length === 0) {
        newsContainer.innerHTML = '<p>No news articles found.</p>';
        return;
    }

    articles.sort((a, b) => {
        const dateA = new Date(a['Published Time']);
        const dateB = new Date(b['Published Time']);
        return (isNaN(dateB) ? -1 : dateB) - (isNaN(dateA) ? -1 : dateA);
    });

    articles.forEach((article, index) => {
        const headline = article.Headline || '';
        const summary = article.Summary || '';
        let url = article.URL?.replace(/^"|"$/g, '').trim() || '#';
        const publishedTime = article['Published Time'] || '';
        const tickers = article.Tickers || '';
        const isBreaking = index === 0;

        try {
            if (!url.startsWith('http')) url = 'https://' + url;
            new URL(url); // validate
        } catch { url = '#'; }

        const articleDiv = document.createElement('div');
        articleDiv.classList.add('news-article');

        const summaryHtml = summary
            ? `<p>${summary.substring(0, MAX_SUMMARY_LENGTH)}${summary.length > MAX_SUMMARY_LENGTH ? '...' : ''}</p>`
            : '<p>No summary available.</p>';

        const readMore = summary.length > MAX_SUMMARY_LENGTH && url !== '#'
            ? `<a href="${url}" class="read-more-button" target="_blank">Read More</a>` : '';

        const tickersHtml = tickers && tickers.trim() !== 'N/A'
            ? `<div class="news-meta"><span>Tickers: ${tickers}</span></div>` : '';

        const ribbonHtml = isBreaking ? `<span class="breaking-ribbon">BREAKING</span>` : '';

        articleDiv.innerHTML = `
            ${ribbonHtml}
            <h2><a href="${url}" target="_blank">${headline}</a></h2>
            <span class="article-dateline">${formatNewspaperDateline(publishedTime)}</span>
            ${summaryHtml}
            ${readMore}
            ${tickersHtml}
        `;
        newsContainer.appendChild(articleDiv);
    });
}

// --- Auto Refresh ---

function startAutoRefresh() {
    if (autoRefreshIntervalId) clearInterval(autoRefreshIntervalId);
    autoRefreshIntervalId = setInterval(fetchNews, AUTO_REFRESH_INTERVAL_MS);
    console.log("Auto-refresh started (every 5 minutes).");
}

function stopAutoRefresh() {
    if (autoRefreshIntervalId) {
        clearInterval(autoRefreshIntervalId);
        autoRefreshIntervalId = null;
        console.log("Auto-refresh stopped.");
    }
}

// --- Initial Load ---
window.onload = () => {
    fetchNews();
    startAutoRefresh();
};

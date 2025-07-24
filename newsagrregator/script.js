const GOOGLE_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRAJhMLSkrHlICOabG493SP5WSQ1kUbbCnoAIgJGdD3TUzhBY1Fyn5-PQ9LuVKzf5YO6LHAlQkW3Dos/pub?output=csv';
let allNewsArticles = [];
let autoRefreshIntervalId;
const AUTO_REFRESH_INTERVAL_MS = 300000;
const MAX_SUMMARY_LENGTH = 350;

// --- Robust CSV Parser Functions ---

function parseCSV(csv) {
    const lines = csv.split('\n');
    const nonEmptyLines = lines.filter(line => line.trim() !== '');
    if (nonEmptyLines.length === 0) return [];

    const headers = parseCSVLine(nonEmptyLines[0]);
    console.log("DEBUG: Raw CSV Header Line:", nonEmptyLines[0]);
    console.log("DEBUG: Parsed Headers (from parseCSVLine):", headers);

    const data = [];

    for (let i = 1; i < nonEmptyLines.length; i++) {
        const row = parseCSVLine(nonEmptyLines[i]);
        if (row.length === headers.length) {
            const obj = {};
            for (let j = 0; j < headers.length; j++) {
                obj[headers[j]] = row[j] || '';
            }
            data.push(obj);
        } else {
            console.warn(`DEBUG: Skipping malformed CSV row (column mismatch): "${nonEmptyLines[i]}" - Expected ${headers.length} columns, got ${row.length}`);
        }
    }

    return data;
}

// ✅ State-machine based CSV line parser
function parseCSVLine(line) {
    const fields = [];
    let current = '';
    let insideQuotes = false;
    let i = 0;

    while (i < line.length) {
        const char = line[i];

        if (insideQuotes) {
            if (char === '"') {
                if (line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    insideQuotes = false;
                }
            } else {
                current += char;
            }
        } else {
            if (char === '"') {
                insideQuotes = true;
            } else if (char === ',') {
                fields.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        i++;
    }

    fields.push(current.trim());

    return fields;
}

function formatNewspaperDateline(dateString) {
    if (!dateString || typeof dateString !== 'string') return 'N/A';
    try {
        let cleaned = dateString.trim().replace(/^"|"$/g, '');
        if (cleaned.endsWith('Z')) cleaned = cleaned.slice(0, -1);
        if (cleaned.includes('.')) cleaned = cleaned.split('.')[0];
        let date = new Date(cleaned);
        if (isNaN(date)) {
            date = new Date(cleaned.replace('T', ' ').replace('Z', ''));
            if (isNaN(date)) throw new Error('Invalid date after parsing attempt');
        }
        const options = { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true };
        return date.toLocaleString('en-US', options);
    } catch (e) {
        console.error("DEBUG: Date format error for input:", dateString, "Error:", e);
        return 'Invalid Date';
    }
}

// --- Main Fetch & Display Logic ---

async function fetchNews() {
    const newsContainer = document.getElementById('news-columns');
    const skeletonWrapper = document.querySelector('.skeleton-wrapper');

    if (!newsContainer) return;

    if (skeletonWrapper) skeletonWrapper.style.display = 'block';
    newsContainer.innerHTML = '';

    try {
        const response = await fetch(GOOGLE_SHEET_URL);
        const csvText = await response.text();

        console.log("DEBUG: Fetched CSV Text (first 500 chars):", csvText.substring(0, 500));

        const newsData = parseCSV(csvText);
        console.log("DEBUG: Parsed News Count:", newsData.length);

        allNewsArticles = newsData.filter(article => article.Headline && article.Headline.trim() !== '');
        console.log("DEBUG: Filtered Articles (passing Headline check):", allNewsArticles.length);

        displayNews(allNewsArticles);
    } catch (error) {
        console.error('Error fetching news:', error);
        newsContainer.innerHTML = '<p>Failed to retrieve news. Please try refreshing.</p>';
        if (skeletonWrapper) skeletonWrapper.style.display = 'none';
    }
}

function displayNews(articlesToDisplay) {
    const newsContainer = document.getElementById('news-columns');
    const skeletonWrapper = document.querySelector('.skeleton-wrapper');

    if (!newsContainer) return;
    newsContainer.innerHTML = '';
    if (skeletonWrapper) skeletonWrapper.style.display = 'none';

    if (articlesToDisplay.length === 0) {
        newsContainer.innerHTML = '<p>No news articles found.</p>';
        return;
    }

    articlesToDisplay.sort((a, b) => new Date(b['Published Time']) - new Date(a['Published Time']))
        .forEach((article, index) => {
            const headline = article.Headline || '';
            const summary = article.Summary || '';
            let url = article.URL || '#';
            const publishedTime = article['Published Time'] || 'N/A';
            const tickers = article.Tickers || 'N/A';

            if (url !== '#') {
                url = url.replace(/^"|"$/g, '').trim();
                if (!url.startsWith('http')) url = 'https://' + url;
                try { new URL(url); } catch { url = '#'; }
            }

            const isBreaking = index === 0;
            const breakingHtml = isBreaking ? '<span class="breaking-ribbon">BREAKING</span>' : '';
            const articleDiv = document.createElement('div');
            articleDiv.classList.add('news-article');

            const summaryHtml = summary
                ? `<p>${summary.substring(0, MAX_SUMMARY_LENGTH)}${summary.length > MAX_SUMMARY_LENGTH ? '...' : ''}</p>`
                : '<p>No summary available.</p>';

            const readMoreHtml = summary.length > MAX_SUMMARY_LENGTH && url !== '#' 
                ? `<a href="${url}" target="_blank" rel="noopener noreferrer" class="read-more-button">Read More</a>` 
                : '';

            articleDiv.innerHTML = `
                ${breakingHtml}
                <h2><a href="${url}" target="_blank" rel="noopener noreferrer">${headline}</a></h2>
                <span class="article-dateline">${formatNewspaperDateline(publishedTime)}</span>
                ${summaryHtml}
                ${readMoreHtml}
                ${tickers !== 'N/A' && tickers.trim() !== '' ? `<div class="news-meta"><span>Tickers: ${tickers}</span></div>` : ''}
            `;

            newsContainer.appendChild(articleDiv);
        });
}

// --- Auto Refresh ---
function startAutoRefresh() {
    if (autoRefreshIntervalId) clearInterval(autoRefreshIntervalId);
    autoRefreshIntervalId = setInterval(fetchNews, AUTO_REFRESH_INTERVAL_MS);
    console.log(`Auto-refresh started (every ${AUTO_REFRESH_INTERVAL_MS / 60000} minutes).`);
}

// --- Initial Load ---
window.onload = () => {
    fetchNews();
    startAutoRefresh();
};

const GOOGLE_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRAJhMLSkrHlICOabG493SP5WSQ1kUbbCnoAIgJGdD3TUzhBY1Fyn5-PQ9LuVKzf5YO6LHAlQkW3Dos/pub?output=csv';
let allNewsArticles = [];
let autoRefreshIntervalId;
const AUTO_REFRESH_INTERVAL_MS = 300000; // 5 minutes

// --- Robust CSV Parsing Functions ---

function splitCSVIntoRows(csvText) {
    const rows = [];
    let currentRow = '';
    let inQuotes = false;

    for (let i = 0; i < csvText.length; i++) {
        const char = csvText[i];
        const nextChar = csvText[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                currentRow += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === '\n' && !inQuotes) {
            rows.push(currentRow);
            currentRow = '';
        } else {
            currentRow += char;
        }
    }

    if (currentRow) rows.push(currentRow);
    return rows;
}

function parseCSVLine(line) {
    const result = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                currentField += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(currentField.trim());
            currentField = '';
        } else {
            currentField += char;
        }
    }

    result.push(currentField.trim());
    return result;
}

function parseCSV(csvText) {
    const lines = splitCSVIntoRows(csvText);
    if (!lines.length) return [];

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
            console.warn(`Skipping malformed CSV row: "${lines[i]}" - Expected ${headers.length} columns, got ${row.length}`);
        }
    }

    return data;
}

// --- Date Formatter ---

function formatNewspaperDateline(dateString) {
    if (!dateString || typeof dateString !== 'string') return 'N/A';
    try {
        let cleanedDate = dateString.trim().replace(/^"|"$/g, '');

        if (cleanedDate.endsWith('Z')) cleanedDate = cleanedDate.slice(0, -1);
        if (cleanedDate.includes('.')) cleanedDate = cleanedDate.split('.')[0];

        let date = new Date(cleanedDate);

        if (isNaN(date.getTime())) {
            date = new Date(cleanedDate.replace('T', ' '));
            if (isNaN(date.getTime())) throw new Error('Unparsable date');
        }

        return date.toLocaleString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        });
    } catch (e) {
        console.error("DEBUG: Date format error for input:", dateString, "Error:", e);
        return 'Invalid Date';
    }
}

// --- Fetch & Display ---

async function fetchNews() {
    const newsContainer = document.getElementById('news-columns');
    const skeletonWrapper = document.querySelector('.skeleton-wrapper');
    if (!newsContainer) return;

    if (skeletonWrapper) skeletonWrapper.style.display = 'block';
    newsContainer.innerHTML = '';

    try {
        const response = await fetch(GOOGLE_SHEET_URL);
        const csvText = await response.text();

        const newsData = parseCSV(csvText);
        console.log("DEBUG: Parsed News Count:", newsData.length);

        allNewsArticles = newsData.filter(article => article.Headline && article.Headline.trim() !== '');
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

    if (!articlesToDisplay.length) {
        newsContainer.innerHTML = '<p>No news articles found.</p>';
        return;
    }

    articlesToDisplay.sort((a, b) => {
        const dateA = new Date(a['Published Time']);
        const dateB = new Date(b['Published Time']);
        return dateB - dateA;
    }).forEach((article, index) => {
        const headline = article.Headline || '';
        const summary = article.Summary || '';
        const publishedTime = article['Published Time'] || '';
        const tickers = article.Tickers || '';
        const imageUrl = article['Image URL'] || '';
        let url = article.URL || '#';

        if (url) {
            url = url.replace(/^"|"$/g, '').trim();
            if (!url.startsWith('http')) url = 'https://' + url;
            try { new URL(url); } catch { url = '#'; }
        }

        const isBreaking = index === 0;
        const breakingRibbonHtml = isBreaking ? '<span class="breaking-ribbon">BREAKING</span>' : '';
        const summaryHtml = summary ? `<p>${summary.substring(0, 300)}...</p>` : '<p>No summary available.</p>';
        const readMoreHtml = summary.length > 300 && url !== '#' ? `<a href="${url}" target="_blank" rel="noopener noreferrer" class="read-more-button">Read More</a>` : '';

        const articleDiv = document.createElement('div');
        articleDiv.classList.add('news-article');

        articleDiv.innerHTML = `
            ${breakingRibbonHtml}
            <h2><a href="${url}" target="_blank" rel="noopener noreferrer">${headline}</a></h2>
            <span class="article-dateline">${formatNewspaperDateline(publishedTime)}</span>
            ${summaryHtml}
            ${readMoreHtml}
            ${tickers.trim() !== '' ? `<div class="news-meta"><span>Tickers: ${tickers}</span></div>` : ''}
        `;

        newsContainer.appendChild(articleDiv);
    });
}

// --- Auto-Refresh ---

function startAutoRefresh() {
    if (autoRefreshIntervalId) clearInterval(autoRefreshIntervalId);
    autoRefreshIntervalId = setInterval(fetchNews, AUTO_REFRESH_INTERVAL_MS);
    console.log(`Auto-refresh started (every ${AUTO_REFRESH_INTERVAL_MS / 60000} minutes).`);
}

function stopAutoRefresh() {
    if (autoRefreshIntervalId) {
        clearInterval(autoRefreshIntervalId);
        autoRefreshIntervalId = null;
        console.log('Auto-refresh stopped.');
    }
}

// --- Init ---

window.onload = () => {
    fetchNews();
    startAutoRefresh();
};

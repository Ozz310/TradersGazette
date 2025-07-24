const GOOGLE_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRAJhMLSkrHlICOabG493SP5WSQ1kUbbCnoAIgJGdD3TUzhBY1Fyn5-PQ9LuVKzf5YO6LHAlQkW3Dos/pub?output=csv';
const AUTO_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

// === CSV PARSER ===
function parseCSV(csvText) {
    const lines = csvText.trim().split(/\r?\n/);
    const headers = parseCSVLine(lines[0]);
    console.debug("DEBUG: Raw CSV Header Line:", lines[0]);
    console.debug("DEBUG: Parsed Headers (from parseCSVLine):", headers);

    const data = [];
    for (let i = 1; i < lines.length; i++) {
        const row = parseCSVLine(lines[i]);
        if (row.length !== headers.length) {
            console.warn(`DEBUG: Skipping malformed CSV row (column mismatch): "${lines[i]}" - Expected ${headers.length} columns, got ${row.length}`);
            continue;
        }

        const entry = {};
        headers.forEach((header, index) => {
            entry[header.trim()] = row[index].trim();
        });
        data.push(entry);
    }

    console.debug("DEBUG: Parsed News Data (first 3 articles):", data.slice(0, 3));
    console.debug("DEBUG: Total Parsed Articles:", data.length);
    return data;
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let insideQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];

        if (insideQuotes) {
            if (char === '"' && nextChar === '"') {
                current += '"';
                i++; // Skip the escaped quote
            } else if (char === '"') {
                insideQuotes = false;
            } else {
                current += char;
            }
        } else {
            if (char === '"') {
                insideQuotes = true;
            } else if (char === ',') {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
    }
    result.push(current); // Last field
    return result;
}

// === DISPLAY LOGIC ===
function displayNews(newsArray) {
    const container = document.getElementById('news-columns');
    container.innerHTML = ''; // Clear existing

    newsArray.forEach((article, index) => {
        if (!article.Headline || !article.URL || !article['Published Time']) return;

        let dateStr = formatNewspaperDateline(article['Published Time']);
        if (!dateStr) return;

        console.debug(`DEBUG: Rendering Article #${index}: Headline="${article.Headline}", Tickers="${article.Tickers}"`);

        const articleDiv = document.createElement('div');
        articleDiv.className = 'news-article';

        articleDiv.innerHTML = `
            <img src="${article['Image URL']}" class="news-thumbnail" alt="News Image">
            <div class="news-text">
                <h2><a href="${article.URL}" target="_blank">${article.Headline}</a></h2>
                <p>${article.Summary}</p>
                <div class="news-meta">
                    <span>${dateStr}</span>
                    <span>${article.Tickers}</span>
                </div>
            </div>
        `;

        container.appendChild(articleDiv);
    });
}

function formatNewspaperDateline(dateInput) {
    try {
        const date = new Date(dateInput);
        if (isNaN(date.getTime())) throw new Error("Invalid date");
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (e) {
        console.debug("DEBUG: Date format error for input:", dateInput, "Error:", e);
        return null;
    }
}

// === FETCH LOGIC ===
async function fetchNews() {
    try {
        const response = await fetch(GOOGLE_SHEET_URL);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const csvText = await response.text();

        console.debug("DEBUG: Fetched CSV Text (first 500 chars):", csvText.slice(0, 500));

        const articles = parseCSV(csvText);
        const filtered = articles.filter(article => article.Headline && article.Headline.trim() !== '');

        console.debug("DEBUG: Filtered Articles (passing Headline check):", filtered.length);

        displayNews(filtered);
    } catch (error) {
        console.error("Error fetching news:", error);
    }
}

function startAutoRefresh() {
    setInterval(fetchNews, AUTO_REFRESH_INTERVAL);
    console.log("Auto-refresh started (every 5 minutes).");
}

// === INIT ===
window.onload = () => {
    fetchNews();
    startAutoRefresh();
};

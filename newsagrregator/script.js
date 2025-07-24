const GOOGLE_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRAJhMLSkrHlICOabG493SP5WSQ1kUbbCnoAIgJGdD3TUzhBY1Fyn5-PQ9LuVKzf5YO6LHAlQkW3Dos/pub?output=csv';
let allNewsArticles = []; // To store all fetched news
let autoRefreshIntervalId; // Used for setInterval
const AUTO_REFRESH_INTERVAL_MS = 300000; // 5 minutes


// --- Helper Functions ---

// Robust CSV parser
function parseCSV(csv) {
    const lines = csv.split('\n');
    const nonEmptyLines = lines.filter(line => line.trim() !== '');
    if (nonEmptyLines.length === 0) return [];

    const headers = parseCSVLine(nonEmptyLines[0]).map(header => header.trim());
    const data = [];

    // NEW: Log raw header line and parsed headers for debugging
    console.log("DEBUG: Raw CSV Header Line:", nonEmptyLines[0]);
    console.log("DEBUG: Parsed Headers (from parseCSVLine):", headers);

    for (let i = 1; i < nonEmptyLines.length; i++) {
        const currentLine = parseCSVLine(nonEmptyLines[i]);
        if (currentLine.length === headers.length) { // Ensure line has correct number of columns
            const row = {};
            for (let j = 0; j < headers.length; j++) {
                row[headers[j]] = currentLine[j] !== undefined ? currentLine[j] : '';
            }
            data.push(row);
        } else {
            // NEW: Log malformed rows for debugging
            console.warn(`DEBUG: Skipping malformed CSV row (column mismatch): "${nonEmptyLines[i]}" - Expected ${headers.length} columns, got ${currentLine.length}`);
        }
    }
    return data;
}

// NEW: Highly robust CSV line parser using regex
function parseCSVLine(line) {
    const results = [];
    // Regex: Matches a quoted field (allowing "" for escaped quotes) OR an unquoted field (up to comma or end of line)
    const regex = /(?:\"([^\"]*(?:\"\"[^\"]*)*)\"|([^,]*))(?:,|$)/g; 
    let match;
    let lastIndex = 0;

    while ((match = regex.exec(line)) !== null) {
        let value;
        if (match[1] !== undefined) { // If it matched a quoted field
            value = match[1].replace(/\"\"/g, '"'); // Unescape double quotes within the field
        } else { // If it matched an unquoted field
            value = match[2];
        }
        results.push(value.trim()); // Add the value, trimming whitespace
        lastIndex = regex.lastIndex; // Keep track of progress in the line
    }

    // Handle trailing empty fields (e.g., "a,b," should result in ["a", "b", ""])
    if (lastIndex < line.length && line.charAt(lastIndex - 1) === ',') {
        results.push('');
    }

    return results;
}

// More robust Date Formatting Function (from previous iteration)
function formatNewspaperDateline(dateString) {
  if (!dateString || typeof dateString !== 'string') return 'N/A';
  try {
    let cleanedDateString = dateString.trim();
    // Remove trailing 'Z' and milliseconds if present, as some older engines struggle with it
    if (cleanedDateString.endsWith('Z')) {
        cleanedDateString = cleanedDateString.substring(0, cleanedDateString.length - 1);
    }
    if (cleanedDateString.includes('.')) {
        cleanedDateString = cleanedDateString.split('.')[0]; // Remove milliseconds
    }
    // Remove quotes if the string is wrapped in them
    if (cleanedDateString.startsWith('"') && cleanedDateString.endsWith('"')) {
        cleanedDateString = cleanedDateString.substring(1, cleanedDateString.length - 1);
    }

    let date = new Date(cleanedDateString); 

    if (isNaN(date.getTime())) {
        // Fallback for some specific formats if initial parse fails (e.g., if it has T and Z but no time)
        const fallbackDate = new Date(dateString.replace('T', ' ').replace('Z', '')); 
        if (!isNaN(fallbackDate.getTime())) {
            date = fallbackDate;
        } else {
            throw new Error('Invalid date after parsing attempt');
        }
    }

    const options = { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true };
    return `${date.toLocaleString('en-US', options)}`;
  } catch (e) {
    console.error("DEBUG: Date format error for input:", dateString, "Error:", e);
    return 'Invalid Date';
  }
}


// --- Main Fetch & Display Functions ---

async function fetchNews() {
    const newsContainer = document.getElementById('news-columns');
    const skeletonWrapper = document.querySelector('.skeleton-wrapper'); // Get skeleton wrapper

    if (!newsContainer) {
        console.error("Error: #news-columns element not found. Cannot load news.");
        return;
    }

    // Show skeleton loader
    if (skeletonWrapper) {
        skeletonWrapper.style.display = 'block';
    }
    newsContainer.innerHTML = ''; // Clear previous content

    try {
        const response = await fetch(GOOGLE_SHEET_URL);
        const csvText = await response.text();

        // NEW: Log raw CSV text for debugging
        console.log("DEBUG: Fetched CSV Text (first 500 chars):", csvText.substring(0, 500)); 

        const newsData = parseCSV(csvText);
        // NEW: Log parsed data for debugging
        console.log("DEBUG: Parsed News Data (first 3 articles):", newsData.slice(0, 3)); 
        console.log("DEBUG: Total Parsed Articles:", newsData.length);

        // Filter out articles with empty headlines (or other critical missing data if needed)
        allNewsArticles = newsData.filter(article => article.Headline && article.Headline.trim() !== '');
        // NEW: Log filtered count for debugging
        console.log("DEBUG: Filtered Articles (passing Headline check):", allNewsArticles.length);

        displayNews(allNewsArticles);

    } catch (error) {
        console.error('Error fetching news:', error);
        newsContainer.innerHTML = '<p>Failed to retrieve news. Please try refreshing.</p>';
        if (skeletonWrapper) { // Hide skeleton if error
            skeletonWrapper.style.display = 'none';
        }
    }
}

function displayNews(articlesToDisplay) {
    const newsContainer = document.getElementById('news-columns');
    const skeletonWrapper = document.querySelector('.skeleton-wrapper'); // Get skeleton wrapper

    if (!newsContainer) {
        console.error("Error: #news-columns element not found in displayNews.");
        return;
    }

    newsContainer.innerHTML = ''; // Clear everything, including skeleton if present

    // Hide skeleton after news is loaded
    if (skeletonWrapper) {
        skeletonWrapper.style.display = 'none';
    }

    if (articlesToDisplay.length === 0) {
        newsContainer.innerHTML = '<p>No news articles found.</p>';
        return;
    }

    // Sort news by published time descending (most recent first)
    articlesToDisplay.sort((a, b) => {
        const dateA = new Date(a['Published Time']);
        const dateB = new Date(b['Published Time']);
        if (isNaN(dateA) && isNaN(dateB)) return 0;
        if (isNaN(dateA)) return 1;
        if (isNaN(dateB)) return -1;
        return dateB - dateA;
    }).forEach((article, index) => {
        const headline = article.Headline || '';
        const summary = article.Summary || ''; // Corrected to article.Summary
        let url = article.URL || '#';
        const publishedTime = article['Published Time'] || 'N/A';
        const tickers = article.Tickers || 'N/A';
        const imageUrl = article['Image URL'] || ''; // Still extract, but not used for display

        // NEW: Log article data before rendering for debugging
        console.log(`DEBUG: Rendering Article #${index}: Headline="${headline}", Tickers="${tickers}"`);

        // URL Validation
        if (url !== '') {
            url = url.replace(/^"|"$/g, '').trim();
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                url = 'https://' + url;
            }
            try { new URL(url); } catch (e) { url = '#'; }
        } else { url = '#'; }

        // Determine if BREAKING ribbon is needed (e.g., first article)
        const isBreaking = index === 0;
        const breakingRibbonHtml = isBreaking ? '<span class="breaking-ribbon">BREAKING</span>' : '';

        const articleDiv = document.createElement('div');
        articleDiv.classList.add('news-article');

        const summaryHtml = summary ? `<p>${summary.substring(0, 300)}...</p>` : '<p>No summary available.</p>';
        // Add a class to the Read More link for specific button styling
        const readMoreHtml = summary.length > 300 && url !== '#' ? `<a href="${url}" target="_blank" rel="noopener noreferrer" class="read-more-button">Read More</a>` : '';


        // Build the HTML for a single news article
        articleDiv.innerHTML = `
            ${breakingRibbonHtml}
            <h2><a href="${url}" target="_blank" rel="noopener noreferrer">${headline}</a></h2>
            <span class="article-dateline">${formatNewspaperDateline(publishedTime)}</span>
            ${summaryHtml}
            ${readMoreHtml}
            ${tickers !== 'N/A' && tickers.trim() !== '' ? `<div class="news-meta"><span>Tickers: ${tickers}</span></div>` : ''}
        `;
        newsContainer.appendChild(articleDiv);
    });
}

// --- Functionality & Event Listeners (Simplified for removed elements) ---

// Auto-Refresh: STARTING BY DEFAULT
function startAutoRefresh() {
    if (autoRefreshIntervalId) clearInterval(autoRefreshIntervalId);
    autoRefreshIntervalId = setInterval(fetchNews, AUTO_REFRESH_INTERVAL_MS);
    console.log(`Auto-refresh started (every ${AUTO_REFRESH_INTERVAL_MS / 60000} minutes).`);
}

function stopAutoRefresh() { // This function is not called but remains for completeness
    if (autoRefreshIntervalId) {
        clearInterval(autoRefreshIntervalId);
        autoRefreshIntervalId = null;
        console.log('Auto-refresh stopped.');
    }
}


// --- Initial Load ---
window.onload = () => {
    fetchNews(); // Initial fetch
    startAutoRefresh(); // Start auto-refresh by default
};

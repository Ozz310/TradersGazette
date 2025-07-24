const GOOGLE_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRAJhMLSkrHlICOabG493SP5WSQ1kUbbCnoAIgJGdD3TUzhBY1Fyn5-PQ9LuVKzf5YO6LHAlqkW3Dos/pub?output=csv'; // Your correct Google Sheet URL
let allNewsArticles = []; // To store all fetched news
let autoRefreshIntervalId; // Used for setInterval
const AUTO_REFRESH_INTERVAL_MS = 300000; // 5 minutes
const MAX_SUMMARY_LENGTH = 500; // Define max summary length for display and to prevent overflow

// --- Helper Functions ---

// Robust CSV parser
function parseCSV(csv) {
    const lines = csv.split('\n');
    const nonEmptyLines = lines.filter(line => line.trim() !== '');
    if (nonEmptyLines.length === 0) return [];

    const headersLine = nonEmptyLines[0];
    const headers = parseCSVLine(headersLine).map(header => header.trim());

    const data = [];

    // DEBUG: Log raw header line and parsed headers for debugging
    console.log("DEBUG: Raw CSV Header Line:", nonEmptyLines[0]);
    console.log("DEBUG: Parsed Headers (from parseCSVLine):", headers);

    for (let i = 1; i < nonEmptyLines.length; i++) {
        const currentLine = nonEmptyLines[i];
        let parsedRow = [];
        try {
            parsedRow = parseCSVLine(currentLine);
        } catch (rowParseError) {
            // DEBUG: Log parsing errors for specific rows
            console.warn(`DEBUG: Error parsing row (RangeError likely): "${currentLine.substring(0, 100)}...". Skipping. Error: ${rowParseError.message}`);
            continue; // Skip this row if parsing itself throws an error
        }

        if (parsedRow.length === headers.length) { // Ensure line has correct number of columns
            const rowObj = {};
            for (let j = 0; j < headers.length; j++) {
                rowObj[headers[j]] = parsedRow[j] !== undefined ? parsedRow[j] : '';
            }
            data.push(rowObj);
        } else {
            console.warn(`DEBUG: Skipping malformed CSV row (column mismatch): "${currentLine.substring(0, 100)}..." - Expected ${headers.length} columns, got ${parsedRow.length}`);
        }
    }
    return data;
}

// Highly robust CSV line parser (Handles escaped quotes "" and commas within quotes)
function parseCSVLine(line) {
    const results = [];
    const regex = /(?:\"([^\"]*(?:\"\"[^\"]*)*)\"|([^,]*))(?:,|$)/g; 
    let match;
    let lastIndex = 0; // Track progress to prevent infinite loops

    const MAX_FIELD_LENGTH = 10000; // Safeguard: max chars for a single field
    const MAX_FIELDS_PER_LINE = 100; // Safeguard: max fields to parse per line

    let fieldCount = 0;

    // Trim the line before parsing to remove leading/trailing whitespace which might affect regex
    const trimmedLine = line.trim();

    while ((match = regex.exec(trimmedLine)) !== null) {
        if (fieldCount >= MAX_FIELDS_PER_LINE) {
            console.warn(`DEBUG: parseCSVLine exceeded MAX_FIELDS_PER_LINE for line: ${trimmedLine.substring(0, 100)}...`);
            throw new Error("Too many fields detected in line."); // Prevent runaway parsing
        }

        let value;
        if (match[1] !== undefined) { // Matched a quoted field
            value = match[1].replace(/\"\"/g, '"'); // Unescape double quotes within the field
        } else { // Matched an unquoted field
            value = match[2];
        }

        // Safeguard: Truncate very long fields during parsing if they exceed expected size
        if (value && value.length > MAX_FIELD_LENGTH) {
            console.warn(`DEBUG: Field too long, truncating: ${value.substring(0, 50)}...`);
            value = value.substring(0, MAX_FIELD_LENGTH);
        }

        results.push(value); 
        lastIndex = regex.lastIndex; 
        fieldCount++;

        // Safeguard against regex getting stuck (shouldn't happen with proper regex but good for very malformed data)
        if (regex.lastIndex === startIndex) { // startIndex comes from outer scope or set to 0 initially
            regex.lastIndex++; 
        }
    }

    // Handle trailing empty fields (e.g., "a,b," should result in ["a", "b", ""])
    // This is necessary because the regex might not capture trailing empty fields correctly if the line ends with a comma
    if (trimmedLine.endsWith(',') && trimmedLine.charAt(trimmedLine.length - 1) === ',') {
        // Check if the regex already correctly pushed an empty string for a trailing comma
        if (results[results.length - 1] !== '') { // If not, add it
             results.push('');
        }
    }

    return results.map(s => (s || '').trim()); // Trim all results at the very end
}

// More robust Date Formatting Function (from previous iteration)
function formatNewspaperDateline(dateString) {
  if (!dateString || typeof dateString !== 'string') return 'N/A';
  try {
    let cleanedDateString = dateString.trim();
    // Remove trailing 'Z' and milliseconds if present
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

        // DEBUG: Log raw CSV text for debugging
        console.log("DEBUG: Fetched CSV Text (first 500 chars):", csvText.substring(0, 500)); 

        const newsData = parseCSV(csvText);
        // DEBUG: Log parsed data for debugging
        console.log("DEBUG: Parsed News Data (first 3 articles):", newsData.slice(0, 3)); 
        console.log("DEBUG: Total Parsed Articles:", newsData.length);

        // Filter out articles with empty headlines (or other critical missing data if needed)
        allNewsArticles = newsData.filter(article => article.Headline && article.Headline.trim() !== '');
        // DEBUG: Log filtered count for debugging
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
        const summary = article.Summary || ''; 
        let url = article.URL || '#';
        const publishedTime = article['Published Time'] || 'N/A';
        const tickers = article.Tickers || 'N/A';
        const imageUrl = article['Image URL'] || ''; // Still extract, but not used for display

        // DEBUG: Log article data before rendering for debugging
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

        // REMOVED IMAGE HTML: The image is no longer included here.

        const summaryHtml = summary ? `<p>${summary.substring(0, MAX_SUMMARY_LENGTH) + (summary.length > MAX_SUMMARY_LENGTH ? '...' : '')}</p>` : '<p>No summary available.</p>'; 
        // Add a class to the Read More link for specific button styling
        const readMoreHtml = article.Summary && article.Summary.length > MAX_SUMMARY_LENGTH && url !== '#' ? `<a href="${url}" target="_blank" rel="noopener noreferrer" class="read-more-button">Read More</a>` : '';


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

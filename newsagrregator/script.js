// script.js
// MAKE SURE THIS IS THE LATEST APPS SCRIPT WEB APP URL THAT RETURNS JSON
const GOOGLE_SHEET_URL = 'https://script.google.com/macros/s/AKfycbzzyYtZRvj1VntxAjhmuFrKnjZq8D7EijHKiDGir1m7yisRW7aVuUNnaUNP5Dia6eTo/exec'; 

let allNewsArticles = []; // To store all fetched news
let autoRefreshIntervalId; // Used for setInterval
const AUTO_REFRESH_INTERVAL_MS = 300000; // 5 minutes

// --- No more parseCSV or parseCSVLine needed! ---

// Format date for display (keep this as is)
function formatNewspaperDateline(dateString) {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        if (isNaN(date)) throw new Error('Invalid Date');

        const options = { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true };
        return `${date.toLocaleString('en-US', options)}`;
    } catch (e) {
        console.error("Date parsing error:", e);
        return 'Invalid Date';
    }
}

// --- Main Fetch & Display Functions ---

async function fetchNews() {
    const newsContainer = document.getElementById('news-columns');
    const skeletonWrapper = document.querySelector('.skeleton-wrapper');

    if (!newsContainer) {
        console.error("Error: #news-columns element not found. Cannot load news.");
        return;
    }

    if (skeletonWrapper) {
        skeletonWrapper.style.display = 'block';
    }
    newsContainer.innerHTML = ''; // Clear previous content

    try {
        const response = await fetch(GOOGLE_SHEET_URL);
        // CHANGED: Expect JSON instead of text/CSV
        const newsData = await response.json(); 

        // Filter out articles with empty Headlines, as before
        allNewsArticles = newsData.filter(article => article.Headline && article.Headline.trim() !== '');
        displayNews(allNewsArticles);

    } catch (error) {
        console.error('Error fetching news:', error);
        newsContainer.innerHTML = '<p>Failed to retrieve news. Please try refreshing.</p>';
        if (skeletonWrapper) {
            skeletonWrapper.style.display = 'none';
        }
    }
}

function displayNews(articlesToDisplay) {
    const newsContainer = document.getElementById('news-columns');
    const skeletonWrapper = document.querySelector('.skeleton-wrapper');

    if (!newsContainer) {
        console.error("Error: #news-columns element not found in displayNews.");
        return;
    }

    newsContainer.innerHTML = ''; // Clear everything, including skeleton if present

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
        const summary = article.description || ''; // Make sure to use 'description' if that's the API field name or sheet column
        let url = article.URL || '#';
        const publishedTime = article['Published Time'] || 'N/A';
        const tickers = article.Tickers || 'N/A';
        const imageUrl = article['Image URL'] || '';

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
        const readMoreHtml = summary.length > 300 && url !== '#' ? `<a href="${url}" target="_blank" rel="noopener noreferrer" class="read-more-button">Read More</a>` : '';

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

// --- Functionality & Event Listeners ---

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

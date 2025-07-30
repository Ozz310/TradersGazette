// script.js
// MAKE SURE THIS IS THE LATEST APPS SCRIPT WEB APP URL THAT RETURNS JSON
const GOOGLE_SHEET_URL = 'https://script.google.com/macros/s/AKfycbzIpig_oQ3eEbYOow209uyJMPdqfA7ByGXT6W-9kB--DmVPmYqmYsdHEIM_svNvmt-r/exec'; // <--- UPDATED TO YOUR NEW DEPLOYMENT ID

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

    // Show skeleton loader immediately
    if (skeletonWrapper) {
        skeletonWrapper.style.display = 'block';
    }
    newsContainer.innerHTML = ''; // Clear previous content

    try {
        const response = await fetch(GOOGLE_SHEET_URL);
        const newsData = await response.json();    

        allNewsArticles = newsData.filter(article => article.Headline && article.Headline.trim() !== '');
        
        // Direct call to displayNews - animation delay removed
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
    const skeletonWrapper = document.querySelector('.skeleton-wrapper'); // Get skeleton wrapper

    // Clear everything and hide skeleton right before displaying news
    newsContainer.innerHTML = '';    
    if (skeletonWrapper) { // Hide skeleton after news is loaded
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
        if (isNaN(dateB)) return -1; // Keep b if valid and a is not
        if (isNaN(dateA)) return 1;  // Keep a if valid and b is not
        return dateB - dateA;
    }).forEach((article, index) => {
        const headline = article.Headline || '';
        const summary = article.Summary || '';    
        let url = article.URL || '#';
        const publishedTime = article['Published Time'] || 'N/A';
        const tickers = article.Tickers || 'N/A';
        // const imageUrl = article['Image URL'] || ''; // No longer used for display

        // Log summary for debugging (kept for your reference)
        if (!summary || summary.trim() === '') {
            console.warn(`Summary missing for article: "${headline}"`);
            console.log("Full article data:", article);    
        }

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

        // Adjusted summary display to ensure max 300 chars always
        const displaySummary = summary ? summary.substring(0, 300) : '';
        const summaryHtml = displaySummary ? `<p>${displaySummary}${summary.length > 300 ? '...' : ''}</p>` : '<p>No summary available.</p>';
        const readMoreHtml = url !== '#' ? `<a href="${url}" target="_blank" rel="noopener noreferrer" class="read-more-button">Read More</a>` : '';


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

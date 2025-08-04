
// API Key provided by the user
const API_KEY = "c27c0cc562a3bfd70fff7003";

// Base URL for the Exchangerate API, using a dynamic base currency
const API_BASE_URL = "https://v6.exchangerate-api.com/v6/";

// --- DOM elements ---
const accountCurrencySelect = document.getElementById('accountCurrency');
const leverageSelect = document.getElementById('leverage');
const currencyPairSelect = document.getElementById('currencyPair');
const tradeSizeInput = document.getElementById('tradeSize');
const tradeSizeLabel = document.getElementById('tradeSizeLabel');
const messageBox = document.getElementById('messageBox');
const messageText = document.getElementById('messageText');
const loadingSpinnerMargin = document.getElementById('loadingSpinnerMargin');
const loadingSpinnerRR = document.getElementById('loadingSpinnerRR');

const ratePairDisplay = document.getElementById('ratePairDisplay');
const currentRateDisplay = document.getElementById('currentRateDisplay');
const timestampMargin = document.getElementById('timestampMargin');
const requiredMarginDisplay = document.getElementById('requiredMarginDisplay');
const marginCurrencySymbol = document.getElementById('marginCurrencySymbol');
const pipValueDisplay = document.getElementById('pipValueDisplay');
const pipValueCurrencySymbol = document.getElementById('pipValueCurrencySymbol');

const capitalInput = document.getElementById('capital');
const riskPercentInput = document.getElementById('riskPercent');
const instrumentRRSelect = document.getElementById('instrumentRR');
const entryPriceInput = document.getElementById('entryPrice');
const stopLossPriceInput = document.getElementById('stopLossPrice');
const takeProfitPriceInput = document.getElementById('takeProfitPrice');
const riskAmountDisplay = document.getElementById('riskAmountDisplay');
const stopLossPipsDisplay = document.getElementById('stopLossPipsDisplay');
const recommendedUnitsDisplay = document.getElementById('recommendedUnitsDisplay');
const rrRatioDisplay = document.getElementById('rrRatioDisplay');

// All result card elements for easy reset
const allResultCards = document.querySelectorAll('.result-card');
const marginCards = document.querySelectorAll('#cardMarginRate, #cardMarginRequired, #cardMarginPip');
const rrCards = document.querySelectorAll('#cardRRRisk, #cardRRStopLoss, #cardRRUnits, #cardRRRatio');

// --- Event Listeners ---
window.onload = () => {
    fetchAndDisplayInitialRate();
    updateTradeSizeLabel();
};
currencyPairSelect.addEventListener('change', () => {
    fetchAndDisplayInitialRate();
    updateTradeSizeLabel();
});

// --- Message Box Functions ---
function showMessage(message, type = 'info') {
    messageText.textContent = message;
    messageBox.classList.add('show');
    messageBox.style.backgroundColor = (type === 'error') ? '#d32f2f' : '#333';
    allResultCards.forEach(card => card.classList.remove('success-border'));
}

function hideMessage() {
    messageBox.classList.remove('show');
}

function showLoading(spinner) {
    if (spinner) spinner.classList.add('show');
}

function hideLoading(spinner) {
    if (spinner) spinner.classList.remove('show');
}

function resetResults() {
    allResultCards.forEach(card => card.classList.remove('success-border'));
    ratePairDisplay.textContent = 'N/A';
    currentRateDisplay.textContent = 'N/A';
    timestampMargin.textContent = '';
    requiredMarginDisplay.textContent = 'N/A';
    marginCurrencySymbol.textContent = '';
    pipValueDisplay.textContent = 'N/A';
    pipValueCurrencySymbol.textContent = '';
    riskAmountDisplay.textContent = 'N/A';
    stopLossPipsDisplay.textContent = 'N/A';
    recommendedUnitsDisplay.textContent = 'N/A';
    rrRatioDisplay.textContent = 'N/A';
}


// NEW: Function to show/hide result cards based on active calculator
function showRelevantResults(calculatorType) {
    // First, hide all cards
    allResultCards.forEach(card => card.style.display = 'none');
    
    // Then, show only the relevant ones
    if (calculatorType === 'margin') {
        marginCards.forEach(card => card.style.display = 'block');
    } else if (calculatorType === 'rr') {
        rrCards.forEach(card => card.style.display = 'block');
    }
}


function validateInputs(inputs) {
    let isValid = true;
    inputs.forEach(input => {
        if (input.value === "" || isNaN(parseFloat(input.value)) || parseFloat(input.value) <= 0) {
            input.classList.add('invalid');
            isValid = false;
        } else {
            input.classList.remove('invalid');
        }
    });
    return isValid;
}

// --- Helper Functions ---
function getAssetType(symbol) {
    if (symbol.length === 6 && !symbol.startsWith('X')) {
        return 'forex';
    } else if (symbol.startsWith('XAU') || symbol.startsWith('XAG')) {
        return 'metal';
    }
    return 'unknown';
}

function updateTradeSizeLabel() {
    const selectedSymbol = currencyPairSelect.value;
    const assetType = getAssetType(selectedSymbol);
    let labelText = "Trade Size (Units):";
    let defaultValue = "1";

    switch (assetType) {
        case 'forex':
            labelText = "Trade Size (Base Currency Units):";
            defaultValue = "100000";
            break;
        case 'metal':
            labelText = "Trade Size (Ounces):";
            defaultValue = "1";
            break;
        default:
            labelText = "Trade Size (Units):";
            defaultValue = "1";
            break;
    }
    tradeSizeLabel.textContent = labelText;
    tradeSizeInput.value = defaultValue;
    tradeSizeInput.placeholder = `e.g., ${defaultValue}`;
}

function getPipPointDetails(symbol) {
    const assetType = getAssetType(symbol);
    let pipSize = 0;
    let valueLabel = 'N/A';
    let isPipCalculable = false;

    switch (assetType) {
        case 'forex':
            isPipCalculable = true;
            valueLabel = 'Pip Value';
            if (symbol.includes('JPY')) {
                pipSize = 0.01;
            } else {
                pipSize = 0.0001;
            }
            break;
        case 'metal':
            isPipCalculable = true;
            valueLabel = 'Point Value';
            pipSize = 1;
            break;
        default:
            isPipCalculable = false;
            valueLabel = 'N/A';
            break;
    }
    return { pipSize, valueLabel, isPipCalculable };
}

function parseSymbol(symbol) {
    if (symbol.startsWith('XAU') || symbol.startsWith('XAG')) {
        return { base: symbol.substring(0, 3), quote: symbol.substring(3, 6) };
    } else if (symbol.length === 6) {
        return { base: symbol.substring(0, 3), quote: symbol.substring(3, 6) };
    }
    return { base: '', quote: '' };
}

// --- Core Logic for Margin Calculator ---
async function fetchConversionRates(baseCurrency) {
    showLoading(loadingSpinnerMargin);
    try {
        const url = `${API_BASE_URL}${API_KEY}/latest/${baseCurrency}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.result === 'success') {
            return data.conversion_rates;
        } else {
            const errorMsg = data['error-type'] || 'Unknown API Error';
            showMessage(`API Error: ${errorMsg}. Please check your API key or base currency.`, 'error');
            return null;
        }
    } catch (error) {
        console.error("Error fetching rates:", error);
        showMessage(`Failed to fetch rates. Check your internet connection.`, 'error');
        return null;
    } finally {
        hideLoading(loadingSpinnerMargin);
    }
}

async function calculateMargin() {
    hideMessage();
    // Re-apply active class to prevent vanishing
    const activeTab = document.getElementById('marginCalculator');
    if (activeTab) {
        activeTab.classList.add('active');
    }
    // NEW: Show only the result cards for the margin calculator
    showRelevantResults('margin');
    
    showLoading(loadingSpinnerMargin);
    
    marginCards.forEach(card => card.classList.remove('success-border'));

    const selectedSymbol = currencyPairSelect.value;
    const assetType = getAssetType(selectedSymbol);

    if (assetType !== 'forex') {
        showMessage("This calculator only supports Forex pairs on the free plan.", 'error');
        hideLoading(loadingSpinnerMargin);
        return;
    }

    const inputsToValidate = [tradeSizeInput];
    if (!validateInputs(inputsToValidate)) {
        showMessage("Please check your inputs.", 'error');
        hideLoading(loadingSpinnerMargin);
        return;
    }

    const accountCurrency = accountCurrencySelect.value;
    const leverage = parseFloat(leverageSelect.value);
    const tradeSizeUnits = parseFloat(tradeSizeInput.value);

    const { base: baseCurrencyOfPair, quote: quoteCurrencyOfPair } = parseSymbol(selectedSymbol);
    
    const baseRates = await fetchConversionRates(baseCurrencyOfPair);
    if (!baseRates) {
        hideLoading(loadingSpinnerMargin);
        return;
    }
    const currentPrice = baseRates[quoteCurrencyOfPair];
    ratePairDisplay.textContent = `${baseCurrencyOfPair}/${quoteCurrencyOfPair}`;
    currentRateDisplay.textContent = currentPrice.toFixed(5);
    timestampMargin.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
    
    let marginRequiredInBaseCurrency = (currentPrice * tradeSizeUnits) / leverage;

    let finalMarginAmount = marginRequiredInBaseCurrency;
    
    let marginCurrency = (assetType === 'forex') ? baseCurrencyOfPair : quoteCurrencyOfPair;

    if (marginCurrency !== accountCurrency) {
        const conversionRates = await fetchConversionRates(marginCurrency);
        if (!conversionRates || !conversionRates[accountCurrency]) {
            showMessage(`Could not fetch conversion rate from ${marginCurrency} to ${accountCurrency}. Margin may be inaccurate.`, 'error');
            requiredMarginDisplay.textContent = finalMarginAmount.toFixed(2);
            marginCurrencySymbol.textContent = marginCurrency;
            hideLoading(loadingSpinnerMargin);
            return;
        }
        finalMarginAmount = finalMarginAmount * conversionRates[accountCurrency];
    }
    
    requiredMarginDisplay.textContent = finalMarginAmount.toFixed(2);
    marginCurrencySymbol.textContent = accountCurrency;

    const { pipSize, valueLabel, isPipCalculable } = getPipPointDetails(selectedSymbol);
    
    if (isPipCalculable) {
        let pipPointValue = tradeSizeUnits * pipSize;
        
        if (quoteCurrencyOfPair !== accountCurrency) {
            const conversionRates = await fetchConversionRates(quoteCurrencyOfPair);
            if (!conversionRates || !conversionRates[accountCurrency]) {
                showMessage(`Could not fetch conversion rate for pip/point value from ${quoteCurrencyOfPair} to ${accountCurrency}.`, 'error');
                pipValueDisplay.textContent = 'N/A';
                pipValueCurrencySymbol.textContent = '';
                hideLoading(loadingSpinnerMargin);
                return;
            }
            const conversionRateForPip = conversionRates[accountCurrency];
            pipPointValue = pipPointValue * conversionRateForPip;
        }

        pipValueDisplay.textContent = pipPointValue.toFixed(2);
        pipValueCurrencySymbol.textContent = accountCurrency;
    } else {
        pipValueDisplay.textContent = valueLabel;
        pipValueCurrencySymbol.textContent = '';
    }
    
    document.getElementById('cardMarginRate').classList.add('success-border');
    document.getElementById('cardMarginRequired').classList.add('success-border');
    document.getElementById('cardMarginPip').classList.add('success-border');

    hideLoading(loadingSpinnerMargin);
}

// --- Core Logic for Position Size & Risk/Reward Calculator ---
async function calculateRiskRewardAndPosition() {
    hideMessage();
    // Re-apply active class to prevent vanishing
    const activeTab = document.getElementById('rrCalculator');
    if (activeTab) {
        activeTab.classList.add('active');
    }
    // NEW: Show only the result cards for the R/R calculator
    showRelevantResults('rr');
    
    showLoading(loadingSpinnerRR);
    
    rrCards.forEach(card => card.classList.remove('success-border'));
    riskAmountDisplay.textContent = 'N/A';
    stopLossPipsDisplay.textContent = 'N/A';
    recommendedUnitsDisplay.textContent = 'N/A';
    rrRatioDisplay.textContent = 'N/A';

    const inputsToValidate = [capitalInput, entryPriceInput, stopLossPriceInput];
    if (!validateInputs(inputsToValidate)) {
        showMessage("Please check your inputs.", 'error');
        hideLoading(loadingSpinnerRR);
        return;
    }

    const capital = parseFloat(capitalInput.value);
    const riskPercent = parseFloat(document.getElementById('riskPercent').value);
    const entryPrice = parseFloat(entryPriceInput.value);
    const stopLossPrice = parseFloat(stopLossPriceInput.value);
    const takeProfitPrice = parseFloat(takeProfitPriceInput.value);
    const selectedSymbol = instrumentRRSelect.value;
    
    const assetType = getAssetType(selectedSymbol);
    if (assetType === 'unknown') {
        showMessage("Position sizing is not supported for this asset type.", 'error');
        hideLoading(loadingSpinnerRR);
        return;
    }

    if (riskPercent > 100) {
        showMessage("Risk percent cannot exceed 100.", 'error');
        hideLoading(loadingSpinnerRR);
        return;
    }
    
    if (entryPrice === stopLossPrice) {
        showMessage("Entry and Stop Loss cannot be the same.", 'error');
        hideLoading(loadingSpinnerRR);
        return;
    }
    
    const riskAmount = capital * (riskPercent / 100);

    const { pipSize, isPipCalculable } = getPipPointDetails(selectedSymbol);
    if (!isPipCalculable) {
        showMessage("Position sizing is not supported for this asset type.", 'error');
        hideLoading(loadingSpinnerRR);
        return;
    }

    const priceDifference = Math.abs(entryPrice - stopLossPrice);
    const stopLossPips = priceDifference / pipSize;

    let recommendedUnits = 0;
    if (priceDifference > 0) {
        const { quote: quoteCurrencyOfPair } = parseSymbol(selectedSymbol);
        
        let pipValueInQuote = pipSize * 1;
        let pipValueInAccount = pipValueInQuote;

        if (quoteCurrencyOfPair !== 'USD') {
             const conversionRates = await fetchConversionRates(quoteCurrencyOfPair);
             if (conversionRates && conversionRates['USD']) {
                 pipValueInAccount = pipValueInQuote * conversionRates['USD'];
             } else {
                 showMessage(`Could not fetch conversion rate from ${quoteCurrencyOfPair} to USD.`, 'error');
                 hideLoading(loadingSpinnerRR);
                 return;
             }
        }
        
        if (pipValueInAccount > 0) {
            recommendedUnits = (riskAmount / pipValueInAccount) / stopLossPips;
        }
    }

    let rrRatio = 'N/A';
    const riskDistance = Math.abs(entryPrice - stopLossPrice);
    const rewardDistance = Math.abs(entryPrice - takeProfitPrice);
    if (riskDistance !== 0) {
        rrRatio = (rewardDistance / riskDistance).toFixed(2);
    }
    
    riskAmountDisplay.textContent = `$${riskAmount.toFixed(2)}`;
    stopLossPipsDisplay.textContent = `${stopLossPips.toFixed(1)} ${assetType === 'forex' ? 'pips' : 'points'}`;
    recommendedUnitsDisplay.textContent = recommendedUnits.toFixed(0);
    rrRatioDisplay.textContent = `1:${rrRatio}`;

    document.getElementById('cardRRRisk').classList.add('success-border');
    document.getElementById('cardRRStopLoss').classList.add('success-border');
    document.getElementById('cardRRUnits').classList.add('success-border');
    document.getElementById('cardRRRatio').classList.add('success-border');

    hideLoading(loadingSpinnerRR);
}

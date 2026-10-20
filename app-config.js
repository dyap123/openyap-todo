// Public OAuth client ID from Google Cloud Console. Never put a client secret here.
// Firebase sign-in works independently; Calendar shows a setup message until configured.
window.OY_CONFIG = { googleClientId: '', financeApiBase: 'https://api.openyap.org/todo-finance' };

// financeApiBase is the public HTTPS URL of the private Schwab adapter; see docs/schwab-setup.md.
// API keys, client secrets and account tokens belong only in the backend environment.

import { createBrowser as createXActionsBrowser } from 'xactions';

const HEADLESS_X_BROWSER_ARGS = Object.freeze([
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-blink-features=AutomationControlled',
  '--disable-web-security',
]);

export async function createBrowser(options = {}) {
  if (options.headless === false) return createXActionsBrowser(options);

  return createXActionsBrowser({
    ...options,
    args: [...HEADLESS_X_BROWSER_ARGS, ...(options.args || [])],
  });
}

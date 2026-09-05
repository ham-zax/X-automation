import { launch as launchClearcote } from 'clearcote';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const CLEARCOTE_CHROME_EXECUTABLE = '/usr/bin/google-chrome';
const CLEARCOTE_FINGERPRINT = 'x-test-growth-os';
const WAIT_UNTIL = Object.freeze({
  networkidle0: 'domcontentloaded',
  networkidle2: 'domcontentloaded',
});

function bindMethod(target, property) {
  const value = Reflect.get(target, property, target);
  return typeof value === 'function' ? value.bind(target) : value;
}

function normalizeNavigationOptions(options = {}) {
  if (!options.waitUntil || !WAIT_UNTIL[options.waitUntil]) return options;
  return { ...options, waitUntil: WAIT_UNTIL[options.waitUntil] };
}

function normalizeCookie(cookie) {
  return Object.fromEntries(Object.entries({
    name: cookie.name,
    value: cookie.value,
    url: cookie.url,
    domain: cookie.domain,
    path: cookie.path,
    expires: cookie.expires,
    httpOnly: cookie.httpOnly,
    secure: cookie.secure,
    sameSite: cookie.sameSite,
  }).filter(([, value]) => value !== undefined));
}

function wrapElementHandle(handle) {
  return new Proxy(handle, {
    get(target, property) {
      if (property === 'uploadFile') {
        return (...paths) => target.setInputFiles(paths.length === 1 ? paths[0] : paths);
      }
      return bindMethod(target, property);
    },
  });
}

function wrapPage(page) {
  return new Proxy(page, {
    get(target, property) {
      if (property === 'goto') {
        return (url, options) => target.goto(url, normalizeNavigationOptions(options));
      }
      if (property === 'setCookie') {
        return (...cookies) => target.context().addCookies(cookies.map(normalizeCookie));
      }
      if (property === 'setViewport') {
        return ({ width, height }) => target.setViewportSize({ width, height });
      }
      if (property === '$') {
        return async (selector) => {
          const handle = await target.$(selector);
          return handle ? wrapElementHandle(handle) : null;
        };
      }
      return bindMethod(target, property);
    },
  });
}

export async function createBrowser(options = {}) {
  // /tmp may be a small, shared tmpfs. Keep this reader's profile and Chrome
  // temporary files on disk without changing process-wide environment state.
  const root = join(homedir(), '.cache', 'x-growth', 'browser');
  await mkdir(root, { recursive: true, mode: 0o700 });
  const runDirectory = await mkdtemp(join(root, 'run-'));
  let browser;
  try {
    browser = await launchClearcote({
      ...options,
      executablePath: CLEARCOTE_CHROME_EXECUTABLE,
      headless: options.headless !== false,
      humanize: true,
      fingerprint: CLEARCOTE_FINGERPRINT,
      platform: 'linux',
      brand: 'Chrome',
      userDataDir: options.userDataDir ?? join(runDirectory, 'profile'),
      env: { ...process.env, ...options.env, TMPDIR: runDirectory },
    });
  } catch (error) {
    await rm(runDirectory, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
  const close = browser.close.bind(browser);
  browser.close = async (...args) => {
    // Do not remove a live profile when close fails; preserve the original error.
    await close(...args);
    await rm(runDirectory, { recursive: true, force: true });
  };
  return browser;
}

export async function createPage(browser) {
  const context = typeof browser.newPage === 'function' ? browser : await browser.newContext();
  return wrapPage(await context.newPage());
}

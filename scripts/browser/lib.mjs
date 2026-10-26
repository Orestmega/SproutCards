// Shared helpers for the real-browser checks in this folder: a static file server for `dist/` and a
// tiny Chrome DevTools Protocol client. No dependencies. These scripts only start a headless Chrome
// with a throw-away profile and a server on 127.0.0.1; they touch nothing else.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join, normalize, resolve } from 'node:path';

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain',
  '.tsv': 'text/tab-separated-values',
};

/** Where Chrome is installed: the CHROME_PATH variable, or a usual location. */
export function chromePath() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ];
  const found = candidates.find((path) => path && existsSync(path));
  if (!found) throw new Error('Chrome not found. Set the CHROME_PATH environment variable.');
  return found;
}

/** Serves a folder on 127.0.0.1 (localhost counts as a secure context, so service workers work). */
export async function serveDir(folder, port, extraHeaders = {}) {
  const dir = resolve(folder);
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = join(dir, normalize(path));
    if (!file.startsWith(dir)) file = join(dir, 'index.html');
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    res.writeHead(200, {
      'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
      'cache-control': 'no-cache',
      ...extraHeaders,
    });
    res.end(readFileSync(file));
  });
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  return {
    origin: `http://localhost:${port}/`,
    /** Stops answering at once (what "the network is gone" looks like to the page). */
    stop() {
      server.close();
      server.closeAllConnections();
    },
  };
}

/** Starts a headless Chrome (phone-sized window) and connects to it. */
export async function launchChrome({ width = 390, height = 844 } = {}) {
  const port = 9333 + Math.floor(Math.random() * 500);
  const profile = mkdtempSync(join(tmpdir(), 'sproutcards-chrome-'));
  const chrome = spawn(
    chromePath(),
    [
      '--headless=new',
      '--disable-gpu',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      '--no-first-run',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );

  let socketUrl = null;
  for (let i = 0; i < 50 && !socketUrl; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      socketUrl = list.find((target) => target.type === 'page')?.webSocketDebuggerUrl ?? null;
    } catch {
      // Chrome is still starting
    }
    if (!socketUrl) await sleep(200);
  }
  if (!socketUrl) {
    chrome.kill();
    throw new Error('Chrome did not start');
  }

  const ws = new WebSocket(socketUrl);
  await new Promise((resolve) => (ws.onopen = resolve));
  let nextId = 0;
  const pending = new Map();
  /** Console errors/warnings, uncaught exceptions and browser log entries (such as CSP violations). */
  const problems = [];
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    } else if (message.method === 'Runtime.consoleAPICalled') {
      const { type, args } = message.params;
      if (type === 'error' || type === 'warning') {
        problems.push(`console.${type}: ${args.map((a) => a.value ?? a.description).join(' ')}`);
      }
    } else if (message.method === 'Runtime.exceptionThrown') {
      const details = message.params.exceptionDetails;
      problems.push(`exception: ${details.exception?.description ?? details.text}`);
    } else if (message.method === 'Log.entryAdded') {
      const { level, text } = message.params.entry;
      if (level === 'error' || level === 'warning') problems.push(`log.${level}: ${text}`);
    }
  };
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const id = ++nextId;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 2,
    mobile: true,
  });

  return {
    send,
    problems,
    /** Runs JavaScript in the page and returns its (JSON) result; promises are awaited. */
    async evalJs(expression) {
      const reply = await send('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
      });
      if (reply.result?.exceptionDetails) {
        return { error: reply.result.exceptionDetails.exception?.description };
      }
      return reply.result?.result?.value;
    },
    async goto(url, settleMs = 2000) {
      await send('Page.navigate', { url });
      await sleep(settleMs);
    },
    async reload(settleMs = 2000) {
      await send('Page.reload');
      await sleep(settleMs);
    },
    async screenshot() {
      const reply = await send('Page.captureScreenshot', { format: 'png' });
      return Buffer.from(reply.result.data, 'base64');
    },
    close() {
      ws.close();
      chrome.kill();
      setTimeout(() => rmSync(profile, { recursive: true, force: true }), 1500).unref();
    },
  };
}

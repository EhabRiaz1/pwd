/**
 * Vercel serverless: updates auth-flag.js in a GitHub repo.
 *
 * Env (Vercel project):
 *   GITHUB_TOKEN      — fine-grained or classic PAT with repo Contents read/write
 *   GITHUB_OWNER      — default EhabRiaz1
 *   GITHUB_REPO       — e.g. pwd
 *   AUTH_FLAG_PATH    — e.g. auth-flag.js  (CottonApp copy: key-booth/auth-flag.js)
 *   COTTON_TOGGLE_SECRET — must match the secret sent from the booth page
 *
 * POST JSON: { "on": true }  +  Header: Authorization: Bearer <COTTON_TOGGLE_SECRET>
 * (or same secret in body: { "on", "secret" } for local testing)
 */

const FILE_TEMPLATE = (on) => `/**
 * Remote switch for the Cotton AI marketing home page (index) password gate.
 * - true  = require 12h key before showing the home page
 * - false = home page is public
 *
 * Deploy this with your key booth (e.g. GitHub Pages / Vercel). The main site
 * loads this file from the booth URL — edit, commit, and deploy this repo; no
 * main-site deploy needed to change the switch (after cache updates — see index.html).
 */
window.__COTTON_SITE_AUTH = ${on ? 'true' : 'false'};
`;

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function parseBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body;
  }
  return {};
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      deploy:
        'POST { on: boolean } with Authorization: Bearer (COTTON_TOGGLE_SECRET). Requires GITHUB_TOKEN in Vercel env.',
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const expected = process.env.COTTON_TOGGLE_SECRET;
  if (!expected) {
    return res.status(503).json({ error: 'COTTON_TOGGLE_SECRET not set on server' });
  }

  const auth = req.headers.authorization || '';
  const bearer = auth.replace(/^Bearer\s+/i, '').trim();
  let body = parseBody(req);
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  const token = bearer || (body && body.secret);
  if (token !== expected) {
    return res.status(401).json({ error: 'Invalid secret' });
  }

  if (body == null || typeof body.on !== 'boolean') {
    return res.status(400).json({ error: 'Body must be JSON: { "on": true } or { "on": false }' });
  }

  const gh = process.env.GITHUB_TOKEN;
  if (!gh) {
    return res.status(500).json({ error: 'GITHUB_TOKEN not set on server' });
  }

  const owner = process.env.GITHUB_OWNER || 'EhabRiaz1';
  const repository = process.env.GITHUB_REPO || 'pwd';
  const path = process.env.AUTH_FLAG_PATH || 'auth-flag.js';
  const on = body.on;

  const base = 'https://api.github.com';
  const pathEnc = path.split('/').map(encodeURIComponent).join('/');

  const getUrl = `${base}/repos/${owner}/${repository}/contents/${pathEnc}`;
  const getR = await fetch(getUrl + '?ref=main', {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${gh}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!getR.ok) {
    const t = await getR.text();
    return res.status(500).json({ error: 'GitHub get failed', status: getR.status, detail: t.slice(0, 500) });
  }

  const fileMeta = await getR.json();
  const sha = fileMeta.sha;
  const content = Buffer.from(FILE_TEMPLATE(on), 'utf8').toString('base64');

  const putR = await fetch(getUrl, {
    method: 'PUT',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${gh}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: `chore: set marketing home lock ${on ? 'ON' : 'OFF'}`,
      content,
      sha,
      branch: 'main',
    }),
  });

  if (!putR.ok) {
    const t = await putR.text();
    return res.status(500).json({ error: 'GitHub update failed', status: putR.status, detail: t.slice(0, 500) });
  }

  return res.status(200).json({ ok: true, on });
}

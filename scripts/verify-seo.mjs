import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { request as httpRequest } from 'node:http';
import { fileURLToPath } from 'node:url';

// Run after npm run build. Uses its own loopback listeners and an in-memory
// Prisma replacement that rejects all writes; no application service is touched.
const root = fileURLToPath(new URL('../', import.meta.url));
const fixture = fileURLToPath(new URL('./fixtures/seo-prisma.mjs', import.meta.url));
const publicOrigin = 'https://universident.ro';
let checked = 0;
async function freePort() {
  const socket = createServer();
  socket.listen(0, '127.0.0.1');
  await once(socket, 'listening');
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  return port;
}
function attribute(html, tag, attributeName, marker) {
  const node = [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>`, 'g'))].map((match) => match[0]).find((value) => value.includes(marker));
  return node?.match(new RegExp(`${attributeName}="([^"]*)"`))?.[1].replaceAll('&amp;', '&');
}
function structuredData(html) {
  return [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
    .map((match) => JSON.parse(match[1]));
}
async function withServer(environment, verify) {
  const port = await freePort();
  const server = spawn(process.execPath, ['--import', fixture, '.next/standalone/server.js'], {
    cwd: root,
    env: {
      ...process.env, NODE_ENV: 'production', DEPLOYMENT_ENV: environment,
      VERCEL_ENV: environment === 'production' ? 'production' : 'preview',
      DATABASE_URL: 'postgresql://seo_check:unused@127.0.0.1:1/seo_check',
      BETTER_AUTH_URL: publicOrigin, BETTER_AUTH_SECRET: randomBytes(32).toString('hex'),
      RESEND_API_KEY: '', OPENAI_API_KEY: '', CHAT_WORKER_SECRET: '',
      NEXT_TELEMETRY_DISABLED: '1', HOSTNAME: '127.0.0.1', PORT: String(port),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  for (const stream of [server.stdout, server.stderr]) stream.on('data', (data) => { logs += data; });
  async function get(path, host = 'universident.ro') {
    return new Promise((resolve, reject) => {
      const request = httpRequest(`http://127.0.0.1:${port}${path}`, {
        headers: { host, 'user-agent': 'Googlebot' },
      }, (response) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          checked += 1;
          resolve({
            response: { status: response.statusCode, headers: new Headers(Object.entries(response.headers).map(([key, value]) => [key, String(value)])) },
            body: Buffer.concat(chunks).toString(),
          });
        });
      });
      request.on('error', reject);
      request.setTimeout(15000, () => request.destroy(new Error('SEO request timed out')));
      request.end();
    });
  }
  try {
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      if (server.exitCode !== null) throw new Error(`Local server exited: ${logs}`);
      try { await get('/robots.txt'); ready = true; break; } catch { await new Promise((resolve) => setTimeout(resolve, 100)); }
    }
    assert.ok(ready, logs);
    await verify(get);
    assert.doesNotMatch(logs, /SEO fixture refuses|PrismaClient.*Error|ECONNREFUSED/);
  } catch (error) {
    console.error(logs);
    throw error;
  } finally {
    if (server.exitCode === null) {
      const exited = once(server, 'exit');
      server.kill('SIGTERM');
      await exited;
    }
  }
}
function metadata(body, canonical, index = true) {
  const actual = attribute(body, 'link', 'href', 'rel="canonical"');
  // Next normalizes the root URL by omitting its optional final slash.
  assert.equal(actual ? new URL(actual).href : actual, canonical ? new URL(canonical).href : canonical);
  assert.equal(attribute(body, 'meta', 'content', 'name="robots"'), index ? 'index, follow' : 'noindex, follow');
  assert.ok(attribute(body, 'meta', 'content', 'name="description"'));
}

await withServer('production', async (get) => {
  const robots = await get('/robots.txt');
  assert.equal(robots.response.status, 200);
  assert.match(robots.body, /Sitemap: https:\/\/universident\.ro\/sitemap\.xml/);
  assert.doesNotMatch(robots.body, /Disallow: \/(?:cont|studenti|pacienti|autentificare)/);
  assert.equal(robots.response.headers.get('x-robots-tag'), null);
  const sitemap = await get('/sitemap.xml');
  assert.equal(sitemap.response.status, 200);
  assert.match(sitemap.response.headers.get('content-type'), /xml/);
  assert.match(sitemap.body, /<loc>https:\/\/universident\.ro\/studenti\?tratament=igienizare&amp;oras=cluj-napoca<\/loc>/);
  assert.equal([...sitemap.body.matchAll(/<loc>/g)].length, 17); // home + directory + one combination + 14 real published profiles
  assert.doesNotMatch(sitemap.body, /demo|nepublicat|neverificat|localhost|echipa|pacienti|cont\/|consultatie|oras=iasi/);
  for (const [path, canonical] of [
    ['/', `${publicOrigin}/`], ['/studenti', `${publicOrigin}/studenti`],
    ['/studenti?oras=cluj-napoca&tratament=igienizare&utm_source=test', `${publicOrigin}/studenti?tratament=igienizare&oras=cluj-napoca`],
    ['/studenti?tratament=igienizare&oras=cluj-napoca&pagina=2', `${publicOrigin}/studenti?tratament=igienizare&oras=cluj-napoca&pagina=2`],
    ['/studenti/student-verificare-0?tratament=igienizare&oras=cluj-napoca&sursa=acasa', `${publicOrigin}/studenti/student-verificare-0`],
  ]) {
    const result = await get(path);
    assert.equal(result.response.status, 200, path);
    metadata(result.body, canonical);
    assert.equal(result.response.headers.get('x-robots-tag'), null);
    const data = structuredData(result.body);
    assert.equal(data.length, 1, path);
    assert.equal(data[0]['@context'], 'https://schema.org');
    assert.doesNotMatch(JSON.stringify(data), /"(?:email|dateOfBirth|patientNote|reviews|aggregateRating)"\s*:/);
    if (path === '/') {
      assert.equal(data[0]['@graph'][0]['@type'], 'WebSite');
      assert.ok(result.body.includes(data[0]['@graph'][0].description));
      assert.match(result.body, /<dt[^>]*>Ce este Universident\?<\/dt>/);
      assert.match(result.body, /<dt[^>]*>Cererea de programare este confirmată automat\?<\/dt>/);
    } else if (path.startsWith('/studenti/student-verificare-0')) {
      assert.equal(data[0]['@type'], 'ProfilePage');
      assert.equal(data[0].mainEntity['@type'], 'Person');
      assert.equal(data[0].mainEntity.name, 'Student Verificare 0');
      assert.ok(result.body.includes(data[0].mainEntity.description));
    } else {
      assert.equal(data[0]['@type'], 'CollectionPage');
      assert.equal(data[0].url, canonical);
    }
    if (path === '/studenti') assert.match(result.body, /href="\/studenti\?tratament=igienizare&amp;oras=cluj-napoca"/);
    if (path.includes('pagina=2')) {
      assert.match(result.body, /<title>Igienizare dentară în Cluj-Napoca — pagina 2 \| Universident<\/title>/);
      assert.match(result.body, /href="\/studenti\/student-verificare-/);
      const items = data[0].mainEntity.itemListElement;
      assert.equal(items.length, 2);
      assert.deepEqual(items.map((item) => item.position), [13, 14]);
      for (const item of items) assert.ok(result.body.includes(`href="${new URL(item.url).pathname}"`));
    }
  }
  for (const path of ['/studenti?tratament=igienizare', '/studenti?tratament=invalid&oras=cluj-napoca',
    '/studenti?tratament=igienizare&tratament=consultatie&oras=cluj-napoca', '/studenti?pagina=abc']) {
    const result = await get(path);
    assert.equal(result.response.status, 200, path);
    metadata(result.body, undefined, false);
    assert.deepEqual(structuredData(result.body), []);
  }
  const empty = await get('/studenti?tratament=consultatie&oras=iasi');
  metadata(empty.body, `${publicOrigin}/studenti?tratament=consultatie&oras=iasi`, false);
  assert.deepEqual(structuredData(empty.body), []);
  const overflow = await get('/studenti?tratament=igienizare&oras=cluj-napoca&pagina=999');
  assert.equal(overflow.response.status, 307);
  assert.match(overflow.response.headers.get('location'), /pagina=2$/);
  for (const slug of ['nepublicat', 'neverificat', 'absent']) {
    const result = await get(`/studenti/${slug}`);
    assert.equal(result.response.status, 404, slug);
    assert.match(result.body, /name="robots" content="noindex/);
    assert.equal(attribute(result.body, 'link', 'href', 'rel="canonical"'), undefined);
    assert.deepEqual(structuredData(result.body), []);
  }
  for (const slug of ['student-demo-001', 'demo-id-cu-slug-obisnuit', 'demo-email-cu-slug-obisnuit', 'demo-resurse-cu-slug-obisnuit']) {
    const result = await get(`/studenti/${slug}`);
    assert.match(result.body, /name="robots" content="noindex, nofollow"/);
    assert.equal(attribute(result.body, 'link', 'href', 'rel="canonical"'), undefined);
    assert.deepEqual(structuredData(result.body), []);
  }
  for (const path of ['/autentificare?next=%2Fcont', '/inregistrare?tip=student', '/parola-uitata', '/resetare-parola?token=fictiv']) {
    const result = await get(path);
    assert.equal(result.response.headers.get('x-robots-tag'), 'noindex, nofollow');
    assert.match(result.body, /name="robots" content="noindex, nofollow"/);
    assert.deepEqual(structuredData(result.body), []);
  }
  for (const path of ['/cont', '/cont/calendar', '/cont/mesaje', '/cont/mesaje/abcdef123456', '/pacienti/pacient-fictiv']) {
    const result = await get(path);
    assert.equal(result.response.status, 307, path);
    assert.equal(result.response.headers.get('x-robots-tag'), 'noindex, nofollow', path);
    assert.match(result.response.headers.get('location'), /autentificare/, path);
  }
  const team = await get('/echipa');
  assert.match(team.body, /<title>Echipa \| Universident<\/title>/);
  assert.equal(attribute(team.body, 'meta', 'content', 'name="robots"'), 'noindex, follow');
  assert.equal(attribute(team.body, 'link', 'href', 'rel="canonical"'), undefined);
  assert.deepEqual(structuredData(team.body), []);
  const wrongHost = await get('/studenti', 'staging.universident.ro');
  assert.equal(wrongHost.response.headers.get('x-robots-tag'), 'noindex, nofollow');
});
await withServer('staging', async (get) => {
  const robots = await get('/robots.txt');
  assert.match(robots.body, /Disallow: \/\s*$/);
  assert.doesNotMatch(robots.body, /Sitemap:/);
  const sitemap = await get('/sitemap.xml');
  assert.equal(sitemap.response.status, 200);
  assert.doesNotMatch(sitemap.body, /<loc>/);
  for (const path of ['/', '/studenti', '/studenti/student-verificare-0']) {
    const result = await get(path);
    assert.equal(result.response.status, 200);
    assert.equal(result.response.headers.get('x-robots-tag'), 'noindex, nofollow');
    assert.equal(attribute(result.body, 'meta', 'content', 'name="robots"'), 'noindex, follow');
    assert.deepEqual(structuredData(result.body), []);
  }
});
console.log(`SEO/AEO HTTP verification passed (${checked} requests; in-memory fixtures, no database access).`);

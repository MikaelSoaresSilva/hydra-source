// Teste de ponta a ponta no Chromium (viewport de celular), com o app compilado (dist/).
// Uso: npx vite build && node tests/e2e.mjs
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { tsImport } from 'tsx/esm/api';

const { ALL_LESSONS } = await tsImport('../src/data/index.ts', import.meta.url);
const ROOT = new URL('../dist/', import.meta.url).pathname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = p === '/' ? 'index.html' : p;
  try { const b = await readFile(join(ROOT, f)); res.writeHead(200, { 'content-type': TYPES[extname(f)] ?? 'application/octet-stream' }); res.end(b); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
const BASE = `http://127.0.0.1:${server.address().port}/`;
const SHOTS = process.env.SHOTS ?? '/tmp/claude-0/-home-user-hydra-source/5da1ff11-5854-531e-af39-612a1a158f6a/scratchpad/shots';
await import('node:fs').then((fs) => fs.mkdirSync(SHOTS, { recursive: true }));

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'pt-BR' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('response', (r) => { if (r.status() >= 400 && !/foto\.png|favicon/.test(r.url())) errors.push('HTTP ' + r.status() + ' ' + r.url()); });
page.on('console', (m) => { if (m.type() === 'error' && !/youtube|favicon|net::ERR|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });

let passed = 0, failed = 0;
async function step(name, fn) {
  try { await fn(); passed++; console.log('✔', name); }
  catch (e) { failed++; console.log('✘', name, '—', e.message.split('\n')[0]); await page.screenshot({ path: `${SHOTS}/FAIL-${name.replace(/\W+/g, '_')}.png` }).catch(() => {}); }
}
const shot = (n) => page.screenshot({ path: `${SHOTS}/${n}.png`, fullPage: false });
const go = async (h) => { await page.evaluate((x) => { location.hash = x; }, h); await page.waitForTimeout(150); };
const expectText = async (t, timeout = 5000) => page.getByText(t, { exact: false }).first().waitFor({ timeout });

await page.goto(BASE);

await step('onboarding completo', async () => {
  await expectText('Formação Dev');
  await shot('01-onboarding');
  await page.getByRole('button', { name: 'Começar' }).click();
  await page.getByPlaceholder('Seu nome (opcional)').fill('Mika');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expectText('13h30');
  await page.getByRole('button', { name: 'Agora não' }).click();
  await page.getByRole('button', { name: 'Ir para o app' }).click();
  await expectText('Mika');
});

await step('tela Hoje mostra progresso e próxima sessão', async () => {
  await expectText('formação');
  await expectText('Sessão');
  await shot('02-hoje');
});

await step('trilha com 24 sessões e 3 meses', async () => {
  await go('/trilha');
  await expectText('Mês 1: Fundamentos e exploração');
  await expectText('Mês 3');
  const n = await page.locator('.session-card').count();
  if (n !== 24) throw new Error('sessões: ' + n);
  await shot('03-trilha');
});

await step('sessão 1: roteiro de 3h com horários', async () => {
  await go('/sessao/s1');
  await expectText('13:30 · Revisão');
  await expectText('16:20 · Fechamento');
  await page.locator('.tl-check').first().click();
  await shot('04-sessao');
});

await step('aula: passos, código executável e exercício', async () => {
  await go('/aula/l-vars');
  await expectText('Objetivo');
  await page.getByRole('button', { name: 'Próximo →' }).click();
  await page.getByRole('button', { name: '▶ Executar' }).first().click();
  await expectText('Ana 26 true');
  await shot('05-aula-codigo');
});

await step('exercício JS: resposta errada mostra dica e tipo de erro; certa é aceita', async () => {
  await go('/exercicio/e-logic-2');
  const ta = page.locator('textarea.code-input').first();
  await ta.fill('function maior(lista) { return 0; }');
  await page.getByRole('button', { name: '▶ Testar' }).click();
  await expectText('Alguns testes não passaram');
  await page.getByRole('button', { name: /Dica/ }).click();
  await expectText('Dica 1');
  await ta.fill('function maior(lista) {\n  if (lista.length === 0) return null;\n  let m = lista[0];\n  for (const n of lista) if (n > m) m = n;\n  return m;\n}');
  await page.getByRole('button', { name: '▶ Testar' }).click();
  await expectText('Correto!');
  await shot('06-exercicio-js');
});

await step('laço infinito não trava o app (tempo esgotado)', async () => {
  await go('/lab/js');
  await page.locator('textarea.code-input').fill('while (true) {}');
  await page.getByRole('button', { name: '▶ Executar' }).click();
  await expectText('Tempo esgotado', 8000);
});

await step('laboratório Python roda offline', async () => {
  await go('/lab/py');
  await page.getByRole('button', { name: '▶ Executar Python' }).click();
  await expectText('Olá, Carla!', 15000);
  await shot('07-python');
});

await step('exercício Python corrigido', async () => {
  await go('/exercicio/e-py2-2');
  await page.locator('textarea.code-input').fill('def pares(numeros):\n    return [n for n in numeros if n % 2 == 0]\n');
  await page.getByRole('button', { name: '▶ Testar' }).click();
  await expectText('Correto!', 15000);
});

await step('laboratório SQL (banco Loja) e exercício SQL', async () => {
  await go('/lab/sql');
  await page.getByRole('button', { name: '▶ Executar SQL' }).click();
  await expectText('Recife', 10000);
  await go('/exercicio/e-sql-6');
  await page.locator('textarea.code-input').fill('SELECT clientes.nome FROM clientes LEFT JOIN pedidos ON pedidos.cliente_id = clientes.id WHERE pedidos.id IS NULL;');
  await page.getByRole('button', { name: '▶ Testar' }).click();
  await expectText('Correto!', 10000);
  await shot('08-sql');
});

// Todas as soluções dos exercícios de HTML/CSS/DOM passam nas verificações no navegador real
const htmlEx = ALL_LESSONS.flatMap((l) => l.exercises).filter((e) => e.type === 'html');
for (const e of htmlEx) {
  await step('solução HTML confere: ' + e.id, async () => {
    await go('/exercicio/' + e.id);
    await page.locator('textarea.code-input').fill(e.solution);
    await page.getByRole('button', { name: '▶ Testar' }).click();
    await expectText('Correto!', 8000);
  });
}
await step('HTML errado é reprovado com detalhe', async () => {
  await go('/exercicio/e-layout-1');
  await page.locator('textarea.code-input').fill('<div class="linha"><div>A</div></div>');
  await page.getByRole('button', { name: '▶ Testar' }).click();
  await expectText('verificações falharam');
  await shot('09-html');
});

await step('revisão espaçada lista exercício errado', async () => {
  await go('/exercicio/e-vars-2');
  const opts = page.locator('.option');
  const n = await opts.count();
  for (let i = 0; i < n; i++) { const t = await opts.nth(i).innerText(); if (t.trim() !== 'string') { await opts.nth(i).click(); break; } }
  await page.getByRole('button', { name: 'Verificar' }).click();
  await expectText('Tipo de erro');
  await go('/praticar');
  await expectText('Revisão de hoje');
  const txt = await page.locator('.hero h2').innerText();
  if (!/[1-9]/.test(txt)) throw new Error(txt);
  await shot('10-pratica');
});

await step('avaliação do mês 1 (15 perguntas)', async () => {
  await go('/avaliacao/1');
  await expectText('15 perguntas');
  await page.getByRole('button', { name: 'Começar' }).click();
  await expectText('Pergunta 1 de 15');
});

await step('progresso e mapa das áreas', async () => {
  await go('/progresso');
  await expectText('Mapa das áreas');
  const tiles = await page.locator('.area-tile').count();
  if (tiles !== 11) throw new Error('áreas: ' + tiles);
  await shot('11-progresso');
  await page.locator('.area-tile').filter({ hasText: 'Backend' }).click();
  await expectText('Quanto você gostou');
  await page.getByRole('button', { name: '4 estrelas' }).click();
});

await step('recursos com filtros', async () => {
  await go('/recursos');
  await expectText('Curso de Algoritmos');
  await page.getByLabel('Só em português').check();
  await shot('12-recursos');
});

await step('projetos e projeto final', async () => {
  await go('/projeto/p-final');
  await expectText('TaskFlow');
  await page.locator('.check-row input').first().check();
});

await step('carreira: avaliação honesta e checklist', async () => {
  await go('/carreira');
  await expectText('Avaliação honesta');
  await expectText('72 horas');
  await shot('13-carreira');
});

await step('ajustes: lembretes sáb/dom 13:30 e 15:15', async () => {
  await go('/ajustes');
  await expectText('Lembretes de estudo');
  const times = await page.locator('input[type=time]').evaluateAll((els) => els.map((e) => e.value));
  if (JSON.stringify(times) !== JSON.stringify(['13:30', '15:15', '13:30', '15:15'])) throw new Error(JSON.stringify(times));
  await expectText('Sábado'); await expectText('Domingo');
  await shot('14-ajustes');
});

await step('glossário com busca', async () => {
  await go('/glossario');
  await page.getByPlaceholder('Buscar termo…').fill('JWT');
  await expectText('crachá digital');
});

await step('progresso persiste após recarregar', async () => {
  await page.reload();
  await page.waitForTimeout(500);
  await go('/progresso');
  const t = await page.locator('.hero').innerText();
  if (!/Exercícios: \d+ certos/.test(t)) throw new Error(t);
  if (/Exercícios: 0 certos/.test(t)) throw new Error('não persistiu: ' + t);
});

await step('tema claro', async () => {
  await go('/ajustes');
  await page.getByRole('button', { name: 'Claro' }).click();
  await go('/hoje');
  await shot('15-hoje-claro');
});

await step('sem erros de JavaScript na página', async () => { if (errors.length) throw new Error(errors.slice(0, 5).join(' | ')); });

console.log(`\n${passed} passaram, ${failed} falharam. Capturas em ${SHOTS}`);
await browser.close(); server.close();
process.exit(failed ? 1 : 0);

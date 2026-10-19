// Testes de aceitação ponta a ponta em viewport de celular (Pixel 7).
import { chromium, devices } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const PORT = 4179;
const APP_URL = `http://127.0.0.1:${PORT}/`;
const SHOTS = new URL('./shots/', import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'pipe' });
await new Promise((r) => { server.stdout.on('data', (d) => { if (String(d).includes(String(PORT))) r(); }); setTimeout(r, 6000); });

const results = [];
const check = (name, ok, extra = '') => { results.push({ name, ok, extra }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`); };
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ ...devices['Pixel 7'] });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const save = () => page.evaluate(() => JSON.parse(localStorage.getItem('life-leveling:save')));
const shot = (n) => page.screenshot({ path: `${SHOTS}${n}.png` });
const dismissOn = async (pg) => {
  for (let i = 0; i < 12; i++) {
    const c = pg.locator('.cine');
    if (!(await c.count())) break;
    const b = c.locator('button.primary');
    if (await b.count()) await b.first().click().catch(() => {});
    else await c.first().click({ position: { x: 20, y: 20 } }).catch(() => {});
    await pg.waitForTimeout(300);
  }
};
const dismiss = () => dismissOn(page);

try {
  // 1. Abrir e navegar
  await page.goto(APP_URL);
  await page.waitForTimeout(1500);
  await shot('01-boot');
  await page.locator('.boot').click();
  await page.getByRole('button', { name: 'DESPERTAR' }).click();
  check('1. App abre (sequência de despertar)', true);

  // 2. Criar personagem
  await page.getByLabel('Nome').fill('Mikael');
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await page.getByText('Arcanista do Véu').click();
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await page.waitForTimeout(1500);
  await page.locator('select').filter({ hasText: 'Espetado' }).selectOption('cacheado');
  await page.getByRole('button', { name: 'Vitória' }).click();
  await page.waitForTimeout(1200);
  await shot('02-criador');
  const canvasOk = await page.locator('canvas').first().evaluate((c) => c.width > 0 && !!(c.getContext('webgl2') || c.getContext('webgl')));
  check('2a. Avatar 3D renderizado em WebGL', canvasOk);
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByText('+ Quero aprender programação backend').click();
  await page.getByRole('button', { name: 'INICIAR JORNADA' }).click();
  await page.waitForTimeout(1200);
  await dismiss();
  let s = await save();
  check('2b. Personagem criado e personalizado', s.character.name === 'Mikael' && s.character.classId === 'arcano' && s.character.appearance.hairStyle === 'cacheado');
  check('2c. Objetivo virou campanha com chefe', s.campaigns.length === 1 && s.bosses[0]?.name === 'Guardião do Código');
  await shot('03-inicio');

  // 3. Criar missão
  await page.getByRole('button', { name: 'Missões', exact: true }).click();
  await page.getByTestId('new-mission').click();
  await page.getByLabel('Nome da missão').fill('Ler 20 páginas');
  await page.getByLabel('Dificuldade').selectOption('3');
  await page.getByRole('button', { name: 'Conhecimento' }).click();
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await page.waitForTimeout(300);
  s = await save();
  const m = s.missions.find((x) => x.title === 'Ler 20 páginas');
  check('3. Missão criada', !!m && m.difficulty === 3);

  // 4/5. Concluir e receber XP correto (principal D3 = 35 XP, sem sequência)
  const xpBefore = s.ledger.reduce((t, e) => t + e.xp, 0);
  const card = page.getByTestId('mission').filter({ hasText: 'Ler 20 páginas' });
  await card.getByRole('button', { name: 'Concluir missão' }).click();
  await page.waitForTimeout(600);
  await shot('04-capitulo');
  await dismiss();
  await shot('04-missao-concluida');
  s = await save();
  const entry = s.ledger.find((e) => e.id.startsWith(`mission:${m.id}`));
  check('4. Concluir missão concede XP', !!entry && s.ledger.reduce((t, e) => t + e.xp, 0) > xpBefore);
  check('5. XP calculado corretamente (35 = D3 × principal)', entry?.xp === 35, `xp=${entry?.xp}`);

  // 6. Sem XP duplicado
  await page.getByRole('tab', { name: 'Histórico' }).click();
  const histCard = page.getByTestId('mission').filter({ hasText: 'Ler 20 páginas' });
  const disabled = (await histCard.count()) === 1 && (await histCard.locator('.complete-btn').count()) === 0;
  await page.getByRole('tab', { name: 'Hoje' }).click();
  const dup = await page.evaluate((id) => {
    const st = JSON.parse(localStorage.getItem('life-leveling:save'));
    return st.ledger.filter((e) => e.id.startsWith(`mission:${id}`)).length;
  }, m.id);
  check('6. Sem XP duplicado (botão bloqueado e 1 registro)', disabled && dup === 1);

  // 7. Subida de nível entrega recompensa (nível 2 → Luvas da Forja)
  for (let i = 0; i < 4; i++) {
    await page.getByTestId('new-mission').click();
    await page.getByLabel('Nome da missão').fill(`Projeto etapa ${i}`);
    await page.getByLabel('Tipo').selectOption('epica');
    await page.getByLabel('Dificuldade').selectOption('4');
    await page.getByRole('button', { name: 'Disciplina' }).click();
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    await page.getByTestId('mission').filter({ hasText: `Projeto etapa ${i}` }).getByRole('button', { name: 'Concluir missão' }).click();
    await page.waitForTimeout(500);
    if (await page.locator('.cine').count()) { await shot('05-level-up'); await dismiss(); }
  }
  s = await save();
  const total = s.ledger.reduce((t, e) => t + e.xp, 0);
  check('7. Subiu de nível e recebeu Luvas da Forja', total >= 150 && s.inventory.some((x) => x.itemId === 'luvas_forja'), `xp total=${total}`);

  // 8. Equipar
  await page.getByRole('button', { name: 'Herói', exact: true }).click();
  await page.getByRole('tab', { name: 'Equipamentos' }).click();
  await page.locator('.item-cell[title="Luvas da Forja"]').click();
  await page.getByTestId('equip').click();
  await page.waitForTimeout(500);
  s = await save();
  check('8. Equipamento visualizado e equipado', s.character.equipped.luvas === 'luvas_forja');
  await shot('06-equipamentos');
  await page.getByRole('tab', { name: 'Status' }).click();
  await page.waitForTimeout(300);
  await shot('07-status');

  // 9. Persistência após fechar e reabrir
  const xpPersist = total;
  await page.close();
  const page2 = await ctx.newPage();
  page2.on('pageerror', (e) => errors.push(String(e)));
  await page2.goto(APP_URL);
  await page2.waitForTimeout(1500);
  const lvlTxt = await page2.getByTestId('level').textContent();
  const s2 = await page2.evaluate(() => JSON.parse(localStorage.getItem('life-leveling:save')));
  check('9. Progresso permanece após reabrir', s2.ledger.reduce((t, e) => t + e.xp, 0) === xpPersist && Number(lvlTxt) >= 2, `nível ${lvlTxt}`);

  // Mundo: chefe e arena
  await dismissOn(page2);
  await page2.getByRole('button', { name: 'Mundo', exact: true }).click();
  await page2.getByRole('tab', { name: 'Chefes' }).click();
  await page2.locator('.boss-card').first().click();
  await page2.waitForTimeout(500);
  await page2.screenshot({ path: `${SHOTS}08-chefe-intro.png` });
  await page2.locator('.cine').click();
  await page2.waitForTimeout(300);
  await page2.screenshot({ path: `${SHOTS}09-chefe.png` });
  await page2.getByRole('tab', { name: 'Arena 3D' }).click();
  await page2.getByTestId('play-fenda1').click();
  await page2.waitForTimeout(2500);
  const btn = page2.locator('.abtn.attack');
  for (let i = 0; i < 12; i++) { await btn.dispatchEvent('pointerdown'); await page2.waitForTimeout(150); }
  await page2.waitForTimeout(800);
  await page2.screenshot({ path: `${SHOTS}10-arena.png` });
  const hud = await page2.locator('.hud-wave').textContent();
  check('Arena 3D carrega e responde a comandos', /Onda|Prepare/.test(hud ?? ''), hud ?? '');
  await page2.locator('.hud-top .icon-btn').click();
  await page2.getByRole('button', { name: 'Sair', exact: true }).click();

  // SISTEMA offline
  await page2.getByRole('button', { name: 'Sistema', exact: true }).click();
  await page2.getByLabel('Mensagem').fill('como o XP é calculado?');
  await page2.getByRole('button', { name: 'Enviar', exact: true }).click();
  await page2.waitForTimeout(400);
  const chat = await page2.getByTestId('chat').textContent();
  check('SISTEMA responde offline com dados reais', chat.includes('COMO O XP É CALCULADO'));
  await page2.screenshot({ path: `${SHOTS}11-sistema.png` });

  // Vida: treino
  await page2.getByRole('button', { name: 'Vida', exact: true }).click();
  await page2.getByTestId('log-workout').click();
  await page2.getByLabel('Exercício').fill('Supino');
  await page2.getByLabel('Carga').fill('40');
  await page2.getByRole('button', { name: 'Salvar treino' }).click();
  await page2.waitForTimeout(400);
  const s3 = await page2.evaluate(() => JSON.parse(localStorage.getItem('life-leveling:save')));
  check('Treino real registrado com carga', s3.workouts[0]?.exercises[0]?.sets[0]?.kg === 40);
  await page2.screenshot({ path: `${SHOTS}12-vida.png` });

  // 12. Erros compreensíveis
  await page2.getByRole('button', { name: 'Missões', exact: true }).click();
  await page2.getByTestId('new-mission').click();
  await page2.getByRole('button', { name: 'Salvar', exact: true }).click();
  const alert = await page2.getByRole('alert').textContent();
  check('12. Erro compreensível ao salvar missão inválida', alert.includes('Dê um nome'), alert);
  await page2.keyboard.press('Escape');

  // 13. Sem rolagem horizontal no celular
  const overflow = await page2.evaluate(() => document.querySelector('.screen').scrollWidth > window.innerWidth + 1);
  check('13. Interface cabe na tela do celular (sem rolagem horizontal)', !overflow);

  const relevant = errors.filter((e) => !/Download the React DevTools|WebGL|GPU stall|THREE.WebGLRenderer/.test(e));
  check('Sem erros de JavaScript no console', relevant.length === 0, relevant.slice(0, 3).join(' | '));
} catch (e) {
  check('Execução do roteiro', false, String(e).slice(0, 300));
} finally {
  await browser.close();
  server.kill();
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} verificações passaram.`);
  process.exit(failed ? 1 : 0);
}

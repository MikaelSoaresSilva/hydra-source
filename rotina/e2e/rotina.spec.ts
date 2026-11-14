import { expect, test, type Page } from '@playwright/test';

// Segunda-feira, 16/11/2026, 12:05 (horário fixo para os testes não dependerem do dia real).
const nav = (page: Page, name: string) => page.getByRole('navigation').getByRole('button', { name, exact: true });

async function start(page: Page, time = '2026-11-16T12:05:00') {
  await page.clock.setFixedTime(new Date(time));
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Painel do dia' })).toBeVisible();
}

test('painel: data, hora, próxima atividade, concluir dá XP e fica salvo ao reabrir', async ({ page }, info) => {
  await start(page);
  await expect(page.getByText(/Segunda-feira, 16 de novembro de 2026/)).toBeVisible();
  await expect(page.getByLabel('Horário atual')).toHaveText('12:05');
  await expect(page.getByTestId('next-activity')).toBeVisible();
  await expect(page.getByTestId('day-pct')).toHaveText('0%');
  const items = page.getByTestId('tl-item');
  expect(await items.count()).toBeGreaterThan(15);
  await expect(page.locator('.tl-item.now')).toContainText('Almoço');
  await page.screenshot({ path: `test-results/hoje-${info.project.name}.png`, fullPage: true });
  await page.getByRole('button', { name: 'Concluir Acordar' }).click();
  await expect(page.getByRole('status')).toContainText('+');
  await page.getByRole('button', { name: 'Concluir Almoço' }).click();
  await expect(page.getByTestId('day-pct')).not.toHaveText('0%');
  const pct = await page.getByTestId('day-pct').textContent();
  // o que passou antes de instalar não conta como atraso
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId('day-pct')).toHaveText(pct!);
  await expect(page.getByRole('button', { name: 'Desmarcar Almoço' })).toBeVisible();
  // descrição detalhada
  await page.locator('.tl-main', { hasText: 'Skincare matinal' }).click();
  await expect(page.getByText(/Protetor solar FPS 30\+/)).toBeVisible();
  // água
  await page.getByRole('button', { name: '+ 500 ml' }).click();
  await expect(page.getByTestId('water')).toContainText('0,50');
  // mais tarde: o lanche das 15:00 não foi feito → atrasada
  await page.clock.setFixedTime(new Date('2026-11-16T15:30:00'));
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('Lanche da tarde');
  await expect(page.getByTestId('tl-item').filter({ hasText: 'Lanche da tarde' })).toContainText('atrasada');
});

test('IA: "Hoje só vou conseguir ir à academia às 18h" mostra a prévia e aplica', async ({ page }, info) => {
  await start(page);
  await nav(page, 'IA').click();
  await page.getByLabel('Descreva sua necessidade').fill('Hoje só vou conseguir ir à academia às 18h e quero dormir mais cedo.');
  await page.getByRole('button', { name: '✨ Reorganizar' }).click();
  await expect(page.getByRole('heading', { name: 'Prévia da nova rotina' })).toBeVisible();
  await expect(page.getByTestId('ops')).toContainText('Academia — musculação às 18:00 só hoje');
  await expect(page.getByTestId('ops')).toContainText('Dormir 30 min mais cedo só hoje');
  await expect(page.getByTestId('changes')).toContainText('Academia');
  await page.screenshot({ path: `test-results/ia-${info.project.name}.png`, fullPage: true });
  await page.getByRole('button', { name: 'Aplicar mudanças' }).click();
  await expect(page.getByRole('status')).toContainText('Rotina reorganizada');
  await nav(page, 'Hoje').click();
  await expect(page.getByTestId('tl-item').filter({ hasText: 'Academia' })).toContainText('18:00');
  // desfazer
  await nav(page, 'IA').click();
  await page.getByRole('button', { name: /Desfazer a última alteração/ }).click();
  await nav(page, 'Hoje').click();
  await expect(page.getByTestId('tl-item').filter({ hasText: 'Academia' })).toContainText('16:00');
});

test('IA: pedido que o app não entende é explicado, sem mudar nada', async ({ page }) => {
  await start(page);
  await nav(page, 'IA').click();
  await page.getByLabel('Descreva sua necessidade').fill('banana azul');
  await page.getByRole('button', { name: '✨ Reorganizar' }).click();
  await expect(page.getByRole('heading', { name: 'Não entendi tudo' })).toBeVisible();
  await expect(page.getByText(/ative a IA do Claude em Ajustes/)).toBeVisible();
});

test('rotina: adicionar atividade personalizada, pausar e mudar o sono', async ({ page }, info) => {
  await start(page, '2026-11-16T08:00:00');
  await nav(page, 'Rotina').click();
  await page.getByRole('button', { name: '➕ Adicionar' }).click();
  await page.getByLabel('Nome').fill('Inglês');
  await page.getByLabel('Categoria').selectOption('mind');
  await page.getByLabel('Descrição').fill('Duolingo + 1 vídeo');
  await page.getByLabel('Duração (min)').fill('45');
  await page.getByLabel('Horário de início').fill('14:00');
  await page.getByText('Horário fixo (não mover)').click();
  await page.getByRole('button', { name: 'Fim de semana' }).click();
  await page.getByRole('button', { name: 'Seg–Sex' }).click();
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByText(/Inglês/).first()).toBeVisible();
  await page.getByRole('button', { name: 'Pausar Leitura' }).click();
  await expect(page.locator('.list li', { hasText: 'Leitura' }).getByText('pausada')).toBeVisible();
  await page.getByLabel('Acordar (semana)').fill('06:00');
  await expect(page.locator('.banner', { hasText: 'Sono: 7 h 30 min' })).toBeVisible();
  await page.getByRole('button', { name: 'Ajustar dormir para 8 h 30 de sono' }).click();
  await expect(page.locator('.banner', { hasText: '8 h 30 min ✓' })).toBeVisible();
  await page.screenshot({ path: `test-results/rotina-${info.project.name}.png`, fullPage: true });
  await nav(page, 'Hoje').click();
  await expect(page.getByTestId('tl-item').filter({ hasText: 'Inglês' })).toContainText('14:00');
  await expect(page.getByTestId('tl-item').filter({ hasText: 'Leitura' })).toHaveCount(0);
  await expect(page.getByTestId('tl-item').first()).toContainText('06:00');
});

test('evolução: nível, metas, conquistas; ajustes: backup e restauração', async ({ page }, info) => {
  await start(page, '2026-11-16T23:59:00');
  // concluir o dia inteiro
  const buttons = page.getByRole('button', { name: /^Concluir / });
  const n = await buttons.count();
  for (let i = 0; i < n; i++) await buttons.first().click();
  await expect(page.getByTestId('day-pct')).toHaveText('100%');
  await nav(page, 'Evolução').click();
  await expect(page.getByTestId('level')).not.toHaveText('1');
  await expect(page.getByTestId('ach-on').first()).toBeVisible();
  await expect(page.getByText('Dia perfeito')).toBeVisible();
  await page.screenshot({ path: `test-results/evolucao-${info.project.name}.png`, fullPage: true });

  await nav(page, 'Ajustes').click();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Fazer backup' }).click()]);
  const path = await dl.path();
  page.on('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: 'Apagar todos os dados' }).click();
  await nav(page, 'Hoje').click();
  await expect(page.getByTestId('day-pct')).toHaveText('0%');
  await nav(page, 'Ajustes').click();
  await page.getByLabel('Arquivo de backup').setInputFiles(path);
  await expect(page.getByRole('status')).toContainText('Backup restaurado');
  await nav(page, 'Hoje').click();
  await expect(page.getByTestId('day-pct')).toHaveText('100%');
});

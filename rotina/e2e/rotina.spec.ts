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
  await expect(page.getByLabel(/Horário fixo: começa e termina/)).toBeChecked(); // definir o início já fixa o horário
  await expect(page.getByLabel('Horário de término')).toHaveValue('14:45');
  await page.getByRole('button', { name: 'Fim de semana', exact: true }).click();
  await page.getByRole('button', { name: 'Seg–Sex', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Salvar', exact: true }).click();
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

test('início e término: no formulário e pela linha do tempo (só hoje / todos os dias)', async ({ page }, info) => {
  await start(page, '2026-11-16T08:00:00');
  // Formulário: término define a duração
  await nav(page, 'Rotina').click();
  await page.getByRole('button', { name: 'Editar Leitura' }).click();
  await page.getByLabel('Horário de início').fill('11:00');
  await page.getByLabel('Horário de término').fill('11:50');
  await expect(page.getByTestId('form-span')).toContainText('11:00 até 11:50 · 50 min');
  await expect(page.getByLabel('Duração (min)')).toHaveValue('50');
  await page.screenshot({ path: `test-results/inicio-termino-${info.project.name}.png`, fullPage: true });
  await page.getByRole('dialog').getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.locator('.list li', { hasText: 'Leitura' })).toContainText('11:00–11:50');
  // término antes do início dá erro
  await page.getByRole('button', { name: 'Editar Leitura' }).click();
  await page.getByLabel('Horário de término').fill('11:02');
  await page.getByRole('dialog').getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('pelo menos 5 min');
  await page.getByRole('button', { name: 'Fechar' }).click();

  // Linha do tempo: só hoje
  await nav(page, 'Hoje').click();
  await expect(page.getByTestId('tl-item').filter({ hasText: 'Leitura' })).toContainText('11:00');
  await page.getByRole('button', { name: 'Opções de Almoço' }).click();
  await page.getByRole('button', { name: '🕒 Mudar início e término' }).click();
  await page.getByLabel('Novo início').fill('12:30');
  await page.getByLabel('Novo término').fill('13:30');
  await page.getByRole('button', { name: 'Salvar horário' }).click();
  const lunch = page.getByTestId('tl-item').filter({ hasText: 'Almoço' });
  await expect(lunch).toContainText('12:30');
  await expect(lunch).toContainText('13:30');
  await expect(lunch).toContainText('só hoje');
  await page.getByRole('button', { name: 'Próximo dia' }).click();
  await expect(page.getByTestId('tl-item').filter({ hasText: 'Almoço' })).toContainText('12:00');
  // todos os dias
  await page.getByRole('button', { name: 'Opções de Jantar' }).click();
  await page.getByRole('button', { name: '🕒 Mudar início e término' }).click();
  await page.getByLabel('Novo início').fill('20:00');
  await page.getByLabel('Novo término').fill('20:45');
  await page.getByRole('radio', { name: 'Todos os dias' }).click();
  await page.getByRole('button', { name: 'Salvar horário' }).click();
  await expect(page.getByTestId('tl-item').filter({ hasText: 'Jantar' })).toContainText('20:45');
  await page.getByRole('main').getByRole('button', { name: 'Hoje', exact: true }).click();
  await expect(page.getByTestId('tl-item').filter({ hasText: 'Jantar' })).toContainText('20:00');
  // fora do horário acordado: avisa e não deixa salvar
  await page.getByRole('button', { name: 'Opções de Leitura' }).click();
  await page.getByRole('button', { name: '🕒 Mudar início e término' }).click();
  await page.getByLabel('Novo início').fill('05:00');
  await page.getByLabel('Novo término').fill('05:30');
  await expect(page.getByRole('alert')).toContainText('antes do horário de acordar');
  await expect(page.getByRole('button', { name: 'Salvar horário' })).toBeDisabled();
});

test('trabalho com almoço junto (11:30–12:50), juntar e unir atividades', async ({ page }, info) => {
  await start(page, '2026-11-16T08:00:00');
  await nav(page, 'Rotina').click();
  await expect(page.getByTestId('work-lunch-status')).toContainText('Ainda não há atividade de Trabalho');
  // cria o Trabalho 08:00–17:00 seg–sex
  await page.getByRole('button', { name: '➕ Adicionar' }).click();
  await page.getByLabel('Nome').fill('Trabalho');
  await page.getByLabel('Categoria').selectOption('work');
  await page.getByLabel('Horário de início').fill('08:00');
  await page.getByLabel('Horário de término').fill('17:00');
  await page.getByRole('button', { name: 'Seg–Sex', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByTestId('work-lunch-status')).toContainText('Almoço junto com Trabalho');
  await expect(page.getByTestId('work-lunch-status')).toContainText('11:30–12:50');
  await page.screenshot({ path: `test-results/trabalho-almoco-${info.project.name}.png`, fullPage: true });

  await nav(page, 'Hoje').click();
  const lunch = page.getByTestId('tl-item').filter({ hasText: 'Almoço' });
  await expect(lunch).toContainText('11:30');
  await expect(lunch).toContainText('12:50');
  await expect(lunch).toContainText('junto com Trabalho');
  // sábado: sem trabalho, almoço no horário normal
  for (let i = 0; i < 5; i++) await page.getByRole('button', { name: 'Próximo dia' }).click();
  await expect(page.getByText(/Sábado, 21 de novembro/)).toBeVisible();
  await expect(page.getByTestId('tl-item').filter({ hasText: 'Almoço' })).toContainText('12:00');
  await expect(page.getByTestId('tl-item').filter({ hasText: 'Trabalho' })).toHaveCount(0);
  await page.getByRole('main').getByRole('button', { name: 'Hoje', exact: true }).click();

  // juntar: Leitura junto com Tempo livre
  await nav(page, 'Rotina').click();
  await page.getByRole('button', { name: 'Editar Leitura' }).click();
  await page.getByText('🔗 Combinar com outra atividade').click();
  await page.getByText('Fazer junto com outra atividade (ao mesmo tempo)').click();
  await page.getByLabel('Junto com', { exact: true }).selectOption({ label: 'Tempo livre (20:05–21:05)' });
  await page.getByLabel('Início junto').fill('20:10');
  await page.getByLabel('Término junto').fill('20:40');
  await page.getByRole('dialog').getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.locator('.list li', { hasText: 'Leitura' })).toContainText('junto com Tempo livre');

  // unir: Higiene pessoal + Skincare matinal
  page.on('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: 'Editar Higiene pessoal' }).click();
  await page.getByText('🔗 Combinar com outra atividade').click();
  await page.getByLabel('Unir com').selectOption({ label: 'Skincare matinal' });
  await page.getByRole('button', { name: 'Unir as duas' }).click();
  await expect(page.getByRole('status')).toContainText('Unidas: Higiene pessoal + Skincare matinal');
  await expect(page.locator('.list li', { hasText: 'Higiene pessoal + Skincare matinal' })).toContainText('25 min');
  await expect(page.locator('.list li').filter({ hasText: /^.*Skincare matinal$/ })).toHaveCount(0);

  await nav(page, 'Hoje').click();
  // segunda com trabalho + academia: o tempo livre não cabe e o app avisa (com a leitura que está dentro dele)
  await expect(page.locator('.banner.warn', { hasText: 'Não couberam' })).toContainText('Tempo livre');
  await expect(page.getByTestId('tl-item').filter({ hasText: 'Higiene pessoal + Skincare matinal' })).toHaveCount(1);
  for (let i = 0; i < 5; i++) await page.getByRole('button', { name: 'Próximo dia' }).click();
  const reading = page.getByTestId('tl-item').filter({ hasText: 'Leitura' });
  await expect(reading).toContainText('20:10');
  await expect(reading).toContainText('junto com Tempo livre');
});

test('estudos: semana encaixa se der; fim de semana sempre tem', async ({ page }) => {
  await start(page, '2026-11-16T07:30:00');
  await nav(page, 'IA').click();
  await page.getByLabel('Descreva sua necessidade').fill('Vou trabalhar das 8h às 17h');
  await page.getByRole('button', { name: '✨ Reorganizar' }).click();
  await page.getByRole('button', { name: 'Aplicar mudanças' }).click();
  await nav(page, 'Hoje').click();
  // segunda com trabalho: estudos entram depois do jantar, sem aviso de "não coube" para estudos
  // com o banho depois da academia, os estudos encurtam (mínimo 30 min) mas continuam no dia
  await expect(page.getByTestId('tl-item').filter({ hasText: 'Estudos' })).toContainText(/20:\d\d/);
  await expect(page.locator('.banner.warn', { hasText: 'Não couberam' })).not.toContainText('Estudos');
  // sábado: estudos do fim de semana
  for (let i = 0; i < 5; i++) await page.getByRole('button', { name: 'Próximo dia' }).click();
  await expect(page.getByTestId('tl-item').filter({ hasText: 'Estudos (fim de semana)' })).toContainText('1 h 30 min'); // perto das 14:00, ao redor do lanche das 15:00
  await page.getByRole('button', { name: 'Próximo dia' }).click();
  await expect(page.getByTestId('tl-item').filter({ hasText: 'Estudos (fim de semana)' })).toContainText('1 h 30 min');
  // Rotina mostra opcional / encurta
  await nav(page, 'Rotina').click();
  await expect(page.locator('.list li').filter({ has: page.getByRole('button', { name: 'Editar Estudos', exact: true }) })).toContainText('Opcional');
  await expect(page.locator('.list li', { hasText: 'Estudos (fim de semana)' })).toContainText('encurta até 45 min');
  await page.getByRole('button', { name: 'Editar Estudos', exact: true }).click();
  await expect(page.getByLabel(/Opcional: encaixar só se der/)).toBeChecked();
  await expect(page.getByLabel('Pode encurtar até')).toHaveValue('30');
});

test('banho depois do treino; mudar o horário do trabalho reorganiza o resto', async ({ page }, info) => {
  await start(page, '2026-11-16T06:00:00');
  // banho logo depois da academia, lanche pós-treino depois do banho
  const gym = page.getByTestId('tl-item').filter({ hasText: 'Academia' });
  await expect(gym).toContainText('16:00');
  await expect(gym).toContainText('17:45');
  await expect(page.getByTestId('tl-item').filter({ hasText: /^.*Banho/ }).first()).toContainText('17:45');
  await expect(page.getByTestId('tl-item').filter({ hasText: 'Lanche pós-treino' })).toContainText('18:00');

  // cria o trabalho pela IA: a prévia mostra o ajuste automático
  await nav(page, 'IA').click();
  await page.getByLabel('Descreva sua necessidade').fill('Vou trabalhar das 8h às 17h');
  await page.getByRole('button', { name: '✨ Reorganizar' }).click();
  await expect(page.getByTestId('auto-adjust')).toContainText('acordar 07:00 → 06:55');
  await page.getByRole('button', { name: 'Aplicar mudanças' }).click();

  // muda o trabalho para 9h–18h e põe 30 min de deslocamento no cartão
  await nav(page, 'Rotina').click();
  await page.getByLabel('Trabalho início', { exact: true }).fill('09:00');
  await page.getByLabel('Trabalho término', { exact: true }).fill('18:00');
  await page.getByLabel('Deslocamento até o trabalho').fill('30');
  await page.getByRole('button', { name: 'Salvar trabalho e almoço' }).click();
  await expect(page.getByTestId('work-lunch-status')).toContainText('09:00–18:00');
  await expect(page.getByLabel('Acordar (semana)')).toHaveValue('07:25'); // 09:00 − 30 min − 1h05 de manhã
  await page.screenshot({ path: `test-results/trabalho-muda-${info.project.name}.png`, fullPage: true });

  await nav(page, 'Hoje').click();
  await expect(page.getByTestId('tl-item').first()).toContainText('07:25');
  await expect(page.getByTestId('tl-item').filter({ hasText: 'Ida para o trabalho' })).toContainText('08:30');
  await expect(page.getByTestId('tl-item').filter({ hasText: 'Volta para casa' })).toContainText('18:00');
  await expect(page.getByTestId('tl-item').filter({ hasText: 'Academia' })).toContainText('18:30');
  await expect(page.getByTestId('tl-item').filter({ hasText: 'Almoço' })).toContainText('11:30');
  // sábado: sem trabalho, acorda 08:00 e banho depois da luta
  for (let i = 0; i < 5; i++) await page.getByRole('button', { name: 'Próximo dia' }).click();
  await expect(page.getByTestId('tl-item').first()).toContainText('08:00');
  await expect(page.getByTestId('tl-item').filter({ hasText: 'Ida para o trabalho' })).toHaveCount(0);
});

test('prioridades: academia, 4 refeições, trabalho e estudos nos dias de estudo', async ({ page }, info) => {
  await start(page, '2026-11-16T06:00:00'); // segunda (dia de estudo padrão)
  await nav(page, 'IA').click();
  await page.getByLabel('Descreva sua necessidade').fill('Vou trabalhar das 8h às 17h');
  await page.getByRole('button', { name: '✨ Reorganizar' }).click();
  await page.getByRole('button', { name: 'Aplicar mudanças' }).click();
  await nav(page, 'Hoje').click();
  for (const t of ['Academia', 'Café da manhã', 'Almoço', 'Lanche da tarde', 'Jantar', 'Trabalho', 'Estudos']) {
    await expect(page.getByTestId('tl-item').filter({ hasText: t }).first().getByLabel('prioridade máxima')).toBeVisible();
  }
  await expect(page.getByTestId('tl-item').filter({ hasText: 'Lanche da tarde' })).toContainText('junto com Trabalho');
  await page.screenshot({ path: `test-results/prioridades-${info.project.name}.png`, fullPage: true });
  // terça não é dia de estudo: estudos sem estrela (opcional)
  await page.getByRole('button', { name: 'Próximo dia' }).click();
  const tueStudy = page.getByTestId('tl-item').filter({ hasText: /^.*Estudos/ });
  if (await tueStudy.count()) await expect(tueStudy.first().getByLabel('prioridade máxima')).toHaveCount(0);
  // marca terça como dia de estudo no cartão
  await nav(page, 'Rotina').click();
  await page.getByRole('group', { name: 'Dias de estudo' }).getByRole('button', { name: 'Ter' }).click();
  await expect(page.getByRole('group', { name: 'Dias de estudo' }).getByRole('button', { name: 'Ter' })).toHaveAttribute('aria-pressed', 'true');
  await nav(page, 'Hoje').click();
  await page.getByRole('button', { name: 'Próximo dia' }).click();
  await expect(page.getByTestId('tl-item').filter({ hasText: 'Estudos' }).first().getByLabel('prioridade máxima')).toBeVisible();
});

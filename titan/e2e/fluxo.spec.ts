import { expect, test } from '@playwright/test';

// Fluxo completo em modo local (build sem chaves do Supabase).
test('onboarding → treino com séries → persistência → nutrição → pele → medidas', async ({ page }, info) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Usar em modo local' }).click();

  // Onboarding
  await expect(page.getByRole('heading', { name: 'Você' })).toBeVisible();
  await page.getByRole('button', { name: 'Salvar e continuar' }).click();
  await expect(page.getByRole('alert')).toContainText('Confirme');
  await page.getByLabel('Confirmo que estes dados estão atuais.').check();
  await page.getByRole('button', { name: 'Salvar e continuar' }).click();
  await expect(page.getByRole('heading', { name: 'Treino', exact: true })).toBeVisible();
  await page.getByLabel(/Conferi a lista/).check();
  await page.getByRole('button', { name: 'Salvar e continuar' }).click(); // treino
  await page.getByRole('button', { name: 'Pular' }).click(); // nutrição (pulada: mantém padrões já salvos)
  await page.getByRole('button', { name: 'Principia GL-02' }).click();
  await page.getByRole('button', { name: 'Salvar e continuar' }).click(); // pele
  await page.getByRole('button', { name: 'Salvar e continuar' }).click(); // cabelo
  await page.getByRole('button', { name: 'Gerar meu plano' }).click();

  // Painel diário
  await expect(page.getByRole('heading', { name: 'O que fazer hoje' })).toBeVisible();
  await page.screenshot({ path: `test-results/hoje-${info.project.name}.png`, fullPage: true });

  // Treino
  await page.getByRole('link', { name: 'Treino' }).first().click();
  await expect(page.getByText(/Próxima sessão:/)).toBeVisible();
  await expect(page.getByText(/Protocolo Olympia — 60 dias/)).toBeVisible();
  await expect(page.getByText('Próxima sessão: Superior A — largura')).toBeVisible();
  await page.getByRole('button', { name: 'Iniciar treino' }).click();
  // Prontidão (TQR) abaixo de 13 → sessão ajustada
  await page.getByLabel('Prontidão TQR').selectOption('11');
  await page.getByRole('button', { name: 'Começar' }).click();
  await expect(page.getByText(/TQR 11 .*abaixo de 13/)).toBeVisible();
  await page.getByLabel('Carga série 1').first().fill('60');
  await page.getByLabel('Repetições série 1').first().fill('8');
  await page.getByLabel('RIR série 1').first().fill('3');
  await page.getByRole('button', { name: 'Concluir série 1' }).first().click();
  await expect(page.getByRole('timer')).toBeVisible();
  await expect(page.getByText(/Série 1: 8 reps com RIR 3: dentro do alvo/)).toBeVisible();
  // Série 2 fácil demais → a carga da série seguinte sobe sozinha
  await page.getByRole('button', { name: 'Pular' }).click();
  await page.getByRole('button', { name: '+ série' }).first().click();
  await page.getByLabel('Repetições série 2').first().fill('15');
  await page.getByLabel('RIR série 2').first().fill('5');
  await page.getByRole('button', { name: 'Concluir série 2' }).first().click();
  await expect(page.getByText(/Série 2: 15 reps com RIR 5: acima do alvo. Próxima série: 67,5 kg \(\+7,5 kg\)/)).toBeVisible();
  await expect(page.getByLabel('Carga série 3').first()).toHaveValue('67,5');
  await page.screenshot({ path: `test-results/treino-${info.project.name}.png` });

  // Recarrega: série continua salva
  await page.reload();
  await expect(page.getByRole('button', { name: 'Concluir série 1' }).first()).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Carga série 1').first()).toHaveValue('60');
  await expect(page.getByRole('heading', { name: 'O que muda no próximo treino' })).toBeVisible();
  await page.screenshot({ path: `test-results/progressao-${info.project.name}.png`, fullPage: true });
  await page.getByRole('button', { name: 'Concluir treino' }).click();
  await expect(page.getByText('Treino concluído e salvo!')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ver' }).first()).toBeVisible();

  // Nutrição: meta calculada a partir do perfil (80 kg, 180 cm, 19 anos, moderado → 3000 kcal)
  await page.getByRole('link', { name: 'Nutrição' }).first().click();
  await page.getByRole('tab', { name: 'Metas' }).click();
  await expect(page.locator('.stat-v').first()).toHaveText('3000');
  await page.getByRole('tab', { name: 'Plano' }).click();
  await page.getByRole('button', { name: 'Comi isso' }).first().click();
  await page.getByRole('tab', { name: 'Hoje' }).click();
  await expect(page.getByText('Registrado hoje')).toBeVisible();
  await expect(page.locator('.list li').filter({ hasText: 'Café da manhã' }).first()).toBeVisible();

  // Pele: gerar e editar rotina; produto do onboarding aparece como pausado
  await page.getByRole('link', { name: 'Cuidados' }).first().click();
  await page.getByRole('button', { name: 'Gerar rotina base' }).click();
  await expect(page.getByRole('heading', { name: 'Manhã' }).first()).toBeVisible();
  await expect(page.locator('li strong', { hasText: 'Principia GL-02' })).toBeVisible();
  await page.getByRole('button', { name: 'Editar' }).last().click();
  await page.getByLabel('Passo').fill('Hidratante gel leve');
  await page.getByRole('button', { name: 'Salvar' }).first().click();
  await expect(page.getByText('Hidratante gel leve').first()).toBeVisible();

  // Evolução: medidas + gráfico com dado real
  await page.getByRole('link', { name: 'Evolução' }).first().click();
  await page.getByLabel('Peso (kg)').fill('80,4');
  await page.getByLabel('Braço direito contraído (cm)').fill('38,5');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('cell', { name: '80,4' })).toBeVisible();
  await page.getByRole('tab', { name: 'Gráficos' }).click();
  await expect(page.locator('.recharts-surface').first()).toBeVisible();

  // Proporções aparecem no Treino a partir da medição
  await page.goto('/#/treino');
  await expect(page.getByRole('cell', { name: 'Braço / cintura' })).toHaveCount(0); // sem cintura medida ainda
  await page.screenshot({ path: `test-results/olympia-${info.project.name}.png`, fullPage: true });

  // Persistência após "sair e entrar" (nova página, mesmo navegador)
  await page.goto('/#/treino');
  await expect(page.getByRole('link', { name: 'Ver' }).first()).toBeVisible();
  await page.screenshot({ path: `test-results/evolucao-${info.project.name}.png`, fullPage: true });
});

test('aparência (questionário sem IA) + biblioteca/calculadora + IA desligada por padrão', async ({ page }, info) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Usar em modo local' }).click();
  await page.getByLabel('Confirmo que estes dados estão atuais.').check();
  await page.getByRole('button', { name: 'Salvar e continuar' }).click();
  await page.getByLabel(/Conferi a lista/).check();
  await page.getByRole('button', { name: 'Salvar e continuar' }).click();
  await page.getByRole('button', { name: 'Pular' }).click();
  await page.getByRole('button', { name: 'Salvar e continuar' }).click();
  await page.getByRole('button', { name: 'Salvar e continuar' }).click();
  await page.getByRole('button', { name: 'Gerar meu plano' }).click();
  await expect(page.getByRole('heading', { name: 'O que fazer hoje' })).toBeVisible();

  await page.getByRole('link', { name: 'Aparência' }).click();
  await page.getByLabel('length').selectOption('similar');
  await page.getByLabel('widest').selectOption('equal');
  await page.getByLabel('jaw').selectOption('angular');
  await expect(page.getByRole('heading', { name: 'Rosto quadrado' })).toBeVisible();
  await expect(page.getByText('Assimétrico com pontas desiguais puxadas para a testa').first()).toBeVisible();
  await page.getByRole('button', { name: 'Salvar no histórico' }).click();
  await page.getByRole('tab', { name: 'Histórico' }).click();
  await expect(page.getByText('Rosto: quadrado')).toBeVisible();
  await page.screenshot({ path: `test-results/aparencia-${info.project.name}.png`, fullPage: true });

  // IA desligada por padrão: nada é enviado sem ligar e consentir
  await page.getByRole('tab', { name: 'Foto + IA' }).click();
  await expect(page.getByText('Análise por foto com IA (desligada)')).toBeVisible();
  await page.getByRole('button', { name: 'Ligar análise por IA' }).click();
  await expect(page.getByRole('button', { name: 'Enviar e analisar' })).toBeDisabled();

  // Biblioteca: calculadora de 1RM
  await page.getByRole('link', { name: 'Biblioteca' }).click();
  await page.getByRole('tab', { name: 'Calculadora' }).click();
  await page.getByLabel('Carga da série').fill('60');
  await page.getByLabel('Repetições feitas').fill('10');
  await expect(page.getByTestId('e1rm')).toHaveText('80 kg');
  await page.getByRole('tab', { name: 'Sistemas' }).click();
  await expect(page.getByText('Drop-set')).toBeVisible();
  await page.screenshot({ path: `test-results/biblioteca-${info.project.name}.png`, fullPage: true });
});

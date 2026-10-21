// Atalhos para escrever exercícios no formato que o app entende.
// Cada função devolve um objeto igual aos exercícios originais do app.

// Escreva a alternativa correta em `answer`; a ordem final é embaralhada de forma
// determinística (pelo id) para a resposta certa não ficar sempre na mesma posição.
function shuffleById(id, n) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    h = (h * 1103515245 + 12345) >>> 0;
    const j = h % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

const mcq = (id, competency, prompt, options, answer, explanation, hints, extra = {}) => {
  const order = shuffleById(id, options.length);
  return {
    id, type: 'mcq', competency, prompt, options: order.map((i) => options[i]), answer: order.indexOf(answer),
    hints, solution: options[answer], explanation, errorKind: 'conhecimento', ...extra,
  };
};

// predict com run: true é executado pelo build para conferir a saída esperada.
const predict = (id, competency, prompt, code, expected, explanation, hints, extra = {}) => ({
  id, type: 'predict', competency, prompt, code, expected,
  hints, solution: expected, explanation, errorKind: 'interpretacao', run: true, ...extra,
});

const code = (id, competency, prompt, starter, tests, solution, explanation, hints, extra = {}) => ({
  id, type: 'code', competency, prompt, starter, tests,
  hints, solution, explanation, errorKind: 'logica', ...extra,
});

const explain = (id, competency, prompt, keywords, solution, explanation, hints, extra = {}) => ({
  id, type: 'explain', competency, prompt, keywords, minGroups: 2,
  hints, solution, explanation, errorKind: 'conhecimento', ...extra,
});

const t = (call, expect, desc) => ({ call, expect, desc });

module.exports = { mcq, predict, code, explain, t };

// Confere exercícios de HTML/CSS/DOM montando a página num iframe invisível.
import type { HtmlEx } from '../data/types';

export interface CheckResult { desc: string; pass: boolean; detail?: string }

const normStyle = (prop: string, v: string) => {
  if (prop === 'font-weight') return v === 'bold' ? '700' : v === 'normal' ? '400' : v;
  return v.trim();
};

export function checkHtml(html: string, checks: HtmlEx['checks']): Promise<CheckResult[]> {
  return new Promise((resolve) => {
    const frame = document.createElement('iframe');
    frame.setAttribute('sandbox', 'allow-scripts allow-same-origin');
    frame.style.cssText = 'position:absolute;width:400px;height:300px;left:-9999px;top:0;border:0';
    let done = false;
    const finish = () => {
      if (done) return; done = true;
      const doc = frame.contentDocument;
      const win = frame.contentWindow;
      const res: CheckResult[] = checks.map((c) => {
        if (!doc || !win) return { desc: c.desc, pass: false, detail: 'página não carregou' };
        let els: Element[] = [];
        try { els = [...doc.querySelectorAll(c.selector)]; } catch { return { desc: c.desc, pass: false, detail: 'seletor inválido' }; }
        if (c.count !== undefined) {
          if (els.length !== c.count) return { desc: c.desc, pass: false, detail: `encontrei ${els.length}, esperava ${c.count}` };
        } else if (!els.length) return { desc: c.desc, pass: false, detail: `não encontrei nenhum elemento "${c.selector}"` };
        if (c.text !== undefined) {
          const ok = els.some((e) => (e.textContent ?? '').trim() === c.text);
          if (!ok) return { desc: c.desc, pass: false, detail: `texto encontrado: "${(els[0].textContent ?? '').trim().slice(0, 40)}"` };
        }
        if (c.attr) {
          const ok = els.some((e) => e.getAttribute(c.attr![0]) === c.attr![1]);
          if (!ok) return { desc: c.desc, pass: false, detail: `${c.attr[0]}="${els[0].getAttribute(c.attr[0]) ?? ''}"` };
        }
        if (c.style) {
          const [prop, val] = c.style;
          const ok = els.some((e) => normStyle(prop, win.getComputedStyle(e).getPropertyValue(prop)) === normStyle(prop, val));
          if (!ok) return { desc: c.desc, pass: false, detail: `${prop} está como "${win.getComputedStyle(els[0]).getPropertyValue(prop)}"` };
        }
        return { desc: c.desc, pass: true };
      });
      frame.remove();
      resolve(res);
    };
    frame.onload = () => setTimeout(finish, 250);
    setTimeout(finish, 3000);
    document.body.appendChild(frame);
    frame.srcdoc = '<!doctype html><html><head><meta charset="utf-8"></head><body>' + html + '</body></html>';
  });
}

/** Documento completo para a pré-visualização dos laboratórios. */
export function previewDoc(html: string) {
  return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:system-ui,sans-serif;margin:12px;color:#111;background:#fff}button{font-size:16px;padding:6px 10px;margin:2px}input{font-size:16px;padding:6px}</style></head><body>' + html + '</body></html>';
}

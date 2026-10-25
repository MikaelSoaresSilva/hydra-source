"""Converte livro.md em uma página HTML offline (android/assets/index.html)."""
import html
import re
import sys
from pathlib import Path

import markdown

ROOT = Path(__file__).parent
SRC = ROOT / "livro.md"
OUT = ROOT / "android" / "assets" / "index.html"


def slug_key(text):
    text = re.sub(r"<[^>]+>", "", text)
    return re.sub(r"[^a-z0-9]+", "-", text.lower())[:60].strip("-")


def main():
    md = SRC.read_text(encoding="utf-8")
    lines = md.splitlines()

    # Título, subtítulo e linha de data/autor saem do corpo: viram a capa do app.
    title = lines[0].lstrip("# ").strip()
    subtitle = lines[2].strip("* ").strip()
    body_md = "\n".join(lines[5:])

    body = markdown.markdown(body_md, extensions=["tables", "sane_lists"])

    # Divide em capítulos a cada <h2>.
    parts = re.split(r"(?=<h2>)", body)
    chapters = [p for p in parts if p.strip().startswith("<h2>")]

    sections = []
    toc = []
    for i, ch in enumerate(chapters):
        heading = re.match(r"<h2>(.*?)</h2>", ch).group(1)

        # Listas de tarefas "[ ]" viram caixas de marcar que ficam salvas.
        n = [0]

        def checkbox(m):
            n[0] += 1
            key = f"c{i}-{n[0]}"
            return (f'<li class="task"><label><input type="checkbox" data-k="{key}">'
                    f"<span>{m.group(1)}</span></label></li>")

        ch = re.sub(r"<li>\[ \]\s*(.*?)</li>", checkbox, ch, flags=re.S)

        # Coluna "Feito" das tabelas de missões vira caixa de marcar.
        def table_done(tm):
            t = tm.group(0)
            if not re.search(r"<th[^>]*>Feito</th>", t):
                return t
            row = [0]

            def cell(_):
                row[0] += 1
                return (f'<td class="done"><input type="checkbox" '
                        f'data-k="d{i}-{row[0]}" aria-label="Feito"></td>')

            t = t.replace("<table>", '<table class="missions">', 1)
            return re.sub(r"<td[^>]*>\s*</td>", cell, t)

        ch = re.sub(r"<table>.*?</table>", table_done, ch, flags=re.S)

        # Tabelas roláveis na horizontal no celular.
        ch = re.sub(r"<table([^>]*)>", r'<div class="tw"><table\1>', ch)
        ch = ch.replace("</table>", "</table></div>")

        # Links externos abrem no navegador.
        ch = ch.replace('<a href="http', '<a target="_blank" rel="noopener" href="http')

        sections.append(f'<section class="chapter" id="c{i}" data-i="{i}">{ch}'
                        f'<nav class="pager"></nav></section>')
        toc.append((i, re.sub(r"<[^>]+>", "", heading)))

    toc_html = "".join(
        f'<li><a href="#c{i}" data-i="{i}"><span class="t">{html.escape(h)}</span>'
        f'<span class="p" data-p="{i}"></span></a></li>'
        for i, h in toc
    )

    page = TEMPLATE.replace("{{TITLE}}", html.escape(title)) \
        .replace("{{SUBTITLE}}", html.escape(subtitle)) \
        .replace("{{TOC}}", toc_html) \
        .replace("{{CHAPTERS}}", "\n".join(sections))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(page, encoding="utf-8")
    boxes = page.count('type="checkbox"')
    print(f"{OUT} gerado: {len(chapters)} capítulos, {boxes} caixas de marcar, {len(page)} bytes")
    if len(chapters) < 5:
        sys.exit("poucos capítulos encontrados, verifique livro.md")


TEMPLATE = r"""<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{{TITLE}}</title>
<style>
:root{
  --bg:#0e0e10; --bg2:#17171b; --card:#1d1d22; --line:#2c2c33;
  --tx:#e9e6df; --tx2:#a9a59c; --acc:#c8243b; --acc2:#e0b65a;
  --fs:17px;
}
:root[data-theme="light"]{
  --bg:#f6f2ea; --bg2:#ece6da; --card:#fffdf8; --line:#d9d1c2;
  --tx:#1d1b18; --tx2:#5f5a51; --acc:#a3162b; --acc2:#8a6418;
}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{margin:0;background:var(--bg);color:var(--tx)}
body{font:var(--fs)/1.6 Georgia,"Noto Serif",serif;}
a{color:var(--acc2)}
/* Barra superior */
.bar{position:sticky;top:0;z-index:20;display:flex;align-items:center;gap:6px;
  padding:8px 10px;background:var(--bg2);border-bottom:1px solid var(--line);
  font-family:system-ui,Roboto,sans-serif}
.bar .name{flex:1;font-weight:700;font-size:15px;letter-spacing:.08em;text-transform:uppercase;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.btn{display:inline-flex;align-items:center;justify-content:center;background:none;border:1px solid var(--line);color:var(--tx);border-radius:10px;
  min-width:40px;height:40px;font-size:15px;font-weight:600;padding:0 10px;font-family:inherit}
.btn:active{background:var(--line)}
/* Capa */
#home{min-height:calc(100vh - 57px);display:flex;flex-direction:column;justify-content:center;
  padding:32px 22px;text-align:center}
.emblem{width:92px;height:92px;margin:0 auto 22px}
#home h1{font-family:system-ui,Roboto,sans-serif;font-size:34px;line-height:1.1;margin:0 0 12px;
  letter-spacing:.06em;text-transform:uppercase}
#home h1 b{color:var(--acc)}
#home .sub{color:var(--tx2);margin:0 auto 28px;max-width:420px}
.cta{display:block;width:100%;max-width:360px;margin:0 auto 12px;padding:15px;border-radius:12px;
  border:0;background:var(--acc);color:#fff;font:700 17px system-ui,Roboto,sans-serif}
.cta.alt{background:transparent;border:1px solid var(--line);color:var(--tx)}
.meter{max-width:360px;margin:22px auto 0;font:14px system-ui,Roboto,sans-serif;color:var(--tx2)}
.meter .track{height:8px;border-radius:8px;background:var(--line);overflow:hidden;margin-top:8px}
.meter .fill{height:100%;width:0;background:var(--acc2);transition:width .3s}
/* Capítulos */
.chapter{display:none;max-width:760px;margin:0 auto;padding:18px 18px 90px}
.chapter.on{display:block}
h2{font-family:system-ui,Roboto,sans-serif;font-size:1.55em;line-height:1.2;margin:.4em 0 .8em;
  padding-bottom:.4em;border-bottom:3px solid var(--acc)}
h3{font-family:system-ui,Roboto,sans-serif;font-size:1.12em;margin:1.8em 0 .5em;color:var(--acc2)}
p{margin:.7em 0}
li{margin:.35em 0}
strong{color:var(--tx)}
blockquote{margin:1em 0;padding:.6em 1em;border-left:4px solid var(--acc2);background:var(--card);
  border-radius:0 10px 10px 0;color:var(--tx2);font-style:italic}
.tw{overflow-x:auto;margin:1em -18px;padding:0 18px;-webkit-overflow-scrolling:touch}
table{border-collapse:collapse;font:14.5px/1.45 system-ui,Roboto,sans-serif;min-width:100%;width:max-content}
th,td{border:1px solid var(--line);padding:8px 10px;text-align:left;vertical-align:top;max-width:250px}
th{background:var(--bg2);color:var(--acc2);font-weight:700}
tr:nth-child(even) td{background:var(--card)}
td.done{text-align:center}
table.missions{width:100%}
.missions th,.missions td{max-width:none}
ul li.task{list-style:none;margin-left:-1.4em}
.task label{display:flex;gap:12px;align-items:flex-start;padding:8px 10px;margin:4px 0;border-radius:10px;
  background:var(--card);border:1px solid var(--line)}
input[type=checkbox]{width:22px;height:22px;flex:0 0 22px;margin:2px 0 0;accent-color:var(--acc)}
.task input:checked+span{color:var(--tx2);text-decoration:line-through}
.pager{display:flex;gap:10px;margin-top:36px}
.pager a{flex:1;display:block;padding:14px 12px;border-radius:12px;border:1px solid var(--line);
  text-decoration:none;color:var(--tx);font:600 14px system-ui,Roboto,sans-serif;background:var(--card)}
.pager a small{display:block;color:var(--tx2);font-weight:400;margin-bottom:2px}
.pager a.next{text-align:right}
/* Sumário */
#scrim{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:30;display:none}
#toc{position:fixed;top:0;bottom:0;left:0;width:min(86vw,360px);z-index:31;background:var(--bg2);
  transform:translateX(-102%);transition:transform .22s ease;overflow-y:auto;
  font-family:system-ui,Roboto,sans-serif;border-right:1px solid var(--line)}
body.toc-open #toc{transform:none}
body.toc-open #scrim{display:block}
#toc h4{margin:0;padding:18px 18px 10px;letter-spacing:.1em;text-transform:uppercase;font-size:13px;color:var(--tx2)}
#toc ul{list-style:none;margin:0;padding:0 8px 24px}
#toc a{display:flex;align-items:center;gap:8px;padding:12px 10px;border-radius:10px;color:var(--tx);
  text-decoration:none;font-size:15px}
#toc a.cur{background:var(--card);box-shadow:inset 3px 0 0 var(--acc)}
#toc .t{flex:1}
#toc .p{font-size:12px;color:var(--tx2);white-space:nowrap}
#toc .p.full{color:var(--acc2);font-weight:700}
#totop{position:fixed;right:14px;bottom:18px;z-index:10;display:none;width:46px;height:46px;border-radius:50%;
  border:1px solid var(--line);background:var(--bg2);color:var(--tx);font-size:20px}
</style>
</head>
<body>
<header class="bar">
  <button class="btn" id="menu" aria-label="Sumário">&#9776;</button>
  <span class="name" id="barname">{{TITLE}}</span>
  <button class="btn" id="fminus" aria-label="Diminuir letra">A&minus;</button>
  <button class="btn" id="fplus" aria-label="Aumentar letra">A+</button>
  <button class="btn" id="theme" aria-label="Trocar tema"><svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10 2a8 8 0 0 1 0 16z" fill="currentColor"/></svg></button>
</header>

<div id="scrim"></div>
<aside id="toc" aria-label="Sumário">
  <h4>Sumário</h4>
  <ul><li><a href="#inicio" data-i="-1"><span class="t">Capa</span></a></li>{{TOC}}</ul>
</aside>

<main>
  <section id="home">
    <svg class="emblem" viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="47" fill="none" stroke="var(--acc)" stroke-width="3"/>
      <path d="M50 14 L57 58 L50 66 L43 58 Z" fill="var(--tx)"/>
      <rect x="33" y="60" width="34" height="6" rx="3" fill="var(--acc2)"/>
      <rect x="46" y="66" width="8" height="16" rx="2" fill="var(--acc)"/>
      <circle cx="50" cy="85" r="4" fill="var(--acc2)"/>
    </svg>
    <h1>Manual do <b>Assassino</b></h1>
    <p class="sub">{{SUBTITLE}}</p>
    <button class="cta" id="go">Começar a ler</button>
    <button class="cta alt" id="open-toc">Ver sumário</button>
    <div class="meter"><span id="meter-txt">Treino concluído: 0%</span>
      <div class="track"><div class="fill" id="meter-fill"></div></div></div>
  </section>
  {{CHAPTERS}}
</main>
<button id="totop" aria-label="Voltar ao topo">&#8593;</button>

<script>
(function(){
  var KEY='manual-assassino.v1';
  var st={};
  try{st=JSON.parse(localStorage.getItem(KEY))||{};}catch(e){st={};}
  st.checks=st.checks||{}; st.scroll=st.scroll||{};
  function save(){try{localStorage.setItem(KEY,JSON.stringify(st));}catch(e){}}

  var root=document.documentElement;
  var chapters=[].slice.call(document.querySelectorAll('.chapter'));
  var titles=chapters.map(function(c){return c.querySelector('h2').textContent;});
  var boxes=[].slice.call(document.querySelectorAll('input[type=checkbox][data-k]'));
  var cur=-1;

  // Tema e tamanho da letra
  function applyLook(){
    root.setAttribute('data-theme',st.theme||'dark');
    root.style.setProperty('--fs',(st.fs||17)+'px');
  }
  applyLook();
  document.getElementById('theme').onclick=function(){st.theme=(st.theme==='light')?'dark':'light';applyLook();save();};
  document.getElementById('fplus').onclick=function(){st.fs=Math.min(26,(st.fs||17)+1);applyLook();save();};
  document.getElementById('fminus').onclick=function(){st.fs=Math.max(13,(st.fs||17)-1);applyLook();save();};

  // Caixas de marcar salvas
  boxes.forEach(function(b){
    b.checked=!!st.checks[b.dataset.k];
    b.addEventListener('change',function(){
      if(b.checked)st.checks[b.dataset.k]=1; else delete st.checks[b.dataset.k];
      save(); progress();
    });
  });
  function progress(){
    var total=0,done=0;
    chapters.forEach(function(c,i){
      var bs=c.querySelectorAll('input[type=checkbox][data-k]'),d=0;
      for(var j=0;j<bs.length;j++){if(bs[j].checked)d++;}
      total+=bs.length;done+=d;
      var el=document.querySelector('#toc .p[data-p="'+i+'"]');
      if(el){el.textContent=bs.length?d+'/'+bs.length:'';el.classList.toggle('full',bs.length>0&&d===bs.length);}
    });
    var pct=total?Math.round(done*100/total):0;
    document.getElementById('meter-txt').textContent='Treino concluído: '+pct+'% ('+done+' de '+total+' tarefas)';
    document.getElementById('meter-fill').style.width=pct+'%';
  }

  // Botões anterior / próximo
  chapters.forEach(function(c,i){
    var nav=c.querySelector('.pager'),h='';
    if(i>0)h+='<a class="prev" href="#c'+(i-1)+'"><small>&larr; Anterior</small>'+titles[i-1]+'</a>';
    else h+='<a class="prev" href="#inicio"><small>&larr; Voltar</small>Capa</a>';
    if(i<chapters.length-1)h+='<a class="next" href="#c'+(i+1)+'"><small>Próximo &rarr;</small>'+titles[i+1]+'</a>';
    nav.innerHTML=h;
  });

  // Navegação por endereço (#c3) para o botão voltar do Android funcionar
  function show(){
    var m=/^#c(\d+)$/.exec(location.hash),i=m?+m[1]:-1;
    if(i>=chapters.length)i=-1;
    if(cur>=0)st.scroll[cur]=window.scrollY;
    cur=i;
    document.getElementById('home').style.display=i<0?'':'none';
    chapters.forEach(function(c,j){c.classList.toggle('on',j===i);});
    [].forEach.call(document.querySelectorAll('#toc a'),function(a){a.classList.toggle('cur',+a.dataset.i===i);});
    document.getElementById('barname').textContent=i<0?'Manual do Assassino':titles[i];
    if(i>=0)st.last=i;
    save(); closeToc();
    window.scrollTo(0,i>=0&&st.scroll[i]?st.scroll[i]:0);
    updateHome();
  }
  function updateHome(){
    var go=document.getElementById('go');
    go.textContent=(st.last!=null)?'Continuar: '+titles[st.last]:'Começar a ler';
  }
  document.getElementById('go').onclick=function(){location.hash='#c'+(st.last!=null?st.last:0);};
  window.addEventListener('hashchange',show);

  // Sumário lateral
  function openToc(){document.body.classList.add('toc-open');}
  function closeToc(){document.body.classList.remove('toc-open');}
  document.getElementById('menu').onclick=function(){document.body.classList.contains('toc-open')?closeToc():openToc();};
  document.getElementById('open-toc').onclick=openToc;
  document.getElementById('scrim').onclick=closeToc;
  [].forEach.call(document.querySelectorAll('#toc a'),function(a){a.addEventListener('click',closeToc);});
  window.closeTocIfOpen=function(){if(document.body.classList.contains('toc-open')){closeToc();return true;}return false;};

  // Voltar ao topo e memória da posição de leitura
  var totop=document.getElementById('totop'),t=null;
  window.addEventListener('scroll',function(){
    totop.style.display=window.scrollY>900?'block':'none';
    clearTimeout(t);t=setTimeout(function(){if(cur>=0){st.scroll[cur]=window.scrollY;save();}},300);
  },{passive:true});
  totop.onclick=function(){window.scrollTo({top:0,behavior:'smooth'});};

  progress(); show();
})();
</script>
</body>
</html>
"""

if __name__ == "__main__":
    main()

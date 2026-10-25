"""Converte os livros em livros/*.md numa página HTML offline (android/assets/index.html)."""
import html
import re
import sys
from pathlib import Path

import markdown

ROOT = Path(__file__).parent
OUT = ROOT / "android" / "assets" / "index.html"

DAGGER = """
      <circle cx="50" cy="50" r="47" fill="none" stroke="var(--acc)" stroke-width="3"/>
      <path d="M50 14 L57 58 L50 66 L43 58 Z" fill="var(--tx)"/>
      <rect x="33" y="60" width="34" height="6" rx="3" fill="var(--acc2)"/>
      <rect x="46" y="66" width="8" height="16" rx="2" fill="var(--acc)"/>
      <circle cx="50" cy="85" r="4" fill="var(--acc2)"/>"""

AXE = """
      <circle cx="50" cy="50" r="47" fill="none" stroke="var(--acc)" stroke-width="3"/>
      <rect x="45" y="16" width="7" height="68" rx="3" fill="var(--acc2)"/>
      <path d="M52 22 C70 18 82 32 80 54 C72 46 62 44 52 47 Z" fill="var(--tx)"/>
      <path d="M45 26 C36 26 30 32 30 40 C35 37 40 37 45 39 Z" fill="var(--tx)"/>
      <circle cx="48.5" cy="86" r="4" fill="var(--acc)"/>"""

# A ordem aqui é a ordem na biblioteca. "store" é onde o progresso fica salvo no
# aparelho: não mude, ou o progresso já marcado some.
BOOKS = [
    dict(id="a", src="livros/manual-do-assassino.md", store="manual-assassino.v1",
         title_html="Manual do <b>Assassino</b>", emblem=DAGGER),
    dict(id="v", src="livros/codigo-do-viking.md", store="codigo-viking.v1",
         title_html="O Código do <b>Viking</b>", emblem=AXE),
]


def build_book(book):
    lines = (ROOT / book["src"]).read_text(encoding="utf-8").splitlines()
    # Título, subtítulo e linha de data/autor saem do corpo: viram a capa.
    title = lines[0].lstrip("# ").strip()
    subtitle = lines[2].strip("* ").strip()
    body = markdown.markdown("\n".join(lines[5:]), extensions=["tables", "sane_lists"])

    b = book["id"]
    chapters = [p for p in re.split(r"(?=<h2>)", body) if p.strip().startswith("<h2>")]
    sections, toc, boxes = [], [], 0
    for i, ch in enumerate(chapters):
        heading = re.sub(r"<[^>]+>", "", re.match(r"<h2>(.*?)</h2>", ch).group(1))

        # Listas de tarefas "[ ]" viram caixas de marcar que ficam salvas.
        n = [0]

        def checkbox(m):
            n[0] += 1
            return (f'<li class="task"><label><input type="checkbox" data-k="c{i}-{n[0]}">'
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

        boxes += ch.count('type="checkbox"')
        sections.append(f'<section class="chapter" id="{b}-c{i}" data-i="{i}">{ch}'
                        f'<nav class="pager"></nav></section>')
        toc.append(f'<li><a href="#{b}/{i}" data-i="{i}"><span class="t">{html.escape(heading)}</span>'
                   f'<span class="p" data-p="{i}"></span></a></li>')

    if len(chapters) < 5:
        sys.exit(f"{book['src']}: poucos capítulos encontrados")

    emblem = f'<svg class="emblem" viewBox="0 0 100 100" aria-hidden="true">{book["emblem"]}</svg>'
    data = f'data-book="{b}" data-store="{book["store"]}" data-title="{html.escape(title)}"'
    card = f"""
    <a class="card" href="#{b}" data-book="{b}">
      {emblem}
      <span class="ct">{book["title_html"]}</span>
      <span class="cs">{html.escape(subtitle)}</span>
      <span class="meter"><span class="mt" data-meter="{b}"></span>
        <span class="track"><span class="fill" data-fill="{b}"></span></span></span>
    </a>"""
    page = f"""
  <div class="book" id="book-{b}" {data}>
    <section class="home">
      {emblem}
      <h1>{book["title_html"]}</h1>
      <p class="sub">{html.escape(subtitle)}</p>
      <button class="cta go">Começar a ler</button>
      <button class="cta alt open-toc">Ver sumário</button>
      <div class="meter"><span class="mt" data-meter="{b}"></span>
        <div class="track"><div class="fill" data-fill="{b}"></div></div></div>
      <a class="back" href="#biblioteca">&larr; Biblioteca</a>
    </section>
    {"".join(sections)}
  </div>"""
    toc_html = (f'<ul class="toclist" data-book="{b}">'
                f'<li><a href="#biblioteca" data-i="-2"><span class="t">&larr; Biblioteca</span></a></li>'
                f'<li><a href="#{b}" data-i="-1"><span class="t">Capa</span></a></li>{"".join(toc)}</ul>')
    print(f"{book['src']}: {len(chapters)} seções, {boxes} caixas de marcar")
    return card, page, toc_html


def main():
    built = [build_book(bk) for bk in BOOKS]
    page = (TEMPLATE.replace("{{CARDS}}", "".join(c for c, _, _ in built))
            .replace("{{BOOKS}}", "".join(p for _, p, _ in built))
            .replace("{{TOC}}", "".join(t for _, _, t in built)))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(page, encoding="utf-8")
    print(f"{OUT} gerado: {len(page)} bytes")


TEMPLATE = r"""<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Biblioteca do Guerreiro</title>
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
[data-book="v"]{--acc:#4f86c6}
:root[data-theme="light"] [data-book="v"]{--acc:#2d5b8f}
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
.btn{display:inline-flex;align-items:center;justify-content:center;background:none;border:1px solid var(--line);
  color:var(--tx);border-radius:10px;min-width:40px;height:40px;font-size:15px;font-weight:600;padding:0 10px;font-family:inherit}
.btn:active{background:var(--line)}
body.at-lib #menu{visibility:hidden}
/* Biblioteca */
#lib{max-width:760px;margin:0 auto;padding:26px 18px 40px;font-family:system-ui,Roboto,sans-serif}
#lib h1{font-size:28px;letter-spacing:.08em;text-transform:uppercase;margin:6px 0 4px}
#lib .lead{color:var(--tx2);margin:0 0 22px;font-size:15px}
.card{display:grid;grid-template-columns:72px 1fr;gap:4px 16px;align-items:center;padding:18px;margin:0 0 14px;
  border-radius:16px;background:var(--card);border:1px solid var(--line);color:var(--tx);text-decoration:none;
  box-shadow:inset 4px 0 0 var(--acc)}
.card:active{background:var(--line)}
.card .emblem{width:72px;height:72px;margin:0;grid-row:span 2}
.card .ct{font-size:20px;font-weight:700;line-height:1.2;letter-spacing:.03em}
.card .ct b{color:var(--acc)}
.card .cs{font-size:14px;color:var(--tx2);line-height:1.4}
.card .meter{grid-column:1 / -1;margin:12px 0 0;max-width:none;text-align:left}
/* Capa do livro */
.home{min-height:calc(100vh - 57px);flex-direction:column;justify-content:center;
  padding:32px 22px;text-align:center}
.emblem{width:92px;height:92px;margin:0 auto 22px;display:block}
.home h1{font-family:system-ui,Roboto,sans-serif;font-size:34px;line-height:1.1;margin:0 0 12px;
  letter-spacing:.06em;text-transform:uppercase}
.home h1 b{color:var(--acc)}
.home .sub{color:var(--tx2);margin:0 auto 28px;max-width:420px}
.cta{display:block;width:100%;max-width:360px;margin:0 auto 12px;padding:15px;border-radius:12px;
  border:0;background:var(--acc);color:#fff;font:700 17px system-ui,Roboto,sans-serif}
.cta.alt{background:transparent;border:1px solid var(--line);color:var(--tx)}
.back{display:inline-block;margin:26px auto 0;font:600 15px system-ui,Roboto,sans-serif;text-decoration:none}
.meter{display:block;max-width:360px;margin:22px auto 0;font:14px system-ui,Roboto,sans-serif;color:var(--tx2)}
.meter .track{display:block;height:8px;border-radius:8px;background:var(--line);overflow:hidden;margin-top:8px}
.meter .fill{display:block;height:100%;width:0;background:var(--acc2);transition:width .3s}
/* Telas: só uma aparece por vez */
.book,.home,.chapter{display:none}
.book.on{display:block}
.book.on .home.on{display:flex}
.chapter.on{display:block}
/* Capítulos */
.chapter{max-width:760px;margin:0 auto;padding:18px 18px 90px}
h2{font-family:system-ui,Roboto,sans-serif;font-size:1.55em;line-height:1.2;margin:.4em 0 .8em;
  padding-bottom:.4em;border-bottom:3px solid var(--acc)}
h3{font-family:system-ui,Roboto,sans-serif;font-size:1.12em;margin:1.8em 0 .5em;color:var(--acc2)}
p{margin:.7em 0}
li{margin:.35em 0}
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
#toc ul{list-style:none;margin:0;padding:0 8px 24px;display:none}
#toc ul.on{display:block}
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
<body class="at-lib">
<header class="bar">
  <button class="btn" id="menu" aria-label="Sumário">&#9776;</button>
  <span class="name" id="barname">Biblioteca</span>
  <button class="btn" id="fminus" aria-label="Diminuir letra">A&minus;</button>
  <button class="btn" id="fplus" aria-label="Aumentar letra">A+</button>
  <button class="btn" id="theme" aria-label="Trocar tema"><svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10 2a8 8 0 0 1 0 16z" fill="currentColor"/></svg></button>
</header>

<div id="scrim"></div>
<aside id="toc" aria-label="Sumário">
  <h4>Sumário</h4>
  {{TOC}}
</aside>

<main>
  <section id="lib">
    <h1>Biblioteca</h1>
    <p class="lead">Escolha o livro. Seu progresso fica salvo em cada um.</p>
    {{CARDS}}
  </section>
  {{BOOKS}}
</main>
<button id="totop" aria-label="Voltar ao topo">&#8593;</button>

<script>
(function(){
  function load(k){try{return JSON.parse(localStorage.getItem(k))||{};}catch(e){return {};}}
  function put(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
  var root=document.documentElement,body=document.body;

  // Preferências gerais (tema e letra). Na versão 1.0 elas ficavam junto do Manual do Assassino.
  var prefs=load('app.prefs');
  if(prefs.theme==null&&prefs.fs==null){var old=load('manual-assassino.v1');prefs={theme:old.theme,fs:old.fs};}
  function savePrefs(){put('app.prefs',prefs);}
  function applyLook(){root.setAttribute('data-theme',prefs.theme||'dark');root.style.setProperty('--fs',(prefs.fs||17)+'px');}
  applyLook();
  document.getElementById('theme').onclick=function(){prefs.theme=(prefs.theme==='light')?'dark':'light';applyLook();savePrefs();};
  document.getElementById('fplus').onclick=function(){prefs.fs=Math.min(26,(prefs.fs||17)+1);applyLook();savePrefs();};
  document.getElementById('fminus').onclick=function(){prefs.fs=Math.max(13,(prefs.fs||17)-1);applyLook();savePrefs();};

  // Um registro por livro: tarefas marcadas, posição de leitura e último capítulo.
  var books={},order=[];
  [].forEach.call(document.querySelectorAll('.book'),function(el){
    var b=el.dataset.book,st=load(el.dataset.store);
    st.checks=st.checks||{};st.scroll=st.scroll||{};
    var chapters=[].slice.call(el.querySelectorAll('.chapter'));
    books[b]={id:b,el:el,st:st,store:el.dataset.store,title:el.dataset.title,home:el.querySelector('.home'),
      chapters:chapters,titles:chapters.map(function(c){return c.querySelector('h2').textContent;}),
      toc:document.querySelector('.toclist[data-book="'+b+'"]')};
    order.push(b);
  });
  function save(bk){put(bk.store,bk.st);}

  order.forEach(function(b){
    var bk=books[b];
    [].forEach.call(bk.el.querySelectorAll('input[type=checkbox][data-k]'),function(x){
      x.checked=!!bk.st.checks[x.dataset.k];
      x.addEventListener('change',function(){
        if(x.checked)bk.st.checks[x.dataset.k]=1; else delete bk.st.checks[x.dataset.k];
        save(bk);progress(bk);
      });
    });
    bk.chapters.forEach(function(c,i){
      var h='';
      if(i>0)h+='<a class="prev" href="#'+b+'/'+(i-1)+'"><small>&larr; Anterior</small>'+bk.titles[i-1]+'</a>';
      else h+='<a class="prev" href="#'+b+'"><small>&larr; Voltar</small>Capa</a>';
      if(i<bk.chapters.length-1)h+='<a class="next" href="#'+b+'/'+(i+1)+'"><small>Próximo &rarr;</small>'+bk.titles[i+1]+'</a>';
      c.querySelector('.pager').innerHTML=h;
    });
    bk.home.querySelector('.go').onclick=function(){location.hash='#'+b+'/'+(bk.st.last!=null?bk.st.last:0);};
    bk.home.querySelector('.open-toc').onclick=openToc;
    progress(bk);
  });

  function progress(bk){
    var total=0,done=0;
    bk.chapters.forEach(function(c,i){
      var bs=c.querySelectorAll('input[type=checkbox][data-k]'),d=0;
      for(var j=0;j<bs.length;j++){if(bs[j].checked)d++;}
      total+=bs.length;done+=d;
      var el=bk.toc.querySelector('.p[data-p="'+i+'"]');
      if(el){el.textContent=bs.length?d+'/'+bs.length:'';el.classList.toggle('full',bs.length>0&&d===bs.length);}
    });
    var pct=total?Math.round(done*100/total):0;
    [].forEach.call(document.querySelectorAll('[data-meter="'+bk.id+'"]'),function(e){e.textContent='Treino concluído: '+pct+'% ('+done+' de '+total+' tarefas)';});
    [].forEach.call(document.querySelectorAll('[data-fill="'+bk.id+'"]'),function(e){e.style.width=pct+'%';});
  }

  // Endereços: #biblioteca, #a (capa), #a/3 (capítulo). O botão voltar do Android segue esse histórico.
  var cur={b:null,i:-1};
  function route(){
    var h=location.hash;
    var legacy=/^#c(\d+)$/.exec(h);
    if(legacy){location.replace('#a/'+legacy[1]);return null;}
    var m=/^#([a-z])(?:\/(\d+))?$/.exec(h);
    if(!m||!books[m[1]])return {b:null,i:-1};
    var i=m[2]==null?-1:+m[2];
    if(i>=books[m[1]].chapters.length)i=-1;
    return {b:m[1],i:i};
  }
  function show(){
    var r=route();if(!r)return;
    if(cur.b&&cur.i>=0){books[cur.b].st.scroll[cur.i]=window.scrollY;save(books[cur.b]);}
    cur=r;
    var bk=r.b?books[r.b]:null;
    document.getElementById('lib').style.display=bk?'none':'';
    body.classList.toggle('at-lib',!bk);
    if(bk)body.setAttribute('data-book',bk.id); else body.removeAttribute('data-book');
    order.forEach(function(b){
      var x=books[b],on=(x===bk);
      x.el.classList.toggle('on',on);
      x.home.classList.toggle('on',on&&r.i<0);
      x.chapters.forEach(function(c,j){c.classList.toggle('on',on&&j===r.i);});
      x.toc.classList.toggle('on',on);
    });
    var name='Biblioteca';
    if(bk){
      name=r.i<0?bk.title:bk.titles[r.i];
      [].forEach.call(bk.toc.querySelectorAll('a'),function(a){a.classList.toggle('cur',+a.dataset.i===r.i);});
      if(r.i>=0){bk.st.last=r.i;save(bk);}
      bk.home.querySelector('.go').textContent=(bk.st.last!=null)?'Continuar: '+bk.titles[bk.st.last]:'Começar a ler';
    }
    document.getElementById('barname').textContent=name;
    closeToc();
    window.scrollTo(0,bk&&r.i>=0&&bk.st.scroll[r.i]?bk.st.scroll[r.i]:0);
  }
  window.addEventListener('hashchange',show);

  // Sumário lateral
  function openToc(){if(cur.b)body.classList.add('toc-open');}
  function closeToc(){body.classList.remove('toc-open');}
  document.getElementById('menu').onclick=function(){body.classList.contains('toc-open')?closeToc():openToc();};
  document.getElementById('scrim').onclick=closeToc;
  [].forEach.call(document.querySelectorAll('#toc a'),function(a){a.addEventListener('click',closeToc);});
  window.closeTocIfOpen=function(){if(body.classList.contains('toc-open')){closeToc();return true;}return false;};

  // Voltar ao topo e memória da posição de leitura
  var totop=document.getElementById('totop'),t=null;
  window.addEventListener('scroll',function(){
    totop.style.display=window.scrollY>900?'block':'none';
    clearTimeout(t);t=setTimeout(function(){if(cur.b&&cur.i>=0){books[cur.b].st.scroll[cur.i]=window.scrollY;save(books[cur.b]);}},300);
  },{passive:true});
  totop.onclick=function(){window.scrollTo({top:0,behavior:'smooth'});};

  show();
})();
</script>
</body>
</html>
"""

if __name__ == "__main__":
    main()

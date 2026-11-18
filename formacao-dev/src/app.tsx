import { useEffect, useState } from 'preact/hooks';
import { useAppState } from './engine/store';
import { Today, Track, SessionView, AllLessons } from './ui/today';
import { LessonView } from './ui/lesson';
import { Practice, Review, Reinforce, Lab, Labs, Assessment } from './ui/practice';
import { Progress, AreaView } from './ui/progress';
import { More, Resources, Projects, ProjectView, Library, Glossary, Career, Settings, Onboarding } from './ui/more';
import type { AreaId } from './data/types';
import { EX_BY_ID } from './engine/progress';
import { ExerciseView } from './ui/exercise';
import { Header } from './ui/components';

function useHash() {
  const [h, setH] = useState(location.hash.slice(1) || '/hoje');
  useEffect(() => { const f = () => { setH(location.hash.slice(1) || '/hoje'); }; addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  return h;
}

const TABS: [string, string, string][] = [['/hoje', '🏠', 'Hoje'], ['/trilha', '🗓', 'Trilha'], ['/praticar', '🧪', 'Prática'], ['/progresso', '📈', 'Progresso'], ['/mais', '☰', 'Mais']];

export function App() {
  const st = useAppState();
  const path = useHash();
  useEffect(() => {
    const dark = st.theme === 'dark' || (st.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  }, [st.theme]);
  useEffect(() => { window.scrollTo(0, 0); }, [path]);

  if (!st.onboarded) return <main class="screen"><Onboarding /></main>;

  const [, a, b] = path.split('/');
  let view;
  switch (a) {
    case 'hoje': view = <Today />; break;
    case 'trilha': view = <Track />; break;
    case 'sessao': view = <SessionView id={b} />; break;
    case 'aula': view = <LessonView key={b} id={b} />; break;
    case 'aulas': view = <AllLessons />; break;
    case 'praticar': view = <Practice />; break;
    case 'revisao': view = <Review />; break;
    case 'reforco': view = <Reinforce key={b} comp={b} />; break;
    case 'labs': view = <Labs />; break;
    case 'lab': view = <Lab key={b} kind={b} />; break;
    case 'avaliacao': view = <Assessment key={b} n={Number(b) as 1 | 2 | 3} />; break;
    case 'exercicio': view = EX_BY_ID[b] ? <div><Header title="Exercício" back /><ExerciseView key={b} ex={EX_BY_ID[b].ex} /></div> : <Today />; break;
    case 'progresso': view = <Progress />; break;
    case 'area': view = <AreaView id={b as AreaId} />; break;
    case 'mais': view = <More />; break;
    case 'recursos': view = <Resources />; break;
    case 'projetos': view = <Projects />; break;
    case 'projeto': view = <ProjectView id={b} />; break;
    case 'biblioteca': view = <Library />; break;
    case 'glossario': view = <Glossary />; break;
    case 'carreira': view = <Career />; break;
    case 'ajustes': view = <Settings />; break;
    default: view = <Today />;
  }
  const tab = '/' + a;
  return (
    <>
      <main class="screen">{view}</main>
      <nav class="tabbar" aria-label="Navegação principal">
        {TABS.map(([p, i, t]) => <a href={'#' + p} class={tab === p || (p === '/trilha' && (a === 'sessao' || a === 'aula')) ? 'active' : ''}><span class="tab-icon">{i}</span><span>{t}</span></a>)}
      </nav>
    </>
  );
}

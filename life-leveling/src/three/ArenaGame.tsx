import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Environment } from './Stage';
import { Avatar, type AvatarAnim } from './Avatar';
import { createCombat, stepCombat, type CombatState, type DungeonDef, type Enemy, type Input, type SkillSlot, type CombatStats, ARENA_RADIUS } from '../core/combat';
import type { Character } from '../core/types';
import { sfx, startMusic, stopMusic } from '../services/audio';

interface Props {
  dungeon: DungeonDef;
  stats: CombatStats;
  skills: SkillSlot[];
  character: Character;
  classColor: string;
  quality: 'alto' | 'medio' | 'baixo';
  onEnd: (won: boolean, c: CombatState) => void;
  onExit: () => void;
}

type Pressed = { attack: boolean; heavy: boolean; dodge: boolean; skill1: boolean; skill2: boolean };

export function ArenaGame({ dungeon, stats, skills, character, classColor, quality, onEnd, onExit }: Props) {
  const combat = useRef<CombatState>(createCombat(dungeon, stats, skills, Date.now() & 0xffff));
  const move = useRef({ x: 0, z: 0 });
  const pressed = useRef<Pressed>({ attack: false, heavy: false, dodge: false, skill1: false, skill2: false });
  const keys = useRef<Record<string, boolean>>({});
  const [, force] = useState(0);
  const [paused, setPaused] = useState(false);
  const ended = useRef(false);
  const texts = useRef<HTMLDivElement>(null!);

  useEffect(() => {
    startMusic('combate');
    const id = setInterval(() => force((x) => x + 1), 100);
    const kd = (e: KeyboardEvent) => {
      keys.current[e.key.toLowerCase()] = true;
      const k = e.key.toLowerCase();
      if (k === 'j') pressed.current.attack = true;
      if (k === 'k') pressed.current.heavy = true;
      if (k === ' ' || k === 'shift') pressed.current.dodge = true;
      if (k === 'u') pressed.current.skill1 = true;
      if (k === 'i') pressed.current.skill2 = true;
      if (k === 'escape') setPaused((p) => !p);
    };
    const ku = (e: KeyboardEvent) => { keys.current[e.key.toLowerCase()] = false; };
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    return () => { clearInterval(id); window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); stopMusic(); startMusic('calmo'); };
  }, []);

  const c = combat.current;
  const p = c.player;
  if (c.status !== 'playing' && !ended.current) {
    ended.current = true;
    setTimeout(() => onEnd(c.status === 'won', c), 50);
  }
  const boss = c.enemies.find((e) => e.kind === 'chefe' && e.state !== 'dead');
  const restart = () => { combat.current = createCombat(dungeon, stats, skills, Date.now() & 0xffff); ended.current = false; setPaused(false); force((x) => x + 1); };

  return (
    <div className="arena">
      <Canvas dpr={quality === 'alto' ? [1, 2] : quality === 'medio' ? [1, 1.5] : [0.7, 1]} camera={{ position: [0, 9, -12], fov: 45 }} gl={{ antialias: quality !== 'baixo' }}>
        <Environment scene="coliseu" quality={quality} />
        <ArenaBoundary />
        <World combat={combat} move={move} pressed={pressed} keys={keys} paused={paused} character={character} classColor={classColor} quality={quality} textsEl={texts} />
      </Canvas>
      <div className="arena-texts" ref={texts} />
      {/* HUD */}
      <div className="hud-top">
        <button className="icon-btn" onClick={() => setPaused(true)} aria-label="Pausar">❚❚</button>
        <div className="hud-bars">
          <div className="bar hp"><i style={{ width: `${(p.hp / stats.hp) * 100}%` }} /><span>{Math.ceil(p.hp)} / {stats.hp}</span></div>
          <div className="bar en"><i style={{ width: `${(p.energy / stats.maxEnergy) * 100}%` }} /><span>Energia {Math.floor(p.energy)}</span></div>
        </div>
        <div className="hud-wave">{c.wave < 0 ? 'Prepare-se' : `Onda ${Math.min(c.wave + 1, dungeon.waves.length)}/${dungeon.waves.length}`}<small>{c.kills} abates · {Math.floor(c.t)}s</small></div>
      </div>
      {boss && (
        <div className="boss-bar">
          <div className="boss-name">GUARDIÃO DA FENDA {boss.hp / boss.maxHp < 0.3 ? '· ENFURECIDO' : boss.hp / boss.maxHp < 0.6 ? '· FASE 2' : '· FASE 1'}</div>
          <div className="bar boss"><i style={{ width: `${(boss.hp / boss.maxHp) * 100}%` }} /></div>
        </div>
      )}
      {c.log.length > 0 && c.t < 999 && <div className="arena-log" key={c.log.length}>{c.log[c.log.length - 1]}</div>}
      <Joystick onMove={(x, y) => { move.current = { x: -x, z: -y }; }} />
      <div className="arena-buttons">
        {skills.map((sk, i) => {
          const cd = p.cooldowns[i];
          const ready = cd <= 0 && p.energy >= sk.energy;
          return (
            <button key={sk.id} className={`abtn skill ${ready ? 'ready' : ''}`} onPointerDown={(e) => { e.preventDefault(); pressed.current[i === 0 ? 'skill1' : 'skill2'] = true; }}>
              <span>{sk.name.split(' ')[0]}</span>
              {cd > 0 && <b className="cd" style={{ height: `${(cd / sk.cooldown) * 100}%` }} />}
              <small>{sk.energy}⚡</small>
            </button>
          );
        })}
        <button className="abtn dodge" onPointerDown={(e) => { e.preventDefault(); pressed.current.dodge = true; }}>Esquiva</button>
        <button className="abtn heavy" onPointerDown={(e) => { e.preventDefault(); pressed.current.heavy = true; }}>Pesado</button>
        <button className="abtn attack" onPointerDown={(e) => { e.preventDefault(); pressed.current.attack = true; }}>Atacar</button>
      </div>
      {skills.length === 0 && <div className="arena-hint">Dica: aprenda talentos ativos (Herói → Talentos) para ganhar habilidades especiais.</div>}
      {paused && c.status === 'playing' && (
        <div className="modal-back"><div className="panel modal">
          <h2>Pausado</h2>
          <p className="muted">Controles: arraste o joystick para mover. No teclado: WASD move, J ataca, K golpe pesado, Espaço esquiva, U/I habilidades.</p>
          <div className="row gap"><button className="btn primary" onClick={() => setPaused(false)}>Continuar</button><button className="btn" onClick={restart}>Reiniciar</button><button className="btn ghost" onClick={onExit}>Sair</button></div>
        </div></div>
      )}
      {c.status !== 'playing' && (
        <div className="modal-back"><div className={`panel modal result ${c.status}`}>
          <h1>{c.status === 'won' ? 'FENDA FECHADA' : 'VOCÊ CAIU'}</h1>
          <p>{c.kills} abates · {Math.round(c.damageDealt)} de dano · {Math.floor(c.t)}s</p>
          <p className="muted">{c.status === 'won' ? 'A vitória foi registrada no seu histórico.' : 'Derrotas na arena nunca tiram progresso. Evolua na vida real para ficar mais forte, ou tente outra estratégia.'}</p>
          <div className="row gap"><button className="btn primary" onClick={restart}>Jogar de novo</button><button className="btn" onClick={onExit}>Voltar</button></div>
        </div></div>
      )}
    </div>
  );
}

function ArenaBoundary() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
      <ringGeometry args={[ARENA_RADIUS, ARENA_RADIUS + 0.15, 96]} />
      <meshBasicMaterial color="#ff4d8d" toneMapped={false} transparent opacity={0.8} />
    </mesh>
  );
}

function World({ combat, move, pressed, keys, paused, character, classColor, quality, textsEl }: {
  combat: React.MutableRefObject<CombatState>; move: React.MutableRefObject<{ x: number; z: number }>; pressed: React.MutableRefObject<Pressed>;
  keys: React.MutableRefObject<Record<string, boolean>>; paused: boolean; character: Character; classColor: string; quality: 'alto' | 'medio' | 'baixo';
  textsEl: React.MutableRefObject<HTMLDivElement>;
}) {
  const player = useRef<THREE.Group>(null!);
  const animRef = useRef<{ anim: AvatarAnim; t: number; combo?: number }>({ anim: 'idle', t: 0 });
  const { camera, size } = useThree();
  const [ids, setIds] = useState<string>('');
  const lastHp = useRef<Record<number, number>>({});
  const lastPlayerHp = useRef(combat.current.player.hp);
  const lastAction = useRef('idle');

  useFrame((_, dt) => {
    const c = combat.current;
    if (!paused) {
      const k = keys.current;
      const kx = (k['a'] || k['arrowleft'] ? 1 : 0) - (k['d'] || k['arrowright'] ? 1 : 0);
      const kz = (k['w'] || k['arrowup'] ? 1 : 0) - (k['s'] || k['arrowdown'] ? 1 : 0);
      const input: Input = { moveX: move.current.x || kx, moveZ: move.current.z || kz, ...pressed.current };
      stepCombat(c, input, dt);
      pressed.current = { attack: false, heavy: false, dodge: false, skill1: false, skill2: false };
    }
    const p = c.player;
    // Sons por evento
    if (p.action !== lastAction.current) {
      if (p.action === 'attack') sfx('hit'); else if (p.action === 'heavy') sfx('heavy'); else if (p.action === 'dodge') sfx('dodge'); else if (p.action === 'skill') sfx('skill');
      lastAction.current = p.action;
    }
    if (p.hp < lastPlayerHp.current) sfx('hurt');
    lastPlayerHp.current = p.hp;
    for (const e of c.enemies) { const prev = lastHp.current[e.id]; if (prev !== undefined && e.hp < prev && e.kind === 'chefe' && e.hp <= 0) sfx('boss'); lastHp.current[e.id] = e.hp; }

    if (player.current) {
      player.current.position.set(p.pos.x, 0, p.pos.z);
      player.current.rotation.y = p.facing;
    }
    const map: Record<string, AvatarAnim> = { idle: 'idle', run: 'run', attack: 'attack', heavy: 'heavy', dodge: 'dodge', skill: 'skill', hit: 'hit', dead: 'dead', victory: 'victory' };
    animRef.current.anim = map[p.action];
    animRef.current.t = p.actionT;
    animRef.current.combo = p.combo;
    // Câmera
    const shake = c.shake * 0.25;
    const portrait = size.height > size.width;
    const target = new THREE.Vector3(p.pos.x * 0.9, portrait ? 7 : 8.5, p.pos.z - (portrait ? 6.5 : 9.5));
    camera.position.lerp(target, 1 - Math.exp(-5 * dt));
    camera.position.x += (Math.random() - 0.5) * shake; camera.position.y += (Math.random() - 0.5) * shake;
    camera.lookAt(p.pos.x * 0.9, 0.6, p.pos.z + (size.height > size.width ? 3 : 1.5));
    // Lista de inimigos (re-render só quando muda)
    const key = c.enemies.map((e) => e.id).join(',') + '|' + c.projectiles.length + '|' + c.fx.map((f) => f.id).join(',');
    if (key !== ids) setIds(key);
    // Números de dano projetados na tela
    const el = textsEl.current;
    if (el) {
      let html = '';
      for (const tx of c.texts) {
        const v = new THREE.Vector3(tx.pos.x, 2 + tx.t * 1.4, tx.pos.z).project(camera);
        const x = (v.x * 0.5 + 0.5) * size.width; const y = (-v.y * 0.5 + 0.5) * size.height;
        html += `<span style="left:${x}px;top:${y}px;color:${tx.color};opacity:${1 - tx.t / 0.9};font-size:${tx.big ? 26 : 18}px">${tx.text}</span>`;
      }
      el.innerHTML = html;
    }
  });

  const c = combat.current;
  return (
    <>
      <group ref={player}>
        <Avatar appearance={character.appearance} equipped={character.equipped} classColor={classColor} animRef={animRef} quality={quality} rankGlow={0.3} />
        <ShieldBubble combat={combat} />
      </group>
      {c.enemies.map((e) => <EnemyMesh key={e.id} e={e} />)}
      {c.projectiles.map((pr) => <Projectile key={pr.id} combat={combat} id={pr.id} />)}
      {c.fx.map((f) => <FxMesh key={f.id} combat={combat} id={f.id} />)}
    </>
  );
}

function ShieldBubble({ combat }: { combat: React.MutableRefObject<CombatState> }) {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame(() => { if (ref.current) ref.current.visible = combat.current.player.shieldT > 0; });
  return <mesh ref={ref} position={[0, 1, 0]} visible={false}><sphereGeometry args={[1.1, 24, 16]} /><meshBasicMaterial color="#5fd38d" transparent opacity={0.18} blending={THREE.AdditiveBlending} depthWrite={false} /></mesh>;
}

function EnemyMesh({ e }: { e: Enemy }) {
  const g = useRef<THREE.Group>(null!);
  const body = useRef<THREE.MeshStandardMaterial>(null!);
  const arm = useRef<THREE.Group>(null!);
  const colors = { sombra: '#1a1028', bruto: '#2a1414', atirador: '#0f1f2a', chefe: '#1a0a14' };
  const eyes = { sombra: '#b06bff', bruto: '#ff5d3d', atirador: '#4cc9ff', chefe: '#ff2a6a' };
  const scale = e.kind === 'chefe' ? 2.1 : e.kind === 'bruto' ? 1.45 : 1;
  useFrame((st, dt) => {
    if (!g.current) return;
    const t = st.clock.elapsedTime;
    g.current.position.x += (e.pos.x - g.current.position.x) * Math.min(1, dt * 20);
    g.current.position.z += (e.pos.z - g.current.position.z) * Math.min(1, dt * 20);
    g.current.rotation.y = e.facing;
    if (e.state === 'dead') {
      g.current.position.y = -e.deadT * 1.5;
      g.current.scale.setScalar(scale * Math.max(0, 1 - e.deadT * 1.6));
    } else {
      g.current.position.y = e.kind === 'atirador' ? 0.4 + Math.sin(t * 3 + e.id) * 0.15 : 0;
      g.current.scale.setScalar(scale * (e.state === 'windup' ? 1.06 : 1));
    }
    if (body.current) body.current.emissiveIntensity = e.hitFlash > 0 ? 3 : e.state === 'windup' ? 0.9 + Math.sin(t * 30) * 0.4 : 0.25;
    if (body.current) body.current.emissive.set(e.hitFlash > 0 ? '#ffffff' : e.state === 'windup' ? '#ff2244' : eyes[e.kind]);
    if (arm.current) arm.current.rotation.x = e.state === 'windup' ? -2.2 : e.state === 'attack' ? 0.6 : Math.sin(t * 6 + e.id) * 0.3;
  });
  const hpPct = e.hp / e.maxHp;
  return (
    <group ref={g} position={[e.pos.x, 0, e.pos.z]}>
      {e.kind === 'atirador' ? (
        <mesh position={[0, 1.2, 0]}><octahedronGeometry args={[0.45, 0]} /><meshStandardMaterial ref={body} color={colors[e.kind]} metalness={0.6} roughness={0.2} emissive={eyes[e.kind]} /></mesh>
      ) : (
        <>
          <mesh position={[0, 0.75, 0]}><capsuleGeometry args={[e.kind === 'bruto' ? 0.42 : 0.3, 0.7, 6, 12]} /><meshStandardMaterial ref={body} color={colors[e.kind]} roughness={0.7} emissive={eyes[e.kind]} /></mesh>
          <mesh position={[0, 1.45, 0.05]}><sphereGeometry args={[0.24, 16, 12]} /><meshStandardMaterial color={colors[e.kind]} roughness={0.6} /></mesh>
          {[-1, 1].map((s) => <mesh key={s} position={[0.08 * s, 1.5, 0.22]}><sphereGeometry args={[0.035, 8, 6]} /><meshBasicMaterial color={eyes[e.kind]} toneMapped={false} /></mesh>)}
          <group ref={arm} position={[0.38, 1.1, 0]}><mesh position={[0, -0.3, 0.1]}><capsuleGeometry args={[0.08, 0.5, 4, 8]} /><meshStandardMaterial color={colors[e.kind]} /></mesh><mesh position={[0, -0.65, 0.15]}><coneGeometry args={[0.07, 0.3, 6]} /><meshBasicMaterial color={eyes[e.kind]} toneMapped={false} /></mesh></group>
          <group position={[-0.38, 1.1, 0]}><mesh position={[0, -0.3, 0]}><capsuleGeometry args={[0.08, 0.5, 4, 8]} /><meshStandardMaterial color={colors[e.kind]} /></mesh></group>
          {e.kind === 'chefe' && (
            <>
              {[-1, 1].map((s) => <mesh key={s} position={[0.18 * s, 1.72, 0]} rotation={[0, 0, -0.5 * s]}><coneGeometry args={[0.06, 0.45, 6]} /><meshStandardMaterial color="#0a0508" emissive="#ff2a6a" emissiveIntensity={0.6} /></mesh>)}
              <mesh position={[0, 2.05, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.32, 0.025, 6, 32]} /><meshBasicMaterial color="#ff2a6a" toneMapped={false} /></mesh>
              <pointLight position={[0, 1.5, 0.5]} color="#ff2a6a" intensity={6} distance={5} />
            </>
          )}
        </>
      )}
      {e.state !== 'dead' && e.kind !== 'chefe' && hpPct < 1 && (
        <mesh position={[0, 2.05, 0]}><planeGeometry args={[0.8 * hpPct, 0.07]} /><meshBasicMaterial color="#ff5d73" toneMapped={false} side={THREE.DoubleSide} /></mesh>
      )}
      {e.rootedT > 0 && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}><ringGeometry args={[0.45, 0.6, 24]} /><meshBasicMaterial color="#ffd166" toneMapped={false} /></mesh>}
    </group>
  );
}

function Projectile({ combat, id }: { combat: React.MutableRefObject<CombatState>; id: number }) {
  const ref = useRef<THREE.Mesh>(null!);
  const pr = combat.current.projectiles.find((x) => x.id === id);
  const color = pr?.from === 'player' ? '#4cc9ff' : '#ff3d6a';
  useFrame(() => {
    const p = combat.current.projectiles.find((x) => x.id === id);
    if (ref.current && p) ref.current.position.set(p.pos.x, 1.1, p.pos.z);
  });
  return <mesh ref={ref}><sphereGeometry args={[pr?.from === 'player' ? 0.35 : 0.22, 12, 8]} /><meshBasicMaterial color={color} toneMapped={false} /></mesh>;
}

function FxMesh({ combat, id }: { combat: React.MutableRefObject<CombatState>; id: number }) {
  const ref = useRef<THREE.Mesh>(null!);
  const mat = useRef<THREE.MeshBasicMaterial>(null!);
  const f0 = useMemo(() => combat.current.fx.find((x) => x.id === id), [combat, id]);
  useFrame(() => {
    const f = combat.current.fx.find((x) => x.id === id);
    if (!f || !ref.current) return;
    const k = f.t / f.life;
    if (f.kind === 'ring' || f.kind === 'root' || f.kind === 'heal') ref.current.scale.setScalar(0.2 + k * 0.8);
    if (f.kind === 'telegraph') ref.current.scale.setScalar(k);
    if (f.kind === 'shield') { const p = combat.current.player.pos; ref.current.position.set(p.x, 0.04, p.z); }
    if (mat.current) mat.current.opacity = f.kind === 'telegraph' ? 0.35 + k * 0.4 : Math.max(0, 1 - k) * 0.85;
  });
  if (!f0) return null;
  const pos: [number, number, number] = [f0.pos.x, f0.kind === 'slash' ? 1 : 0.05, f0.pos.z];
  if (f0.kind === 'slash') {
    return (
      <mesh ref={ref} position={pos} rotation={[-Math.PI / 2, 0, -(f0.angle ?? 0) + Math.PI / 2]}>
        <ringGeometry args={[f0.radius * 0.55, f0.radius, 24, 1, -0.9, 1.8]} />
        <meshBasicMaterial ref={mat} color={f0.color} transparent toneMapped={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    );
  }
  if (f0.kind === 'dash') {
    const a = f0.angle ?? 0;
    return (
      <mesh ref={ref} position={[f0.pos.x + Math.sin(a) * f0.radius * 0.5, 0.6, f0.pos.z + Math.cos(a) * f0.radius * 0.5]} rotation={[0, a, 0]}>
        <boxGeometry args={[0.15, 0.6, f0.radius]} />
        <meshBasicMaterial ref={mat} color={f0.color} transparent toneMapped={false} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    );
  }
  if (f0.kind === 'burst') {
    return <mesh ref={ref} position={[f0.pos.x, 1, f0.pos.z]}><sphereGeometry args={[f0.radius, 16, 12]} /><meshBasicMaterial ref={mat} color={f0.color} transparent toneMapped={false} blending={THREE.AdditiveBlending} depthWrite={false} /></mesh>;
  }
  return (
    <mesh ref={ref} position={pos} rotation={[-Math.PI / 2, 0, 0]}>
      {f0.kind === 'telegraph' ? <circleGeometry args={[f0.radius, 32]} /> : <ringGeometry args={[f0.radius * 0.85, f0.radius, 48]} />}
      <meshBasicMaterial ref={mat} color={f0.color} transparent toneMapped={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
    </mesh>
  );
}

function Joystick({ onMove }: { onMove: (x: number, y: number) => void }) {
  const base = useRef<HTMLDivElement>(null!);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const active = useRef<number | null>(null);
  const handle = (e: React.PointerEvent) => {
    const r = base.current.getBoundingClientRect();
    const cx = r.left + r.width / 2; const cy = r.top + r.height / 2;
    let dx = e.clientX - cx; let dy = e.clientY - cy;
    const max = r.width / 2; const d = Math.hypot(dx, dy);
    if (d > max) { dx = (dx / d) * max; dy = (dy / d) * max; }
    setKnob({ x: dx, y: dy });
    onMove(dx / max, dy / max);
  };
  return (
    <div className="joystick" ref={base}
      onPointerDown={(e) => { active.current = e.pointerId; (e.target as HTMLElement).setPointerCapture(e.pointerId); handle(e); }}
      onPointerMove={(e) => { if (active.current === e.pointerId) handle(e); }}
      onPointerUp={() => { active.current = null; setKnob({ x: 0, y: 0 }); onMove(0, 0); }}
      onPointerCancel={() => { active.current = null; setKnob({ x: 0, y: 0 }); onMove(0, 0); }}>
      <div className="knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
  );
}

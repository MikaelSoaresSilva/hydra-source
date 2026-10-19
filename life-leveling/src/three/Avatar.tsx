// Avatar 3D procedural: esqueleto hierárquico (quadril → tronco → braços/pernas/cabeça)
// animado por código (repouso, caminhada, corrida, ataques, vitória). Equipamentos mudam
// malhas, materiais e efeitos. Nada de imagem plana: é geometria real renderizada por WebGL.
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Appearance, Slot } from '../core/types';
import { ITEM_MAP, RARITY_INFO } from '../data/items';

export type AvatarAnim = 'idle' | 'walk' | 'run' | 'victory' | 'attack' | 'heavy' | 'dodge' | 'skill' | 'hit' | 'dead' | 'pose';

export interface AvatarProps {
  appearance: Appearance;
  equipped: Partial<Record<Slot, string>>;
  classColor: string;
  anim?: AvatarAnim;
  animRef?: React.MutableRefObject<{ anim: AvatarAnim; t: number; combo?: number }>;
  rankGlow?: number; // 0..1 intensidade de aura por rank
  quality?: 'alto' | 'medio' | 'baixo';
}

function mat(color: string, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1, ...opts });
}

export function Avatar({ appearance: ap, equipped, classColor, anim = 'idle', animRef, rankGlow = 0, quality = 'medio' }: AvatarProps) {
  const root = useRef<THREE.Group>(null!);
  const hips = useRef<THREE.Group>(null!);
  const chest = useRef<THREE.Group>(null!);
  const head = useRef<THREE.Group>(null!);
  const armL = useRef<THREE.Group>(null!);
  const armR = useRef<THREE.Group>(null!);
  const foreL = useRef<THREE.Group>(null!);
  const foreR = useRef<THREE.Group>(null!);
  const legL = useRef<THREE.Group>(null!);
  const legR = useRef<THREE.Group>(null!);
  const shinL = useRef<THREE.Group>(null!);
  const shinR = useRef<THREE.Group>(null!);
  const weapon = useRef<THREE.Group>(null!);
  const companion = useRef<THREE.Group>(null!);
  const local = useRef({ t: 0 });

  const it = (slot: Slot) => (equipped[slot] ? ITEM_MAP[equipped[slot]!] : undefined);
  const armor = it('armadura'); const gloves = it('luvas'); const boots = it('botas'); const wpn = it('arma');
  const aura = it('aura'); const cape = it('traje'); const emblem = it('emblema'); const comp = it('companheiro'); const acc = it('acessorio');
  const pose = it('animacao');

  const m = useMemo(() => {
    const skin = mat(ap.skin, { roughness: 0.75 });
    const hair = mat(ap.hair, { roughness: 0.85 });
    const torso = armor
      ? mat(armor.visual.color, { metalness: armor.visual.variant === 'placas' || armor.visual.variant === 'couraca' ? 0.75 : 0.15, roughness: armor.visual.variant === 'jaqueta' ? 0.8 : 0.35, emissive: armor.visual.emissive ?? '#000', emissiveIntensity: 0.04 })
      : mat('#20242e');
    const trim = mat(armor?.visual.emissive ?? classColor, { emissive: armor?.visual.emissive ?? classColor, emissiveIntensity: 1.6, toneMapped: false } as THREE.MeshStandardMaterialParameters);
    const pants = mat('#12141b', { roughness: 0.9 });
    const glove = gloves ? mat(gloves.visual.color, { metalness: 0.5, roughness: 0.4, emissive: gloves.visual.emissive ?? '#000', emissiveIntensity: 0.3 }) : skin;
    const boot = mat(boots?.visual.color ?? '#1b1b20', { metalness: boots?.visual.variant === 'grevas' ? 0.7 : 0.1, roughness: 0.5, emissive: boots?.visual.emissive ?? '#000', emissiveIntensity: 0.25 });
    const eye = mat(ap.eyes, { roughness: 0.2 });
    const eyeWhite = mat('#f2f2f2', { roughness: 0.3 });
    const glow = mat(classColor, { emissive: classColor, emissiveIntensity: 2, toneMapped: false } as THREE.MeshStandardMaterialParameters);
    return { skin, hair, torso, trim, pants, glove, boot, eye, eyeWhite, glow };
  }, [ap.skin, ap.hair, ap.eyes, armor, gloves, boots, classColor]);

  const H = ap.height; const W = ap.build; const M = ap.muscle;
  const shoulder = 0.23 * W * (1 + M * 0.25);
  const armThick = 0.055 * (1 + M * 0.6) * W;
  const legThick = 0.075 * (1 + M * 0.4) * W;

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const st = animRef?.current;
    const a = st?.anim ?? anim;
    local.current.t += dt;
    const t = local.current.t;
    const at = st?.t ?? t; // tempo dentro da ação
    const L = (r: React.MutableRefObject<THREE.Group>, x = 0, y = 0, z = 0, k = 12) => {
      const o = r.current; if (!o) return;
      const f = 1 - Math.exp(-k * dt);
      o.rotation.x += (x - o.rotation.x) * f; o.rotation.y += (y - o.rotation.y) * f; o.rotation.z += (z - o.rotation.z) * f;
    };
    let hipY = 0;
    const breath = Math.sin(t * 2) * 0.02;
    switch (a) {
      case 'walk':
      case 'run': {
        const sp = a === 'run' ? 11 : 6; const amp = a === 'run' ? 0.9 : 0.5;
        const s = Math.sin(t * sp);
        L(legL, s * amp, 0, 0, 20); L(legR, -s * amp, 0, 0, 20);
        L(shinL, Math.max(0, -s) * amp * 1.3, 0, 0, 20); L(shinR, Math.max(0, s) * amp * 1.3, 0, 0, 20);
        L(armL, -s * amp * 0.8, 0, 0.12, 20); L(armR, s * amp * 0.8, 0, -0.12, 20);
        L(foreL, -0.5 - (a === 'run' ? 0.6 : 0), 0, 0); L(foreR, -0.5 - (a === 'run' ? 0.6 : 0), 0, 0);
        L(chest, a === 'run' ? 0.25 : 0.05, s * 0.1, 0); L(head, a === 'run' ? -0.2 : 0, 0, 0);
        hipY = Math.abs(Math.cos(t * sp)) * (a === 'run' ? 0.08 : 0.03);
        break;
      }
      case 'attack': {
        const combo = st?.combo ?? 0;
        const p = Math.min(1, at / 0.3);
        const swing = p < 0.4 ? -1.2 * (p / 0.4) : -1.2 + 2.6 * Math.min(1, (p - 0.4) / 0.3);
        if (combo === 1) { L(armR, 0.3, 0, swing * -1.1, 30); L(chest, 0, -swing * 0.4, 0, 30); }
        else if (combo === 2) { L(armR, -swing - 1.2, 0, -0.2, 30); L(armL, -swing - 1.2, 0, 0.2, 30); L(chest, swing * 0.3, 0, 0, 30); }
        else { L(armR, -1.4, 0, swing, 30); L(chest, 0, swing * 0.5, 0, 30); }
        L(foreR, -0.3, 0, 0, 30); L(legL, -0.5, 0, 0); L(legR, 0.4, 0, 0); L(shinR, 0.5, 0, 0);
        break;
      }
      case 'heavy': {
        const p = Math.min(1, at / 0.7);
        const up = p < 0.55 ? -2.8 * (p / 0.55) : -2.8 + 3.8 * Math.min(1, (p - 0.55) / 0.15);
        L(armR, up, 0, -0.2, 25); L(armL, up, 0, 0.2, 25); L(foreR, -0.2, 0, 0); L(foreL, -0.2, 0, 0);
        L(chest, p < 0.55 ? -0.25 : 0.45, 0, 0, 20); L(legL, -0.6, 0, 0); L(legR, 0.5, 0, 0); L(shinL, 0.4, 0, 0); L(shinR, 0.8, 0, 0);
        hipY = p > 0.55 ? -0.12 : 0;
        break;
      }
      case 'dodge':
        L(chest, 0.8, 0, 0, 30); L(legL, -1.4, 0, 0, 30); L(legR, -1.2, 0, 0, 30); L(shinL, 1.8, 0, 0, 30); L(shinR, 1.8, 0, 0, 30);
        L(armL, -1, 0, 0.5, 30); L(armR, -1, 0, -0.5, 30); hipY = -0.35;
        break;
      case 'skill':
        L(armR, -1.6, 0, -0.3, 30); L(armL, -1.6, 0, 0.3, 30); L(foreR, 0, 0, 0); L(foreL, 0, 0, 0); L(chest, -0.15, 0, 0); L(head, -0.2, 0, 0);
        L(legL, -0.3, 0, 0.2); L(legR, 0.3, 0, -0.2);
        break;
      case 'hit':
        L(chest, -0.4, 0, 0, 30); L(head, -0.4, 0, 0, 30); L(armL, 0.4, 0, 0.6, 30); L(armR, 0.4, 0, -0.6, 30);
        break;
      case 'dead':
        L(chest, 0.9, 0, 0, 4); L(head, 0.5, 0, 0, 4); L(armL, 0.2, 0, 0.3, 4); L(armR, 0.2, 0, -0.3, 4);
        L(legL, -1.4, 0, 0, 4); L(legR, -1.4, 0, 0, 4); L(shinL, 2.2, 0, 0, 4); L(shinR, 2.2, 0, 0, 4); hipY = -0.55;
        break;
      case 'victory': {
        const v = pose?.visual.variant;
        if (v === 'levitar') { hipY = 0.25 + Math.sin(t * 2) * 0.08; L(armL, -0.2, 0, 1.1, 6); L(armR, -0.2, 0, -1.1, 6); L(head, -0.25, 0, 0); L(legL, 0.2, 0, 0.1); L(legR, 0.4, 0, -0.1); L(shinR, 0.6, 0, 0); }
        else if (v === 'despertar') { L(armR, -3, 0, -0.1, 8); L(foreR, 0, 0, 0); L(armL, 0.1, 0, 0.35, 8); L(chest, -0.15, 0, 0); L(head, -0.35, 0, 0); }
        else { L(armR, -2.6, 0, -0.4, 8); L(foreR, -0.6, 0, 0); L(armL, 0, 0, 0.2); L(foreL, -1.6, 0, 0); L(head, -0.1, 0, 0); L(chest, -0.05, 0.2, 0); }
        break;
      }
      case 'pose':
        L(armL, 0.15, 0, 0.35 + breath); L(armR, -0.9, -0.4, -0.15); L(foreR, -1.2, 0, 0); L(chest, 0, -0.25, 0); L(head, 0, 0.2, 0);
        L(legL, -0.12, 0, 0.12); L(legR, 0.12, 0, -0.05); L(shinL, 0.15, 0, 0);
        break;
      default: // idle
        L(armL, 0.05, 0, 0.18 + breath, 6); L(armR, 0.05, 0, -0.18 - breath, 6); L(foreL, -0.15, 0, 0, 6); L(foreR, -0.15, 0, 0, 6);
        L(chest, breath, Math.sin(t * 0.6) * 0.05, 0, 6); L(head, Math.sin(t * 0.7) * 0.04, Math.sin(t * 0.4) * 0.15, 0, 4);
        L(legL, 0, 0, 0.04, 6); L(legR, 0, 0, -0.04, 6); L(shinL, 0, 0, 0, 6); L(shinR, 0, 0, 0, 6);
    }
    if (hips.current) hips.current.position.y += (0.95 * H + hipY - hips.current.position.y) * (1 - Math.exp(-14 * dt));
    if (chest.current) chest.current.scale.setScalar(1 + breath * 0.5);
    if (companion.current) {
      companion.current.position.set(Math.sin(t * 0.8) * 0.75, 1.75 * H + Math.sin(t * 2.2) * 0.12, Math.cos(t * 0.8) * 0.4 - 0.2);
      companion.current.rotation.y = t;
    }
  });

  const hairMesh = () => {
    const r = 0.155 * ap.headSize;
    switch (ap.hairStyle) {
      case 'raspado': return <mesh position={[0, 0.05, -0.005]} scale={[1.02, 0.75, 1.02]} material={m.hair}><sphereGeometry args={[r, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /></mesh>;
      case 'longo': return <group><mesh position={[0, 0.04, -0.01]} material={m.hair}><sphereGeometry args={[r * 1.08, 20, 14, 0, Math.PI * 2, 0, Math.PI / 1.7]} /></mesh><mesh position={[0, -0.12, -0.07]} material={m.hair}><boxGeometry args={[r * 2, 0.3, 0.1]} /></mesh></group>;
      case 'cacheado': return <group>{Array.from({ length: 14 }).map((_, i) => { const a = (i / 14) * Math.PI * 2; return <mesh key={i} position={[Math.cos(a) * r * 0.75, 0.08 + (i % 2) * 0.03, Math.sin(a) * r * 0.75 - 0.02]} material={m.hair}><sphereGeometry args={[r * 0.38, 10, 8]} /></mesh>; })}<mesh position={[0, 0.12, -0.01]} material={m.hair}><sphereGeometry args={[r * 0.8, 14, 10]} /></mesh></group>;
      case 'coque': return <group><mesh position={[0, 0.04, -0.01]} material={m.hair}><sphereGeometry args={[r * 1.06, 20, 14, 0, Math.PI * 2, 0, Math.PI / 1.9]} /></mesh><mesh position={[0, 0.16, -0.1]} material={m.hair}><sphereGeometry args={[r * 0.45, 14, 10]} /></mesh></group>;
      case 'espetado': return <group><mesh position={[0, 0.04, -0.01]} material={m.hair}><sphereGeometry args={[r * 1.06, 20, 14, 0, Math.PI * 2, 0, Math.PI / 1.9]} /></mesh>{Array.from({ length: 9 }).map((_, i) => { const a = -1.2 + (i / 8) * 2.4; return <mesh key={i} position={[Math.sin(a) * r * 0.7, 0.15, Math.cos(a) * r * 0.5 - 0.04]} rotation={[-0.6 + Math.cos(a) * 0.3, 0, -a * 0.5]} material={m.hair}><coneGeometry args={[0.045, 0.16, 6]} /></mesh>; })}</group>;
      default: return <group><mesh position={[0, 0.04, -0.01]} material={m.hair}><sphereGeometry args={[r * 1.07, 20, 14, 0, Math.PI * 2, 0, Math.PI / 1.85]} /></mesh><mesh position={[0, 0.08, 0.1]} rotation={[0.5, 0, 0]} material={m.hair}><boxGeometry args={[r * 1.6, 0.05, 0.1]} /></mesh></group>;
    }
  };

  const weaponMesh = () => {
    if (!wpn) return null;
    const metal = mat(wpn.visual.color, { metalness: 0.9, roughness: 0.2, emissive: wpn.visual.emissive ?? '#000', emissiveIntensity: wpn.visual.emissive ? 0.6 : 0 });
    const edge = mat(wpn.visual.emissive ?? '#ffffff', { emissive: wpn.visual.emissive ?? '#888', emissiveIntensity: 2.5, toneMapped: false } as THREE.MeshStandardMaterialParameters);
    const grip = mat('#2a1d14');
    const v = wpn.visual.variant;
    const blade = v === 'adaga' ? 0.35 : v === 'montante' ? 1.1 : 0.85;
    if (v === 'foice') return (
      <group>
        <mesh material={grip} position={[0, 0.2, 0]}><cylinderGeometry args={[0.018, 0.018, 1.3, 8]} /></mesh>
        <mesh material={metal} position={[0.18, 0.82, 0]} rotation={[0, 0, -0.3]}><torusGeometry args={[0.3, 0.03, 6, 20, Math.PI * 0.8]} /></mesh>
        <mesh material={edge} position={[0.18, 0.82, 0]} rotation={[0, 0, -0.3]}><torusGeometry args={[0.32, 0.008, 4, 20, Math.PI * 0.8]} /></mesh>
      </group>
    );
    return (
      <group>
        <mesh material={grip} position={[0, -0.04, 0]}><cylinderGeometry args={[0.02, 0.022, 0.18, 8]} /></mesh>
        <mesh material={metal} position={[0, 0.06, 0]}><boxGeometry args={[v === 'adaga' ? 0.12 : 0.22, 0.03, 0.05]} /></mesh>
        <mesh material={metal} position={[0, 0.08 + blade / 2, 0]}><boxGeometry args={[v === 'montante' ? 0.09 : 0.06, blade, 0.015]} /></mesh>
        <mesh material={edge} position={[0, 0.08 + blade / 2, 0.009]}><boxGeometry args={[0.008, blade * 0.95, 0.004]} /></mesh>
        <mesh material={metal} position={[0, 0.08 + blade + 0.03, 0]} rotation={[0, 0, Math.PI / 4]}><boxGeometry args={[0.045, 0.045, 0.014]} /></mesh>
      </group>
    );
  };

  const auraColor = aura?.visual.color ?? classColor;
  const auraStrength = Math.min(1, (aura ? 0.6 + RARITY_INFO[aura.rarity].glow * 0.4 : 0) + rankGlow * 0.6);

  return (
    <group ref={root}>
      <group ref={hips} position={[0, 0.95 * H, 0]}>
        {/* Quadril */}
        <mesh material={m.pants} scale={[W * 1.1, 0.8, 0.75]}><sphereGeometry args={[0.15, 20, 14]} /></mesh>
        <mesh material={m.trim} position={[0, 0.07, 0]} scale={[W * 1.05, 1, 0.8]}><torusGeometry args={[0.15, 0.008, 6, 32]} /></mesh>
        {/* Pernas */}
        {([[legL, shinL, -1], [legR, shinR, 1]] as const).map(([leg, shin, side]) => (
          <group key={side} ref={leg} position={[0.09 * side * W, -0.06, 0]}>
            <mesh material={m.pants} position={[0, -0.22 * H, 0]}><capsuleGeometry args={[legThick, 0.32 * H, 6, 12]} /></mesh>
            <group ref={shin} position={[0, -0.45 * H, 0]}>
              <mesh material={m.pants} position={[0, -0.2 * H, 0]}><capsuleGeometry args={[legThick * 0.85, 0.3 * H, 6, 12]} /></mesh>
              <mesh material={m.boot} position={[0, -0.3 * H, 0.01]}><capsuleGeometry args={[legThick * 0.95, 0.14 * H, 6, 12]} /></mesh>
              <mesh material={m.boot} position={[0, -0.43 * H, 0.06]}><boxGeometry args={[0.12, 0.07, 0.25]} /></mesh>
              {boots?.visual.emissive && <mesh material={m.trim} position={[0, -0.38 * H, 0.095]}><boxGeometry args={[0.1, 0.012, 0.01]} /></mesh>}
            </group>
          </group>
        ))}
        {/* Tronco */}
        <group ref={chest} position={[0, 0.1, 0]}>
          <mesh material={m.torso} position={[0, 0.27 * H, 0]} scale={[W * (1.25 + M * 0.25), H * 0.95, 0.85 + M * 0.2]}><sphereGeometry args={[0.16, 24, 18]} /></mesh>
          <mesh material={m.torso} position={[0, 0.1 * H, 0]} scale={[W * (1 + M * 0.1), H, 0.8 + M * 0.1]}><cylinderGeometry args={[0.15, 0.135, 0.22, 20]} /></mesh>
          {[-1, 1].map((sd) => <mesh key={sd} material={m.torso} position={[shoulder * sd * 0.92, 0.37 * H, 0]}><sphereGeometry args={[armThick * 1.25, 16, 12]} /></mesh>)}
          {/* Detalhes luminosos (identidade visual) */}
          <mesh material={m.trim} position={[0, 0.2 * H, 0.14 + M * 0.03]}><boxGeometry args={[0.012, 0.28 * H, 0.006]} /></mesh>
          <mesh material={m.trim} position={[-0.08 * W, 0.31 * H, 0.125 + M * 0.03]} rotation={[0, 0, 0.6]}><boxGeometry args={[0.12, 0.01, 0.006]} /></mesh>
          <mesh material={m.trim} position={[0.08 * W, 0.31 * H, 0.125 + M * 0.03]} rotation={[0, 0, -0.6]}><boxGeometry args={[0.12, 0.01, 0.006]} /></mesh>
          {(armor?.visual.variant === 'placas' || armor?.visual.variant === 'couraca') && (
            <>
              <mesh material={m.torso} position={[-shoulder, 0.38 * H, 0]}><sphereGeometry args={[0.09 * W, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2]} /></mesh>
              <mesh material={m.torso} position={[shoulder, 0.38 * H, 0]}><sphereGeometry args={[0.09 * W, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2]} /></mesh>
            </>
          )}
          {emblem && (
            <mesh position={[0.08 * W, 0.3 * H, 0.165 + M * 0.03]} rotation={[0, 0, Math.PI / 4]}>
              <boxGeometry args={[0.045, 0.045, 0.01]} />
              <meshStandardMaterial color={emblem.visual.color} emissive={emblem.visual.emissive ?? emblem.visual.color} emissiveIntensity={2} toneMapped={false} />
            </mesh>
          )}
          {cape && (
            <mesh position={[0, 0.02 * H, -0.14]} rotation={[0.12, 0, 0]}>
              <planeGeometry args={[0.46 * W, cape.visual.variant === 'manto' ? 1 * H : 0.8 * H, 4, 8]} />
              <meshStandardMaterial color={cape.visual.color} emissive={cape.visual.emissive ?? '#000'} emissiveIntensity={0.25} side={THREE.DoubleSide} roughness={0.8} />
            </mesh>
          )}
          {acc && (
            <mesh position={[0, 0.46 * H, 0.06]}><torusGeometry args={[0.07, 0.008, 6, 16]} /><meshStandardMaterial color={acc.visual.color} metalness={1} roughness={0.2} emissive={acc.visual.emissive ?? '#000'} emissiveIntensity={0.8} /></mesh>
          )}
          {/* Cabeça */}
          <group ref={head} position={[0, 0.56 * H, 0]}>
            <mesh material={m.skin} position={[0, -0.08, 0]}><cylinderGeometry args={[0.055, 0.065, 0.1, 10]} /></mesh>
            <group position={[0, 0.07, 0]} scale={ap.headSize}>
              <mesh material={m.skin} scale={[0.92, 1.08, 0.98]}><sphereGeometry args={[0.15, 28, 20]} /></mesh>
              <mesh material={m.skin} position={[0, -0.06, 0.015]} scale={[0.72, 0.55, 0.78]}><sphereGeometry args={[0.13, 20, 14]} /></mesh>
              {/* Olhos */}
              {[-1, 1].map((sd) => (
                <group key={sd} position={[0.05 * sd, 0.01, 0.125]}>
                  <mesh material={m.eyeWhite} scale={[1, 0.6, 0.5]}><sphereGeometry args={[0.025, 12, 8]} /></mesh>
                  <mesh material={m.eye} position={[0, 0, 0.01]}><sphereGeometry args={[0.013, 10, 8]} /></mesh>
                  <mesh material={m.hair} position={[0, 0.035, 0.005]} rotation={[0, 0, sd * -0.12]}><boxGeometry args={[0.05, 0.008 + ap.brows * 0.014, 0.01]} /></mesh>
                </group>
              ))}
              <mesh material={m.skin} position={[0, -0.025, 0.145]} rotation={[0.3, 0, 0]}><coneGeometry args={[0.018, 0.05, 6]} /></mesh>
              <mesh position={[0, -0.075, 0.13]}><boxGeometry args={[0.045, 0.006, 0.01]} /><meshStandardMaterial color="#6b3a32" /></mesh>
              {ap.beard !== 'nenhuma' && (
                <mesh material={m.hair} position={[0, -0.1, 0.07]} scale={ap.beard === 'cavanhaque' ? [0.35, 0.6, 0.6] : ap.beard === 'rala' ? [0.85, 0.5, 0.75] : [0.95, 0.75, 0.85]}>
                  <sphereGeometry args={[0.11, 16, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
                </mesh>
              )}
              {ap.mustache && <mesh material={m.hair} position={[0, -0.055, 0.135]}><boxGeometry args={[0.06, 0.012, 0.012]} /></mesh>}
              {hairMesh()}
            </group>
          </group>
          {/* Braços */}
          {([[armL, foreL, -1], [armR, foreR, 1]] as const).map(([arm, fore, side]) => (
            <group key={side} ref={arm} position={[shoulder * side, 0.37 * H, 0]}>
              <mesh material={armor ? m.torso : m.skin} position={[0, -0.14 * H, 0]}><capsuleGeometry args={[armThick, 0.2 * H, 6, 12]} /></mesh>
              <group ref={fore} position={[0, -0.3 * H, 0]}>
                <mesh material={m.skin} position={[0, -0.12 * H, 0]}><capsuleGeometry args={[armThick * 0.85, 0.18 * H, 6, 12]} /></mesh>
                <mesh material={m.glove} position={[0, -0.26 * H, 0]}><sphereGeometry args={[armThick * 1.05, 12, 10]} /></mesh>
                {gloves && <mesh material={m.glove} position={[0, -0.18 * H, 0]}><cylinderGeometry args={[armThick * 1.1, armThick * 1.2, 0.1, 10]} /></mesh>}
                {side === 1 && (
                  <group ref={weapon} position={[0, -0.27 * H, 0.02]} rotation={[Math.PI / 2, 0, 0]}>{weaponMesh()}</group>
                )}
              </group>
            </group>
          ))}
        </group>
      </group>
      {/* Aura */}
      {auraStrength > 0 && quality !== 'baixo' && <AuraFx color={auraColor} strength={auraStrength} variant={aura?.visual.variant ?? 'rank'} height={1.9 * H} />}
      {/* Companheiro */}
      {comp && (
        <group ref={companion}>
          {comp.visual.variant === 'corvo' ? (
            <group scale={0.5}><mesh><coneGeometry args={[0.12, 0.35, 6]} /><meshStandardMaterial color="#15101f" emissive="#6b3bff" emissiveIntensity={0.5} /></mesh><mesh position={[0.2, 0.05, 0]} rotation={[0, 0, -1.2]}><planeGeometry args={[0.35, 0.15]} /><meshStandardMaterial color="#0d0a14" side={THREE.DoubleSide} /></mesh><mesh position={[-0.2, 0.05, 0]} rotation={[0, 0, 1.2]}><planeGeometry args={[0.35, 0.15]} /><meshStandardMaterial color="#0d0a14" side={THREE.DoubleSide} /></mesh></group>
          ) : (
            <mesh><icosahedronGeometry args={[0.07, 1]} /><meshStandardMaterial color={comp.visual.color} emissive={comp.visual.variant === 'sombra' ? '#8a5bff' : comp.visual.color} emissiveIntensity={2.5} toneMapped={false} /></mesh>
          )}
          <pointLight color={comp.visual.variant === 'sombra' ? '#8a5bff' : comp.visual.color} intensity={0.6} distance={1.5} />
        </group>
      )}
      {/* Sombra de contato */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <circleGeometry args={[0.45 * W, 32]} />
        <meshBasicMaterial color="#000" transparent opacity={0.45} depthWrite={false} />
      </mesh>
    </group>
  );
}

function AuraFx({ color, strength, variant, height }: { color: string; strength: number; variant: string; height: number }) {
  const count = Math.round(40 + strength * 80);
  const pts = useRef<THREE.Points>(null!);
  const ring = useRef<THREE.Mesh>(null!);
  const { positions, speeds } = useMemo(() => {
    const p = new Float32Array(count * 3); const s = new Float32Array(count);
    for (let i = 0; i < count; i++) { const a = Math.random() * Math.PI * 2; const r = 0.25 + Math.random() * 0.35; p[i * 3] = Math.cos(a) * r; p[i * 3 + 1] = Math.random() * height; p[i * 3 + 2] = Math.sin(a) * r; s[i] = 0.3 + Math.random() * 0.9; }
    return { positions: p, speeds: s };
  }, [count, height]);
  useFrame((st, dt) => {
    const arr = pts.current?.geometry.attributes.position.array as Float32Array | undefined;
    if (!arr) return;
    const t = st.clock.elapsedTime;
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 1] += speeds[i] * dt * (variant === 'tempestade' || variant === 'relampago' ? 1.8 : 1);
      const swirl = variant === 'chama' || variant === 'tempestade' ? 1.4 : 0.4;
      const x = arr[i * 3], z = arr[i * 3 + 2];
      const a = swirl * dt;
      arr[i * 3] = x * Math.cos(a) - z * Math.sin(a); arr[i * 3 + 2] = x * Math.sin(a) + z * Math.cos(a);
      if (arr[i * 3 + 1] > height) arr[i * 3 + 1] = 0;
    }
    pts.current.geometry.attributes.position.needsUpdate = true;
    if (ring.current) { ring.current.rotation.z = t * 0.5; (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.25 + Math.sin(t * 3) * 0.1 * strength; }
  });
  return (
    <group>
      <points ref={pts}>
        <bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry>
        <pointsMaterial color={color} size={variant === 'brasa' ? 0.035 : 0.05} transparent opacity={0.85} blending={THREE.AdditiveBlending} depthWrite={false} sizeAttenuation />
      </points>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.45, 0.62, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0.3} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <pointLight color={color} intensity={1.2 * strength} distance={3} position={[0, 1, 0]} />
    </group>
  );
}

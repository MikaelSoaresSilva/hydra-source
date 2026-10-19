import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { SCENES, type SceneId } from '../data/story';
import { Avatar, type AvatarAnim } from './Avatar';
import type { Character } from '../core/types';

export function Environment({ scene, quality }: { scene: SceneId; quality: 'alto' | 'medio' | 'baixo' }) {
  const sc = SCENES[scene];
  const ringRef = useRef<THREE.Group>(null!);
  const dust = useRef<THREE.Points>(null!);
  const N = quality === 'alto' ? 400 : quality === 'medio' ? 180 : 60;
  const dustPos = useMemo(() => {
    const p = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { p[i * 3] = (Math.random() - 0.5) * 16; p[i * 3 + 1] = Math.random() * 6; p[i * 3 + 2] = (Math.random() - 0.5) * 16; }
    return p;
  }, [N]);
  useFrame((st, dt) => {
    if (ringRef.current) ringRef.current.rotation.y += dt * 0.08;
    const a = dust.current?.geometry.attributes.position.array as Float32Array | undefined;
    if (a) { for (let i = 0; i < N; i++) { a[i * 3 + 1] += dt * (scene === 'forja' ? 0.5 : 0.12); if (a[i * 3 + 1] > 6) a[i * 3 + 1] = 0; } dust.current.geometry.attributes.position.needsUpdate = true; }
    void st;
  });
  return (
    <>
      <color attach="background" args={[sc.fog]} />
      <fog attach="fog" args={[sc.fog, 6, 22]} />
      <ambientLight intensity={0.25} />
      <hemisphereLight args={['#bcd4ff', '#080810', 0.45]} />
      <directionalLight position={[2.5, 4, 5]} intensity={1.3} color="#ffffff" castShadow={quality === 'alto'} />
      <pointLight position={[-2.5, 2.2, -1.5]} color={sc.rim} intensity={18} distance={8} />
      <pointLight position={[2.5, 1.5, -2]} color={sc.key} intensity={14} distance={8} />
      <spotLight position={[1.5, 6, 3]} angle={0.4} penumbra={0.8} intensity={30} color="#f2f6ff" distance={14} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[14, 64]} />
        <meshStandardMaterial color={sc.floor} roughness={0.45} metalness={0.4} emissive={sc.floor} emissiveIntensity={0.6} />
      </mesh>
      <group ref={ringRef}>
        {[1.2, 2.2, 3.6].map((r, i) => (
          <mesh key={r} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01 + i * 0.001, 0]}>
            <ringGeometry args={[r, r + (i === 0 ? 0.03 : 0.015), 96, 1, 0, i === 2 ? Math.PI * 1.6 : Math.PI * 2]} />
            <meshBasicMaterial color={i === 1 ? sc.rim : sc.key} transparent opacity={0.6 - i * 0.12} toneMapped={false} />
          </mesh>
        ))}
        {Array.from({ length: 12 }).map((_, i) => {
          const a = (i / 12) * Math.PI * 2;
          return <mesh key={i} position={[Math.cos(a) * 2.9, 0.012, Math.sin(a) * 2.9]} rotation={[-Math.PI / 2, 0, -a]}><planeGeometry args={[0.18, 0.04]} /><meshBasicMaterial color={sc.key} toneMapped={false} /></mesh>;
        })}
      </group>
      {/* Elementos de cenário por região */}
      {scene === 'santuario' && Array.from({ length: 6 }).map((_, i) => {
        const a = (i / 6) * Math.PI * 2 + 0.5;
        return (
          <group key={i} position={[Math.cos(a) * 6, 0, Math.sin(a) * 6 - 1]}>
            <mesh position={[0, 2.5, 0]}><boxGeometry args={[0.35, 5, 0.35]} /><meshStandardMaterial color="#0d1222" metalness={0.8} roughness={0.3} /></mesh>
            <mesh position={[0, 2.5, 0.18]}><boxGeometry args={[0.04, 4.6, 0.01]} /><meshBasicMaterial color={sc.key} toneMapped={false} /></mesh>
          </group>
        );
      })}
      {scene === 'forja' && (
        <>
          {[-3.5, 3.5].map((x) => (
            <group key={x} position={[x, 0, -3]}>
              <mesh position={[0, 0.5, 0]}><cylinderGeometry args={[0.8, 1, 1, 12]} /><meshStandardMaterial color="#24140c" roughness={0.9} /></mesh>
              <mesh position={[0, 1.05, 0]}><cylinderGeometry args={[0.7, 0.7, 0.1, 12]} /><meshBasicMaterial color="#ff6a1a" toneMapped={false} /></mesh>
              <pointLight position={[0, 1.6, 0]} color="#ff7a3d" intensity={12} distance={6} />
            </group>
          ))}
          <mesh position={[0, 0.4, -4.5]}><boxGeometry args={[1.6, 0.8, 0.7]} /><meshStandardMaterial color="#2a2a30" metalness={0.9} roughness={0.35} /></mesh>
        </>
      )}
      {scene === 'coliseu' && Array.from({ length: 16 }).map((_, i) => {
        const a = (i / 16) * Math.PI * 2;
        return <mesh key={i} position={[Math.cos(a) * 9, 1.5 + (i % 3) * 0.5, Math.sin(a) * 9]} rotation={[0, -a, 0]}><boxGeometry args={[0.6, 3 + (i % 3), 1.6]} /><meshStandardMaterial color="#120b1a" roughness={0.4} metalness={0.5} emissive="#3a0f55" emissiveIntensity={0.9} /></mesh>;
      })}
      {scene === 'limiar' && (
        <group position={[0, 2.2, -5]}>
          <mesh><torusGeometry args={[1.8, 0.12, 12, 64]} /><meshStandardMaterial color="#0b1a1c" metalness={0.9} roughness={0.2} emissive={sc.key} emissiveIntensity={0.6} /></mesh>
          <mesh><circleGeometry args={[1.7, 48]} /><meshBasicMaterial color={sc.key} transparent opacity={0.18} toneMapped={false} /></mesh>
          <pointLight color={sc.key} intensity={20} distance={9} />
        </group>
      )}
      <points ref={dust}>
        <bufferGeometry><bufferAttribute attach="attributes-position" args={[dustPos, 3]} /></bufferGeometry>
        <pointsMaterial color={scene === 'forja' ? '#ffb070' : sc.key} size={0.04} transparent opacity={0.7} blending={THREE.AdditiveBlending} depthWrite={false} />
      </points>
    </>
  );
}

export interface ShowcaseProps {
  character: Character;
  classColor: string;
  scene: SceneId;
  anim: AvatarAnim;
  rankGlow: number;
  quality: 'alto' | 'medio' | 'baixo';
  interactive?: boolean;
  autoRotate?: boolean;
  height?: number | string;
  cameraZ?: number;
}

export function Showcase({ character, classColor, scene, anim, rankGlow, quality, interactive = true, autoRotate = false, height = 320, cameraZ = 3.9 }: ShowcaseProps) {
  return (
    <div className="stage" style={{ height }}>
      <Canvas
        dpr={quality === 'alto' ? [1, 2] : quality === 'medio' ? [1, 1.5] : [0.75, 1]}
        camera={{ position: [0, 1.25, cameraZ], fov: 40 }}
        gl={{ antialias: quality !== 'baixo', powerPreference: quality === 'baixo' ? 'low-power' : 'high-performance' }}
        frameloop="always"
        shadows={quality === 'alto'}
      >
        <Environment scene={scene} quality={quality} />
        <Avatar appearance={character.appearance} equipped={character.equipped} classColor={classColor} anim={anim} rankGlow={rankGlow} quality={quality} />
        <OrbitControls
          enabled={interactive}
          enablePan={false}
          minDistance={1.6}
          maxDistance={6}
          minPolarAngle={0.6}
          maxPolarAngle={1.65}
          target={[0, 0.98, 0]}
          autoRotate={autoRotate}
          autoRotateSpeed={0.8}
        />
      </Canvas>
    </div>
  );
}

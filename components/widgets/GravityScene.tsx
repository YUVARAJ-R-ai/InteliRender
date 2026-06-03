'use client';

import { useRef, useState, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, Line } from '@react-three/drei';
import * as THREE from 'three';
import { GravityParams } from '@/types/widget';

const G = 6.67430e-11; // Gravitational constant
const TIME_STEP = 3600 * 24; // 1 day per frame step for visible planetary motion
const SCALE_FACTOR = 1e-9; // Scale down for rendering

interface BodyState {
  name: string;
  mass: number;
  radius: number;
  color: string;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  path: THREE.Vector3[];
}

function Simulation({ params }: { params: GravityParams }) {
  const [bodies, setBodies] = useState<BodyState[]>(
    (params.bodies ?? [])
      .filter(b => Array.isArray(b.initialPosition) && Array.isArray(b.initialVelocity))
      .map(b => {
        const pos: [number, number, number] = [
          Number(b.initialPosition[0] ?? 0),
          Number(b.initialPosition[1] ?? 0),
          Number(b.initialPosition[2] ?? 0),
        ];
        const vel: [number, number, number] = [
          Number(b.initialVelocity[0] ?? 0),
          Number(b.initialVelocity[1] ?? 0),
          Number(b.initialVelocity[2] ?? 0),
        ];
        return {
          name: b.name,
          mass: b.mass,
          radius: Math.max((b.radius ?? 1) * SCALE_FACTOR * 10, 0.5),
          color: b.color || '#ffffff',
          position: new THREE.Vector3(...pos).multiplyScalar(SCALE_FACTOR),
          velocity: new THREE.Vector3(...vel).multiplyScalar(SCALE_FACTOR),
          path: [new THREE.Vector3(...pos).multiplyScalar(SCALE_FACTOR)],
        };
      })
  );

  useFrame(() => {
    setBodies(prevBodies => {
      const newBodies = prevBodies.map(body => ({ ...body }));

      // Calculate forces and update velocities
      for (let i = 0; i < newBodies.length; i++) {
        for (let j = 0; j < newBodies.length; j++) {
          if (i === j) continue;

          const b1 = newBodies[i];
          const b2 = newBodies[j];

          const direction = new THREE.Vector3().subVectors(b2.position, b1.position);
          const distanceSq = direction.lengthSq() / (SCALE_FACTOR * SCALE_FACTOR); // Real distance sq

          if (distanceSq > 0) {
            const forceMag = (G * b1.mass * b2.mass) / distanceSq;
            const force = direction.normalize().multiplyScalar(forceMag);
            
            // a = F/m
            const acceleration = force.divideScalar(b1.mass);
            // v = v + a*t
            // Scale velocity back to simulation scale
            b1.velocity.add(acceleration.multiplyScalar(TIME_STEP * SCALE_FACTOR));
          }
        }
      }

      // Update positions
      for (let i = 0; i < newBodies.length; i++) {
        newBodies[i].position.add(newBodies[i].velocity.clone().multiplyScalar(TIME_STEP));
        
        // Update orbital path (limit length for performance)
        if (params.showOrbitalPaths !== false) {
          newBodies[i].path.push(newBodies[i].position.clone());
          if (newBodies[i].path.length > 500) {
            newBodies[i].path.shift();
          }
        }
      }

      return newBodies;
    });
  });

  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[0, 0, 0]} intensity={2} color="#ffffff" />
      
      {bodies.map((body, i) => (
        <group key={i}>
          <mesh position={body.position}>
            <sphereGeometry args={[body.radius, 32, 32]} />
            <meshStandardMaterial 
              color={body.color} 
              emissive={body.name.toLowerCase() === 'sun' ? body.color : '#000000'}
              emissiveIntensity={body.name.toLowerCase() === 'sun' ? 1 : 0}
            />
          </mesh>
          
          {params.showOrbitalPaths !== false && body.path.length > 1 && (
            <Line
              points={body.path}
              color={body.color}
              lineWidth={1}
              opacity={0.4}
              transparent
            />
          )}
        </group>
      ))}
    </>
  );
}

export function GravitySceneWidget({ params }: { params: GravityParams }) {
  return (
    <div className="w-full h-[400px] bg-black rounded-xl overflow-hidden border border-white/10 relative">
      <div className="absolute top-4 left-4 z-10 bg-black/50 p-2 rounded text-xs text-white backdrop-blur-md border border-white/10 pointer-events-none">
        <div className="font-bold mb-1">Gravity Simulator</div>
        <div className="text-white/70">Left Click: Rotate | Scroll: Zoom | Right Click: Pan</div>
      </div>
      <Canvas camera={{ position: [0, 20, 50], fov: 45 }}>
        <color attach="background" args={['#050505']} />
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        <Simulation params={params} />
        <OrbitControls makeDefault />
      </Canvas>
    </div>
  );
}

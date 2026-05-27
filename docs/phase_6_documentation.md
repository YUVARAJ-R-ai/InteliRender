# Phase 6: Gravity Visualizer (3D Interactive Rendering)

## Overview
Phase 6 brings true complexity to the Visual Response Engine by introducing 3D rendering and real-time physics simulation using WebGL. When the LLM generates a \`gravity\` payload, it provides initial masses, positions, and velocities for a system of celestial bodies.

## Tech Stack
- **Three.js**: The underlying WebGL rendering engine.
- **@react-three/fiber**: A React reconciler for Three.js, allowing us to build 3D scenes using declarative React components.
- **@react-three/drei**: A collection of useful helpers for R3F (used here for `OrbitControls`, `Stars`, and `Line` rendering).

## Architecture & Implementation

### 1. The GravityScene Component
Located in `components/widgets/GravityScene.tsx`, this component mounts a `<Canvas>` that takes over the widget boundaries. 

### 2. The Physics Engine Loop (\`useFrame\`)
The core of the simulation relies on a custom N-body physics engine calculated on the client side at 60 FPS using React Three Fiber's `useFrame` hook.

For every frame, the simulation:
1. Iterates through every pair of bodies to calculate the gravitational force using Newton's law of universal gravitation: $F = G \frac{m_1 m_2}{r^2}$
2. Calculates the acceleration ($a = F/m$) and adds it to the body's velocity vector, scaled by a standard time step (e.g., 1 day of simulation time per frame).
3. Adds the velocity to the current position.
4. Pushes the new position into a `path` array, maintaining a trail of the last 500 positions to render orbital paths.

### 3. Rendering the Universe
- We use `OrbitControls` to allow the user to pan, zoom, and rotate the camera interactively.
- The `Stars` component provides a dynamic background environment.
- The calculated `path` arrays are fed into the `Line` component to draw the glowing trails behind the celestial bodies as they move.

## Replacing the Stub
Prior to this phase, the `WidgetRenderer` was mapping the `gravity` type to a temporary stub component that merely dumped the JSON output to the screen. By replacing the stub mapping with `GravitySceneWidget`, the application now seamlessly transforms structured physics data from the LLM directly into a playable 3D sandbox.

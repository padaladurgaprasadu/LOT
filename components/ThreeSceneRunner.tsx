"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

interface ThreeSceneRunnerProps {
  type?: "prism_chip" | "cube_lattice" | "custom";
  title?: string;
}

export function ThreeSceneRunner({ type = "prism_chip", title = "3D Interactive Viewport" }: ThreeSceneRunnerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isRunning, setIsRunning] = useState(true);

  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth || 400;
    const height = 260;

    // Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#09090b");

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 2.5, 5);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0x3b82f6, 2, 50);
    pointLight.position.set(5, 5, 5);
    scene.add(pointLight);

    const accentLight = new THREE.PointLight(0x10b981, 1.5, 50);
    accentLight.position.set(-5, -3, 3);
    scene.add(accentLight);

    // 3D Geometry for PRISM Chip Die Stack
    const chipGroup = new THREE.Group();

    // Base Substrate
    const substrateGeo = new THREE.BoxGeometry(2.4, 0.1, 2.4);
    const substrateMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.3, metalness: 0.8 });
    const substrate = new THREE.Mesh(substrateGeo, substrateMat);
    chipGroup.add(substrate);

    // Silicon Die Core
    const dieGeo = new THREE.BoxGeometry(1.6, 0.15, 1.6);
    const dieMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.2, metalness: 0.9 });
    const die = new THREE.Mesh(dieGeo, dieMat);
    die.position.y = 0.15;
    chipGroup.add(die);

    // HBM Memory Stacks (4 Corners)
    const hbmGeo = new THREE.BoxGeometry(0.4, 0.25, 0.4);
    const hbmMat = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.3, metalness: 0.7 });

    const positions = [
      [-0.9, 0.2, -0.9],
      [0.9, 0.2, -0.9],
      [-0.9, 0.2, 0.9],
      [0.9, 0.2, 0.9],
    ];

    positions.forEach(([x, y, z]) => {
      const hbm = new THREE.Mesh(hbmGeo, hbmMat);
      hbm.position.set(x, y, z);
      chipGroup.add(hbm);
    });

    scene.add(chipGroup);

    // Animation Loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      chipGroup.rotation.y += 0.01;
      chipGroup.rotation.x = Math.sin(Date.now() * 0.001) * 0.1;
      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      // Dispose all geometries and materials to prevent GPU memory leaks
      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).geometry) (obj as THREE.Mesh).geometry.dispose();
        if ((obj as THREE.Mesh).material) {
          const mat = (obj as THREE.Mesh).material;
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else mat.dispose();
        }
      });
      renderer.dispose();
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-white/10 bg-zinc-950 p-3 shadow-2xl">
      <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-xs font-semibold text-zinc-300">{title} (Three.js WebGL)</span>
        </div>
        <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono">60 FPS Hardware Accelerated</span>
      </div>
      <div ref={containerRef} className="w-full flex justify-center items-center h-[260px] rounded-lg overflow-hidden" />
    </div>
  );
}

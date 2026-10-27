"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { FortifySceneKind } from "./fortify-scene";

export function FortifySceneCanvas({ kind, onReady, onError }: {
  kind: FortifySceneKind;
  onReady: () => void;
  onError: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "low-power" });
    } catch {
      onError();
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(kind === "signal" ? 40 : 38, 1, 0.1, 30);
    camera.position.set(0, 0, kind === "signal" ? 7.6 : 8.8);
    scene.add(new THREE.AmbientLight(0xffffff, 1.25));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(-3, 4, 6);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0x929aab, 1.8);
    rimLight.position.set(4, -2, -1);
    scene.add(rimLight);

    const subject = new THREE.Group();
    scene.add(subject);
    const resources: Array<THREE.BufferGeometry | THREE.Material> = [];
    const keep = <T extends THREE.BufferGeometry | THREE.Material>(resource: T): T => {
      resources.push(resource);
      return resource;
    };
    let pulse: THREE.Mesh | undefined;
    let tracer: THREE.Mesh | undefined;

    if (kind === "signal") {
      const count = 420;
      const positions = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const y = 1 - 2 * (i + 0.5) / count;
        const radius = Math.sqrt(1 - y * y);
        const angle = i * Math.PI * (3 - Math.sqrt(5));
        positions[i * 3] = Math.cos(angle) * radius * 1.85;
        positions[i * 3 + 1] = y * 1.85;
        positions[i * 3 + 2] = Math.sin(angle) * radius * 1.85;
      }
      const pointsGeometry = keep(new THREE.BufferGeometry());
      pointsGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      subject.add(new THREE.Points(pointsGeometry, keep(new THREE.PointsMaterial({ color: 0xdadfe8, size: 0.024, sizeAttenuation: true, transparent: true, opacity: 0.75 }))));

      const frame = new THREE.Mesh(
        keep(new THREE.IcosahedronGeometry(0.79, 1)),
        keep(new THREE.MeshStandardMaterial({ color: 0x141820, metalness: 0.68, roughness: 0.3, flatShading: true, transparent: true, opacity: 0.9 })),
      );
      subject.add(frame);
      const edges = new THREE.LineSegments(
        keep(new THREE.EdgesGeometry(frame.geometry, 20)),
        keep(new THREE.LineBasicMaterial({ color: 0xb8c2d2, transparent: true, opacity: 0.55 })),
      );
      subject.add(edges);
      for (const [index, tilt] of [0.35, -0.63, 1.1].entries()) {
        const orbit = new THREE.Mesh(
          keep(new THREE.TorusGeometry(2.22 + index * 0.1, 0.006, 3, 160)),
          keep(new THREE.MeshBasicMaterial({ color: index === 1 ? 0xb9c4d4 : 0x848f9e, transparent: true, opacity: index === 1 ? 0.64 : 0.36 })),
        );
        orbit.rotation.set(tilt, index * 0.34, index * 0.2);
        subject.add(orbit);
      }
      pulse = new THREE.Mesh(keep(new THREE.SphereGeometry(0.06, 12, 8)), keep(new THREE.MeshBasicMaterial({ color: 0xffffff })));
      subject.add(pulse);
    } else {
      const slabs = [
        { x: -1.36, y: -0.64, z: 0.6 },
        { x: 0, y: 0.05, z: 0 },
        { x: 1.36, y: 0.74, z: -0.6 },
      ];
      for (const [index, position] of slabs.entries()) {
        const geometry = keep(new THREE.BoxGeometry(1.42, 0.18, 1.08));
        const slab = new THREE.Mesh(geometry, keep(new THREE.MeshStandardMaterial({
          color: index === 1 ? 0x343a45 : 0x252a32,
          metalness: 0.65,
          roughness: 0.32,
        })));
        slab.position.set(position.x, position.y, position.z);
        subject.add(slab);
        const outline = new THREE.LineSegments(keep(new THREE.EdgesGeometry(geometry)), keep(new THREE.LineBasicMaterial({ color: 0xc6cfdb, transparent: true, opacity: 0.75 })));
        outline.position.copy(slab.position);
        subject.add(outline);
        const inset = new THREE.Mesh(
          keep(new THREE.PlaneGeometry(0.85, 0.55)),
          keep(new THREE.MeshBasicMaterial({ color: 0x9ca8b9, transparent: true, opacity: index === 1 ? 0.24 : 0.14, side: THREE.DoubleSide })),
        );
        inset.rotation.x = -Math.PI / 2;
        inset.position.set(position.x, position.y + 0.094, position.z);
        subject.add(inset);
      }
      const path = [new THREE.Vector3(-1.36, -0.53, 0.6), new THREE.Vector3(0, 0.16, 0), new THREE.Vector3(1.36, 0.85, -0.6)];
      const curve = new THREE.CatmullRomCurve3(path);
      subject.add(new THREE.Mesh(
        keep(new THREE.TubeGeometry(curve, 48, 0.012, 5, false)),
        keep(new THREE.MeshBasicMaterial({ color: 0x99a7b9, transparent: true, opacity: 0.65 })),
      ));
      tracer = new THREE.Mesh(keep(new THREE.SphereGeometry(0.065, 10, 8)), keep(new THREE.MeshBasicMaterial({ color: 0xf7f9ff })));
      subject.add(tracer);
      subject.rotation.set(-0.2, -0.18, -0.05);
    }

    const resize = () => {
      const width = canvas.parentElement?.clientWidth || 1;
      const height = canvas.parentElement?.clientHeight || 1;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      renderer.render(scene, camera);
    };
    const resizeObserver = new ResizeObserver(resize);
    if (canvas.parentElement) resizeObserver.observe(canvas.parentElement);
    resize();

    let visible = false;
    const timer = new THREE.Timer();
    timer.connect(document);
    const pointer = { x: 0, y: 0 };
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const shouldAnimate = () => visible && document.visibilityState === "visible" && !motionQuery.matches &&
      document.documentElement.dataset.motion !== "paused" && document.documentElement.dataset.reducedEffects !== "true";
    const animate = () => {
      timer.update();
      const elapsed = timer.getElapsed();
      const delta = Math.min(timer.getDelta(), 0.04);
      subject.rotation.y += delta * (kind === "signal" ? 0.12 : 0.035);
      subject.rotation.x = THREE.MathUtils.damp(subject.rotation.x, (kind === "signal" ? 0.14 : -0.2) + pointer.y * 0.11, 2.5, delta);
      subject.rotation.z = THREE.MathUtils.damp(subject.rotation.z, (kind === "signal" ? 0 : -0.05) + pointer.x * 0.055, 2.5, delta);
      if (pulse) pulse.position.set(Math.cos(elapsed * 0.32) * 2.22, Math.sin(elapsed * 0.32) * 1.15, Math.sin(elapsed * 0.32) * 1.7);
      if (tracer) tracer.position.set(-1.36 + ((elapsed * 0.25) % 1) * 2.72, -0.53 + ((elapsed * 0.25) % 1) * 1.38, 0.6 - ((elapsed * 0.25) % 1) * 1.2);
      renderer.render(scene, camera);
    };
    const updateLoop = () => renderer.setAnimationLoop(shouldAnimate() ? animate : null);
    const intersection = new IntersectionObserver((entries) => { visible = !!entries[0]?.isIntersecting; updateLoop(); }, { threshold: 0.02 });
    intersection.observe(canvas);
    const onPointer = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = (event.clientX - rect.left) / Math.max(rect.width, 1) * 2 - 1;
      pointer.y = (event.clientY - rect.top) / Math.max(rect.height, 1) * 2 - 1;
    };
    const onPointerLeave = () => { pointer.x = 0; pointer.y = 0; };
    canvas.addEventListener("pointermove", onPointer, { passive: true });
    canvas.addEventListener("pointerleave", onPointerLeave);
    const attributes = new MutationObserver(updateLoop);
    attributes.observe(document.documentElement, { attributes: true, attributeFilter: ["data-motion", "data-reduced-effects"] });
    document.addEventListener("visibilitychange", updateLoop);
    motionQuery.addEventListener("change", updateLoop);
    canvas.addEventListener("webglcontextlost", onError);
    onReady();

    return () => {
      renderer.setAnimationLoop(null);
      intersection.disconnect();
      resizeObserver.disconnect();
      attributes.disconnect();
      document.removeEventListener("visibilitychange", updateLoop);
      motionQuery.removeEventListener("change", updateLoop);
      canvas.removeEventListener("pointermove", onPointer);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("webglcontextlost", onError);
      timer.dispose();
      for (const resource of resources) resource.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    };
  }, [kind, onError, onReady]);

  return <canvas ref={canvasRef} className="fortify-scene-canvas" aria-hidden="true" />;
}

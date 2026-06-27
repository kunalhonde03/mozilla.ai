import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Database, ShieldAlert, Cpu, Activity } from 'lucide-react';
import socketService from '../services/socket';

export default function TopologyVisualizer() {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  
  const [lastEvent, setLastEvent] = useState(null);
  const [activeDetections, setActiveDetections] = useState(0);

  useEffect(() => {
    // 1. Scene Setup
    const container = containerRef.current;
    const width = container.clientWidth || 600;  // fallback if not yet laid out
    const height = 320;

    const scene = new THREE.Scene();
    // Fog to give depth
    scene.background = null; // Transparent background to blend with CSS gradient
    scene.fog = new THREE.FogExp2(0x06070a, 0.08);

    // 2. Camera Setup
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 2, 11);
    camera.lookAt(0, 0, 0);

    // 3. Renderer Setup
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: true
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.15);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
    dirLight.position.set(5, 10, 7);
    scene.add(dirLight);

    // Node-specific point lights for glow effect
    const sourceLight = new THREE.PointLight(0x4facfe, 1.5, 6);
    sourceLight.position.set(-4, 0, 0);
    scene.add(sourceLight);

    const gateLight = new THREE.PointLight(0x00f2fe, 1.5, 6);
    gateLight.position.set(0, 0, 0);
    scene.add(gateLight);

    const computeLight = new THREE.PointLight(0x00f5a0, 1.5, 6);
    computeLight.position.set(4, 0, 0);
    scene.add(computeLight);

    // Injection Alert Flash Light (initially off/black)
    const alertLight = new THREE.PointLight(0xff0844, 0, 10);
    alertLight.position.set(0, 0, 0.5);
    scene.add(alertLight);

    // 5. Geometries & Meshes
    // Node 1: Logs (Source) - Sphere
    const sphereGeo = new THREE.SphereGeometry(0.5, 32, 32);
    const sourceMat = new THREE.MeshStandardMaterial({
      color: 0x4facfe,
      emissive: 0x4facfe,
      emissiveIntensity: 0.5,
      roughness: 0.2,
      metalness: 0.8
    });
    const sourceNode = new THREE.Mesh(sphereGeo, sourceMat);
    sourceNode.position.set(-4, 0, 0);
    scene.add(sourceNode);

    // Node 2: Otari Gate - Box
    const boxGeo = new THREE.BoxGeometry(0.9, 0.9, 0.9);
    const gateMat = new THREE.MeshStandardMaterial({
      color: 0x00f2fe,
      emissive: 0x00f2fe,
      emissiveIntensity: 0.6,
      roughness: 0.1,
      metalness: 0.9
    });
    const gateNode = new THREE.Mesh(boxGeo, gateMat);
    gateNode.position.set(0, 0, 0);
    scene.add(gateNode);

    // Node 3: Local Inference (Compute) - Octahedron
    const octaGeo = new THREE.OctahedronGeometry(0.6, 0);
    const computeMat = new THREE.MeshStandardMaterial({
      color: 0x00f5a0,
      emissive: 0x00f5a0,
      emissiveIntensity: 0.5,
      roughness: 0.3,
      metalness: 0.7
    });
    const computeNode = new THREE.Mesh(octaGeo, computeMat);
    computeNode.position.set(4, 0, 0);
    scene.add(computeNode);

    // Grid Floor
    const gridHelper = new THREE.GridHelper(20, 20, 0x4facfe, 0x1e293b);
    gridHelper.position.y = -1.2;
    // Lower grid opacity
    gridHelper.material.opacity = 0.2;
    gridHelper.material.transparent = true;
    scene.add(gridHelper);

    // Connection Pipes (Tubes representing pathways)
    const createConnectionPipe = (p1, p2, colorVal) => {
      const points = [p1, p2];
      const path = new THREE.CatmullRomCurve3(points);
      const pipeGeo = new THREE.TubeGeometry(path, 20, 0.05, 8, false);
      const pipeMat = new THREE.MeshBasicMaterial({
        color: colorVal,
        transparent: true,
        opacity: 0.15,
        wireframe: true
      });
      return new THREE.Mesh(pipeGeo, pipeMat);
    };

    const pipeLeft = createConnectionPipe(new THREE.Vector3(-4, 0, 0), new THREE.Vector3(0, 0, 0), 0x4facfe);
    const pipeRight = createConnectionPipe(new THREE.Vector3(0, 0, 0), new THREE.Vector3(4, 0, 0), 0x00f5a0);
    scene.add(pipeLeft);
    scene.add(pipeRight);

    // 6. Particle System state arrays
    const particles = [];
    const particleGeometry = new THREE.SphereGeometry(0.08, 8, 8);
    const particleMaterialNormal = new THREE.MeshBasicMaterial({ color: 0x00f2fe });
    const particleMaterialBlocked = new THREE.MeshBasicMaterial({ color: 0xff0844 });
    const particleMaterialSuccess = new THREE.MeshBasicMaterial({ color: 0x00f5a0 });

    // Function to spawn a particle representing a log data packet
    const spawnDataPacket = (isBlocked) => {
      const pMesh = new THREE.Mesh(
        particleGeometry,
        isBlocked ? particleMaterialBlocked.clone() : particleMaterialNormal.clone()
      );
      pMesh.position.set(-4, 0, 0);
      scene.add(pMesh);

      particles.push({
        mesh: pMesh,
        speed: 0.06 + Math.random() * 0.02,
        stage: 0, // 0 = source to gate, 1 = gate to destination, 2 = success finished
        isBlocked: isBlocked,
        progress: 0,
        yOffset: (Math.random() - 0.5) * 0.1, // Slight hover variation
        zOffset: (Math.random() - 0.5) * 0.1
      });
    };

    // Particles explosion fragment geometry
    const fragmentGeo = new THREE.BoxGeometry(0.04, 0.04, 0.04);
    const spawnExplosion = (position) => {
      const fragmentCount = 15;
      for (let i = 0; i < fragmentCount; i++) {
        const fragMat = new THREE.MeshBasicMaterial({ 
          color: 0xff0844,
          transparent: true,
          opacity: 1
        });
        const fragMesh = new THREE.Mesh(fragmentGeo, fragMat);
        fragMesh.position.copy(position);
        scene.add(fragMesh);

        particles.push({
          mesh: fragMesh,
          isFragment: true,
          velocity: new THREE.Vector3(
            (Math.random() - 0.5) * 0.1,
            (Math.random() - 0.5) * 0.1 + 0.03, // Tends to burst upwards
            (Math.random() - 0.5) * 0.1
          ),
          life: 1.0, // Decay value
          decay: 0.02 + Math.random() * 0.02
        });
      }
    };

    // 7. Subscribe to Socket Telemetry to trigger packets dynamically
    const unsubscribeParticles = socketService.subscribe('particles', (data) => {
      setLastEvent(data.blocked ? 'BLOCKED PROMPT INJECTION' : 'DATA PACKET ROUTED');
      spawnDataPacket(data.blocked);
      if (data.blocked) {
        setActiveDetections(d => d + 1);
      }
    });

    // Mouse movement visual feedback (parallax shift)
    let mouseX = 0;
    let mouseY = 0;
    const onMouseMove = (event) => {
      const rect = container.getBoundingClientRect();
      mouseX = ((event.clientX - rect.left) / width) * 2 - 1;
      mouseY = -((event.clientY - rect.top) / height) * 2 + 1;
    };
    container.addEventListener('mousemove', onMouseMove);

    // Window resize handler
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      renderer.setSize(w, height);
      camera.aspect = w / height;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', handleResize);

    // 8. Animation Loop
    let animationFrameId;
    let gateFlashTimer = 0;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      // Node rotations/animations
      sourceNode.rotation.y += 0.01;
      sourceNode.rotation.x += 0.005;

      gateNode.rotation.y += 0.015;
      gateNode.rotation.z += 0.01;

      computeNode.rotation.y += 0.008;
      computeNode.rotation.x += 0.012;

      // Pulse nodes glow intensity based on simple math
      const time = Date.now() * 0.003;
      sourceMat.emissiveIntensity = 0.4 + Math.sin(time) * 0.15;
      gateMat.emissiveIntensity = 0.5 + Math.cos(time * 1.5) * 0.2;
      computeMat.emissiveIntensity = 0.4 + Math.sin(time * 0.8) * 0.15;

      // Handle alert light flash fade
      if (alertLight.intensity > 0) {
        alertLight.intensity -= 0.05;
        // gateNode flash color effect
        gateMat.color.setHex(alertLight.intensity > 0.5 ? 0xff0844 : 0x00f2fe);
        gateMat.emissive.setHex(alertLight.intensity > 0.5 ? 0xff0844 : 0x00f2fe);
      }

      // Parallax camera effect
      camera.position.x += (mouseX * 2.0 - camera.position.x) * 0.05;
      camera.position.y += (mouseY * 1.0 + 2.0 - camera.position.y) * 0.05;
      camera.lookAt(0, 0, 0);

      // Update active particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];

        if (p.isFragment) {
          // Handle explosion fragments
          p.mesh.position.add(p.velocity);
          p.mesh.rotation.x += 0.1;
          p.mesh.rotation.y += 0.1;
          
          p.life -= p.decay;
          p.mesh.material.opacity = p.life;

          if (p.life <= 0) {
            scene.remove(p.mesh);
            p.mesh.geometry.dispose();
            p.mesh.material.dispose();
            particles.splice(i, 1);
          }
          continue;
        }

        // Handle flowing data packets
        if (p.stage === 0) {
          // Moving Source -> Gate
          p.progress += p.speed;
          // Interpolate position from -4 to 0
          const x = THREE.MathUtils.lerp(-4, 0, p.progress);
          // Apply sinusoidal height path
          const y = Math.sin(p.progress * Math.PI) * 0.4 + p.yOffset;
          p.mesh.position.set(x, y, p.zOffset);

          if (p.progress >= 1.0) {
            // Hit the Gate!
            if (p.isBlocked) {
              // Blocked: Flash red and explode
              alertLight.intensity = 2.5;
              spawnExplosion(p.mesh.position);
              
              // Remove particle
              scene.remove(p.mesh);
              p.mesh.geometry.dispose();
              p.mesh.material.dispose();
              particles.splice(i, 1);
            } else {
              // Sanitized/Clean: Shift color to green and move to stage 1
              p.mesh.material = particleMaterialSuccess;
              p.stage = 1;
              p.progress = 0;
            }
          }
        } else if (p.stage === 1) {
          // Moving Gate -> Compute
          p.progress += p.speed;
          // Interpolate position from 0 to 4
          const x = THREE.MathUtils.lerp(0, 4, p.progress);
          const y = Math.sin(p.progress * Math.PI) * 0.4 + p.yOffset;
          p.mesh.position.set(x, y, p.zOffset);

          if (p.progress >= 1.0) {
            // Hit compute, remove particle
            scene.remove(p.mesh);
            p.mesh.geometry.dispose();
            p.mesh.material.dispose();
            particles.splice(i, 1);
          }
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    // Clean up
    return () => {
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('mousemove', onMouseMove);
      unsubscribeParticles();
      cancelAnimationFrame(animationFrameId);
      
      // Dispose meshes and materials
      sourceNode.geometry.dispose();
      sourceNode.material.dispose();
      gateNode.geometry.dispose();
      gateNode.material.dispose();
      computeNode.geometry.dispose();
      computeNode.material.dispose();
      gridHelper.dispose();
      pipeLeft.geometry.dispose();
      pipeLeft.material.dispose();
      pipeRight.geometry.dispose();
      pipeRight.material.dispose();

      particles.forEach(p => {
        scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
      });

      renderer.dispose();
    };
  }, []);

  return (
    <div className="glass-panel" ref={containerRef} style={{ position: 'relative', width: '100%', overflow: 'hidden', padding: '16px' }}>
      <div className="card-header" style={{ marginBottom: '0px', borderBottom: 'none' }}>
        <div className="card-title" style={{ color: 'var(--neon-cyan)' }}>
          <Activity size={16} />
          OtariGuard Gateway Topology
        </div>
        <div style={{ display: 'flex', gap: '16px', fontSize: '12px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--neon-blue)' }} /> Ingress Logs
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--neon-cyan)' }} /> Otari PDP Gate
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--neon-green)' }} /> Downstream Compute
          </span>
        </div>
      </div>

      {/* Floating HTML Labels over Three.js Canvas */}
      <div style={{ position: 'absolute', width: '100%', height: '100%', pointerEvents: 'none', top: 0, left: 0 }}>
        {/* Source Label */}
        <div style={{
          position: 'absolute',
          left: '18%',
          top: '65%',
          transform: 'translateX(-50%)',
          textAlign: 'center',
          color: 'var(--neon-blue)',
          fontSize: '12px',
          fontWeight: '600',
          textShadow: '0 0 10px rgba(79, 172, 254, 0.4)'
        }}>
          <Database size={16} style={{ margin: '0 auto 4px auto' }} />
          LOG SOURCE
        </div>

        {/* Gate Label */}
        <div style={{
          position: 'absolute',
          left: '50%',
          top: '65%',
          transform: 'translateX(-50%)',
          textAlign: 'center',
          color: 'var(--neon-cyan)',
          fontSize: '12px',
          fontWeight: '600',
          textShadow: '0 0 10px rgba(0, 242, 254, 0.4)'
        }}>
          <ShieldAlert size={16} style={{ margin: '0 auto 4px auto' }} />
          OTARI GATEWAY
        </div>

        {/* Compute Label */}
        <div style={{
          position: 'absolute',
          left: '82%',
          top: '65%',
          transform: 'translateX(-50%)',
          textAlign: 'center',
          color: 'var(--neon-green)',
          fontSize: '12px',
          fontWeight: '600',
          textShadow: '0 0 10px rgba(0, 245, 160, 0.4)'
        }}>
          <Cpu size={16} style={{ margin: '0 auto 4px auto' }} />
          LOCAL INFERENCE
        </div>

        {/* Status ticker overlay */}
        {lastEvent && (
          <div style={{
            position: 'absolute',
            bottom: '10px',
            left: '16px',
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            color: lastEvent.includes('BLOCKED') ? 'var(--neon-rose)' : 'var(--text-secondary)',
            background: 'rgba(0,0,0,0.4)',
            padding: '3px 8px',
            borderRadius: '4px',
            border: '1px solid rgba(255,255,255,0.03)'
          }}>
            SYSTEM BUS: {lastEvent}
          </div>
        )}
      </div>

      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '320px', cursor: 'grab' }} />
    </div>
  );
}

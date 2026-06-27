import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Database, ShieldAlert, Cpu, Activity, X, Server, Layers } from 'lucide-react';
import socketService from '../services/socket';

export default function TopologyVisualizer() {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  
  const [lastEvent, setLastEvent] = useState(null);
  const [activeDetections, setActiveDetections] = useState(0);
  const [selectedNode, setSelectedNode] = useState(null);

  useEffect(() => {
    // 1. Scene Setup
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = 320;

    const scene = new THREE.Scene();
    scene.background = null;
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

    const sourceLight = new THREE.PointLight(0x4facfe, 1.5, 6);
    sourceLight.position.set(-4, 0, 0);
    scene.add(sourceLight);

    const gateLight = new THREE.PointLight(0x00f2fe, 1.5, 6);
    gateLight.position.set(0, 0, 0);
    scene.add(gateLight);

    const computeLight = new THREE.PointLight(0x00f5a0, 1.5, 6);
    computeLight.position.set(4, 0, 0);
    scene.add(computeLight);

    const alertLight = new THREE.PointLight(0xff0844, 0, 10);
    alertLight.position.set(0, 0, 0.5);
    scene.add(alertLight);

    // 5. Geometries & Meshes
    // Node 1: Logs (Source)
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
    sourceNode.name = "source";
    scene.add(sourceNode);

    // Node 2: Otari Gate
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
    gateNode.name = "gate";
    scene.add(gateNode);

    // Node 3: Local Inference
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
    computeNode.name = "compute";
    scene.add(computeNode);

    // Interactive array for Raycasting
    const interactiveObjects = [sourceNode, gateNode, computeNode];

    // Grid Floor
    const gridHelper = new THREE.GridHelper(20, 20, 0x4facfe, 0x1e293b);
    gridHelper.position.y = -1.2;
    gridHelper.material.opacity = 0.2;
    gridHelper.material.transparent = true;
    scene.add(gridHelper);

    // Connection Pipes
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

    // Particles
    const particles = [];
    const particleGeometry = new THREE.SphereGeometry(0.08, 8, 8);
    const particleMaterialNormal = new THREE.MeshBasicMaterial({ color: 0x00f2fe });
    const particleMaterialBlocked = new THREE.MeshBasicMaterial({ color: 0xff0844 });
    const particleMaterialSuccess = new THREE.MeshBasicMaterial({ color: 0x00f5a0 });

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
        stage: 0,
        isBlocked: isBlocked,
        progress: 0,
        yOffset: (Math.random() - 0.5) * 0.1,
        zOffset: (Math.random() - 0.5) * 0.1
      });
    };

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
            (Math.random() - 0.5) * 0.1 + 0.03,
            (Math.random() - 0.5) * 0.1
          ),
          life: 1.0,
          decay: 0.02 + Math.random() * 0.02
        });
      }
    };

    // Subscriptions
    const unsubscribeParticles = socketService.subscribe('particles', (data) => {
      setLastEvent(data.blocked ? 'BLOCKED PROMPT INJECTION' : 'DATA PACKET ROUTED');
      spawnDataPacket(data.blocked);
      if (data.blocked) {
        setActiveDetections(d => d + 1);
      }
    });

    // Raycaster Click Handler
    const raycaster = new THREE.Raycaster();
    const mouse2D = new THREE.Vector2();

    const onClick = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse2D.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse2D.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse2D, camera);
      const intersects = raycaster.intersectObjects(interactiveObjects);

      if (intersects.length > 0) {
        const clickedName = intersects[0].object.name;
        setSelectedNode(clickedName);
      }
    };
    renderer.domElement.addEventListener('click', onClick);

    // Mouse Parallax movement
    let mouseX = 0;
    let mouseY = 0;
    const onMouseMove = (event) => {
      const rect = container.getBoundingClientRect();
      mouseX = ((event.clientX - rect.left) / width) * 2 - 1;
      mouseY = -((event.clientY - rect.top) / height) * 2 + 1;
    };
    container.addEventListener('mousemove', onMouseMove);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      renderer.setSize(w, height);
      camera.aspect = w / height;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', handleResize);

    // Animation Loop
    let animationFrameId;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      sourceNode.rotation.y += 0.01;
      sourceNode.rotation.x += 0.005;

      gateNode.rotation.y += 0.015;
      gateNode.rotation.z += 0.01;

      computeNode.rotation.y += 0.008;
      computeNode.rotation.x += 0.012;

      const time = Date.now() * 0.003;
      sourceMat.emissiveIntensity = 0.4 + Math.sin(time) * 0.15;
      gateMat.emissiveIntensity = 0.5 + Math.cos(time * 1.5) * 0.2;
      computeMat.emissiveIntensity = 0.4 + Math.sin(time * 0.8) * 0.15;

      if (alertLight.intensity > 0) {
        alertLight.intensity -= 0.05;
        gateMat.color.setHex(alertLight.intensity > 0.5 ? 0xff0844 : 0x00f2fe);
        gateMat.emissive.setHex(alertLight.intensity > 0.5 ? 0xff0844 : 0x00f2fe);
      }

      camera.position.x += (mouseX * 1.5 - camera.position.x) * 0.05;
      camera.position.y += (mouseY * 0.8 + 2.0 - camera.position.y) * 0.05;
      camera.lookAt(0, 0, 0);

      // Scale up selected node slightly
      sourceNode.scale.setScalar(selectedNode === "source" ? 1.2 : 1.0);
      gateNode.scale.setScalar(selectedNode === "gate" ? 1.2 : 1.0);
      computeNode.scale.setScalar(selectedNode === "compute" ? 1.2 : 1.0);

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];

        if (p.isFragment) {
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

        if (p.stage === 0) {
          p.progress += p.speed;
          const x = THREE.MathUtils.lerp(-4, 0, p.progress);
          const y = Math.sin(p.progress * Math.PI) * 0.4 + p.yOffset;
          p.mesh.position.set(x, y, p.zOffset);

          if (p.progress >= 1.0) {
            if (p.isBlocked) {
              alertLight.intensity = 2.5;
              spawnExplosion(p.mesh.position);
              scene.remove(p.mesh);
              p.mesh.geometry.dispose();
              p.mesh.material.dispose();
              particles.splice(i, 1);
            } else {
              p.mesh.material = particleMaterialSuccess;
              p.stage = 1;
              p.progress = 0;
            }
          }
        } else if (p.stage === 1) {
          p.progress += p.speed;
          const x = THREE.MathUtils.lerp(0, 4, p.progress);
          const y = Math.sin(p.progress * Math.PI) * 0.4 + p.yOffset;
          p.mesh.position.set(x, y, p.zOffset);

          if (p.progress >= 1.0) {
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

    return () => {
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('mousemove', onMouseMove);
      if (renderer.domElement) {
        renderer.domElement.removeEventListener('click', onClick);
      }
      unsubscribeParticles();
      cancelAnimationFrame(animationFrameId);
      
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
  }, [selectedNode]);

  // Selected node detailed specifications mapping
  const getNodeDetails = () => {
    switch (selectedNode) {
      case "source":
        return {
          title: "LOGS_INGRESS_BUS_01",
          type: "Input Stream Adapter",
          desc: "Watches the server logs stream file in real-time. Collects raw user requests and forwards them to the Otari gateway.",
          metrics: { "Channel Port": "Stdio", "Read Rate": "~3.3 p/s", "Buffer Alloc": "1024KB" }
        };
      case "gate":
        return {
          title: "OTARIGUARD_PDP_SHIELD",
          type: "Policy Decision Point Gateway",
          desc: "The active security node. Applies prompt-level filters to scan for injections and enforces hard quota budget policies.",
          metrics: { "Max Quota Limit": "$2.00", "Rate Limit": "100 RPM", "Active Rules": "Rule-101, 205, 302" }
        };
      case "compute":
        return {
          title: "INFERENCE_CORE_02",
          type: "Downstream LLM Compute Node",
          desc: "Local server hosting model parameters. Runs prompt queries on CPU/GPU threads only after gateway authorization.",
          metrics: { "Host Core": "Llamafile Server", "Thread Alloc": "8 CPU threads", "Model Name": "Llama-3-8B" }
        };
      default:
        return null;
    }
  };

  const nodeDetails = getNodeDetails();

  return (
    <div className="glass-panel" ref={containerRef} style={{ position: 'relative', width: '100%', overflow: 'hidden', padding: '16px' }}>
      <div className="card-header" style={{ marginBottom: '0px', borderBottom: 'none' }}>
        <div className="card-title" style={{ color: 'var(--neon-cyan)', fontFamily: 'var(--font-mono)' }}>
          <Activity size={16} />
          OTARIGUARD_TOPOLOGY_MONITOR
        </div>
        <div style={{ display: 'flex', gap: '16px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--neon-blue)' }} /> Ingress
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--neon-cyan)' }} /> PDP Gate
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--neon-green)' }} /> Downstream
          </span>
        </div>
      </div>

      {/* Floating HTML Labels */}
      <div style={{ position: 'absolute', width: '100%', height: '100%', pointerEvents: 'none', top: 0, left: 0 }}>
        <div style={{
          position: 'absolute',
          left: '18%',
          top: '65%',
          transform: 'translateX(-50%)',
          textAlign: 'center',
          color: 'var(--neon-blue)',
          fontSize: '11px',
          fontFamily: 'var(--font-mono)'
        }}>
          <Database size={14} style={{ margin: '0 auto 4px auto' }} />
          LOG_SOURCE
        </div>

        <div style={{
          position: 'absolute',
          left: '50%',
          top: '65%',
          transform: 'translateX(-50%)',
          textAlign: 'center',
          color: 'var(--neon-cyan)',
          fontSize: '11px',
          fontFamily: 'var(--font-mono)'
        }}>
          <ShieldAlert size={14} style={{ margin: '0 auto 4px auto' }} />
          OTARI_GATEWAY
        </div>

        <div style={{
          position: 'absolute',
          left: '82%',
          top: '65%',
          transform: 'translateX(-50%)',
          textAlign: 'center',
          color: 'var(--neon-green)',
          fontSize: '11px',
          fontFamily: 'var(--font-mono)'
        }}>
          <Cpu size={14} style={{ margin: '0 auto 4px auto' }} />
          LOCAL_COMPUTE
        </div>

        {/* Status ticker */}
        {lastEvent && (
          <div style={{
            position: 'absolute',
            bottom: '10px',
            left: '16px',
            fontSize: '10px',
            fontFamily: 'var(--font-mono)',
            color: lastEvent.includes('BLOCKED') ? 'var(--neon-rose)' : 'var(--text-secondary)',
            background: 'rgba(0,0,0,0.5)',
            padding: '3px 8px',
            borderRadius: '4px',
            border: '1px solid rgba(255,255,255,0.03)'
          }}>
            BUS_STATUS: {lastEvent}
          </div>
        )}
      </div>

      {/* Floating Raycasted Node Inspector Sidebar */}
      {nodeDetails && (
        <div style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          width: '240px',
          background: 'rgba(6, 7, 10, 0.95)',
          border: '1px solid var(--border-medium)',
          borderRadius: '8px',
          padding: '12px',
          zIndex: 100,
          fontFamily: 'var(--font-mono)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px' }}>
            <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--neon-cyan)' }}>NODE_INSPECTOR</span>
            <button 
              onClick={() => setSelectedNode(null)} 
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
            >
              <X size={12} />
            </button>
          </div>
          <div style={{ fontSize: '11px', fontWeight: '600', color: '#fff', marginBottom: '2px' }}>{nodeDetails.title}</div>
          <div style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>{nodeDetails.type}</div>
          <div style={{ fontSize: '10px', color: 'var(--text-secondary)', lineHeight: '1.4', marginBottom: '8px' }}>{nodeDetails.desc}</div>
          <div style={{ borderTop: '1px dashed rgba(255,255,255,0.05)', paddingTop: '6px' }}>
            {Object.entries(nodeDetails.metrics).map(([key, val]) => (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', margin: '3px 0' }}>
                <span style={{ color: 'var(--text-muted)' }}>{key}:</span>
                <span style={{ color: '#fff' }}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '320px', cursor: 'pointer' }} />
    </div>
  );
}

import React, { useEffect, useRef, useState } from 'react';
import socketService from '../services/socket';

const WIDTH = 800;
const HEIGHT = 80;
const POINTS = 120;
const NORMAL_AMP = 6;
const ATTACK_AMP = 38;
const ATTACK_COLOR = '#ff4d6d';
const NORMAL_COLOR = '#00f2fe';

function generateNormalPoint(i, t) {
  const base = Math.sin(i * 0.18 + t * 0.05) * NORMAL_AMP;
  const blip = i % 20 === 10 ? 12 : i % 20 === 11 ? -8 : i % 20 === 12 ? 14 : 0;
  return HEIGHT / 2 - base - blip * 0.5;
}

export default function ThreatPulse() {
  const canvasRef = useRef(null);
  const stateRef = useRef({
    points: Array(POINTS).fill(HEIGHT / 2),
    attackMode: false,
    attackDecay: 0,
    t: 0,
    totalAttacks: 0,
  });
  const [displayStats, setDisplayStats] = useState({ attacks: 0, status: 'NOMINAL', latency: 0 });

  useEffect(() => {
    const unsub = socketService.subscribe('logs', (log) => {
      const s = stateRef.current;
      if (log.blocked) {
        s.attackMode = true;
        s.attackDecay = 60;
        s.totalAttacks++;
        setDisplayStats(prev => ({ ...prev, attacks: s.totalAttacks, status: 'THREAT_DETECTED' }));
      } else {
        if (!s.attackMode) {
          setDisplayStats(prev => ({ ...prev, status: 'NOMINAL' }));
        }
      }
    });

    const unsubStats = socketService.subscribe('stats', (data) => {
      setDisplayStats(prev => ({ ...prev, latency: data.gateLatency || 0 }));
    });

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;

    function draw() {
      const s = stateRef.current;
      s.t++;

      if (s.attackMode && s.attackDecay > 0) {
        s.attackDecay--;
        if (s.attackDecay <= 0) {
          s.attackMode = false;
          setDisplayStats(prev => ({ ...prev, status: 'NOMINAL' }));
        }
      }

      s.points.shift();

      let newY;
      if (s.attackMode) {
        const spike = Math.sin(s.t * 0.8) * ATTACK_AMP * (s.attackDecay / 60);
        const chaos = (Math.random() - 0.5) * ATTACK_AMP * 0.6 * (s.attackDecay / 60);
        newY = HEIGHT / 2 - spike - chaos;
      } else {
        newY = generateNormalPoint(s.t, s.t);
      }
      s.points.push(newY);

      ctx.clearRect(0, 0, WIDTH, HEIGHT);

      if (s.attackMode) {
        const grd = ctx.createLinearGradient(0, 0, 0, HEIGHT);
        grd.addColorStop(0, `rgba(255,77,109,${0.06 * (s.attackDecay / 60)})`);
        grd.addColorStop(1, 'transparent');
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
      }

      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 1;
      for (let x = 0; x < WIDTH; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, HEIGHT); ctx.stroke();
      }
      for (let y = 0; y < HEIGHT; y += 20) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WIDTH, y); ctx.stroke();
      }

      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(0, HEIGHT / 2); ctx.lineTo(WIDTH, HEIGHT / 2); ctx.stroke();
      ctx.setLineDash([]);

      const color = s.attackMode ? ATTACK_COLOR : NORMAL_COLOR;
      const stepX = WIDTH / (POINTS - 1);

      ctx.shadowColor = color;
      ctx.shadowBlur = s.attackMode ? 18 : 8;
      ctx.strokeStyle = color;
      ctx.lineWidth = s.attackMode ? 2.5 : 1.5;
      ctx.beginPath();
      s.points.forEach((y, i) => {
        const x = i * stepX;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.shadowBlur = 0;

      const fillGrad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
      fillGrad.addColorStop(0, s.attackMode ? 'rgba(255,77,109,0.12)' : 'rgba(0,242,254,0.08)');
      fillGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = fillGrad;
      ctx.beginPath();
      s.points.forEach((y, i) => {
        const x = i * stepX;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.lineTo(WIDTH, HEIGHT);
      ctx.lineTo(0, HEIGHT);
      ctx.closePath();
      ctx.fill();

      animId = requestAnimationFrame(draw);
    }

    draw();
    return () => {
      cancelAnimationFrame(animId);
      unsub();
      unsubStats();
    };
  }, []);

  const isAttack = displayStats.status !== 'NOMINAL';

  return (
    <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: '700', letterSpacing: '1px' }}>
          <span style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: isAttack ? ATTACK_COLOR : NORMAL_COLOR,
            boxShadow: isAttack ? `0 0 10px ${ATTACK_COLOR}` : `0 0 8px ${NORMAL_COLOR}`,
            animation: 'pulse 0.8s ease-in-out infinite',
            flexShrink: 0
          }} />
          <span style={{ color: isAttack ? ATTACK_COLOR : NORMAL_COLOR }}>
            THREAT_PULSE_MONITOR
          </span>
        </div>
        <div style={{ display: 'flex', gap: '16px', fontFamily: 'var(--font-mono)', fontSize: '10px' }}>
          <span style={{ color: 'var(--text-muted)' }}>GATE: <strong style={{ color: 'var(--neon-cyan)' }}>{displayStats.latency}ms</strong></span>
          <span style={{ color: 'var(--text-muted)' }}>ATTACKS: <strong style={{ color: ATTACK_COLOR }}>{displayStats.attacks}</strong></span>
          <span style={{
            padding: '2px 8px', borderRadius: '3px',
            background: isAttack ? 'rgba(255,77,109,0.15)' : 'rgba(0,242,254,0.08)',
            border: `1px solid ${isAttack ? 'rgba(255,77,109,0.4)' : 'rgba(0,242,254,0.2)'}`,
            color: isAttack ? ATTACK_COLOR : NORMAL_COLOR,
            fontWeight: '700', letterSpacing: '1px'
          }}>
            {displayStats.status}
          </span>
        </div>
      </div>

      <div style={{
        borderRadius: '6px', overflow: 'hidden',
        border: `1px solid ${isAttack ? 'rgba(255,77,109,0.2)' : 'rgba(0,242,254,0.1)'}`,
        transition: 'border-color 0.4s',
        background: 'rgba(0,0,0,0.3)'
      }}>
        <canvas
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
          style={{ width: '100%', height: `${HEIGHT}px`, display: 'block' }}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)' }}>
        <span>← HISTORICAL (120 frames)</span>
        <span style={{ color: isAttack ? ATTACK_COLOR : 'var(--neon-cyan)' }}>
          {isAttack ? '⚠ INJECTION SPIKE DETECTED — Gateway intercepting' : '● OTARI GATEWAY — Normal traffic flow'}
        </span>
        <span>LIVE →</span>
      </div>
    </div>
  );
}

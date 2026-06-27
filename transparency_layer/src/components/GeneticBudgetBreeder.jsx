import React, { useState, useEffect, useRef } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Dna, TrendingUp, TrendingDown, Minus, Zap, Shield, AlertTriangle, Activity, Wallet } from 'lucide-react';
import socketService from '../services/socket';

// ── Color maps for each GA mode ──────────────────────────────────────────────
const MODE_CONFIG = {
  STABLE_BASELINE: {
    label: 'STABLE_BASELINE',
    color: 'var(--neon-green)',
    bg: 'rgba(0, 255, 136, 0.06)',
    border: 'rgba(0, 255, 136, 0.2)',
    icon: Shield,
    description: 'GA converged at equilibrium'
  },
  THREAT_CONTRACTION: {
    label: 'THREAT_CONTRACTION',
    color: 'var(--neon-yellow)',
    bg: 'rgba(255, 210, 0, 0.06)',
    border: 'rgba(255, 210, 0, 0.2)',
    icon: TrendingDown,
    description: 'Budget tightening on threats'
  },
  AI_STARVATION: {
    label: 'AI_STARVATION',
    color: 'var(--neon-rose)',
    bg: 'rgba(255, 56, 96, 0.08)',
    border: 'rgba(255, 56, 96, 0.3)',
    icon: AlertTriangle,
    description: 'Attacker starved — budget zeroed'
  },
  SURVIVAL_EXPANSION: {
    label: 'SURVIVAL_EXPANSION',
    color: 'var(--neon-cyan)',
    bg: 'rgba(0, 242, 254, 0.06)',
    border: 'rgba(0, 242, 254, 0.2)',
    icon: TrendingUp,
    description: 'Emergency expansion for survival'
  }
};

// ── Mini DNA Strand Visualization ─────────────────────────────────────────────
function DnaStrand({ threatRatio, color }) {
  const bases = ['A', 'T', 'G', 'C'];
  const pairs = 8;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'center' }}>
      {Array.from({ length: pairs }).map((_, i) => {
        const isThreat = Math.random() < threatRatio;
        const baseColor = isThreat ? 'var(--neon-rose)' : color;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{
              fontSize: '9px',
              fontFamily: 'var(--font-mono)',
              color: baseColor,
              opacity: 0.8,
              minWidth: '10px',
              textAlign: 'center'
            }}>
              {bases[i % 4]}
            </span>
            <div style={{
              display: 'flex',
              gap: '2px',
              alignItems: 'center'
            }}>
              {[...Array(3)].map((_, j) => (
                <div key={j} style={{
                  width: '3px',
                  height: '2px',
                  borderRadius: '1px',
                  background: j === 1 ? baseColor : `${baseColor}44`,
                  boxShadow: j === 1 ? `0 0 4px ${baseColor}` : 'none'
                }} />
              ))}
            </div>
            <span style={{
              fontSize: '9px',
              fontFamily: 'var(--font-mono)',
              color: baseColor,
              opacity: 0.8,
              minWidth: '10px',
              textAlign: 'center'
            }}>
              {bases[(i + 2) % 4]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Genome Fitness Bar ────────────────────────────────────────────────────────
function FitnessBar({ label, value, max = 100, color }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
        <span style={{ color: 'var(--text-muted)' }}>{label}</span>
        <span style={{ color }}>{value.toFixed(1)}</span>
      </div>
      <div style={{
        height: '3px',
        background: 'rgba(255,255,255,0.05)',
        borderRadius: '2px',
        overflow: 'hidden'
      }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: color,
          boxShadow: `0 0 6px ${color}`,
          transition: 'width 0.5s ease-out'
        }} />
      </div>
    </div>
  );
}

// ── Evolution History Mini-Chart ──────────────────────────────────────────────
function EvolutionHistory({ history }) {
  if (history.length < 2) return null;
  const maxC = 3.0;
  const w = 200;
  const h = 40;
  const points = history.map((entry, i) => {
    const x = (i / (history.length - 1)) * w;
    const y = h - (entry.ceiling / maxC) * h;
    return `${x},${y}`;
  }).join(' ');

  const colorForMode = (mode) => {
    if (mode === 'AI_STARVATION') return '#ff3860';
    if (mode === 'SURVIVAL_EXPANSION') return '#00f2fe';
    if (mode === 'THREAT_CONTRACTION') return '#ffd200';
    return '#00ff88';
  };

  return (
    <div style={{ position: 'relative' }}>
      <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ overflow: 'visible' }}>
        {/* Reference line at $2.00 */}
        <line x1="0" y1={h - (2.0 / maxC) * h} x2={w} y2={h - (2.0 / maxC) * h}
          stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="4,4" />
        {/* Evolution path */}
        <polyline
          points={points}
          fill="none"
          stroke="rgba(0, 242, 254, 0.4)"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {/* Data points colored by mode */}
        {history.map((entry, i) => {
          const x = (i / (history.length - 1)) * w;
          const y = h - (entry.ceiling / maxC) * h;
          return (
            <circle key={i} cx={x} cy={y} r="2.5"
              fill={colorForMode(entry.mode)}
              style={{ filter: `drop-shadow(0 0 3px ${colorForMode(entry.mode)})` }}
            />
          );
        })}
      </svg>
      <div style={{
        position: 'absolute',
        right: 0,
        top: h - (2.0 / maxC) * h - 8,
        fontSize: '8px',
        color: 'rgba(255,255,255,0.2)',
        fontFamily: 'var(--font-mono)'
      }}>$2.00</div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function GeneticBudgetBreeder() {
  const [genome, setGenome] = useState({
    ceiling: 2.00,
    prev_ceiling: 2.00,
    delta: 0.0,
    mode: 'STABLE_BASELINE',
    color: 'green',
    reason: 'Awaiting first GA evolution cycle...',
    generation: 0,
    fitness_best: 0,
    fitness_avg: 0,
    dna: { threatRatio: 0.05, cpuUsage: 0.45, systemHealth: 0.95, isDDoS: false, isCritical: false }
  });
  const [history, setHistory] = useState([]);
  const [pulse, setPulse] = useState(false);
  const [dnaKey, setDnaKey] = useState(0);
  const [spent, setSpent] = useState(0.42);
  const [fixedCeiling, setFixedCeiling] = useState(2.00);
  const [toolStopped, setToolStopped] = useState(false);

  useEffect(() => {
    const unsubGenome = socketService.subscribe('genome', (data) => {
      // Still show active DNA states and telemetry from server
      setGenome(data);
      setHistory(prev => {
        const next = [...prev, { ceiling: 2.00, mode: data.mode }];
        return next.slice(-16);
      });
      setPulse(true);
      setDnaKey(k => k + 1);
      setTimeout(() => setPulse(false), 600);
    });
    const unsubBudget = socketService.subscribe('budget', (data) => {
      if (!toolStopped) {
        setSpent(data.spent);
      }
    });
    return () => { unsubGenome(); unsubBudget(); };
  }, [toolStopped]);

  const cfg = MODE_CONFIG[genome.mode] || MODE_CONFIG.STABLE_BASELINE;
  const ModeIcon = cfg.icon;
  const delta = genome.delta || 0;
  const DeltaIcon = delta > 0.01 ? TrendingUp : delta < -0.01 ? TrendingDown : Minus;
  const deltaColor = delta > 0.01 ? 'var(--neon-cyan)' : delta < -0.01 ? 'var(--neon-rose)' : 'var(--text-muted)';

  const dna = genome.dna || {};

  return (
    <div
      className="glass-panel"
      style={{
        padding: '18px',
        border: `1px solid ${pulse ? cfg.color : cfg.border}`,
        background: cfg.bg,
        transition: 'border-color 0.3s ease',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px'
      }}
    >
      {/* ── Header ── */}
      <div className="card-header" style={{ marginBottom: 0 }}>
        <div className="card-title" style={{ gap: '8px' }}>
          <Wallet size={15} style={{ color: 'var(--neon-green)' }} />
          Budget Enforcer Panel
        </div>
        <div style={{
          fontSize: '9px',
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-muted)'
        }}>
          STATUS: <span style={{ color: toolStopped ? 'var(--neon-rose)' : 'var(--neon-green)' }}>{toolStopped ? 'HALTED' : 'ACTIVE'}</span>
        </div>
      </div>

      {/* ── Live Spend Gauge (Fixed $2.00 Budget) ── */}
      {(() => {
        const ceiling = fixedCeiling;
        const spentPct = Math.min(100, (spent / ceiling) * 100);
        const isLimitReached = spent >= ceiling;
        const gaugeData = [
          { name: 'Spent', value: Math.min(spent, ceiling) },
          { name: 'Left',  value: Math.max(0, ceiling - spent) }
        ];
        const gaugeColor = isLimitReached ? 'var(--neon-rose)'
          : spent >= ceiling * 0.75 ? 'var(--neon-yellow)'
          : 'var(--neon-green)';
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              {/* Semi-circle gauge */}
              <div style={{ position: 'relative', width: '130px', height: '72px', flexShrink: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={gaugeData} cx="50%" cy="90%" startAngle={180} endAngle={0}
                      innerRadius="62%" outerRadius="85%" paddingAngle={0} dataKey="value" stroke="none">
                      <Cell fill={gaugeColor} />
                      <Cell fill="rgba(255,255,255,0.05)" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
                  textAlign: 'center', whiteSpace: 'nowrap' }}>
                  <div style={{ fontSize: '18px', fontWeight: '700', color: '#fff', lineHeight: 1,
                    textShadow: `0 0 10px ${gaugeColor}40` }}>
                    ${spent.toFixed(2)}
                  </div>
                </div>
              </div>
              {/* Right side details */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Wallet size={12} style={{ color: gaugeColor }} />
                  <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                    {toolStopped ? 'TOOL_STOPPED' : 'LIVE SPEND'}
                  </span>
                  <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: gaugeColor, marginLeft: 'auto', fontWeight: '700' }}>
                    {spentPct.toFixed(1)}%
                  </span>
                </div>
                {/* Progress bar */}
                <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${spentPct}%`, background: gaugeColor,
                    boxShadow: `0 0 8px ${gaugeColor}`, transition: 'width 0.4s ease-out' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px',
                  fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                  <span>$0.00</span>
                  <span style={{ color: 'var(--text-secondary)' }}>Limit: <span style={{ color: 'var(--neon-cyan)' }}>${ceiling.toFixed(2)}</span></span>
                </div>
              </div>
            </div>

            {/* Interactive User Choices on Limit Hit */}
            {isLimitReached && !toolStopped && (
              <div style={{
                background: 'rgba(255, 8, 68, 0.08)',
                border: '1px solid rgba(255, 8, 68, 0.3)',
                padding: '12px',
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                marginTop: '4px'
              }}>
                <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--neon-rose)', fontFamily: 'var(--font-mono)' }}>
                  ⚠️ BUDGET CEILING EXCEEDED
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  You have hit your ${ceiling.toFixed(2)} budget limit. Please select an option:
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  <button 
                    onClick={() => setFixedCeiling(prev => prev + 2.00)}
                    className="btn"
                    style={{
                      flex: 1,
                      fontSize: '11px',
                      padding: '6px 10px',
                      background: 'rgba(0, 242, 254, 0.1)',
                      borderColor: 'var(--neon-cyan)',
                      color: 'var(--neon-cyan)'
                    }}
                  >
                    Increase Limit (+$2)
                  </button>
                  <button 
                    onClick={() => {
                      setToolStopped(true);
                      socketService.enableSimulation(false); // Stop simulation feeds
                    }}
                    className="btn"
                    style={{
                      flex: 1,
                      fontSize: '11px',
                      padding: '6px 10px',
                      background: 'rgba(255, 8, 68, 0.1)',
                      borderColor: 'var(--neon-rose)',
                      color: 'var(--neon-rose)'
                    }}
                  >
                    Stop Tool
                  </button>
                </div>
              </div>
            )}

            {toolStopped && (
              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                padding: '10px 12px',
                borderRadius: '8px',
                fontSize: '11px',
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-mono)',
                textAlign: 'center',
                marginTop: '4px'
              }}>
                🛑 PDP Gate Offline. Gateway processes halted.
                <button 
                  onClick={() => {
                    setSpent(0);
                    setToolStopped(false);
                    socketService.enableSimulation(true);
                  }}
                  className="btn"
                  style={{
                    display: 'block',
                    margin: '8px auto 0 auto',
                    fontSize: '10px',
                    padding: '4px 10px'
                  }}
                >
                  Restart Guard
                </button>
              </div>
            )}
          </div>
        );
      })()}

    </div>
  );
}

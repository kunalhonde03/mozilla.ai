import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Wallet, ShieldAlert, CheckCircle, Clock, Server } from 'lucide-react';
import socketService from '../services/socket';

const DEFAULT_LIMIT = 2.00;

export default function BudgetEnforcer() {
  const [spent, setSpent] = useState(0.42);
  const [budgetLimit, setBudgetLimit] = useState(DEFAULT_LIMIT);
  const [stats, setStats] = useState({
    gateLatency: 12,
    inferenceLatency: 45,
    activeModel: 'DeepSeek-1.5B (Local)'
  });

  useEffect(() => {
    // Subscribe to real-time budget telemetry
    const unsubscribeBudget = socketService.subscribe('budget', (data) => {
      setSpent(data.spent);
    });

    // Subscribe to GA genome to get the dynamically evolved ceiling
    const unsubscribeGenome = socketService.subscribe('genome', (data) => {
      if (data.ceiling !== undefined) {
        setBudgetLimit(Number(data.ceiling.toFixed(2)));
      }
    });

    // Subscribe to real-time latency stats
    const unsubscribeStats = socketService.subscribe('stats', (data) => {
      setStats(data);
    });

    return () => {
      unsubscribeBudget();
      unsubscribeGenome();
      unsubscribeStats();
    };
  }, []);

  const percentage = Math.min(100, (spent / budgetLimit) * 100);
  const warnThreshold = budgetLimit * 0.75;
  const critThreshold = budgetLimit * 0.90;
  const isNearLimit = spent >= warnThreshold && spent < critThreshold;
  const isLimitExceeded = spent >= critThreshold;

  // Chart data setup for semi-circle — uses dynamic GA ceiling
  const chartData = [
    { name: 'Spent', value: Math.min(spent, budgetLimit) },
    { name: 'Remaining', value: Math.max(0, budgetLimit - spent) }
  ];

  const getEnforcerColor = () => {
    if (isLimitExceeded) return 'var(--neon-rose)';
    if (isNearLimit || spent >= 1.2) return 'var(--neon-yellow)';
    return 'var(--neon-green)';
  };

  const activeColor = getEnforcerColor();

  return (
    <div className="glass-panel" style={{ padding: '20px', flexGrow: 1, minHeight: '430px', display: 'flex', flexDirection: 'column' }}>
      {/* Title Header */}
      <div className="card-header" style={{ marginBottom: '8px' }}>
        <div className="card-title">
          <Wallet size={16} style={{ color: activeColor }} />
          Wallet Enforcer Gauge
        </div>
        <div className="status-badge" style={{ borderColor: isLimitExceeded ? 'var(--neon-rose)' : 'var(--border-dim)' }}>
          {isLimitExceeded ? (
            <span style={{ color: 'var(--neon-rose)', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold' }}>
              <span className="pulse-dot-rose" /> PDP BLOCKED
            </span>
          ) : isNearLimit ? (
            <span style={{ color: 'var(--neon-yellow)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="pulse-dot-cyan" style={{ background: 'var(--neon-yellow)' }} /> WARNING
            </span>
          ) : (
            <span style={{ color: 'var(--neon-green)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="pulse-dot-green" /> ACTIVE GUARD
            </span>
          )}
        </div>
      </div>

      {/* Gauge Chart */}
      <div style={{ position: 'relative', width: '100%', height: '150px', marginTop: '5px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="90%"
              startAngle={180}
              endAngle={0}
              innerRadius="65%"
              outerRadius="88%"
              paddingAngle={0}
              dataKey="value"
              stroke="none"
            >
              <Cell fill={activeColor} />
              <Cell fill="rgba(255, 255, 255, 0.05)" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        <div style={{
          position: 'absolute',
          bottom: '4px',
          left: '50%',
          transform: 'translateX(-50%)',
          textAlign: 'center',
          pointerEvents: 'none',
          whiteSpace: 'nowrap'
        }}>
          <div style={{ 
            fontSize: '28px', 
            fontWeight: '700', 
            color: '#fff',
            textShadow: `0 0 12px ${activeColor}30`,
            lineHeight: 1
          }}>
            ${spent.toFixed(2)}
          </div>
          <div style={{ 
            fontSize: '10px', 
            fontWeight: '600', 
            color: 'var(--text-secondary)',
            letterSpacing: '1px',
            marginTop: '2px'
          }}>
            OF ${budgetLimit.toFixed(2)} CEILING
          </div>
        </div>
      </div>

      {/* Details & Telemetry Progress bar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)' }}>
          <span>Budget Burn Rate</span>
          <span style={{ color: '#fff', fontWeight: '500' }}>{percentage.toFixed(1)}%</span>
        </div>
        <div style={{ height: '4px', width: '100%', backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ 
            height: '100%', 
            width: `${percentage}%`, 
            backgroundColor: activeColor,
            boxShadow: `0 0 8px ${activeColor}`,
            transition: 'width 0.4s ease-out'
          }} />
        </div>
      </div>

      {/* Action / Warning Status panel */}
      <div style={{ 
        background: 'rgba(0,0,0,0.2)', 
        border: '1px solid rgba(255, 255, 255, 0.04)',
        borderRadius: '6px', 
        padding: '8px 10px',
        fontSize: '11px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '12px'
      }}>
        {isLimitExceeded ? (
          <>
            <ShieldAlert size={14} style={{ color: 'var(--neon-rose)' }} />
            <span><strong>Blocked:</strong> Downstream LLM tokens suspended by PDP gateway.</span>
          </>
        ) : isNearLimit ? (
          <>
            <ShieldAlert size={14} style={{ color: 'var(--neon-yellow)' }} />
            <span><strong>Warning:</strong> Reached soft threshold. Rate limiting in effect.</span>
          </>
        ) : (
          <>
            <CheckCircle size={14} style={{ color: 'var(--neon-green)' }} />
            <span><strong>Active:</strong> Policy filters passing. Access tokens cleared.</span>
          </>
        )}
      </div>

      {/* Manual Limit Modifier Controls */}
      <div style={{ 
        display: 'flex', 
        gap: '8px', 
        marginBottom: '16px',
        fontFamily: 'var(--font-mono)',
        fontSize: '11px'
      }}>
        <button 
          onClick={() => setBudgetLimit(prev => Math.min(10.0, prev + 1.0))}
          className="btn"
          style={{ 
            flexGrow: 1, 
            padding: '6px 8px', 
            fontSize: '10px',
            borderColor: 'var(--neon-cyan)',
            color: 'var(--neon-cyan)',
            background: 'rgba(0, 242, 254, 0.05)'
          }}
        >
          ➕ INCREASE LIMIT (+$1.00)
        </button>
        <button 
          onClick={() => {
            setBudgetLimit(DEFAULT_LIMIT);
            setSpent(0.42); // reset spent as well for demo refresh
          }}
          className="btn btn-secondary"
          style={{ 
            flexGrow: 1, 
            padding: '6px 8px', 
            fontSize: '10px'
          }}
        >
          🔄 RESET TO DEFAULT ($2.00)
        </button>
      </div>

      {/* HIGH-DENSITY CLOUD TELEMETRY TABLE */}
      <div style={{ 
        marginTop: 'auto',
        borderTop: '1px dashed rgba(255, 255, 255, 0.08)',
        paddingTop: '12px'
      }}>
        <div style={{ 
          fontSize: '10px', 
          fontWeight: '700', 
          color: 'var(--text-secondary)', 
          textTransform: 'uppercase', 
          letterSpacing: '1px',
          marginBottom: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <Server size={12} style={{ color: 'var(--neon-cyan)' }} />
          INFRASTRUCTURE TELEMETRY
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
          fontSize: '12px',
          fontFamily: 'var(--font-mono)'
        }}>
          {/* Latency Stats Panel */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.01)',
            border: '1px solid rgba(255, 255, 255, 0.03)',
            borderRadius: '6px',
            padding: '8px'
          }}>
            <div style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Clock size={10} /> Latencies
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Otari Gate:</span>
                <span style={{ color: 'var(--neon-cyan)', fontWeight: '600' }}>{stats.gateLatency}ms</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Inference:</span>
                <span style={{ color: 'var(--neon-blue)', fontWeight: '600' }}>{stats.inferenceLatency}ms</span>
              </div>
            </div>
          </div>

          {/* Live Active Model Panel */}
          <div style={{
            background: stats.activeModel?.includes('Escalated')
              ? 'rgba(255, 77, 109, 0.05)'
              : 'rgba(0, 255, 136, 0.03)',
            border: `1px solid ${stats.activeModel?.includes('Escalated') ? 'rgba(255,77,109,0.3)' : 'rgba(0,255,136,0.15)'}`,
            borderRadius: '6px',
            padding: '8px',
            transition: 'all 0.5s ease'
          }}>
            <div style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Server size={10} /> Active AI Core
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {/* Model indicator dot + name */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{
                  width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                  background: stats.activeModel?.includes('Escalated') ? '#ff4d6d' : '#00ff88',
                  boxShadow: stats.activeModel?.includes('Escalated')
                    ? '0 0 8px #ff4d6d'
                    : '0 0 8px #00ff88',
                  animation: 'pulse 1s ease-in-out infinite'
                }} />
                <span style={{
                  color: stats.activeModel?.includes('Escalated') ? '#ff4d6d' : '#00ff88',
                  fontWeight: '700', fontSize: '11px', wordBreak: 'break-word'
                }}>
                  {stats.activeModel || 'DeepSeek-1.5B (Local)'}
                </span>
              </div>
              {/* Mode label */}
              <div style={{
                fontSize: '9px',
                color: stats.activeModel?.includes('Escalated') ? '#ff4d6d' : 'var(--text-muted)',
                fontStyle: 'italic'
              }}>
                {stats.activeModel?.includes('Escalated')
                  ? '⚠ ESCALATED — Heavy reasoning active'
                  : '✓ LOCAL — Low-cost inference mode'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

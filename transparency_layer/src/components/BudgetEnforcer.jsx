import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Wallet, ShieldAlert, CheckCircle, Clock, Server } from 'lucide-react';
import socketService from '../services/socket';

const BUDGET_LIMIT = 2.00;

export default function BudgetEnforcer() {
  const [spent, setSpent] = useState(0.42);
  const [stats, setStats] = useState({
    gateLatency: 12,
    inferenceLatency: 45
  });

  useEffect(() => {
    // Subscribe to real-time budget telemetry
    const unsubscribeBudget = socketService.subscribe('budget', (data) => {
      setSpent(data.spent);
    });

    // Subscribe to real-time latency stats
    const unsubscribeStats = socketService.subscribe('stats', (data) => {
      setStats(data);
    });

    return () => {
      unsubscribeBudget();
      unsubscribeStats();
    };
  }, []);

  const percentage = Math.min(100, (spent / BUDGET_LIMIT) * 100);
  const isNearLimit = spent >= 1.5 && spent < 1.8;
  const isLimitExceeded = spent >= BUDGET_LIMIT;

  // Chart data setup for semi-circle
  const chartData = [
    { name: 'Spent', value: Math.min(spent, BUDGET_LIMIT) },
    { name: 'Remaining', value: Math.max(0, BUDGET_LIMIT - spent) }
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
      <div style={{ position: 'relative', width: '100%', height: '140px', marginTop: '5px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="95%"
              startAngle={180}
              endAngle={0}
              innerRadius="70%"
              outerRadius="90%"
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
          bottom: '8%',
          left: '50%',
          transform: 'translateX(-50%)',
          textAlign: 'center',
          pointerEvents: 'none'
        }}>
          <div style={{ 
            fontSize: '32px', 
            fontWeight: '700', 
            color: '#fff',
            textShadow: `0 0 12px ${activeColor}30`
          }}>
            ${spent.toFixed(2)}
          </div>
          <div style={{ 
            fontSize: '10px', 
            fontWeight: '600', 
            color: 'var(--text-secondary)',
            letterSpacing: '1px'
          }}>
            OF $2.00 HARD LIMIT
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
        marginBottom: '16px'
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

          {/* Model Status Panel */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.01)',
            border: '1px solid rgba(255, 255, 255, 0.03)',
            borderRadius: '6px',
            padding: '8px'
          }}>
            <div style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Server size={10} /> Model Core
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Engine:</span>
                <span style={{ color: 'var(--neon-green)', fontWeight: '600' }}>Llamafile</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Version:</span>
                <span style={{ color: '#fff' }}>0.8.2</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

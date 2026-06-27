import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Wallet, ShieldAlert, CheckCircle, Clock, Server, PieChart as ChartIcon } from 'lucide-react';
import socketService from '../services/socket';

const BUDGET_LIMIT = 2.00;

export default function BudgetEnforcer() {
  const [spent, setSpent] = useState(0.42);
  const [stats, setStats] = useState({
    gateLatency: 12,
    inferenceLatency: 45
  });

  useEffect(() => {
    const unsubscribeBudget = socketService.subscribe('budget', (data) => {
      setSpent(data.spent);
    });

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

  // Dynamic breakdown values
  const safeCost = spent * 0.65;
  const threatCost = spent * 0.20;
  const syncCost = spent * 0.15;

  const breakdownData = [
    { name: 'Safe Ingress', value: Number(safeCost.toFixed(4)), color: 'var(--neon-cyan)' },
    { name: 'Threat Shield', value: Number(threatCost.toFixed(4)), color: 'var(--neon-rose)' },
    { name: 'Gateway Sync', value: Number(syncCost.toFixed(4)), color: 'var(--neon-green)' }
  ];

  return (
    <div className="glass-panel" style={{ padding: '20px', flexGrow: 1, minHeight: '430px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Title Header */}
      <div className="card-header" style={{ marginBottom: '0px', borderBottom: 'none' }}>
        <div className="card-title" style={{ fontFamily: 'var(--font-mono)' }}>
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
      <div style={{ position: 'relative', width: '100%', height: '120px', marginTop: '0px' }}>
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
          fontFamily: 'var(--font-mono)'
        }}>
          <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#fff', letterSpacing: '-0.5px' }}>
            ${spent.toFixed(2)}
          </span>
          <div style={{ fontSize: '9px', color: 'var(--text-secondary)', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            OF ${BUDGET_LIMIT.toFixed(2)} HARD LIMIT
          </div>
        </div>
      </div>

      {/* Budget progress sub-bar */}
      <div style={{ padding: '0px 10px', marginTop: '-8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', marginBottom: '4px' }}>
          <span>Budget Burn Rate</span>
          <span style={{ color: activeColor, fontWeight: 'bold' }}>{percentage.toFixed(1)}%</span>
        </div>
        <div style={{ height: '3px', width: '100%', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ 
            height: '100%', 
            width: `${percentage}%`, 
            backgroundColor: activeColor,
            boxShadow: `0 0 6px ${activeColor}`,
            transition: 'width 0.5s ease-out'
          }} />
        </div>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid rgba(255, 255, 255, 0.05)', margin: '4px 0' }} />

      {/* Two-Column Grid: Left is Latency table, Right is FinOps Cost Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px', flexGrow: 1 }}>
        {/* Infrastructure Telemetry Table */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Server size={12} />
            INFRASTRUCTURE_TELEMETRY
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
            <tbody>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <td style={{ padding: '6px 0', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Clock size={10} style={{ color: 'var(--neon-cyan)' }} /> Otari Gate:
                </td>
                <td style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--neon-cyan)' }}>{stats.gateLatency}ms</td>
              </tr>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <td style={{ padding: '6px 0', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Clock size={10} style={{ color: 'var(--neon-blue)' }} /> Inference:
                </td>
                <td style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--neon-blue)' }}>{stats.inferenceLatency}ms</td>
              </tr>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <td style={{ padding: '6px 0', color: 'var(--text-secondary)' }}>Engine:</td>
                <td style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--neon-green)' }}>Llamafile</td>
              </tr>
              <tr>
                <td style={{ padding: '6px 0', color: 'var(--text-secondary)' }}>Version:</td>
                <td style={{ textAlign: 'right', color: '#fff' }}>0.8.2</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Cost Breakdown Donut Chart */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', overflow: 'hidden' }}>
          <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ChartIcon size={12} />
            FINOPS_COST_AUDIT
          </div>

          <div style={{ height: '70px', width: '100%', position: 'relative' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={breakdownData}
                  cx="50%"
                  cy="50%"
                  innerRadius="50%"
                  outerRadius="75%"
                  dataKey="value"
                  stroke="none"
                >
                  {breakdownData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Simple Compact Legend */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontFamily: 'var(--font-mono)', fontSize: '8px' }}>
            {breakdownData.map((item) => (
              <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)' }}>
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: item.color }} />
                  {item.name}
                </span>
                <span style={{ color: '#fff', fontWeight: 'bold' }}>${item.value.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

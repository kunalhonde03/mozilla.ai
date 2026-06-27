import React, { useState, useEffect } from 'react';
import { Eye, ShieldAlert, Sparkles, CheckSquare } from 'lucide-react';
import socketService from '../services/socket';

export default function ExplainabilityView() {
  const [threatLogs, setThreatLogs] = useState([]);
  const [selectedThreat, setSelectedThreat] = useState(null);

  useEffect(() => {
    // Listen for incoming logs, filter and store injection threats
    const unsubscribe = socketService.subscribe('logs', (newLog) => {
      if (newLog.isInjection) {
        setThreatLogs(prev => {
          const updated = [newLog, ...prev]; // Newest first
          if (updated.length > 20) updated.pop();
          return updated;
        });
      }
    });

    return () => unsubscribe();
  }, []);

  // Set default selected threat when list changes and none selected
  useEffect(() => {
    if (threatLogs.length > 0 && !selectedThreat) {
      setSelectedThreat(threatLogs[0]);
    }
  }, [threatLogs, selectedThreat]);

  const selectThreat = (threat) => {
    setSelectedThreat(threat);
  };

  const getRuleExplanation = (rawText) => {
    const text = rawText.toLowerCase();
    if (text.includes('ignore') || text.includes('system') || text.includes('instruction')) {
      return {
        id: "Rule-101 (System Prompt Bypass)",
        desc: "High threat of instruction hijacking. User attempted to force the LLM to ignore preset system behaviors. PDP gateway blocked downstream API routing."
      };
    }
    if (text.includes('password') || text.includes('credential') || text.includes('key')) {
      return {
        id: "Rule-205 (Sensitive Data Leak Prevention)",
        desc: "Potential credentials harvesting attempt. Blocked request to avoid leakage of backend configuration strings or API tokens."
      };
    }
    if (text.includes('rm -rf') || text.includes('execute') || text.includes('sudo')) {
      return {
        id: "Rule-302 (Remote Code Execution Shield)",
        desc: "Detected command line sequences or server control variables. Blocked query to protect server host file directory."
      };
    }
    return {
      id: "Rule-999 (General Safety Filter)",
      desc: "Flagged by gateway heuristics as an adversarial prompt injection pattern. Local LLM core shielded."
    };
  };

  const explanation = selectedThreat ? getRuleExplanation(selectedThreat.raw) : null;

  return (
    <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', minHeight: '360px' }}>
      <div className="card-header" style={{ marginBottom: '12px' }}>
        <div className="card-title" style={{ fontSize: '13px', fontFamily: 'var(--font-mono)' }}>
          <ShieldAlert size={14} style={{ color: 'var(--neon-rose)' }} />
          PDP_EXPLAINABILITY_AUDIT
        </div>
        {threatLogs.length > 0 && (
          <span style={{ 
            fontSize: '10px', 
            background: 'rgba(255, 8, 68, 0.12)', 
            color: 'var(--neon-rose)', 
            padding: '2px 6px', 
            borderRadius: '3px',
            border: '1px solid rgba(255, 8, 68, 0.2)',
            fontFamily: 'var(--font-mono)'
          }}>
            {threatLogs.length} THREATS_LOGGED
          </span>
        )}
      </div>

      {threatLogs.length === 0 ? (
        <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
          <Sparkles size={24} style={{ margin: '0 auto 10px auto', color: 'var(--text-muted)', opacity: 0.5 }} />
          [Awaiting security threat trigger logs...]
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '16px', flexGrow: 1, overflow: 'hidden' }}>
          {/* Left: list of threats */}
          <div style={{ 
            borderRight: '1px solid rgba(255, 255, 255, 0.05)', 
            paddingRight: '10px', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '6px',
            overflowY: 'auto',
            maxHeight: '260px'
          }}>
            {threatLogs.map((log) => {
              const isSelected = selectedThreat && selectedThreat.id === log.id;
              return (
                <button
                  key={log.id}
                  onClick={() => selectThreat(log)}
                  style={{
                    width: '100%',
                    background: isSelected ? 'rgba(255, 8, 68, 0.15)' : 'rgba(255, 255, 255, 0.01)',
                    border: `1px solid ${isSelected ? 'var(--neon-rose)' : 'rgba(255, 255, 255, 0.04)'}`,
                    borderRadius: '4px',
                    padding: '8px',
                    color: isSelected ? '#fff' : 'var(--text-secondary)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {log.timestamp} ID: {log.id}
                </button>
              );
            })}
          </div>

          {/* Right: Comparative Diff & Policy Explanation */}
          {selectedThreat && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%', overflowY: 'auto' }}>
              
              {/* Diff Side-by-Side */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {/* Original prompt */}
                <div style={{
                  background: 'rgba(255, 8, 68, 0.03)',
                  border: '1px solid rgba(255, 8, 68, 0.15)',
                  borderRadius: '6px',
                  padding: '10px'
                }}>
                  <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--neon-rose)', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Eye size={10} /> Original Ingestion Input
                  </div>
                  <div style={{ 
                    fontSize: '11px', 
                    fontFamily: 'var(--font-mono)', 
                    color: '#fff', 
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    lineHeight: '1.4'
                  }}>
                    {selectedThreat.raw}
                  </div>
                </div>

                {/* Sanitized/Blocked prompt */}
                <div style={{
                  background: 'rgba(0, 0, 0, 0.2)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: '6px',
                  padding: '10px'
                }}>
                  <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <CheckSquare size={10} /> Sanitized Egress Output
                  </div>
                  <div style={{ 
                    fontSize: '11px', 
                    fontFamily: 'var(--font-mono)', 
                    color: 'var(--neon-rose)', 
                    fontWeight: 'bold',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    lineHeight: '1.4',
                    textShadow: '0 0 6px rgba(255, 8, 68, 0.2)'
                  }}>
                    {selectedThreat.sanitized}
                  </div>
                </div>
              </div>

              {/* PDP Policy Decider Audit */}
              {explanation && (
                <div style={{
                  background: 'rgba(255, 255, 255, 0.01)',
                  border: '1px solid rgba(255, 255, 255, 0.04)',
                  borderRadius: '6px',
                  padding: '10px',
                  marginTop: 'auto'
                }}>
                  <div style={{ 
                    fontSize: '10px', 
                    fontFamily: 'var(--font-mono)', 
                    color: 'var(--neon-yellow)', 
                    fontWeight: '700',
                    marginBottom: '4px'
                  }}>
                    PDP_POLICY_AUDIT: {explanation.id}
                  </div>
                  <p style={{ 
                    fontSize: '11px', 
                    fontFamily: 'var(--font-mono)', 
                    color: 'var(--text-secondary)',
                    margin: 0,
                    lineHeight: '1.4'
                  }}>
                    {explanation.desc}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Shield, Save, Plus, Trash2, Sliders } from 'lucide-react';
import socketService from '../services/socket';

export default function PolicyEditor() {
  const [rules, setRules] = useState({
    system_bypass: ['ignore', 'system', 'instruction'],
    data_leak: ['password', 'credential', 'key'],
    code_execution: ['rm -rf', 'execute', 'sudo']
  });

  const [inputs, setInputs] = useState({
    bypass: '',
    leak: '',
    exec: ''
  });

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    // Listen for backend rule sets initialization
    const unsubscribeInit = socketService.subscribe('rules_init', (data) => {
      setRules(data);
    });

    return () => unsubscribeInit();
  }, []);

  const addKeyword = (category, inputKey) => {
    const word = inputs[inputKey].trim().toLowerCase();
    if (!word) return;

    if (rules[category].includes(word)) {
      setMessage('Keyword already exists in this rule.');
      return;
    }

    setRules(prev => ({
      ...prev,
      [category]: [...prev[category], word]
    }));

    setInputs(prev => ({
      ...prev,
      [inputKey]: ''
    }));
  };

  const removeKeyword = (category, word) => {
    setRules(prev => ({
      ...prev,
      [category]: prev[category].filter(w => w !== word)
    }));
  };

  const savePolicy = async () => {
    setSaving(true);
    setMessage('');

    // If connected to a live backend socket
    if (!socketService.useSimulation && socketService.socket?.connected) {
      try {
        const response = await fetch(`${socketService.backendUrl}/update_policy`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(rules)
        });

        if (response.ok) {
          setMessage('PDP rules compiled and compiled live on server.');
        } else {
          setMessage('Server failed to compile policy rules.');
        }
      } catch (err) {
        setMessage('Network error connecting to policy server.');
      }
    } else {
      // Local simulation updates
      socketService.listeners.events?.forEach(cb => cb({
        id: Math.random().toString(36).substr(2, 9),
        timestamp: `[${new Date().toLocaleTimeString()}]`,
        text: "Sandbox: Dynamic security policy compiled in local memory",
        type: 'warning'
      }));
      setMessage('Compiled in local simulator cache.');
    }
    setSaving(false);
  };

  return (
    <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', minHeight: '360px', gap: '12px' }}>
      <div className="card-header" style={{ marginBottom: '0px', borderBottom: 'none' }}>
        <div className="card-title" style={{ fontSize: '13px', fontFamily: 'var(--font-mono)' }}>
          <Sliders size={14} style={{ color: 'var(--neon-yellow)' }} />
          PDP_GATEWAY_POLICY_EDITOR
        </div>
        <button 
          className="btn" 
          onClick={savePolicy} 
          disabled={saving}
          style={{ fontSize: '10px', padding: '4px 10px', borderColor: 'var(--neon-green)', color: 'var(--neon-green)', background: 'rgba(0, 245, 160, 0.04)' }}
        >
          <Save size={12} />
          {saving ? 'COMPILING...' : 'SAVE_AND_APPLY'}
        </button>
      </div>

      <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0 }}>
        Manage active threat classification keywords. Modifying these sets updates the gateway enforcer live.
      </p>

      {message && (
        <div style={{
          background: 'rgba(255, 210, 0, 0.05)',
          border: '1px solid rgba(255, 210, 0, 0.2)',
          borderRadius: '4px',
          padding: '6px 10px',
          fontSize: '10px',
          color: 'var(--neon-yellow)',
          fontFamily: 'var(--font-mono)'
        }}>
          {message}
        </div>
      )}

      {/* Rules categories */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flexGrow: 1, overflowY: 'auto', maxHeight: '220px' }}>
        {/* Category 1: System Bypass */}
        <div style={{ background: 'rgba(0,0,0,0.15)', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.02)' }}>
          <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--neon-rose)', fontWeight: 'bold', marginBottom: '6px' }}>
            RULE-101: SYSTEM_PROMPT_BYPASS
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
            {rules.system_bypass.map(word => (
              <span key={word} style={{
                fontSize: '9px',
                fontFamily: 'var(--font-mono)',
                background: 'rgba(255, 8, 68, 0.08)',
                color: 'var(--neon-rose)',
                padding: '2px 6px',
                borderRadius: '3px',
                border: '1px solid rgba(255, 8, 68, 0.15)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                {word}
                <Trash2 size={10} style={{ cursor: 'pointer', opacity: 0.7 }} onClick={() => removeKeyword('system_bypass', word)} />
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <input 
              type="text" 
              placeholder="Add keyword..." 
              value={inputs.bypass}
              onChange={e => setInputs(prev => ({ ...prev, bypass: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && addKeyword('system_bypass', 'bypass')}
              style={{ flexGrow: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '4px', color: '#fff', fontSize: '10px', padding: '4px 8px', fontFamily: 'var(--font-mono)' }}
            />
            <button className="btn btn-secondary" style={{ padding: '2px 6px' }} onClick={() => addKeyword('system_bypass', 'bypass')}>
              <Plus size={12} />
            </button>
          </div>
        </div>

        {/* Category 2: Data Leak */}
        <div style={{ background: 'rgba(0,0,0,0.15)', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.02)' }}>
          <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--neon-cyan)', fontWeight: 'bold', marginBottom: '6px' }}>
            RULE-205: SENSITIVE_DATA_LEAK
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
            {rules.data_leak.map(word => (
              <span key={word} style={{
                fontSize: '9px',
                fontFamily: 'var(--font-mono)',
                background: 'rgba(0, 242, 254, 0.08)',
                color: 'var(--neon-cyan)',
                padding: '2px 6px',
                borderRadius: '3px',
                border: '1px solid rgba(0, 242, 254, 0.15)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                {word}
                <Trash2 size={10} style={{ cursor: 'pointer', opacity: 0.7 }} onClick={() => removeKeyword('data_leak', word)} />
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <input 
              type="text" 
              placeholder="Add keyword..." 
              value={inputs.leak}
              onChange={e => setInputs(prev => ({ ...prev, leak: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && addKeyword('data_leak', 'leak')}
              style={{ flexGrow: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '4px', color: '#fff', fontSize: '10px', padding: '4px 8px', fontFamily: 'var(--font-mono)' }}
            />
            <button className="btn btn-secondary" style={{ padding: '2px 6px' }} onClick={() => addKeyword('data_leak', 'leak')}>
              <Plus size={12} />
            </button>
          </div>
        </div>

        {/* Category 3: Code Execution */}
        <div style={{ background: 'rgba(0,0,0,0.15)', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.02)' }}>
          <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--neon-green)', fontWeight: 'bold', marginBottom: '6px' }}>
            RULE-302: REMOTE_CODE_EXECUTION
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
            {rules.code_execution.map(word => (
              <span key={word} style={{
                fontSize: '9px',
                fontFamily: 'var(--font-mono)',
                background: 'rgba(0, 245, 160, 0.08)',
                color: 'var(--neon-green)',
                padding: '2px 6px',
                borderRadius: '3px',
                border: '1px solid rgba(0, 245, 160, 0.15)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                {word}
                <Trash2 size={10} style={{ cursor: 'pointer', opacity: 0.7 }} onClick={() => removeKeyword('code_execution', word)} />
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <input 
              type="text" 
              placeholder="Add keyword..." 
              value={inputs.exec}
              onChange={e => setInputs(prev => ({ ...prev, exec: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && addKeyword('code_execution', 'exec')}
              style={{ flexGrow: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '4px', color: '#fff', fontSize: '10px', padding: '4px 8px', fontFamily: 'var(--font-mono)' }}
            />
            <button className="btn btn-secondary" style={{ padding: '2px 6px' }} onClick={() => addKeyword('code_execution', 'exec')}>
              <Plus size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

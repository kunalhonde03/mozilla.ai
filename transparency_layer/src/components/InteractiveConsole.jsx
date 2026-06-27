import React, { useState } from 'react';
import { Send, Terminal, Shield, ShieldAlert } from 'lucide-react';

export default function InteractiveConsole() {
  const [promptInput, setPromptInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [responseLog, setResponseLog] = useState([]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!promptInput.trim()) return;

    setIsLoading(true);
    const userPrompt = promptInput;
    setPromptInput('');

    try {
      const response = await fetch('http://127.0.0.1:5000/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userPrompt })
      });
      const data = await response.json();

      setResponseLog(prev => [
        {
          id: Date.now(),
          prompt: userPrompt,
          blocked: data.blocked,
          reply: data.response,
          latency: data.latency,
          cost: data.cost
        },
        ...prev.slice(0, 10)
      ]);
    } catch (err) {
      setResponseLog(prev => [
        {
          id: Date.now(),
          prompt: userPrompt,
          blocked: true,
          reply: "Connection Error: Ensure backend server_telemetry.py is running on port 5000.",
          latency: 0,
          cost: 0
        },
        ...prev
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div className="card-header">
        <div className="card-title" style={{ fontSize: '13px', fontFamily: 'var(--font-mono)' }}>
          <Terminal size={16} style={{ color: 'var(--neon-cyan)' }} />
          INTERACTIVE_GATEWAY_SANDBOX
        </div>
        <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>LIVE_INPUT_CORE</span>
      </div>

      <p style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
        Type a test prompt to evaluate the policy filters in real time. Try trigger words like <em>ignore</em>, <em>bypass</em>, or <em>override</em>.
      </p>

      {/* Input Form */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '10px' }}>
        <input
          type="text"
          value={promptInput}
          onChange={(e) => setPromptInput(e.target.value)}
          placeholder="Type a safe prompt or prompt injection attack..."
          disabled={isLoading}
          style={{
            flexGrow: 1,
            background: 'rgba(0,0,0,0.5)',
            border: '1px solid var(--border-medium)',
            borderRadius: '6px',
            padding: '10px 14px',
            color: '#fff',
            fontFamily: 'var(--font-mono)',
            fontSize: '12px'
          }}
        />
        <button
          type="submit"
          disabled={isLoading || !promptInput.trim()}
          className="btn"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '10px 16px',
            gap: '8px'
          }}
        >
          <Send size={14} />
          {isLoading ? 'SCANNING...' : 'EXECUTE'}
        </button>
      </form>

      {/* Response Display log */}
      {responseLog.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            📊 RECENT_SANDBOX_OUTPUTS
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
            {responseLog.map(item => (
              <div
                key={item.id}
                style={{
                  background: item.blocked ? 'rgba(255, 77, 109, 0.05)' : 'rgba(0, 255, 136, 0.02)',
                  border: `1px solid ${item.blocked ? 'rgba(255,77,109,0.2)' : 'rgba(0,255,136,0.1)'}`,
                  borderRadius: '6px',
                  padding: '10px 14px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  position: 'relative'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '10px', color: 'var(--text-muted)' }}>
                  <span>PROMPT: "{item.prompt}"</span>
                  <span>Cost: ${item.cost.toFixed(3)} | Latency: {item.latency}ms</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: item.blocked ? '#ff4d6d' : '#00ff88', fontWeight: '600' }}>
                  {item.blocked ? <ShieldAlert size={14} /> : <Shield size={14} />}
                  <span>{item.blocked ? 'BLOCKED_BY_PDP' : 'VERIFIED_ROUTED_OK'}</span>
                </div>

                <div style={{ marginTop: '6px', color: '#fff', fontSize: '11px', lineHeight: '1.4' }}>
                  {item.reply}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

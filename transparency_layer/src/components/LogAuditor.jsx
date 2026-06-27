import React, { useState } from 'react';
import { Upload, FileText, CheckCircle, ShieldAlert, BarChart3, AlertCircle } from 'lucide-react';

const THREAT_KEYWORDS = ["ignore", "override", "rm -rf", "bypass", "hijack", "forget", "jailbreak"];

export default function LogAuditor() {
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const performScan = (jsonData) => {
    try {
      if (!Array.isArray(jsonData)) {
        throw new Error("JSON structure must be an array of objects. Example: [{\"prompt\": \"text\"}]");
      }

      let total = jsonData.length;
      let blocked = [];
      let passed = [];

      jsonData.forEach((item, index) => {
        // Extract raw prompt text from standard fields
        const rawText = item.prompt || item.raw || item.message || item.text || "";
        const user = item.user || item.username || `User_${index + 1}`;
        const hasThreat = THREAT_KEYWORDS.some(keyword => rawText.toLowerCase().includes(keyword));

        const resultItem = {
          id: index,
          user,
          text: rawText,
          blocked: hasThreat,
          reason: hasThreat ? "Potential Jailbreak / Policy Bypass Attempt" : "Safe"
        };

        if (hasThreat) {
          blocked.push(resultItem);
        } else {
          passed.push(resultItem);
        }
      });

      setReport({
        total,
        blockedCount: blocked.length,
        passedCount: passed.length,
        blockedList: blocked,
        passedList: passed
      });
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to parse JSON file.');
      setReport(null);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target.result);
        performScan(json);
      } catch (err) {
        setError('Invalid JSON format. Please upload a valid JSON file.');
        setReport(null);
      }
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type === "application/json") {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const json = JSON.parse(event.target.result);
          performScan(json);
        } catch (err) {
          setError('Invalid JSON format.');
          setReport(null);
        }
      };
      reader.readAsText(file);
    } else {
      setError('Please drop a valid JSON file.');
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="card-header">
        <div className="card-title" style={{ fontSize: '13px', fontFamily: 'var(--font-mono)' }}>
          <FileText size={16} style={{ color: 'var(--neon-cyan)' }} />
          OFFLINE_SECURITY_AUDITOR
        </div>
        <span style={{ fontSize: '9px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>JSON_PARSER_V1</span>
      </div>

      <p style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
        Upload or drop a diagnostic prompt log JSON file to audit vulnerabilities offline using current gateway rules.
      </p>

      {/* Upload Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          border: isDragging ? '2px dashed var(--neon-cyan)' : '1px dashed var(--border-medium)',
          background: isDragging ? 'rgba(0, 242, 254, 0.05)' : 'rgba(0,0,0,0.2)',
          borderRadius: '8px',
          padding: '24px',
          textAlign: 'center',
          cursor: 'pointer',
          position: 'relative',
          transition: 'all 0.2s'
        }}
      >
        <input
          type="file"
          accept=".json"
          onChange={handleFileUpload}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            opacity: 0,
            cursor: 'pointer'
          }}
        />
        <Upload size={24} style={{ color: isDragging ? 'var(--neon-cyan)' : 'var(--text-secondary)', marginBottom: '8px' }} />
        <div style={{ fontSize: '12px', color: '#fff', fontWeight: '500' }}>
          Drag & Drop JSON file or <span style={{ color: 'var(--neon-cyan)' }}>Browse</span>
        </div>
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
          Accepts arrays: [ {"{"} "prompt": "text" {"}"} ]
        </div>
      </div>

      {error && (
        <div style={{
          background: 'rgba(255, 77, 109, 0.1)',
          border: '1px solid rgba(255, 77, 109, 0.3)',
          borderRadius: '6px',
          padding: '10px',
          fontSize: '11px',
          color: 'var(--neon-rose)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {/* Diagnostic Report Output */}
      {report && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '4px' }}>
          {/* Quick Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '6px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>TOTAL SCANNED</div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: '#fff', marginTop: '2px' }}>{report.total}</div>
            </div>
            <div style={{ background: 'rgba(0, 255, 136, 0.02)', padding: '10px', borderRadius: '6px', textAlign: 'center', border: '1px solid rgba(0, 255, 136, 0.1)' }}>
              <div style={{ fontSize: '9px', color: 'var(--neon-green)' }}>SAFE PASSED</div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--neon-green)', marginTop: '2px' }}>{report.passedCount}</div>
            </div>
            <div style={{ background: 'rgba(255, 77, 109, 0.02)', padding: '10px', borderRadius: '6px', textAlign: 'center', border: '1px solid rgba(255, 77, 109, 0.15)' }}>
              <div style={{ fontSize: '9px', color: 'var(--neon-rose)' }}>BLOCKED THREATS</div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--neon-rose)', marginTop: '2px' }}>{report.blockedCount}</div>
            </div>
          </div>

          {/* Blocked Threats List */}
          {report.blockedCount > 0 && (
            <div>
              <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--neon-rose)', marginBottom: '6px', fontFamily: 'var(--font-mono)' }}>
                🚨 DETECTED_THREATS ({report.blockedCount})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '140px', overflowY: 'auto' }}>
                {report.blockedList.map(item => (
                  <div key={item.id} style={{
                    background: 'rgba(255,77,109,0.05)',
                    border: '1px solid rgba(255,77,109,0.2)',
                    borderRadius: '4px',
                    padding: '8px 10px',
                    fontSize: '11px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontWeight: '700', color: 'var(--neon-rose)' }}>{item.user}</span>
                      <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{item.reason}</span>
                    </div>
                    <div style={{ color: '#fff', fontStyle: 'italic' }}>"{item.text}"</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Passed Lists */}
          {report.passedCount > 0 && (
            <div>
              <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--neon-green)', marginBottom: '6px', fontFamily: 'var(--font-mono)' }}>
                ✓ VERIFIED_SAFE_PROMPTS ({report.passedCount})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '100px', overflowY: 'auto' }}>
                {report.passedList.map(item => (
                  <div key={item.id} style={{
                    background: 'rgba(0, 255, 136, 0.02)',
                    border: '1px solid rgba(0, 255, 136, 0.1)',
                    borderRadius: '4px',
                    padding: '8px 10px',
                    fontSize: '11px',
                    color: 'var(--text-secondary)'
                  }}>
                    <span style={{ fontWeight: '600', color: '#fff', marginRight: '6px' }}>{item.user}:</span>
                    "{item.text}"
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

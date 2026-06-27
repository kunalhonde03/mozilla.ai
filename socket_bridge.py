import os
import time
import asyncio
import socketio
import uvicorn
import random
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List

# Initialize FastAPI and Socket.IO
app = FastAPI()
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')
socket_app = socketio.ASGIApp(sio, other_asgi_app=app)

LOG_FILE = "logs_stream.log"
current_budget = 0.42
budget_limit = 2.00

# Dynamic policy rules
policy_rules = {
    "system_bypass": ["ignore", "system", "instruction"],
    "data_leak": ["password", "credential", "key"],
    "code_execution": ["rm -rf", "execute", "sudo"]
}

# Enable CORS for FastAPI
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic schemas
class TestLogItem(BaseModel):
    raw: str

class PolicyUpdate(BaseModel):
    system_bypass: List[str]
    data_leak: List[str]
    code_execution: List[str]

@sio.event
async def connect(sid, environ):
    global current_budget
    print(f"Frontend Client Connected: {sid}")
    await sio.emit('budget_update', {'spent': round(current_budget, 4)}, to=sid)
    # Send current policy rules
    await sio.emit('policy_rules_init', policy_rules, to=sid)

@sio.event
def disconnect(sid):
    print(f"Frontend Client Disconnected: {sid}")

# Helper to process a raw log and return parsed log details
def process_raw_log(raw_message):
    global current_budget
    raw_lower = raw_message.lower()
    
    is_bypass = any(w in raw_lower for w in policy_rules["system_bypass"])
    is_leak = any(w in raw_lower for w in policy_rules["data_leak"])
    is_exec = any(w in raw_lower for w in policy_rules["code_execution"])
    
    is_injection = is_bypass or is_leak or is_exec
    
    sanitized = raw_message
    if is_injection:
        sanitized = "[BLOCKED: Intercepted prompt injection threat]"
        cost = 0.002
    else:
        cost = 0.04 + (len(raw_message) * 0.0002)

    current_budget = min(budget_limit, current_budget + cost)

    now = datetime_now_string()
    return {
        'id': os.urandom(4).hex(),
        'timestamp': f"[{now}]",
        'raw': raw_message,
        'sanitized': sanitized,
        'isInjection': is_injection,
        'tag': 'SECURITY_ALERT' if is_injection else 'PDP_ROUTED'
    }

def datetime_now_string():
    from datetime import datetime
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

# Replay sandbox task
async def replay_logs_task(logs: List[TestLogItem]):
    print(f"Sandbox: Replaying {len(logs)} uploaded prompts...")
    
    now_str = f"[{time.strftime('%Y-%m-%d %H:%M:%S')}]"
    await sio.emit('system_event', {
        'id': os.urandom(4).hex(),
        'timestamp': now_str,
        'text': f"Sandbox: Initialized JSON log upload replay ({len(logs)} items)",
        'type': 'info'
    })

    for item in logs:
        parsed = process_raw_log(item.raw)
        
        await sio.emit('budget_update', {'spent': round(current_budget, 4)})
        await sio.emit('log_event', parsed)
        
        await sio.emit('particles', {
            'blocked': parsed['isInjection'],
            'timestamp': int(time.time() * 1000)
        })

        event_text = f"Sandbox PDP Decision: Blocked injection threat" if parsed['isInjection'] else f"Sandbox: Query verified and routed successfully"
        await sio.emit('system_event', {
            'id': os.urandom(4).hex(),
            'timestamp': parsed['timestamp'],
            'text': event_text,
            'type': 'danger' if parsed['isInjection'] else 'info'
        })

        await asyncio.sleep(1.5)

    await sio.emit('system_event', {
        'id': os.urandom(4).hex(),
        'timestamp': f"[{time.strftime('%Y-%m-%d %H:%M:%S')}]",
        'text': "Sandbox: JSON log upload replay completed successfully",
        'type': 'info'
    })

@app.post("/upload_test_log")
async def upload_test_log(payload: List[TestLogItem]):
    asyncio.create_task(replay_logs_task(payload))
    return {"status": "success", "count": len(payload)}

@app.post("/update_policy")
async def update_policy(policy: PolicyUpdate):
    global policy_rules
    policy_rules["system_bypass"] = [w.lower().strip() for w in policy.system_bypass if w.strip()]
    policy_rules["data_leak"] = [w.lower().strip() for w in policy.data_leak if w.strip()]
    policy_rules["code_execution"] = [w.lower().strip() for w in policy.code_execution if w.strip()]
    
    # Broadcast updated policies to all connected socket clients
    await sio.emit('policy_rules_updated', policy_rules)
    
    now_str = f"[{time.strftime('%Y-%m-%d %H:%M:%S')}]"
    await sio.emit('system_event', {
        'id': os.urandom(4).hex(),
        'timestamp': now_str,
        'text': "PDP Policy configurations reloaded and compiled successfully",
        'type': 'warning'
      })
    return {"status": "success", "rules": policy_rules}

# Background task that tails the log file and streams events over Socket.io
async def tail_log_file():
    global current_budget
    print(f"Tailing log file: {LOG_FILE}...")
    
    while not os.path.exists(LOG_FILE):
        await asyncio.sleep(2)

    file_size = os.path.getsize(LOG_FILE)
    
    with open(LOG_FILE, 'r') as f:
        f.seek(file_size)
        while True:
            line = f.readline()
            if not line:
                await asyncio.sleep(0.5)
                continue

            clean_line = line.strip()
            
            # Parse log info using active rules
            raw_lower = clean_line.lower()
            is_bypass = any(w in raw_lower for w in policy_rules["system_bypass"])
            is_leak = any(w in raw_lower for w in policy_rules["data_leak"])
            is_exec = any(w in raw_lower for w in policy_rules["code_execution"])
            is_injection = is_bypass or is_leak or is_exec
            
            parts = clean_line.split("] ", 2)
            timestamp = parts[0] + "]" if len(parts) > 0 else "[Time]"
            raw_message = parts[-1] if len(parts) > 0 else clean_line

            # Extract sanitized message
            sanitized = raw_message
            if is_injection:
                sanitized = "[BLOCKED: Intercepted prompt injection threat]"
                cost = 0.002
            else:
                cost = 0.04 + (len(raw_message) * 0.0002)

            current_budget = min(budget_limit, current_budget + cost)
            
            # Send events to frontend
            await sio.emit('budget_update', {'spent': round(current_budget, 4)})
            await sio.emit('log_event', {
                'id': os.urandom(4).hex(),
                'timestamp': timestamp,
                'raw': raw_message,
                'sanitized': sanitized,
                'isInjection': is_injection,
                'tag': 'SECURITY_ALERT' if is_injection else 'PDP_ROUTED'
            })

            # Add event log
            event_text = f"PDP Decision: Blocked injection threat at Gateway [Node 04]" if is_injection else f"Router: Query verified. Sanitized output generated [Node 02]"
            await sio.emit('system_event', {
                'id': os.urandom(4).hex(),
                'timestamp': timestamp,
                'text': event_text,
                'type': 'danger' if is_injection else 'info'
            })

            # Emit particles trigger
            await sio.emit('particles', {
                'blocked': is_injection,
                'timestamp': int(time.time() * 1000)
            })

# Background task to emit hardware stats and latency parameters periodically
async def emit_periodic_stats():
    while True:
        gateLatency = random.randint(8, 16)
        inferenceLatency = random.randint(35, 60)
        cpu = random.randint(40, 65)
        ram = round(random.uniform(5.2, 6.0), 1)
        disk = round(random.uniform(0.5, 4.7), 1)
        tps = round(random.uniform(15.0, 45.0), 1)

        await sio.emit('hardware_stats', {
            'cpu': cpu,
            'ram': ram,
            'disk': disk,
            'gateLatency': gateLatency,
            'inferenceLatency': inferenceLatency,
            'tps': tps
        })
        await asyncio.sleep(3.0)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(tail_log_file())
    asyncio.create_task(emit_periodic_stats())

if __name__ == "__main__":
    uvicorn.run(socket_app, host="127.0.0.1", port=5000)

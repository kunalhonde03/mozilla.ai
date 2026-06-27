import os
import time
import asyncio
import socketio
import uvicorn
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

# Enable CORS for FastAPI
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic schemas for sandbox uploads
class TestLogItem(BaseModel):
    raw: str

@sio.event
async def connect(sid, environ):
    global current_budget
    print(f"Frontend Client Connected: {sid}")
    # Immediately send the current budget to the newly connected client
    await sio.emit('budget_update', {'spent': round(current_budget, 4)}, to=sid)

@sio.event
def disconnect(sid):
    print(f"Frontend Client Disconnected: {sid}")

# Helper to process a raw log and return parsed log details
def process_raw_log(raw_message):
    global current_budget
    # Scans for prompt injection triggers
    is_injection = "CRITICAL" in raw_message or "injection" in raw_message.lower() or "bypass" in raw_message.lower() or "ignore" in raw_message.lower()
    
    # Process sanitization string
    sanitized = raw_message
    if is_injection:
        sanitized = "[BLOCKED: Intercepted prompt injection threat]"
        cost = 0.002
    else:
        cost = 0.04 + (len(raw_message) * 0.0002)

    # Update budget
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
    
    # Send a journal system log indicating sandbox started
    now_str = f"[{time.strftime('%Y-%m-%d %H:%M:%S')}]"
    await sio.emit('system_event', {
        'id': os.urandom(4).hex(),
        'timestamp': now_str,
        'text': f"Sandbox: Initialized JSON log upload replay ({len(logs)} items)",
        'type': 'info'
    })

    for item in logs:
        # Process prompt
        parsed = process_raw_log(item.raw)
        
        # Emit logs, budget and event triggers
        await sio.emit('budget_update', {'spent': round(current_budget, 4)})
        await sio.emit('log_event', parsed)
        
        # Trigger topology visualizer particle
        await sio.emit('particles', {
            'blocked': parsed['isInjection'],
            'timestamp': Date_now_ms()
        })

        # Add event log
        event_text = f"Sandbox PDP Decision: Blocked injection threat" if parsed['isInjection'] else f"Sandbox: Query verified and routed successfully"
        await sio.emit('system_event', {
            'id': os.urandom(4).hex(),
            'timestamp': parsed['timestamp'],
            'text': event_text,
            'type': 'danger' if parsed['isInjection'] else 'info'
        })

        await asyncio.sleep(1.5) # Replay delay

    await sio.emit('system_event', {
        'id': os.urandom(4).hex(),
        'timestamp': f"[{time.strftime('%Y-%m-%d %H:%M:%S')}]",
        'text': "Sandbox: JSON log upload replay completed successfully",
        'type': 'info'
    })

def Date_now_ms():
    return int(time.time() * 1000)

@app.post("/upload_test_log")
async def upload_test_log(payload: List[TestLogItem]):
    asyncio.create_task(replay_logs_task(payload))
    return {"status": "success", "count": len(payload)}

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
            
            # Parse log info
            is_injection = "CRITICAL" in clean_line or "injection" in clean_line.lower() or "bypass" in clean_line.lower() or "ignore" in clean_line.lower()
            
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

            # Update live budget
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
                'timestamp': Date_now_ms()
            })

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(tail_log_file())

if __name__ == "__main__":
    uvicorn.run(socket_app, host="127.0.0.1", port=5000)

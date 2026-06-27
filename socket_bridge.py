import os
import time
import asyncio
import socketio
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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

@sio.event
async def connect(sid, environ):
    global current_budget
    print(f"Frontend Client Connected: {sid}")
    # Immediately send the current budget to the newly connected client
    await sio.emit('budget_update', {'spent': round(current_budget, 4)}, to=sid)

@sio.event
def disconnect(sid):
    print(f"Frontend Client Disconnected: {sid}")

# Background task that tails the log file and streams events over Socket.io
async def tail_log_file():
    global current_budget
    print(f"Tailing log file: {LOG_FILE}...")
    
    # Wait for the log file to be created
    while not os.path.exists(LOG_FILE):
        print("Waiting for logs_stream.log to be created...")
        await asyncio.sleep(2)

    # Move to the end of the file
    file_size = os.path.getsize(LOG_FILE)
    
    with open(LOG_FILE, 'r') as f:
        f.seek(file_size)
        while True:
            line = f.readline()
            if not line:
                await asyncio.sleep(0.5) # Wait for new appends
                continue

            clean_line = line.strip()
            print(f"New log detected: {clean_line}")

            # Parse log info
            # Format: [2026-06-27 16:09:05] [TAG] Message...
            is_injection = "CRITICAL" in clean_line or "injection" in clean_line.lower() or "bypass" in clean_line.lower()
            
            # Split off timestamp and tag if possible
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

@app.on_event("startup")
async def startup_event():
    # Start the log tailer in the background
    asyncio.create_task(tail_log_file())

if __name__ == "__main__":
    uvicorn.run(socket_app, host="127.0.0.1", port=5000)

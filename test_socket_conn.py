import socketio
import time

sio = socketio.Client()

@sio.on('connect')
def on_connect():
    print("Successfully connected to the telemetry server!")
    sio.disconnect()

@sio.on('connect_error')
def on_connect_error(data):
    print(f"Connection failed: {data}")

try:
    print("Attempting to connect to http://127.0.0.1:5000 ...")
    sio.connect('http://127.0.0.1:5000')
except Exception as e:
    print(f"Error during connection attempt: {e}")

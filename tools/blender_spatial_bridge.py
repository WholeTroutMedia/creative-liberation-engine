import sys
import json
import socket
import threading
import queue
import bpy
import mathutils

"""
CLE ENGINE V6 ── Blender Real-Time Spatial Camera Controller
==================================================================
Allows an iPhone running ZIG SIM to act as a physical 3D Camera / Virtual Production Rig.
Controls the Blender viewport camera orientation and position dynamically in real-time.

SETUP INSTRUCTIONS:
1. Open Blender.
2. Go to the "Scripting" workspace and create a New text block.
3. Copy and paste this entire script.
4. Set ZIG SIM on your phone to:
   - Protocol: UDP
   - Port: 8181
   - IP: [Your computer's local IP]
   - Enabled Sensors: QUATERNION, ACCEL, TOUCH
5. Tap START in ZIG SIM.
6. Click "Run Script" in Blender.
7. To stop the tracking safely, press 'ESC' in the Blender 3D Viewport.
"""

# Networking configuration
BIND_IP = "0.0.0.0"
BIND_PORT = 8181

# Thread-safe queue to pass telemetry from background socket to Blender main loop
telemetry_queue = queue.Queue(maxsize=10)
socket_thread = None
stop_event = threading.Event()

def udp_listener_thread(ip, port, q, stop_flag):
    """Listens to UDP socket packets in a background thread to prevent freezing Blender UI."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        sock.bind((ip, port))
        sock.settimeout(0.5)
        print(f"[CLE] UDP telemetry socket bound to {ip}:{port}")
        
        while not stop_flag.is_set():
            try:
                data_bytes, _ = sock.recvfrom(65535)
                payload = json.loads(data_bytes.decode('utf-8'))
                
                # ZIG SIM can send lists or dicts
                if isinstance(payload, list):
                    for item in payload:
                        if not q.full():
                            q.put_nowait(item)
                else:
                    if not q.full():
                        q.put_nowait(payload)
            except socket.timeout:
                continue
            except Exception:
                pass
    except Exception as e:
        print(f"[CLE] Socket error: {e}")
    finally:
        sock.close()
        print("[CLE] Socket closed safely.")

class CLESpatialCameraOperator(bpy.types.Operator):
    """Real-time iPhone Telemetry Camera Controller"""
    bl_idname = "view3d.cle_spatial_camera"
    bl_label = "CLE Real-Time Spatial Camera"
    
    _timer = None
    
    def modal(self, context, event):
        # Allow exiting the real-time tracking modal loop by pressing ESC
        if event.type in {'ESC'}:
            self.cancel(context)
            return {'CANCELLED'}
        
        # Read the latest telemetry packet if available
        while not telemetry_queue.empty():
            try:
                packet = telemetry_queue.get_nowait()
                sensordata = packet.get("sensordata", {})
                
                # Fetch active camera in scene
                camera = context.scene.camera
                if not camera:
                    # Fallback to active object if no camera exists
                    camera = context.active_object
                    
                if camera:
                    # 1. Update 3D Quaternion Rotation (Zero gimbal lock)
                    quat_data = sensordata.get("quaternion")
                    if quat_data:
                        qx = quat_data.get("x", 0.0)
                        qy = quat_data.get("y", 0.0)
                        qz = quat_data.get("z", 0.0)
                        qw = quat_data.get("w", 1.0)
                        
                        # ZIG SIM outputs quaternions in iOS device space.
                        # Translate to Blender coordinate system (Y-forward, Z-up).
                        raw_q = mathutils.Quaternion((qw, qx, qy, qz))
                        
                        # Apply coordinate transformation matrices
                        rot_adjust = mathutils.Euler((1.5708, 0, 0)).to_quaternion() # Rotates 90 deg on X
                        camera.rotation_mode = 'QUATERNION'
                        camera.rotation_quaternion = rot_adjust @ raw_q
                    
                    # 2. Position control via touch input mapping (Move camera in 3D Space)
                    touches = sensordata.get("touch", [])
                    if touches and len(touches) > 0:
                        touch = touches[0]
                        tx = touch.get("x", 0.0)
                        ty = touch.get("y", 0.0)
                        
                        # Use first touch dragging to move camera along its local Z-axis (zoom/dolly)
                        # Sliding up/down slides camera forward/backward
                        forward_vec = camera.matrix_world.to_quaternion() @ mathutils.Vector((0, 0, -1))
                        camera.location += forward_vec * ty * 0.18
                        
                        # Sliding left/right slides camera laterally
                        right_vec = camera.matrix_world.to_quaternion() @ mathutils.Vector((1, 0, 0))
                        camera.location += right_vec * tx * 0.18
                        
                    # 3. Dynamic shake/accel drift (inertia)
                    accel = sensordata.get("accel")
                    if accel:
                        ax = accel.get("x", 0.0)
                        ay = accel.get("y", 0.0)
                        az = accel.get("z", 0.0)
                        # Add slight jitter/drift based on high physical G-force spikes
                        if abs(ax) + abs(ay) + abs(az) > 1.5:
                            up_vec = camera.matrix_world.to_quaternion() @ mathutils.Vector((0, 1, 0))
                            camera.location += up_vec * ay * 0.02

            except queue.Empty:
                break
            except Exception as e:
                print(f"[CLE] Render loop error: {e}")
                
        return {'PASS_THROUGH'}
    
    def execute(self, context):
        global socket_thread, stop_event
        
        # Reset telemetry queue
        while not telemetry_queue.empty():
            telemetry_queue.get()
            
        stop_event.clear()
        
        # Start socket thread
        socket_thread = threading.Thread(
            target=udp_listener_thread,
            args=(BIND_IP, BIND_PORT, telemetry_queue, stop_event),
            daemon=True
        )
        socket_thread.start()
        
        # Set up a modal timer inside Blender (executes modal function ~60 times a second)
        self._timer = context.window_manager.event_timer_add(0.016, window=context.window)
        context.window_manager.modal_handler_add(self)
        
        print("[CLE] Spatial Camera tracking started. Hold phone and move context camera.")
        self.report({'INFO'}, "NEXUS Spatial Camera Active. Press 'ESC' in viewport to stop.")
        return {'RUNNING_MODAL'}
        
    def cancel(self, context):
        global stop_event
        # Stop background thread
        stop_event.set()
        # Clean timer
        context.window_manager.event_timer_remove(self._timer)
        print("[CLE] Spatial Camera tracking terminated.")
        self.report({'INFO'}, "NEXUS Spatial Camera Stopped.")

def register():
    bpy.utils.register_class(CLESpatialCameraOperator)

def unregister():
    bpy.utils.unregister_class(CLESpatialCameraOperator)

if __name__ == "__main__":
    # If already registered, unregister to refresh
    try:
        unregister()
    except Exception:
        pass
        
    register()
    
    # Run the operator immediately
    bpy.ops.view3d.cle_spatial_camera()

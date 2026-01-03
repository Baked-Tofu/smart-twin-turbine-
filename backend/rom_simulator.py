# rom_simulator.py

import numpy as np
import time

# --- INITIAL STATE AND PARAMETERS ---
class TurbineState:
    def __init__(self):
        # Operational State
        self.is_running = False
        self.health_score = 100.0
        self.time_history = []
        self.chart_max_history = 20

        # Degradation Parameter (Simulating bearing stiffness)
        self.bearing_stiffness_factor = 1.0  # Controls rate of degradation
        self.BASE_TORQUE_HEALTHY = 105.0
        self.current_temp = 50.0

        # Constants
        self.TEMP_LIMIT = 100.0
        self.MAX_POWER = 1000
        self.MAX_CURRENT = 100
        self.fault_location = "None" 

# Initialize the global state
GLOBAL_STATE = TurbineState()

# Fault analogy log (max 10 entries)
fault_log = []

def add_fault_log(message):
    timestamp = time.strftime("%H:%M:%S")
    fault_log.append(f"[{timestamp}] {message}")
    if len(fault_log) > 10:
        fault_log.pop(0)

# --- SIMULATION STEP ---
def run_simulation_step():
    """Calculates the new state for one simulation step (1 second)."""
    state = GLOBAL_STATE

    # Return default zeros if simulation is stopped
    if not state.is_running:
        return {
            "rpm": 0, 
            "power": 0.0, 
            "current": 0.0, 
            "health": state.health_score, 
            "temp": state.current_temp, 
            "torque": state.BASE_TORQUE_HEALTHY,
            "vibration": 0.0,
            "status": "Offline", 
            "fault_location": state.fault_location
        }

    # --- 1. Simulate Degradation ---
    state.health_score = max(0, state.health_score - state.bearing_stiffness_factor * 0.05)
    
    degradation_level = (100 - state.health_score) / 100

    # Torque Calculation
    actual_torque = state.BASE_TORQUE_HEALTHY + (np.random.rand() * 5) + (degradation_level * 40)
    
    # Temperature Calculation
    state.current_temp = min(120, state.current_temp + (degradation_level * 0.5 - 0.1))

    # Vibration Calculation
    vibration = 2.0 + degradation_level * 6 + np.random.rand()

    # Add fault logs for explanation
    if state.health_score < 80 and state.fault_location == "None":
        add_fault_log("Early bearing wear detected → torque fluctuation increasing")
    if state.fault_location != "None":
        add_fault_log(f"Fault active at {state.fault_location} → vibration increased")

    # Other KPIs
    efficiency = state.health_score / 100.0
    rpm = 1500 + np.random.randint(-50, 50)

    # --- Update History for Charts ---
    if len(state.time_history) >= state.chart_max_history:
        state.time_history.pop(0)

    state.time_history.append({
        "torque": actual_torque,
        "temp": state.current_temp
    })

    return {
        "rpm": rpm, 
        "power": state.MAX_POWER * efficiency * 0.9, 
        "current": state.MAX_CURRENT * efficiency * 0.9,
        "health": state.health_score,
        "temp": state.current_temp,
        "torque": actual_torque,
        "vibration": vibration,
        "status": "alert" if state.health_score < 50 else ("warning" if state.health_score < 80 else "healthy"),
        "fault_location": state.fault_location
    }

# --- CONTROL FUNCTIONS ---
def perform_maintenance():
    """Resets all degradation factors to restore the system to a new state."""
    GLOBAL_STATE.health_score = 100.0
    GLOBAL_STATE.bearing_stiffness_factor = 1.0
    GLOBAL_STATE.current_temp = 50.0
    GLOBAL_STATE.fault_location = "None"
    GLOBAL_STATE.time_history = []
    fault_log.clear()
    add_fault_log("Maintenance performed → health restored to 100%")
    print("[SYSTEM] Maintenance performed: Health restored.")

def inject_fault():
    """Simulates a catastrophic fault by accelerating degradation."""
    GLOBAL_STATE.bearing_stiffness_factor = 0.4
    GLOBAL_STATE.health_score -= 20
    GLOBAL_STATE.fault_location = "High-Speed Bearing"
    add_fault_log("Catastrophic bearing fault injected → rapid health drop")

def start_simulation():
    GLOBAL_STATE.is_running = True
    GLOBAL_STATE.fault_location = "None"
    add_fault_log("Simulation started")

def stop_simulation():
    GLOBAL_STATE.is_running = False
    GLOBAL_STATE.fault_location = "Offline"
    add_fault_log("Simulation stopped")

def get_rul_projection():
    """Returns a simple projection of RUL based on current state."""
    health = GLOBAL_STATE.health_score
    return [max(0, health - (i * 2) * (GLOBAL_STATE.bearing_stiffness_factor)) for i in range(30)]

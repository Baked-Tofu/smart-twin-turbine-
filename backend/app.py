# app.py

from flask import Flask, jsonify, request
from flask_cors import CORS
import threading
import time
import sys 
from rom_simulator import (
    run_simulation_step, GLOBAL_STATE, inject_fault, 
    start_simulation, stop_simulation, get_rul_projection,
    perform_maintenance # <--- THIS IMPORT IS NOW CORRECT
)

app = Flask(__name__)
CORS(app) 

# --- Simulation Thread Management ---
def simulation_loop():
    """Runs the simulation step every 1 second in the background."""
    while True:
        try:
            if GLOBAL_STATE.is_running:
                run_simulation_step()
        except Exception as e:
            # If the simulation crashes, log the error but keep Flask running.
            print(f"\n[CRASH ERROR] Simulation Thread Failed: {e}", file=sys.stderr)
            GLOBAL_STATE.is_running = False
            GLOBAL_STATE.fault_location = "SIMULATION CRASHED"
            print("Simulation stopped. Restart required.", file=sys.stderr)
        time.sleep(1) 

threading.Thread(target=simulation_loop, daemon=True).start()

# --- API ENDPOINTS ---

@app.route('/api/kpi', methods=['GET'])
def get_kpis():
    """Serves current snapshot data to the dashboard KPI cards."""
    latest_data = run_simulation_step()
    return jsonify(latest_data)

@app.route('/api/charts', methods=['GET'])
def get_chart_data():
    """Serves historical/projection data for all charts."""
    
    torque_data = [d['torque'] for d in GLOBAL_STATE.time_history]
    temp_data = [d['temp'] for d in GLOBAL_STATE.time_history]
    rul_projection = get_rul_projection()
    
    return jsonify({
        "torque_history": torque_data,
        "temp_history": temp_data,
        "rul_projection": rul_projection
    })

@app.route('/api/maintenance', methods=['POST'])
def handle_maintenance():
    """Triggers the full system health reset."""
    try:
        # Stop the simulation (maintenance implies downtime)
        stop_simulation()
        perform_maintenance()
        return jsonify({"message": "Maintenance successfully performed. Health restored to 100%."})
    except Exception as e:
        return jsonify({"error": f"Maintenance failed: {e}"}), 500


@app.route('/api/control', methods=['POST'])
def handle_control():
    """Handles commands from the POWER and SIMULATE FAULT buttons."""
    data = request.get_json()
    command = data.get('command')
    
    if command == "START":
        start_simulation()
        return jsonify({"message": "Simulation started."})
        
    elif command == "STOP":
        stop_simulation()
        return jsonify({"message": "Simulation stopped."})
        
    elif command == "INJECT_FAULT":
        inject_fault()
        return jsonify({"message": "Catastrophic fault injected."})
        
    return jsonify({"error": "Invalid command"}), 400

if __name__ == '__main__':
    # Start the Flask API server.
    app.run(debug=True, host='0.0.0.0')
document.addEventListener('DOMContentLoaded', () => {
    // --- 1. Dashboard State and Initial Setup ---
    const API_URL = 'http://127.0.0.1:5000/api/';
    const MAX_POWER = 1000;
    const MAX_CURRENT = 100;

    let turbineIsOn = false;
    let simulationInterval;
    
    // --- ELEMENT REFERENCES ---
    const healthCardEl = document.querySelector('.health-score-card');
    const powerButton = document.getElementById('power-button');
    const faultButton = document.getElementById('fault-button');
    const maintenanceButton = document.getElementById('maintenance-button');
    const themeToggleBtn = document.getElementById('theme-toggle');
    const bodyEl = document.body;
    
    // KPI elements 
    const rpmValueEl = document.getElementById('rpm-value');
    const healthScoreEl = document.getElementById('health-score-value');
    const powerValueEl = document.getElementById('power-value');
    const currentValueEl = document.getElementById('current-value');
    const faultLogEl = document.getElementById('fault-log');
    const backendStatusEl = document.getElementById('backend-status');

    // --- 2. Chart.js Initialization ---
    const canvasPower = document.getElementById('powerRULChart');
    const canvasTorque = document.getElementById('torqueChart');
    const canvasTemp = document.getElementById('tempChart');

    let allCharts = [];
    const RUL_TIME_AXIS = Array.from({length: 30}, (_, i) => `Day ${i + 1}`);
    const CHART_TIME_AXIS = Array.from({length: 20}, (_, i) => `T - ${20 - i}s`);

    // Initialization Logic for all charts (Error protection ensures the script doesn't crash if a canvas is missing)
    if (canvasPower) {
        allCharts.push(new Chart(canvasPower.getContext('2d'), {
            type: 'line', data: { labels: RUL_TIME_AXIS, datasets: [{ label: 'Predicted Health Score (%)', tension: 0.3, data: [] }] },
            options: { responsive: true, maintainAspectRatio: false, scales: {y: {min: 0, max: 100}} }
        }));
    }
    
    if (canvasTorque) {
        allCharts.push(new Chart(canvasTorque.getContext('2d'), {
            type: 'line', data: { labels: CHART_TIME_AXIS, datasets: [{ label: 'Actual Torque (Nm)', tension: 0.1, fill: true, data: Array(20).fill(0) }] },
            options: { responsive: true, maintainAspectRatio: false, scales: {y: {min: 0, max: 200}} }
        }));
    }

    if (canvasTemp) {
        const MAX_TEMP = 100;
        allCharts.push(new Chart(canvasTemp.getContext('2d'), {
            type: 'line', data: {
                labels: CHART_TIME_AXIS,
                datasets: [{ label: 'Winding Temp (°C)', tension: 0.2, fill: true, data: Array(20).fill(25) },
                           { label: 'Max Safe Limit (100°C)', borderColor: '#ff3c41', borderDash: [5, 5], pointRadius: 0, backgroundColor: 'transparent', data: Array(20).fill(MAX_TEMP) }]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: {y: {min: 20, max: 120}} }
        }));
    }

    // --- 3. Utility Functions ---
    function logMessage(message, type = 'info') { 
        if (!faultLogEl) return;
        const logEntry = document.createElement('p');
        logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        if (type === 'alert') { logEntry.classList.add('alert'); } 
        else if (type === 'warning') { logEntry.classList.add('warning'); }
        faultLogEl.prepend(logEntry);
        if (faultLogEl.children.length > 8) { faultLogEl.removeChild(faultLogEl.lastChild); }
    }
    function generateRULData(initialHealth, failureDay = 25) { 
        const data = [];
        let current = initialHealth;
        for (let i = 0; i < 30; i++) {
            current -= (i < failureDay) ? (0.5 + Math.random() * 0.2) : (2.0 + Math.random() * 1.5);
            data.push(Math.max(0, current));
        }
        return data;
    }

    // --- 4. Theme Toggle Logic ---
    function toggleTheme() {
        bodyEl.classList.toggle('light-mode');
        // Setting Material Symbols icons
        if (themeToggleBtn) {
            themeToggleBtn.innerHTML = bodyEl.classList.contains('light-mode') 
                ? '<span class="material-symbols-outlined">light_mode</span>' 
                : '<span class="material-symbols-outlined">dark_mode</span>';
        }
        allCharts.forEach(chart => chart.update('none'));
    }
    
    // --- 5. Core API Fetching Function ---
    async function fetchAndUpdateData() {
        let kpiData;
        let chartData;
        try {
            // Fetch current KPI snapshot and chart data from the Python API
            const kpiResponse = await fetch(API_URL + 'kpi');
            kpiData = await kpiResponse.json();

            const chartResponse = await fetch(API_URL + 'charts');
            chartData = await chartResponse.json();
            
            // --- Update DOM with KPI Data ---
            if (rpmValueEl) rpmValueEl.textContent = Math.round(kpiData.rpm);
            if (powerValueEl) powerValueEl.textContent = kpiData.power.toFixed(1);
            if (currentValueEl) currentValueEl.textContent = kpiData.current.toFixed(1);
            if (healthScoreEl) healthScoreEl.textContent = kpiData.health.toFixed(1);
            
            // --- Update Health Status and Visuals ---
            const status = kpiData.status;
            // Determine Health Color based on status provided by Python
            const healthColor = (status === 'alert') ? 'var(--alert-red)' : (status === 'warning' ? 'var(--warning-yellow)' : 'var(--primary-green)');
            
            if (healthScoreEl) healthScoreEl.style.color = healthColor;
            if (healthCardEl) healthCardEl.setAttribute('data-status', status); 

            // --- Update Charts ---
            if (allCharts.length > 0) {
                if (canvasPower) allCharts[0].data.datasets[0].data = chartData.rul_projection;
                if (canvasTorque) allCharts[1].data.datasets[0].data = chartData.torque_history;
                if (canvasTemp) allCharts[2].data.datasets[0].data = chartData.temp_history;
                allCharts.forEach(chart => chart.update('none'));
            }
            
            // --- Update 3D Model State ---
            if (typeof update3DHighlight === 'function') {
                update3DHighlight(kpiData.fault_location, kpiData.health);
            }


        } catch (error) {
            console.error("API Fetch Error:", error);
            // Stop the interval if the API disconnects
            clearInterval(simulationInterval);
            logMessage("API connection failed. Check Flask server.", 'alert');
            
            if(backendStatusEl) {
                backendStatusEl.textContent = "API DISCONNECTED";
                if(backendStatusEl.classList) backendStatusEl.classList.replace('status-online', 'status-offline');
            }
        }
    }

    // --- 6. Control Logic (Sending POST requests to API) ---
    async function sendControlCommand(command) {
        if (!['START', 'STOP', 'INJECT_FAULT', 'MAINTENANCE'].includes(command)) return;

        let endpoint = (command === 'MAINTENANCE') ? 'maintenance' : 'control';

        try {
            const response = await fetch(API_URL + endpoint, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ command: command })
            });

            const data = await response.json();
            
            if (command === 'START') {
                turbineIsOn = true;
                if(backendStatusEl) backendStatusEl.classList.replace('status-offline', 'status-online');
                simulationInterval = setInterval(fetchAndUpdateData, 1000); 
                logMessage("Simulation started.", 'info');
            } else if (command === 'STOP') {
                turbineIsOn = false;
                clearInterval(simulationInterval);
                logMessage("Simulation stopped.", 'info');
            } else if (command === 'INJECT_FAULT') {
                logMessage("Fault signal sent to Digital Twin.", 'warning');
            } else if (command === 'MAINTENANCE') {
                 logMessage("Maintenance successfully performed. Health restored.", 'info');
            }

            // Update visual state immediately
            fetchAndUpdateData(); 
            updateControlPanelVisuals(command);

        } catch (error) {
            logMessage("Error sending command to API. Server may be down.", 'alert');
            console.error(error);
        }
    }

    // Helper to update button states
    function updateControlPanelVisuals(command) {
        if (command === 'START') {
            if(powerButton) powerButton.textContent = "POWER ON";
            if(powerButton) powerButton.classList.replace('power-off-state', 'power-on-state');
            if(backendStatusEl) backendStatusEl.textContent = "Online";
        } else if (command === 'STOP' || command === 'MAINTENANCE') {
            if(powerButton) powerButton.textContent = "POWER OFF";
            if(powerButton) powerButton.classList.replace('power-on-state', 'power-off-state');
            if(backendStatusEl) backendStatusEl.textContent = "Offline";
        }
    }

    // --- 7. Attach Listeners and Initialize (The button handlers) ---
    
    // Handler functions
    function togglePowerHandler() {
        // CRITICAL CHECK: Determine command based on current text
        const command = powerButton.textContent.includes("OFF") ? "START" : "STOP";
        sendControlCommand(command);
    }
    function simulateFaultHandler() {
        sendControlCommand("INJECT_FAULT");
    }
    function performMaintenanceHandler() {
        sendControlCommand("MAINTENANCE");
        sendControlCommand("STOP"); // Stop server after maintenance for demonstration reset
    }

    // Attaching listeners (FINAL ATTACHMENT)
    if (powerButton) powerButton.addEventListener('click', togglePowerHandler);
    if (faultButton) faultButton.addEventListener('click', simulateFaultHandler);
    if (maintenanceButton) maintenanceButton.addEventListener('click', performMaintenanceHandler);
    if (themeToggleBtn) themeToggleBtn.addEventListener('click', toggleTheme);

    // Initial state setup
    updateControlPanelVisuals("STOP");
    toggleTheme();
    // Start initial fetch to check if API is alive
    fetchAndUpdateData(); 
});
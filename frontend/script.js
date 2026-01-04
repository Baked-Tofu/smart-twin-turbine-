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

    // --- 4. Theme Toggle Logic ---
    function toggleTheme() {
        bodyEl.classList.toggle('light-mode');
        if (themeToggleBtn) {
            themeToggleBtn.innerHTML = bodyEl.classList.contains('light-mode') 
                ? '<span class="material-symbols-outlined">light_mode</span>' 
                : '<span class="material-symbols-outlined">dark_mode</span>';
        }
        allCharts.forEach(chart => chart.update('none'));
    }
    
    // --- 5. Core API Fetching Function ---
    async function fetchAndUpdateData() {
        try {
            const kpiResponse = await fetch(API_URL + 'kpi');
            const kpiData = await kpiResponse.json();

            const chartResponse = await fetch(API_URL + 'charts');
            const chartData = await chartResponse.json();
            
            // --- Update DOM with KPI Data ---
            if (rpmValueEl) rpmValueEl.textContent = Math.round(kpiData.rpm);
            if (powerValueEl) powerValueEl.textContent = kpiData.power.toFixed(1);
            if (currentValueEl) currentValueEl.textContent = kpiData.current.toFixed(1);
            if (healthScoreEl) healthScoreEl.textContent = kpiData.health.toFixed(1);

            // --- SYNC 3D MODEL SPEED ---
            // Set back to your preferred speed (0.00012)
            window.turbineRotationSpeed = kpiData.rpm * 0.00012; 
            
            // --- Update Visuals ---
            const status = kpiData.status;
            const healthColor = (status === 'alert') ? 'var(--alert-red)' : (status === 'warning' ? 'var(--warning-yellow)' : 'var(--primary-green)');
            if (healthScoreEl) healthScoreEl.style.color = healthColor;
            if (healthCardEl) healthCardEl.setAttribute('data-status', status); 

            // --- Update Charts ---
            if (allCharts.length > 0) {
                allCharts[0].data.datasets[0].data = chartData.rul_projection;
                allCharts[1].data.datasets[0].data = chartData.torque_history;
                allCharts[2].data.datasets[0].data = chartData.temp_history;
                allCharts.forEach(chart => chart.update('none'));
            }

       } catch (error) {
    console.error("API Fetch Error:", error);
    clearInterval(simulationInterval);
    window.turbineRotationSpeed = 0;
    logMessage("API connection failed. Check Flask server.", 'alert');
    
    if(backendStatusEl) {
        // Just the word, let the HTML handle the "Data Link" part
        backendStatusEl.innerHTML = "Offline";
        backendStatusEl.className = 'status-offline';
    }
}
    }

    // --- 6. Control Logic ---
    async function sendControlCommand(command) {
        if (!['START', 'STOP', 'INJECT_FAULT', 'MAINTENANCE'].includes(command)) return;
        let endpoint = (command === 'MAINTENANCE') ? 'maintenance' : 'control';

        try {
            const response = await fetch(API_URL + endpoint, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ command: command })
            });

            if (command === 'START') {
                turbineIsOn = true;
                simulationInterval = setInterval(fetchAndUpdateData, 1000); 
                logMessage("Simulation started.", 'info');
            } else if (command === 'STOP') {
                turbineIsOn = false;
                clearInterval(simulationInterval);
                window.turbineRotationSpeed = 0; // Stop 3D wings
                logMessage("Simulation stopped.", 'info');
            } else if (command === 'INJECT_FAULT') {
                logMessage("Fault signal sent to Digital Twin.", 'warning');
            } else if (command === 'MAINTENANCE') {
                 logMessage("Maintenance successfully performed.", 'info');
            }

            fetchAndUpdateData(); 
            updateControlPanelVisuals(command);

        } catch (error) {
            logMessage("Error sending command to API.", 'alert');
        }
    }

    function updateControlPanelVisuals(command) {
    if (command === 'START') {
        powerButton.textContent = "POWER ON";
        powerButton.classList.replace('power-off-state', 'power-on-state');
        
        // ONLY change the word inside the span
        backendStatusEl.innerHTML = 'Online';
        backendStatusEl.className = 'status-online';
        
    } else if (command === 'STOP') {
        powerButton.textContent = "POWER OFF";
        powerButton.classList.replace('power-on-state', 'power-off-state');
        
        // ONLY change the word inside the span
        backendStatusEl.innerHTML = 'Offline';
        backendStatusEl.className = 'status-offline';
    }
}

    // --- 7. Listeners ---
    if (powerButton) powerButton.addEventListener('click', () => {
        const cmd = powerButton.textContent.includes("OFF") ? "START" : "STOP";
        sendControlCommand(cmd);
    });
    if (faultButton) faultButton.addEventListener('click', () => sendControlCommand("INJECT_FAULT"));
    if (maintenanceButton) maintenanceButton.addEventListener('click', () => sendControlCommand("MAINTENANCE"));
    if (themeToggleBtn) themeToggleBtn.addEventListener('click', toggleTheme);

    toggleTheme();
    fetchAndUpdateData(); 
});
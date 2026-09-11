/**
 * WHY DID YOU MOVE LIKE THAT?
 * Retro Pixel Arcade Machine & Questionable Kinetic Research System
 * Web Serial API + ESP32 + MPU6050 Hardware Integration
 */

(function () {
  'use strict';

  // =========================================================================
  // 1. RETRO 8-BIT AUDIO SYNTHESIS SUBSYSTEM (Web Audio API)
  // =========================================================================
  const audio = (function () {
    let ctx = null;
    let enabled = true;

    function init() {
      if (!ctx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) ctx = new AudioContext();
      }
    }

    function tone(freq, duration, type = 'square', gainLevel = 0.08) {
      if (!enabled || !ctx) return;
      try {
        if (ctx.state === 'suspended') ctx.resume();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);

        gain.gain.setValueAtTime(gainLevel, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + duration);
      } catch (e) {}
    }

    return {
      init,
      toggle: () => {
        init();
        enabled = !enabled;
        return enabled;
      },
      isEnabled: () => enabled,
      blip: (freq = 750) => tone(freq, 0.04, 'square', 0.05),
      coin: () => {
        init();
        tone(987, 0.08, 'square', 0.07);
        setTimeout(() => tone(1318, 0.28, 'square', 0.09), 80);
      },
      shakeRumble: () => tone(120 + Math.random() * 80, 0.06, 'sawtooth', 0.05),
      countdownBeep: (isFinal = false) => {
        init();
        tone(isFinal ? 1046 : 523, isFinal ? 0.35 : 0.12, 'square', 0.1);
      },
      victory: () => {
        init();
        [523, 659, 783, 1046].forEach((f, idx) => {
          setTimeout(() => tone(f, 0.16, 'triangle', 0.09), idx * 100);
        });
      },
      buzzer: () => {
        init();
        tone(160, 0.25, 'sawtooth', 0.1);
      }
    };
  })();

  // Audio Toggle Button Setup
  const soundToggleBtn = document.getElementById('soundToggleBtn');
  const soundStatusText = document.getElementById('soundStatusText');
  if (soundToggleBtn && soundStatusText) {
    soundToggleBtn.addEventListener('click', () => {
      const state = audio.toggle();
      soundStatusText.textContent = state ? 'ON' : 'OFF';
      soundToggleBtn.style.opacity = state ? '1' : '0.6';
      if (state) audio.coin();
    });
  }

  // Cabinet Top Clock
  const cabinetTime = document.getElementById('cabinetTime');
  setInterval(() => {
    if (!cabinetTime) return;
    const d = new Date();
    cabinetTime.textContent = d.toTimeString().split(' ')[0];
  }, 500);


  // =========================================================================
  // 2. WEB SERIAL API SUBSYSTEM (ESP32 + MPU6050 COMMUNICATION)
  // =========================================================================
  const serialManager = (function () {
    let port = null;
    let reader = null;
    let isConnected = false;
    let keepReading = false;
    let serialBuffer = '';

    const connectSerialBtn = document.getElementById('connectSerialBtn');
    const disconnectSerialBtn = document.getElementById('disconnectSerialBtn');
    const startConnectBtn = document.getElementById('startConnectBtn');
    const sensorSourceText = document.getElementById('sensorSourceText');
    const sensorLed = document.getElementById('sensorLed');
    const esp32HwDot = document.getElementById('esp32HwDot');
    const esp32HwText = document.getElementById('esp32HwText');
    const mpuHwDot = document.getElementById('mpuHwDot');
    const mpuHwText = document.getElementById('mpuHwText');
    const startHwStatusMsg = document.getElementById('startHwStatusMsg');

    function updateUI(connected, portInfo) {
      isConnected = connected;
      portInfo = portInfo || '';

      if (connected) {
        if (sensorSourceText) sensorSourceText.textContent = 'CONNECTED: ESP32 (115200)' + (portInfo ? ' - ' + portInfo : '');
        if (sensorLed) sensorLed.className = 'sensor-led connected';
        if (connectSerialBtn) connectSerialBtn.style.display = 'none';
        if (disconnectSerialBtn) disconnectSerialBtn.style.display = 'inline-flex';
        if (startConnectBtn) { startConnectBtn.textContent = '\u2714 ESP32 + MPU6050 CONNECTED'; startConnectBtn.classList.add('linked'); }
        if (startHwStatusMsg) { startHwStatusMsg.textContent = '\u2714 Hardware Online! Shake your MPU6050 sensor to control the games.'; startHwStatusMsg.style.color = 'var(--pixel-green)'; }
        if (esp32HwDot) esp32HwDot.className = 'hw-dot connected';
        if (esp32HwText) esp32HwText.textContent = 'CONNECTED';
        if (mpuHwDot) mpuHwDot.className = 'hw-dot connected';
        if (mpuHwText) mpuHwText.textContent = 'ACTIVE';
      } else {
        if (sensorSourceText) sensorSourceText.textContent = 'DISCONNECTED (CLICK CONNECT)';
        if (sensorLed) sensorLed.className = 'sensor-led disconnected';
        if (connectSerialBtn) connectSerialBtn.style.display = 'inline-flex';
        if (disconnectSerialBtn) disconnectSerialBtn.style.display = 'none';
        if (startConnectBtn) { startConnectBtn.textContent = '\uD83D\uDD0C CONNECT ESP32 & MPU6050'; startConnectBtn.classList.remove('linked'); }
        if (startHwStatusMsg) { startHwStatusMsg.textContent = '\u26A1 Connect your ESP32 via USB Serial (115200 Baud) to play all games with real MPU shaking!'; startHwStatusMsg.style.color = 'var(--pixel-yellow)'; }
        if (esp32HwDot) esp32HwDot.className = 'hw-dot disconnected';
        if (esp32HwText) esp32HwText.textContent = 'DISCONNECTED';
        if (mpuHwDot) mpuHwDot.className = 'hw-dot disconnected';
        if (mpuHwText) mpuHwText.textContent = 'STANDBY';
      }
    }

    async function connect() {
      audio.init();

      // -----------------------------------------------------------------------
      // ROOT CAUSE of "No compatible devices found":
      // Web Serial API requires a SECURE CONTEXT (https:// or http://localhost).
      // Opening the file directly as file:/// makes window.isSecureContext = false
      // and navigator.serial becomes undefined or its requestPort() silently
      // shows 0 ports. Chrome refuses to list any COM ports at all.
      // FIX: serve via localhost using start_server.bat, then open
      //      http://localhost:8080 in Chrome.
      // -----------------------------------------------------------------------
      if (!window.isSecureContext) {
        alert(
          'WEB SERIAL BLOCKED: Not a secure context\n\n' +
          'You opened this page directly as a file:// URL.\n' +
          'Chrome blocks Web Serial on file:// — that is why you see\n' +
          '"No compatible devices found" and no COM ports appear.\n\n' +
          'SOLUTION:\n' +
          '1. Double-click  start_server.bat  in the project folder.\n' +
          '2. Open Chrome and go to:  http://localhost:8080\n' +
          '3. Click CONNECT ESP32 there.\n\n' +
          'Keep the black terminal window open while playing.'
        );
        return false;
      }

      if (!('serial' in navigator)) {
        alert(
          'Web Serial API not available.\n\n' +
          'Use Google Chrome or Microsoft Edge 89+.\n' +
          'Also make sure the page is on localhost or https://.'
        );
        return false;
      }

      if (port && isConnected) {
        console.log('[Serial] Already connected.');
        return true;
      }

      try {
        console.log('[Serial] Requesting port from browser...');
        port = await navigator.serial.requestPort();
        console.log('[Serial] Port granted. Opening at 115200 baud...');
        await port.open({ baudRate: 115200 });
        console.log('[Serial] Port open OK.');

        serialBuffer = '';
        keepReading = true;
        updateUI(true);
        audio.coin();

        // Start reading BEFORE sending commands so we don't miss PONG
        readStream();

        // Wait ~600 ms — ESP32 may reset when DTR toggles on port open
        await new Promise(function(r) { setTimeout(r, 600); });

        await sendCommand('PING');
        await new Promise(function(r) { setTimeout(r, 300); });
        await sendCommand('STREAM_ON');
        console.log('[Serial] PING + STREAM_ON sent. Listening for PONG...');
        return true;
      } catch (err) {
        console.warn('[Serial] Connection failed or canceled:', err);
        port = null;
        updateUI(false);
        return false;
      }
    }

    async function disconnect() {
      console.log('[Serial] Disconnecting...');
      keepReading = false;

      // Cancel reader first so readStream() loop exits cleanly
      if (reader) {
        try { await reader.cancel(); } catch (e) {}
        reader = null;
      }

      // Send STREAM_OFF before closing
      try { await sendCommand('STREAM_OFF'); } catch (e) {}

      if (port) {
        try { await port.close(); } catch (e) {}
        port = null;
      }

      updateUI(false);
      audio.blip(350);
      console.log('[Serial] Disconnected.');
    }

    // BUG FIX: writer lock released in finally — previously try/catch without
    // finally meant any write error left the port permanently locked and all
    // subsequent sendCommand() calls silently failed.
    async function sendCommand(cmd) {
      if (!port || !port.writable) return;
      var encoder = new TextEncoder();
      var w = null;
      try {
        w = port.writable.getWriter();
        await w.write(encoder.encode(cmd + '\n'));
        console.log('[Serial] Sent:', cmd);
      } catch (err) {
        console.error('[Serial] Send error for "' + cmd + '":', err);
      } finally {
        if (w) { try { w.releaseLock(); } catch (e) {} }
      }
    }

    // BUG FIX: use port.readable.getReader() directly.
    // The original code did port.readable.pipeTo(TextDecoderStream) inside a
    // while-loop. pipeTo() permanently locks port.readable on the FIRST call.
    // Every subsequent outer-loop iteration found a locked readable and threw
    // immediately, killing the stream after the first chunk.
    // Fix: grab a raw reader, decode Uint8Array manually with TextDecoder.
    async function readStream() {
      var dec = new TextDecoder();

      while (port && port.readable && keepReading) {
        reader = null;
        try {
          reader = port.readable.getReader();

          while (keepReading) {
            var result = await reader.read();
            if (result.done) {
              console.log('[Serial] Stream done.');
              break;
            }
            if (result.value && result.value.length) {
              var chunk = dec.decode(result.value, { stream: true });
              serialBuffer += chunk;
              var lines = serialBuffer.split('\n');
              serialBuffer = lines.pop();
              for (var i = 0; i < lines.length; i++) {
                var line = lines[i].replace(/\r/g, '').trim();
                if (line) handleSerialLine(line);
              }
            }
          }
        } catch (err) {
          if (keepReading) {
            console.warn('[Serial] Read error:', err);
          }
        } finally {
          if (reader) {
            try { reader.releaseLock(); } catch (e) {}
            reader = null;
          }
        }

        if (keepReading && port && port.readable) {
          await new Promise(function(r) { setTimeout(r, 100); });
        }
      }

      if (isConnected) {
        console.warn('[Serial] Port lost unexpectedly. Cleaning up.');
        port = null;
        updateUI(false);
      }
    }

    function handleSerialLine(line) {
      if (!line) return;

      if (!line.startsWith('DATA,')) {
        console.log('[Serial] <-', line);
      }

      // FORMAT: DATA,ax,ay,az,gx,gy,gz,accelMag,gyroMag
      if (line.startsWith('DATA,')) {
        var parts = line.split(',');
        if (parts.length >= 9) {
          var ax = parseFloat(parts[1]) || 0;
          var ay = parseFloat(parts[2]) || 0;
          var az = parseFloat(parts[3]) || 0;
          var gx = parseFloat(parts[4]) || 0;
          var gy = parseFloat(parts[5]) || 0;
          var gz = parseFloat(parts[6]) || 0;
          var accelMag = parseFloat(parts[7]) || 1.0;
          var gyroMag  = parseFloat(parts[8]) || 0.0;
          // Uncomment to debug individual sensor frames:
          // console.log('[Sensor] accelMag=' + accelMag.toFixed(3) + ' gyroMag=' + gyroMag.toFixed(1));
          sensorManager.handleHardwareData(ax, ay, az, gx, gy, gz, accelMag, gyroMag);
        } else {
          console.warn('[Serial] Malformed DATA (need 9 fields):', line);
        }
      } else if (line === 'PONG') {
        console.log('[Serial] ESP32 handshake PONG OK');
      } else if (line === 'STREAM_ON_OK') {
        console.log('[Serial] Streaming active');
      } else if (line === 'STREAM_OFF_OK') {
        console.log('[Serial] Streaming off');
      } else if (line === 'STARTED') {
        console.log('[Serial] Game started');
      } else if (line === 'STOPPED') {
        console.log('[Serial] Game stopped');
      } else if (line === 'RESET_COMPLETE') {
        console.log('[Serial] ESP32 reset complete');
      }
    }

    if (connectSerialBtn) connectSerialBtn.addEventListener('click', connect);
    if (disconnectSerialBtn) disconnectSerialBtn.addEventListener('click', disconnect);
    if (startConnectBtn) startConnectBtn.addEventListener('click', connect);

    return {
      connect: connect,
      disconnect: disconnect,
      sendCommand: sendCommand,
      isConnected: function() { return isConnected; }
    };
  })();


  // =========================================================================
  // 3. SENSOR INTENSITY & MPU SHAKE PROCESSOR
  // =========================================================================
  const sensorManager = (function () {
    let movementIntensity = 0; // 0 to 100
    const listeners = [];

    // Hardware telemetry cache
    let curAx = 0, curAy = 0, curAz = 1, curGx = 0, curGy = 0, curGz = 0;
    let curAccelMag = 1.0, curGyroMag = 0.0;

    // Elements
    const liveBar = document.getElementById('liveIntensityBar');
    const liveNum = document.getElementById('liveIntensityNum');
    const rawAccelXYZ = document.getElementById('rawAccelXYZ');
    const rawGyroXYZ = document.getElementById('rawGyroXYZ');
    const rawAccelMag = document.getElementById('rawAccelMag');
    const rawGyroMag = document.getElementById('rawGyroMag');

    function update() {
      // Decay movement intensity towards 0 when shaking pauses
      if (movementIntensity > 0.4) {
        movementIntensity *= 0.88;
      } else {
        movementIntensity = 0;
      }

      // Update Top HUD Monitor
      if (liveBar) liveBar.style.width = `${Math.round(movementIntensity)}%`;
      if (liveNum) liveNum.textContent = `${Math.round(movementIntensity)}%`;

      // Broadcast to active games
      for (let i = 0; i < listeners.length; i++) {
        listeners[i](movementIntensity);
      }

      requestAnimationFrame(update);
    }
    requestAnimationFrame(update);

    // Called every 20ms with real MPU6050 serial data
    function handleHardwareData(ax, ay, az, gx, gy, gz, accelMag, gyroMag) {
      curAx = ax; curAy = ay; curAz = az;
      curGx = gx; curGy = gy; curGz = gz;
      curAccelMag = accelMag; curGyroMag = gyroMag;

      // Dynamic acceleration (Earth's gravity is 1.0g at rest)
      const dynamicAccel = Math.abs(accelMag - 1.0);

      // Accelerometer intensity mapping (0.12g threshold, 1.6g intense shake)
      const accelFactor = Math.min(100, Math.max(0, (dynamicAccel - 0.12) / 1.5 * 100));

      // Gyroscope rotation intensity (25 deg/s threshold, 360 deg/s intense shake)
      const gyroFactor = Math.min(100, Math.max(0, (gyroMag - 25) / 330 * 100));

      // Combined shake response
      const instantIntensity = Math.min(100, Math.max(accelFactor, gyroFactor) * 0.85 + Math.min(accelFactor, gyroFactor) * 0.15);

      if (instantIntensity > movementIntensity) {
        movementIntensity = instantIntensity; // Immediate peak response
      }

      // Update Raw Telemetry in Lab if visible
      if (rawAccelXYZ) rawAccelXYZ.textContent = `${ax.toFixed(2)}, ${ay.toFixed(2)}, ${az.toFixed(2)} g`;
      if (rawGyroXYZ) rawGyroXYZ.textContent = `${gx.toFixed(1)}, ${gy.toFixed(1)}, ${gz.toFixed(1)} °/s`;
      if (rawAccelMag) rawAccelMag.textContent = `${accelMag.toFixed(3)} g`;
      if (rawGyroMag) rawGyroMag.textContent = `${gyroMag.toFixed(3)} °/s`;
    }

    return {
      getMovementIntensity: () => movementIntensity,
      handleHardwareData,
      getRawVectors: () => ({ ax: curAx, ay: curAy, az: curAz, gx: curGx, gy: curGy, gz: curGz, accelMag: curAccelMag, gyroMag: curGyroMag }),
      onMovement: (cb) => {
        if (typeof cb === 'function') listeners.push(cb);
      }
    };
  })();


  // =========================================================================
  // 4. SCREEN NAVIGATION CONTROLLER
  // =========================================================================
  const screenManager = (function () {
    const screens = document.querySelectorAll('.arcade-screen');

    function showScreen(screenId) {
      audio.init();
      screens.forEach((s) => s.classList.remove('active'));
      const target = document.getElementById(screenId);
      if (target) {
        target.classList.add('active');
        audio.blip(580);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    return { showScreen };
  })();

  // Navigation Button Bindings
  const pressStartBtn = document.getElementById('pressStartBtn');
  if (pressStartBtn) {
    pressStartBtn.addEventListener('click', () => {
      audio.coin();
      screenManager.showScreen('screen-arcade');
    });
  }

  const backToStartBtn = document.getElementById('backToStartBtn');
  if (backToStartBtn) {
    backToStartBtn.addEventListener('click', () => screenManager.showScreen('screen-start'));
  }

  const gotoLabBtn = document.getElementById('gotoLabBtn');
  if (gotoLabBtn) {
    gotoLabBtn.addEventListener('click', () => {
      serialManager.sendCommand("STREAM_ON");
      screenManager.showScreen('screen-lab');
    });
  }

  document.querySelectorAll('.back-to-arcade-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      carGame.stop();
      battleGame.stop();
      // Reset ESP32 state and maintain stream
      serialManager.sendCommand("RESET");
      setTimeout(() => serialManager.sendCommand("STREAM_ON"), 200);
      screenManager.showScreen('screen-arcade');
    });
  });


  // =========================================================================
  // 5. LEADERBOARD SERVICE (LocalStorage CRUD)
  // =========================================================================
  const leaderboardService = (function () {
    const STORAGE_KEY = 'unnecessary_arcade_shame_leaderboard';
    const DEFAULT_ENTRIES = [
      { name: 'GRANDMA_W_TREMORS', score: 940, title: 'ABSOLUTE MENACE' },
      { name: 'CAFFEINE_DEV', score: 815, title: 'PROFESSIONAL SHAKER' },
      { name: 'CEILING_FAN_RIG', score: 670, title: 'SUSPICIOUSLY ENERGETIC' },
      { name: 'NERVOUS_PIGEON', score: 480, title: 'SUSPICIOUSLY ENERGETIC' },
      { name: 'SLOTH_ON_BENCH', score: 140, title: 'YOU BARELY MOVED' }
    ];

    function getEntries() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return JSON.parse(raw);
      } catch (e) {}
      return DEFAULT_ENTRIES;
    }

    function addEntry(name, score, title) {
      const entries = getEntries();
      entries.push({
        name: (name || 'ANONYMOUS').toUpperCase().slice(0, 14),
        score: Math.round(score),
        title: title || 'UNCLASSIFIED'
      });
      entries.sort((a, b) => b.score - a.score);
      const topEntries = entries.slice(0, 10);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(topEntries));
      } catch (e) {}
      return topEntries;
    }

    function renderLeaderboard() {
      const container = document.getElementById('leaderboardList');
      if (!container) return;
      const list = getEntries();
      container.innerHTML = '';

      list.forEach((item, idx) => {
        const row = document.createElement('div');
        row.className = `lead-row rank-${idx + 1}`;
        row.innerHTML = `
          <div class="lead-left">
            <span class="lead-rank">${idx + 1}.</span>
            <span class="lead-name">${item.name}</span>
          </div>
          <div class="lead-score">${item.score} PTS</div>
        `;
        container.appendChild(row);
      });
    }

    return { getEntries, addEntry, renderLeaderboard };
  })();

  const viewLeaderboardBtn = document.getElementById('viewLeaderboardBtn');
  if (viewLeaderboardBtn) {
    viewLeaderboardBtn.addEventListener('click', () => {
      leaderboardService.renderLeaderboard();
      screenManager.showScreen('screen-leaderboard');
    });
  }

  const leadPlayBattleBtn = document.getElementById('leadPlayBattleBtn');
  if (leadPlayBattleBtn) {
    leadPlayBattleBtn.addEventListener('click', () => {
      battleGame.init();
      screenManager.showScreen('screen-game-battle');
    });
  }


  // =========================================================================
  // 6. FAKE GAME POPUP & RANDOMIZED SATIRE
  // =========================================================================
  const fakeGamesData = {
    brain: {
      title: '04 — BRAIN CALIBRATION',
      status: 'CALIBRATING BRAIN CORTEX...',
      results: [
        { q1: '"BRAIN DETECTED."', q2: '"Unfortunately, it appears to be running Internet Explorer."' },
        { q1: '"SYNAPSES SURVEYED."', q2: '"Found 4 opened mental tabs, all playing carnival music."' },
        { q1: '"CALIBRATION ABORTED."', q2: '"User thoughts exceeded recommended dosage of absurdity."' }
      ]
    },
    dance: {
      title: '05 — DANCE DETECTOR',
      status: 'MEASURING RHYTHMIC KINEMATICS...',
      results: [
        { q1: '"DANCE DETECTED."', q2: '"Unfortunately, we have decided not to judge."' },
        { q1: '"RHYTHM ANALYSIS COMPLETE."', q2: '"Zero beat detected. You have invented negative groove."' },
        { q1: '"BIOMECHANICAL ALARM."', q2: '"Looked suspiciously like someone swatting imaginary bees."' }
      ]
    },
    chair: {
      title: '06 — CHAIR STABILITY TEST',
      status: 'STRESS-TESTING FURNITURE GRAVITY...',
      results: [
        { q1: '"CHAIR IS STABLE."', q2: '"YOU ARE THE UNSTABLE VARIABLE."' },
        { q1: '"STRUCTURAL INTEGRITY 100%."', q2: '"Your posture, however, violates 3 safety codes."' },
        { q1: '"SEAT SENSORS SATURATED."', q2: '"Please stop slumping at 45-degree angles."' }
      ]
    },
    robot: {
      title: '07 — EMOTIONAL SUPPORT ROBOT',
      status: 'SCANNING HUMAN VIBES...',
      results: [
        { q1: '"ANALYSING EMOTIONAL STATE..."', q2: '"STATE: NEEDS SNACKS."' },
        { q1: '"VIBE CHECK COMPLETE."', q2: '"Status: Emotionally stable, but questionable life choices."' },
        { q1: '"THERAPEUTIC SYNTHESIS:"', q2: '"Have you tried turning yourself off and on again?"' }
      ]
    },
    chicken: {
      title: '08 — CHICKEN ESCAPE',
      status: 'POULTRY SIMULATION RUNNING...',
      results: [
        { q1: '"CHICKEN INSTINCTS DETECTED."', q2: '"You fled with 94% authentic barnyard panic."' },
        { q1: '"CROSSING THE ROAD..."', q2: '"Recommendation: Cross without philosophical inquiry."' },
        { q1: '"AVIAN VELOCITY MAXED."', q2: '"You were outrun by a moderately motivated duck."' }
      ]
    },
    stock: {
      title: '09 — STOCK MARKET SHAKE',
      status: 'FLAILING FINANCIAL ASSETS...',
      results: [
        { q1: '"YOUR INVESTMENT HAS MOVED."', q2: '"YOUR MONEY HAS NOT."' },
        { q1: '"PORTFOLIO REBALANCED."', q2: '"You bought high, shook wildly, and achieved zero yield."' },
        { q1: '"WALL STREET ALERT:"', q2: '"Federal Reserve requests you cease kinetic trading."' }
      ]
    },
    blink: {
      title: '10 — ADVANCED BLINKING SIMULATOR',
      status: 'MEASURING EYELID TRAJECTORY...',
      results: [
        { q1: '"BLINK DETECTED."', q2: '"Congratulations. You successfully moistened your retinas."' },
        { q1: '"STARE PROTOCOL COMPLETE."', q2: '"You lost a staring contest with an inanimate MPU-6050."' },
        { q1: '"EYELID VELOCITY RECORDED."', q2: '"Scientific contribution to humanity: 0.000000%"' }
      ]
    }
  };

  const fakeModal = document.getElementById('fakeGameModal');
  const fakeGameTitle = document.getElementById('fakeGameTitle');
  const fakeLoadingBox = document.getElementById('fakeLoadingBox');
  const fakeLoadingStatus = document.getElementById('fakeLoadingStatus');
  const fakeProgressFill = document.getElementById('fakeProgressFill');
  const fakeAsciiBar = document.getElementById('fakeAsciiBar');
  const fakeResultBox = document.getElementById('fakeResultBox');
  const fakeQuote1 = document.getElementById('fakeQuote1');
  const fakeQuote2 = document.getElementById('fakeQuote2');
  const fakeReturnArcadeBtn = document.getElementById('fakeReturnArcadeBtn');
  const fakeGameCloseBtn = document.getElementById('fakeGameCloseBtn');

  function openFakeGame(key) {
    const data = fakeGamesData[key];
    if (!data || !fakeModal) return;

    audio.init();
    audio.blip(800);

    fakeGameTitle.textContent = data.title;
    fakeLoadingStatus.textContent = data.status;
    fakeLoadingBox.style.display = 'block';
    fakeResultBox.style.display = 'none';
    fakeProgressFill.style.width = '0%';
    fakeAsciiBar.textContent = '░░░░░░░░░░░░░░░░░░░░';
    fakeModal.style.display = 'flex';

    let progress = 0;
    const interval = setInterval(() => {
      progress += 14;
      if (progress > 100) progress = 100;

      fakeProgressFill.style.width = `${progress}%`;
      const filledBlocks = Math.round((progress / 100) * 20);
      fakeAsciiBar.textContent = '█'.repeat(filledBlocks) + '░'.repeat(20 - filledBlocks);
      audio.blip(400 + progress * 6);

      if (progress >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          const randResult = data.results[Math.floor(Math.random() * data.results.length)];
          fakeQuote1.textContent = randResult.q1;
          fakeQuote2.textContent = randResult.q2;
          fakeLoadingBox.style.display = 'none';
          fakeResultBox.style.display = 'flex';
          audio.victory();
        }, 300);
      }
    }, 110);
  }

  function closeFakeGame() {
    if (fakeModal) fakeModal.style.display = 'none';
    audio.blip(450);
  }

  if (fakeReturnArcadeBtn) fakeReturnArcadeBtn.addEventListener('click', closeFakeGame);
  if (fakeGameCloseBtn) fakeGameCloseBtn.addEventListener('click', closeFakeGame);


  // =========================================================================
  // 7. REAL GAME 1: WHY DID YOU MOVE LIKE THAT? (INTERACTIVE DAILY ACTIVITIES)
  // =========================================================================
  const whyGame = (function () {
    const DAILY_ACTIVITY_EXPLANATIONS = [
      "You were pretending to text someone so you wouldn't have to greet a coworker in the hallway.",
      "You were attempting to open a bag of chips at 1 AM without making a single decibel of noise.",
      "You suddenly realized you were waving back at someone who was actually waving at the person behind you.",
      "You were frantically searching for your phone while actively using your phone's flashlight to look for it.",
      "You tried to unplug a charger from across the room using only your big toe.",
      "You stepped on an imaginary extra step at the bottom of the staircase.",
      "You were smelling your shirt collar to verify if this morning's deodorant was still holding on.",
      "You were trying to scratch an itch in the dead center of your back against a doorframe like a grizzly bear.",
      "You reached for a glass of water, missed completely, and tried to turn it into a cool casual stretch.",
      "You were doing the silent victory wiggle after tossing a crumpled paper into the bin from 6 feet away.",
      "You checked your wrist for the time, forgot what the watch said, and immediately had to check again.",
      "You were trying to dodge an imaginary bee that was actually just a piece of dust in your eyelashes.",
      "You rehearsed a fake argument in the shower and had to deliver the imaginary mic-drop punchline.",
      "You walked into the kitchen with deep purpose, stood in front of the open fridge, and completely forgot why you existed.",
      "You were attempting to balance the hallway light switch exactly between the ON and OFF positions.",
      "You felt a phantom vibration in your thigh, but your phone was sitting on the kitchen counter.",
      "You were trying to push a door that clearly had a giant 'PULL' sign bolted onto it.",
      "You threw yourself sideways to catch a falling pen, failed, and knocked over three other things in the process.",
      "You were sneaking toward the snack cupboard pretending you were a covert operative on a classified mission.",
      "You caught your own reflection in a dark store window and instinctively apologized for bumping into yourself.",
      "You were trying to put on pants while hopping on one leg and refusing to accept defeat.",
      "You heard someone say 'free samples' from 40 meters away and your kinetic sensors locked on.",
      "You felt a single stray hair on your neck and fought for your life against an invisible creature.",
      "You were testing whether you could still kick above waist height without tearing a hamstring.",
      "You were attempting to peel a sticker off a piece of fruit and accidentally launched it across the room."
    ];

    const LIVE_SUSPICIONS = [
      "Testing if morning deodorant is still holding on...",
      "Opening chips bag at 1 AM in stealth mode...",
      "Stepping on imaginary extra step on staircase...",
      "Pretending to text someone to avoid eye contact...",
      "Searching for phone using phone's own flashlight...",
      "Balancing hallway light switch between ON and OFF...",
      "Waving back at someone waving at the person behind you...",
      "Walking into kitchen and forgetting why you exist...",
      "Dodging an imaginary bee that is actually dust...",
      "Trying to unplug charger using only your big toe..."
    ];

    let playerName = 'HUMAN #404';
    let isObserving = false;
    let accumulatedMotion = 0;
    let currentHypoIndex = 0;
    let lastHypoChangeTime = 0;

    const setupPhase = document.getElementById('why-setup-phase');
    const observingPhase = document.getElementById('why-observing-phase');
    const resultPhase = document.getElementById('why-result-phase');
    const playerInput = document.getElementById('whyPlayerName');
    const startBtn = document.getElementById('whyStartBtn');
    const blockMeter = document.getElementById('whyBlockMeter');
    const meterPercent = document.getElementById('whyMeterPercentage');
    const detectedTag = document.getElementById('whyMovementDetectedTag');
    const hypothesisText = document.getElementById('whyHypothesisText');
    const stage1 = document.getElementById('whyStage1');
    const stage2 = document.getElementById('whyStage2');
    const stage3 = document.getElementById('whyStage3');
    const awkwardVal = document.getElementById('whyAwkwardVal');
    const routineVal = document.getElementById('whyRoutineVal');
    const resultPlayer = document.getElementById('whyResultPlayer');
    const explanationText = document.getElementById('whyExplanationText');
    const confidenceVal = document.getElementById('whyConfidenceVal');
    const playAgainBtn = document.getElementById('whyPlayAgainBtn');

    function init() {
      isObserving = false;
      accumulatedMotion = 0;
      if (setupPhase) setupPhase.style.display = 'flex';
      if (observingPhase) observingPhase.style.display = 'none';
      if (resultPhase) resultPhase.style.display = 'none';
      if (playerInput) playerInput.value = playerName;

      if (stage1) stage1.className = 'stage-pill active';
      if (stage2) stage2.className = 'stage-pill';
      if (stage3) stage3.className = 'stage-pill';

      serialManager.sendCommand("GAME1");
    }

    function startObserving() {
      playerName = (playerInput && playerInput.value.trim()) || 'HUMAN #404';
      if (setupPhase) setupPhase.style.display = 'none';
      if (observingPhase) observingPhase.style.display = 'flex';
      if (resultPhase) resultPhase.style.display = 'none';

      isObserving = true;
      accumulatedMotion = 0;
      audio.coin();

      // Trigger ESP32 hardware countdown with OLED bitmap & start fanfare
      serialManager.sendCommand("GAME1");
      setTimeout(() => serialManager.sendCommand("START"), 150);
    }

    function onMotion(intensity) {
      if (!isObserving) return;

      // Slower, measured progress requiring ~10-14 seconds of sustained physical MPU shaking
      if (intensity > 10) {
        accumulatedMotion += (intensity / 100) * 0.92;
        audio.shakeRumble();
      }

      const progress = Math.min(100, Math.round(accumulatedMotion));

      if (meterPercent) meterPercent.textContent = `${progress}%`;
      if (blockMeter) {
        const blocks = Math.round((progress / 100) * 20);
        blockMeter.textContent = '█'.repeat(blocks) + '░'.repeat(20 - blocks);
      }

      // Cycle live suspicion ticker every 1.8 seconds when active
      const now = performance.now();
      if (now - lastHypoChangeTime > 1800 && progress > 5 && progress < 98) {
        lastHypoChangeTime = now;
        currentHypoIndex = (currentHypoIndex + 1) % LIVE_SUSPICIONS.length;
        if (hypothesisText) {
          hypothesisText.textContent = `"${LIVE_SUSPICIONS[currentHypoIndex]}"`;
        }
      }

      // Stage Progression: Stage 1 (0-33%), Stage 2 (34-66%), Stage 3 (67-100%)
      if (progress < 34) {
        if (stage1) stage1.className = 'stage-pill active';
        if (stage2) stage2.className = 'stage-pill';
        if (stage3) stage3.className = 'stage-pill';
        if (awkwardVal) awkwardVal.textContent = 'DETECTING TWITCHES';
        if (routineVal) routineVal.textContent = 'INITIALIZING...';
        if (detectedTag) detectedTag.textContent = 'STAGE 1: RECORDING BIOMETRIC EMBARRASSMENT...';
      } else if (progress < 67) {
        if (stage1) stage1.className = 'stage-pill completed';
        if (stage2) stage2.className = 'stage-pill active';
        if (stage3) stage3.className = 'stage-pill';
        if (awkwardVal) awkwardVal.textContent = 'POSTURE: HIGHLY SUSPICIOUS';
        if (routineVal) routineVal.textContent = 'MATCHING DAILY HABITS (64%)';
        if (detectedTag) detectedTag.textContent = 'STAGE 2: ISOLATING CLUMSY DOMESTIC PATTERNS...';
      } else {
        if (stage1) stage1.className = 'stage-pill completed';
        if (stage2) stage2.className = 'stage-pill completed';
        if (stage3) stage3.className = 'stage-pill active';
        if (awkwardVal) awkwardVal.textContent = 'MAXIMUM WEIRDNESS CONFIRMED';
        if (routineVal) routineVal.textContent = 'EXPLANATION SYNTHESIZING...';
        if (detectedTag) detectedTag.textContent = 'STAGE 3: FINAL BURST! DON\'T STOP SHAKING!';
      }

      if (progress >= 100) {
        conclude();
      }
    }
    sensorManager.onMovement(onMotion);

    function conclude() {
      if (!isObserving) return;
      isObserving = false;

      // Stop ESP32 hardware (buzzer plays victory fanfare, OLED displays trophy)
      serialManager.sendCommand("STOP");
      audio.victory();

      const randExplanation = DAILY_ACTIVITY_EXPLANATIONS[Math.floor(Math.random() * DAILY_ACTIVITY_EXPLANATIONS.length)];
      const randConf = (96.0 + Math.random() * 3.9).toFixed(1);

      if (resultPlayer) resultPlayer.textContent = playerName.toUpperCase();
      if (explanationText) explanationText.textContent = `"${randExplanation}"`;
      if (confidenceVal) confidenceVal.textContent = `${randConf}%`;

      if (observingPhase) observingPhase.style.display = 'none';
      if (resultPhase) resultPhase.style.display = 'flex';
    }

    if (startBtn) startBtn.addEventListener('click', startObserving);
    if (playAgainBtn) playAgainBtn.addEventListener('click', init);

    return { init };
  })();


  // =========================================================================
  // 8. REAL GAME 2: SHAKE THE CAR (1000 METERS EXTENDED RACE)
  // =========================================================================
  const carGame = (function () {
    const FINISH_QUOTES = [
      "Technically you won.",
      "NASA has requested your shaking technique.",
      "That was unnecessarily aggressive.",
      "Your car has filed a formal complaint.",
      "Speed limit officially disrespected.",
      "The car engine survived purely out of fear."
    ];

    let isRacing = false;
    let currentDistance = 0; // 0 to 1000 meters
    let timeLeft = 45.0;     // Extended to 45 seconds
    let shakeCount = 0;
    let speedMph = 0;
    let raceInterval = null;
    let startTime = 0;

    let m250Reached = false;
    let m500Reached = false;
    let m750Reached = false;

    const timerVal = document.getElementById('carTimerVal');
    const distanceVal = document.getElementById('carDistanceVal');
    const speedVal = document.getElementById('carSpeedVal');
    const shakeCountVal = document.getElementById('carShakeCountVal');
    const milestoneMsg = document.getElementById('carMilestoneMsg');
    const distanceFill = document.getElementById('carDistanceFill');
    const playerCar = document.getElementById('playerCar');
    const startOverlay = document.getElementById('carStartOverlay');
    const startRaceBtn = document.getElementById('carStartRaceBtn');
    const resultOverlay = document.getElementById('carResultOverlay');
    const resultTitle = document.getElementById('carResultTitle');
    const finalTime = document.getElementById('carFinalTime');
    const finalShakes = document.getElementById('carFinalShakes');
    const performanceQuote = document.getElementById('carPerformanceQuote');
    const playAgainBtn = document.getElementById('carPlayAgainBtn');

    function init() {
      stop();
      currentDistance = 0;
      timeLeft = 45.0;
      shakeCount = 0;
      speedMph = 0;
      m250Reached = false;
      m500Reached = false;
      m750Reached = false;

      if (playerCar) {
        playerCar.style.left = '10px';
        playerCar.classList.remove('driving');
      }
      if (timerVal) timerVal.textContent = '45.0s';
      if (distanceVal) distanceVal.textContent = '0 / 1000m';
      if (speedVal) speedVal.textContent = '0 MPH';
      if (shakeCountVal) shakeCountVal.textContent = '0';
      if (distanceFill) distanceFill.style.width = '0%';
      if (milestoneMsg) {
        milestoneMsg.textContent = 'RACE LENGTH: 1000 METERS // SHAKE CONTINUOUSLY TO SUSTAIN SPEED!';
        milestoneMsg.classList.remove('highlight');
      }

      if (startOverlay) startOverlay.style.display = 'flex';
      if (resultOverlay) resultOverlay.style.display = 'none';
      serialManager.sendCommand("GAME2");
    }

    function startRace() {
      if (startOverlay) startOverlay.style.display = 'none';
      if (resultOverlay) resultOverlay.style.display = 'none';
      isRacing = true;
      currentDistance = 0;
      timeLeft = 45.0;
      shakeCount = 0;
      speedMph = 0;
      m250Reached = false;
      m500Reached = false;
      m750Reached = false;
      startTime = performance.now();
      audio.countdownBeep(true);

      if (playerCar) playerCar.classList.add('driving');

      // Command ESP32 hardware to countdown with OLED car bitmap & start fanfare
      serialManager.sendCommand("GAME2");
      setTimeout(() => serialManager.sendCommand("START"), 150);

      raceInterval = setInterval(() => {
        timeLeft -= 0.1;
        if (timeLeft <= 0) {
          timeLeft = 0;
          gameOver(false);
        }
        if (timerVal) timerVal.textContent = `${timeLeft.toFixed(1)}s`;

        // Rolling friction continually slows the car down if player stops shaking
        speedMph = Math.max(0, speedMph * 0.965);
        if (speedVal) speedVal.textContent = `${Math.round(speedMph)} MPH`;

        // Advance distance based on current speed
        currentDistance += (speedMph * 0.14);
        if (currentDistance > 1000) currentDistance = 1000;

        const progressPct = (currentDistance / 1000);
        if (distanceVal) distanceVal.textContent = `${Math.round(currentDistance)} / 1000m`;
        if (distanceFill) distanceFill.style.width = `${progressPct * 100}%`;
        if (playerCar) playerCar.style.left = `calc(${progressPct * 84}% + 10px)`;

        // Milestone checkpoints
        if (currentDistance >= 250 && !m250Reached) {
          m250Reached = true;
          announceMilestone("250m CROSSED! KEEP UP THE MOMENTUM!");
        }
        if (currentDistance >= 500 && !m500Reached) {
          m500Reached = true;
          announceMilestone("500m HALFWAY POINT! DON'T STOP SHAKING!");
        }
        if (currentDistance >= 750 && !m750Reached) {
          m750Reached = true;
          announceMilestone("750m FINAL SPRINT! MAXIMUM FLUID MOTION!");
        }

        // Finish Line Reached!
        if (currentDistance >= 1000) {
          gameOver(true);
        }
      }, 100);
    }

    function announceMilestone(msg) {
      if (!milestoneMsg) return;
      milestoneMsg.textContent = `⚡ ${msg}`;
      milestoneMsg.classList.add('highlight');
      audio.blip(880);
      setTimeout(() => {
        if (milestoneMsg) milestoneMsg.classList.remove('highlight');
      }, 1400);
    }

    function onMotion(intensity) {
      if (!isRacing) return;

      if (intensity > 12) {
        shakeCount++;
        if (shakeCountVal) shakeCountVal.textContent = shakeCount;
        // Acceleration directly boosted by physical MPU shake
        speedMph = Math.min(180, speedMph + (intensity / 100) * 11.5);
      }
    }
    sensorManager.onMovement(onMotion);

    function gameOver(won) {
      stop();
      serialManager.sendCommand("STOP");
      const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);

      if (won) {
        audio.victory();
        if (resultTitle) resultTitle.textContent = '1000m FINISH!!!';
        if (finalTime) finalTime.textContent = `${elapsed} seconds`;
        if (finalShakes) finalShakes.textContent = shakeCount;
        if (performanceQuote) {
          performanceQuote.textContent = `"${FINISH_QUOTES[Math.floor(Math.random() * FINISH_QUOTES.length)]}"`;
        }
      } else {
        audio.buzzer();
        if (resultTitle) resultTitle.textContent = 'THE CAR HAS GIVEN UP.';
        if (finalTime) finalTime.textContent = '45.0s (TIMEOUT)';
        if (finalShakes) finalShakes.textContent = shakeCount;
        if (performanceQuote) {
          performanceQuote.textContent = '"You ran out of kinetic stamina before reaching the 1000m mark."';
        }
      }

      if (resultOverlay) resultOverlay.style.display = 'flex';
    }

    function stop() {
      isRacing = false;
      clearInterval(raceInterval);
      if (playerCar) playerCar.classList.remove('driving');
    }

    if (startRaceBtn) startRaceBtn.addEventListener('click', startRace);
    if (playAgainBtn) playAgainBtn.addEventListener('click', init);

    return { init, stop };
  })();


  // =========================================================================
  // 9. REAL GAME 3: SHAKE BATTLE (10s MPU COMBATIVE SHOWDOWN)
  // =========================================================================
  const battleGame = (function () {
    let playerName = 'WARRIOR_01';
    let isBattling = false;
    let timeLeft = 10;
    let score = 0;
    let battleInterval = null;

    const setupPhase = document.getElementById('battle-setup-phase');
    const countdownPhase = document.getElementById('battle-countdown-phase');
    const activePhase = document.getElementById('battle-active-phase');
    const resultPhase = document.getElementById('battle-result-phase');
    const playerNameInput = document.getElementById('battlePlayerName');
    const readyBtn = document.getElementById('battleReadyBtn');
    const countdownNum = document.getElementById('battleCountdownNumber');
    const activePlayer = document.getElementById('battleActivePlayerName');
    const timerDisplay = document.getElementById('battleTimeLeft');
    const scoreDisplay = document.getElementById('battleCurrentScore');
    const fighter = document.getElementById('battleFighter');
    const powerFill = document.getElementById('battlePowerFill');
    const powerPercent = document.getElementById('battlePowerPercent');
    const resultPlayer = document.getElementById('battleResultPlayer');
    const finalScore = document.getElementById('battleFinalScore');
    const rankTitle = document.getElementById('battleRankTitle');
    const playAgainBtn = document.getElementById('battlePlayAgainBtn');
    const viewLeaderboardBtn = document.getElementById('battleViewLeaderboardBtn');

    function init() {
      stop();
      score = 0;
      timeLeft = 10;
      if (setupPhase) setupPhase.style.display = 'flex';
      if (countdownPhase) countdownPhase.style.display = 'none';
      if (activePhase) activePhase.style.display = 'none';
      if (resultPhase) resultPhase.style.display = 'none';
      if (playerNameInput) playerNameInput.value = playerName;
      serialManager.sendCommand("GAME3");
    }

    function startCountdown() {
      playerName = (playerNameInput && playerNameInput.value.trim()) || 'WARRIOR_01';
      if (setupPhase) setupPhase.style.display = 'none';
      if (countdownPhase) countdownPhase.style.display = 'flex';

      // Synchronize ESP32 countdown
      serialManager.sendCommand("GAME3");
      setTimeout(() => serialManager.sendCommand("START"), 100);

      let count = 3;
      if (countdownNum) countdownNum.textContent = '3';
      audio.countdownBeep(false);

      const countTimer = setInterval(() => {
        count--;
        if (count > 0) {
          if (countdownNum) countdownNum.textContent = count;
          audio.countdownBeep(false);
        } else if (count === 0) {
          if (countdownNum) countdownNum.textContent = 'SHAKE!!!';
          audio.countdownBeep(true);
        } else {
          clearInterval(countTimer);
          startActiveBattle();
        }
      }, 750);
    }

    function startActiveBattle() {
      if (countdownPhase) countdownPhase.style.display = 'none';
      if (activePhase) activePhase.style.display = 'flex';
      if (activePlayer) activePlayer.textContent = playerName.toUpperCase();

      isBattling = true;
      score = 0;
      timeLeft = 10;
      if (timerDisplay) timerDisplay.textContent = '10s';
      if (scoreDisplay) scoreDisplay.textContent = '0';

      battleInterval = setInterval(() => {
        timeLeft--;
        if (timerDisplay) timerDisplay.textContent = `${timeLeft}s`;
        audio.blip(280 + timeLeft * 30);

        if (timeLeft <= 0) {
          endBattle();
        }
      }, 1000);
    }

    function onMotion(intensity) {
      if (!isBattling) return;

      // Accumulate score based directly on MPU6050 shake power
      if (intensity > 10) {
        score += Math.round(intensity * 0.45);
        if (scoreDisplay) scoreDisplay.textContent = score;
      }

      if (powerFill) powerFill.style.width = `${Math.round(intensity)}%`;
      if (powerPercent) powerPercent.textContent = `${Math.round(intensity)}%`;

      // Visual character reaction
      if (fighter) {
        fighter.classList.remove('shaking-mild', 'shaking-wild');
        if (intensity > 55) {
          fighter.classList.add('shaking-wild');
        } else if (intensity > 18) {
          fighter.classList.add('shaking-mild');
        }
      }
    }
    sensorManager.onMovement(onMotion);

    function getPerformanceTitle(s) {
      if (s <= 200) return 'YOU BARELY MOVED.';
      if (s <= 400) return 'CASUAL SHAKER.';
      if (s <= 600) return 'SUSPICIOUSLY ENERGETIC.';
      if (s <= 800) return 'PROFESSIONAL SHAKER.';
      if (s <= 1000) return 'ABSOLUTE MENACE.';
      return 'PLEASE PUT THE SENSOR DOWN.';
    }

    function endBattle() {
      stop();
      serialManager.sendCommand("STOP");
      audio.victory();

      const title = getPerformanceTitle(score);

      if (resultPlayer) resultPlayer.textContent = playerName.toUpperCase();
      if (finalScore) finalScore.textContent = score;
      if (rankTitle) rankTitle.textContent = `"${title}"`;

      // Save to Leaderboard
      leaderboardService.addEntry(playerName, score, title);

      if (activePhase) activePhase.style.display = 'none';
      if (resultPhase) resultPhase.style.display = 'flex';
    }

    function stop() {
      isBattling = false;
      clearInterval(battleInterval);
      if (fighter) fighter.classList.remove('shaking-mild', 'shaking-wild');
    }

    if (readyBtn) readyBtn.addEventListener('click', startCountdown);
    if (playAgainBtn) playAgainBtn.addEventListener('click', init);
    if (viewLeaderboardBtn) {
      viewLeaderboardBtn.addEventListener('click', () => {
        leaderboardService.renderLeaderboard();
        screenManager.showScreen('screen-leaderboard');
      });
    }

    return { init, stop };
  })();


  // =========================================================================
  // 10. GAME CARD SELECTION DISPATCHER
  // =========================================================================
  document.querySelectorAll('.game-card').forEach((card) => {
    card.addEventListener('click', () => {
      const playable = card.dataset.game;
      const fake = card.dataset.fake;

      if (playable === 'why') {
        whyGame.init();
        screenManager.showScreen('screen-game-why');
      } else if (playable === 'car') {
        carGame.init();
        screenManager.showScreen('screen-game-car');
      } else if (playable === 'battle') {
        battleGame.init();
        screenManager.showScreen('screen-game-battle');
      } else if (fake) {
        openFakeGame(fake);
      }
    });
  });


  // =========================================================================
  // 11. HARDWARE DIAGNOSTIC LAB (MPU 3D GIMBAL + REAL ORIENTATION)
  // =========================================================================
  const labCanvas = document.getElementById('sensorCanvas');
  const labCtx = labCanvas ? labCanvas.getContext('2d') : null;

  if (labCanvas && labCtx) {
    let baseAngleX = 0, baseAngleY = 0, baseAngleZ = 0;
    let isScanningMode = false;

    function resizeLabCanvas() {
      const rect = labCanvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      labCanvas.width = rect.width * dpr;
      labCanvas.height = rect.height * dpr;
    }
    window.addEventListener('resize', resizeLabCanvas);
    setTimeout(resizeLabCanvas, 100);

    function drawGimbalRing(cx, cy, radius, rotX, rotY, rotZ, color, lineDash = [], ticks = 12) {
      labCtx.save();
      labCtx.translate(cx, cy);
      labCtx.strokeStyle = color;
      labCtx.lineWidth = 1.5;
      labCtx.setLineDash(lineDash);

      const scaleY = Math.cos(rotX);
      const scaleX = Math.cos(rotY);

      labCtx.save();
      labCtx.rotate(rotZ);
      labCtx.scale(scaleX || 0.1, scaleY || 0.1);

      labCtx.beginPath();
      labCtx.arc(0, 0, radius, 0, Math.PI * 2);
      labCtx.stroke();

      if (ticks > 0) {
        labCtx.fillStyle = color;
        for (let i = 0; i < ticks; i++) {
          const theta = (i / ticks) * Math.PI * 2;
          labCtx.fillRect(Math.cos(theta) * radius - 1.5, Math.sin(theta) * radius - 1.5, 3, 3);
        }
      }
      labCtx.restore();
      labCtx.restore();
    }

    function renderLab() {
      const w = labCanvas.width;
      const h = labCanvas.height;
      if (w === 0 || h === 0) {
        requestAnimationFrame(renderLab);
        return;
      }

      const cx = w / 2;
      const cy = h / 2;
      const r = Math.min(cx, cy) * 0.72;

      labCtx.clearRect(0, 0, w, h);

      // Read live vectors from physical MPU6050
      const raw = sensorManager.getRawVectors();
      // Physical tilt angles derived from accelerometer vectors:
      const physPitch = Math.atan2(raw.ay, Math.sqrt(raw.ax * raw.ax + raw.az * raw.az));
      const physRoll  = Math.atan2(-raw.ax, raw.az);

      baseAngleX = physPitch + 0.2;
      baseAngleY = physRoll;
      baseAngleZ += (raw.gz * 0.008) + 0.01;

      // Outer Ring (Yaw)
      drawGimbalRing(cx, cy, r * 0.95, baseAngleX, baseAngleY * 0.5, baseAngleZ, isScanningMode ? '#ffb703' : 'rgba(0, 240, 255, 0.8)', [], 16);
      // Middle Ring (Pitch)
      drawGimbalRing(cx, cy, r * 0.7, baseAngleX * 1.3, baseAngleY, -baseAngleZ * 0.7, '#00ff77', [4, 4], 8);
      // Inner Ring (Roll)
      drawGimbalRing(cx, cy, r * 0.45, -baseAngleX * 0.8, baseAngleY * 1.5, baseAngleZ * 1.4, '#ffffff', [], 6);

      requestAnimationFrame(renderLab);
    }
    resizeLabCanvas();
    renderLab();

    // Lab Sequence Handler
    const initializeBtn = document.getElementById('initializeHumanBtn');
    const resetBtn = document.getElementById('resetSequenceBtn');
    const terminalLog = document.getElementById('terminalLog');
    const terminalStatusIndicator = document.getElementById('terminalStatusIndicator');
    const sysStatusVal = document.getElementById('systemStatusValue');
    const sensorStatusVal = document.getElementById('sensorStatusValue');
    const usefulnessVal = document.getElementById('usefulnessValue');
    const usefulnessBar = document.getElementById('usefulnessBar');

    const LAB_SEQUENCE = [
      'SCANNING HUMAN...',
      'ANALYSING PURPOSE...',
      'MEASURING QUESTIONABLE MOVEMENT...',
      'USELESSNESS DETECTED...',
      'READY.'
    ];
    let labRunning = false;

    if (initializeBtn) {
      initializeBtn.addEventListener('click', () => {
        if (labRunning) return;
        labRunning = true;
        isScanningMode = true;
        initializeBtn.textContent = 'INITIALIZING...';
        if (terminalStatusIndicator) terminalStatusIndicator.textContent = 'PROCESSING';

        let idx = 0;
        function step() {
          if (idx < LAB_SEQUENCE.length) {
            const line = document.createElement('div');
            line.className = 'terminal-line active-log';
            line.textContent = `> ${LAB_SEQUENCE[idx]}`;
            if (terminalLog) terminalLog.appendChild(line);
            audio.blip(500 + idx * 80);
            idx++;
            setTimeout(step, 800);
          } else {
            isScanningMode = false;
            labRunning = false;
            if (sysStatusVal) sysStatusVal.textContent = 'READY';
            if (sensorStatusVal) sensorStatusVal.textContent = 'WAITING FOR HUMAN';
            if (usefulnessVal) usefulnessVal.textContent = '100%';
            if (usefulnessBar) usefulnessBar.style.width = '100%';
            if (terminalStatusIndicator) terminalStatusIndicator.textContent = 'READY';
            initializeBtn.textContent = 'HUMAN INITIALIZED';
            if (resetBtn) resetBtn.style.display = 'block';
            audio.victory();
          }
        }
        step();
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (sysStatusVal) sysStatusVal.textContent = 'ONLINE';
        if (sensorStatusVal) sensorStatusVal.textContent = 'STANDBY';
        if (usefulnessVal) usefulnessVal.textContent = '0%';
        if (usefulnessBar) usefulnessBar.style.width = '0%';
        if (initializeBtn) initializeBtn.textContent = 'INITIALIZE HUMAN';
        resetBtn.style.display = 'none';
        if (terminalLog) terminalLog.innerHTML = '<div class="terminal-line dim">> SYSTEM ARMED.</div>';
        audio.blip(400);
      });
    }
  }

  // Initial population of leaderboard on load
  leaderboardService.renderLeaderboard();

})();

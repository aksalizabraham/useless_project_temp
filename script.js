/**
 * WHY DID YOU MOVE LIKE THAT?
 * Retro Pixel Arcade Machine & Questionable Kinetic Research System
 * Complete Unified Engine
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
      shakeRumble: () => tone(120 + Math.random() * 80, 0.08, 'sawtooth', 0.06),
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

  // =========================================================================
  // 2. SENSOR MANAGER ABSTRACTION (Hardware Decoupled Architecture)
  // =========================================================================
  const sensorManager = (function () {
    let movementIntensity = 0; // 0 to 100
    let isSimulated = true;
    const listeners = [];

    function update() {
      // Decay intensity towards 0
      if (movementIntensity > 0.5) {
        movementIntensity *= 0.91;
      } else {
        movementIntensity = 0;
      }

      // Notify listeners
      for (let i = 0; i < listeners.length; i++) {
        listeners[i](movementIntensity);
      }

      // Update Top HUD Monitor
      const bar = document.getElementById('liveIntensityBar');
      const num = document.getElementById('liveIntensityNum');
      const led = document.getElementById('sensorLed');

      if (bar) bar.style.width = `${Math.round(movementIntensity)}%`;
      if (num) num.textContent = `${Math.round(movementIntensity)}%`;
      if (led) {
        if (movementIntensity > 15) {
          led.classList.add('active');
        } else {
          led.classList.remove('active');
        }
      }

      requestAnimationFrame(update);
    }
    requestAnimationFrame(update);

    function simulateShake(amount = 45) {
      movementIntensity = Math.min(100, movementIntensity + amount);
      audio.shakeRumble();
    }

    return {
      getMovementIntensity: () => movementIntensity,
      simulateShake,
      onMovement: (cb) => {
        if (typeof cb === 'function') listeners.push(cb);
      },
      setSimulated: (val) => { isSimulated = val; },
      isSimulated: () => isSimulated
    };
  })();

  // Connect manual shake button & spacebar
  const manualShakeBtn = document.getElementById('manualShakeBtn');
  if (manualShakeBtn) {
    manualShakeBtn.addEventListener('click', () => sensorManager.simulateShake(38));
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && e.target.tagName !== 'INPUT') {
      e.preventDefault();
      sensorManager.simulateShake(35);
    }
  });

  // Mouse movement on document adds subtle kinetic noise
  let lastMouseX = 0, lastMouseY = 0;
  window.addEventListener('mousemove', (e) => {
    const delta = Math.hypot(e.clientX - lastMouseX, e.clientY - lastMouseY);
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    if (delta > 25) {
      sensorManager.simulateShake(Math.min(12, delta * 0.15));
    }
  });

  // Cabinet Top Clock
  const cabinetTime = document.getElementById('cabinetTime');
  setInterval(() => {
    if (!cabinetTime) return;
    const d = new Date();
    cabinetTime.textContent = d.toTimeString().split(' ')[0];
  }, 500);


  // =========================================================================
  // 3. SCREEN NAVIGATION CONTROLLER
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

  // Global Navigation Links
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
    gotoLabBtn.addEventListener('click', () => screenManager.showScreen('screen-lab'));
  }

  document.querySelectorAll('.back-to-arcade-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      // Clean up any running games
      carGame.stop();
      battleGame.stop();
      screenManager.showScreen('screen-arcade');
    });
  });


  // =========================================================================
  // 4. LEADERBOARD SERVICE (LocalStorage CRUD)
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
  // 5. FAKE GAME POPUP & RANDOMIZED EXCUSES
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
  // 6. GAME SELECTOR DISPATCHER
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
  // 7. REAL GAME 1: WHY DID YOU MOVE LIKE THAT?
  // =========================================================================
  const whyGame = (function () {
    const RIDICULOUS_EXPLANATIONS = [
      "You moved because you remembered something embarrassing from 2019.",
      "You were attacked by an invisible mosquito.",
      "You suddenly remembered you left your charger somewhere.",
      "You heard someone say 'free food'.",
      "You were trying to escape responsibility.",
      "You received a software update.",
      "You simply felt like moving.",
      "Your skeleton attempted a quick escape.",
      "A phantom notification vibrated in your thigh.",
      "You realized you made eye contact with a stranger."
    ];

    let playerName = 'HUMAN #404';
    let isObserving = false;
    let accumulatedMotion = 0;
    let observeTimer = null;

    const setupPhase = document.getElementById('why-setup-phase');
    const observingPhase = document.getElementById('why-observing-phase');
    const resultPhase = document.getElementById('why-result-phase');
    const playerInput = document.getElementById('whyPlayerName');
    const startBtn = document.getElementById('whyStartBtn');
    const blockMeter = document.getElementById('whyBlockMeter');
    const meterPercent = document.getElementById('whyMeterPercentage');
    const detectedTag = document.getElementById('whyMovementDetectedTag');
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
    }

    function startObserving() {
      playerName = (playerInput && playerInput.value.trim()) || 'HUMAN #404';
      if (setupPhase) setupPhase.style.display = 'none';
      if (observingPhase) observingPhase.style.display = 'flex';
      if (resultPhase) resultPhase.style.display = 'none';

      isObserving = true;
      accumulatedMotion = 0;
      audio.coin();

      // Trigger automatic simulation pulse if player is inactive
      observeTimer = setTimeout(() => {
        if (isObserving && accumulatedMotion < 40) {
          sensorManager.simulateShake(60);
        }
      }, 1200);
    }

    function onMotion(intensity) {
      if (!isObserving) return;
      accumulatedMotion += intensity * 0.4;
      const progress = Math.min(100, Math.round(accumulatedMotion));

      if (meterPercent) meterPercent.textContent = `${progress}%`;
      if (blockMeter) {
        const blocks = Math.round((progress / 100) * 20);
        blockMeter.textContent = '█'.repeat(blocks) + '░'.repeat(20 - blocks);
      }

      if (progress > 35 && detectedTag) {
        detectedTag.textContent = 'MOVEMENT DETECTED! ANALYZING MOTIVE...';
        detectedTag.style.color = 'var(--pixel-pink)';
      }

      if (progress >= 100) {
        conclude();
      }
    }
    sensorManager.onMovement(onMotion);

    function conclude() {
      if (!isObserving) return;
      isObserving = false;
      clearTimeout(observeTimer);

      audio.victory();

      const randExplanation = RIDICULOUS_EXPLANATIONS[Math.floor(Math.random() * RIDICULOUS_EXPLANATIONS.length)];
      const randConf = (94.0 + Math.random() * 5.9).toFixed(1);

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
  // 8. REAL GAME 2: SHAKE THE CAR
  // =========================================================================
  const carGame = (function () {
    const FINISH_QUOTES = [
      "Technically you won.",
      "NASA has requested your shaking technique.",
      "That was unnecessarily aggressive.",
      "Your car has filed a complaint.",
      "Speed limit officially disrespected."
    ];

    let isRacing = false;
    let carPosition = 0; // 0 to 86 percent of track
    let timeLeft = 30.0;
    let shakeCount = 0;
    let speedMph = 0;
    let raceInterval = null;
    let startTime = 0;

    const timerVal = document.getElementById('carTimerVal');
    const shakeCountVal = document.getElementById('carShakeCountVal');
    const speedVal = document.getElementById('carSpeedVal');
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
      carPosition = 0;
      timeLeft = 30.0;
      shakeCount = 0;
      speedMph = 0;
      if (playerCar) {
        playerCar.style.left = '10px';
        playerCar.classList.remove('driving');
      }
      if (timerVal) timerVal.textContent = '30.0s';
      if (shakeCountVal) shakeCountVal.textContent = '0';
      if (speedVal) speedVal.textContent = '0 MPH';
      if (startOverlay) startOverlay.style.display = 'flex';
      if (resultOverlay) resultOverlay.style.display = 'none';
    }

    function startRace() {
      if (startOverlay) startOverlay.style.display = 'none';
      if (resultOverlay) resultOverlay.style.display = 'none';
      isRacing = true;
      carPosition = 0;
      timeLeft = 30.0;
      shakeCount = 0;
      startTime = performance.now();
      audio.countdownBeep(true);

      if (playerCar) playerCar.classList.add('driving');

      raceInterval = setInterval(() => {
        timeLeft -= 0.1;
        if (timeLeft <= 0) {
          timeLeft = 0;
          gameOver(false);
        }
        if (timerVal) timerVal.textContent = `${timeLeft.toFixed(1)}s`;
      }, 100);
    }

    function onMotion(intensity) {
      if (!isRacing) return;

      if (intensity > 15) {
        shakeCount++;
        if (shakeCountVal) shakeCountVal.textContent = shakeCount;
      }

      speedMph = Math.round(intensity * 1.8);
      if (speedVal) speedVal.textContent = `${speedMph} MPH`;

      // Advance car
      const delta = (intensity / 100) * 1.4;
      carPosition += delta;

      if (playerCar) {
        playerCar.style.left = `calc(${Math.min(84, carPosition)}% + 10px)`;
      }

      // Check finish line!
      if (carPosition >= 84) {
        gameOver(true);
      }
    }
    sensorManager.onMovement(onMotion);

    function gameOver(won) {
      stop();
      const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);

      if (won) {
        audio.victory();
        if (resultTitle) resultTitle.textContent = 'FINISH!!!';
        if (finalTime) finalTime.textContent = `${elapsed} seconds`;
        if (finalShakes) finalShakes.textContent = shakeCount;
        if (performanceQuote) {
          performanceQuote.textContent = `"${FINISH_QUOTES[Math.floor(Math.random() * FINISH_QUOTES.length)]}"`;
        }
      } else {
        audio.buzzer();
        if (resultTitle) resultTitle.textContent = 'THE CAR HAS GIVEN UP.';
        if (finalTime) finalTime.textContent = '30.0s (TIMEOUT)';
        if (finalShakes) finalShakes.textContent = shakeCount;
        if (performanceQuote) {
          performanceQuote.textContent = '"The engine refused to cooperate with such questionable mechanics."';
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
  // 9. REAL GAME 3: SHAKE BATTLE
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
    }

    function startCountdown() {
      playerName = (playerNameInput && playerNameInput.value.trim()) || 'WARRIOR_01';
      if (setupPhase) setupPhase.style.display = 'none';
      if (countdownPhase) countdownPhase.style.display = 'flex';

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
      }, 850);
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

      // Accumulate score
      score += Math.round(intensity * 0.45);
      if (scoreDisplay) scoreDisplay.textContent = score;

      if (powerFill) powerFill.style.width = `${Math.round(intensity)}%`;
      if (powerPercent) powerPercent.textContent = `${Math.round(intensity)}%`;

      // Visual character reaction
      if (fighter) {
        fighter.classList.remove('shaking-mild', 'shaking-wild');
        if (intensity > 60) {
          fighter.classList.add('shaking-wild');
        } else if (intensity > 20) {
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
  // 10. PRESERVED HARDWARE DIAGNOSTIC LAB SUBSYSTEM (Milestone 1 Canvas & Logic)
  // =========================================================================
  const labCanvas = document.getElementById('sensorCanvas');
  const labCtx = labCanvas ? labCanvas.getContext('2d') : null;

  if (labCanvas && labCtx) {
    let angleX = 0, angleY = 0, angleZ = 0;
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

      const mult = isScanningMode ? 2.5 : 1;
      angleX += 0.012 * mult;
      angleY += 0.01 * mult;
      angleZ += 0.015 * mult;

      // Outer Ring
      drawGimbalRing(cx, cy, r * 0.95, angleX, angleY * 0.5, angleZ, isScanningMode ? '#ffb703' : 'rgba(0, 240, 255, 0.8)', [], 16);
      // Middle Ring
      drawGimbalRing(cx, cy, r * 0.7, angleX * 1.3, angleY, -angleZ * 0.7, '#00ff77', [4, 4], 8);
      // Inner Ring
      drawGimbalRing(cx, cy, r * 0.45, -angleX * 0.8, angleY * 1.5, angleZ * 1.4, '#ffffff', [], 6);

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
    const sysStatusDot = document.getElementById('systemStatusDot');
    const sensorStatusVal = document.getElementById('sensorStatusValue');
    const sensorStatusDot = document.getElementById('sensorStatusDot');
    const sensorSubtext = document.getElementById('sensorSubtext');
    const usefulnessVal = document.getElementById('usefulnessValue');
    const usefulnessBar = document.getElementById('usefulnessBar');
    const usefulnessPill = document.getElementById('usefulnessPill');

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

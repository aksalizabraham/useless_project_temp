#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <math.h>

// =====================================================
// PIN CONFIGURATION
// =====================================================
#define SDA_PIN 21
#define SCL_PIN 22
#define BUZZER_PIN 25

// =====================================================
// I2C ADDRESSES
// =====================================================
#define DEFAULT_MPU_ADDR 0x69
#define ALT_MPU_ADDR     0x68
#define OLED_ADDR        0x3C

byte activeMpuAddr = DEFAULT_MPU_ADDR;

// =====================================================
// MPU6050 REGISTERS
// =====================================================
#define PWR_MGMT_1   0x6B
#define ACCEL_CONFIG 0x1C
#define GYRO_CONFIG  0x1B
#define ACCEL_XOUT_H 0x3B
#define GYRO_XOUT_H  0x43

// =====================================================
// OLED DISPLAY SETUP (128x64)
// =====================================================
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

// =====================================================
// GAME STATE & TELEMETRY
// =====================================================
String currentGame = "NONE";
bool gameRunning = false;
bool continuousStream = false; // When true, streams telemetry for HUD & 3D Lab
unsigned long lastSensorTime = 0;

// =====================================================
// MPU REGISTER FUNCTIONS
// =====================================================
void writeMPU(byte reg, byte value) {
  Wire.beginTransmission(activeMpuAddr);
  Wire.write(reg);
  Wire.write(value);
  Wire.endTransmission();
}

int16_t readMPU16() {
  byte highByte = Wire.read();
  byte lowByte = Wire.read();
  return (int16_t)((highByte << 8) | lowByte);
}

// =====================================================
// INITIALIZE MPU (Auto-detects 0x69 or 0x68)
// =====================================================
bool checkMPUAtAddress(byte addr) {
  Wire.beginTransmission(addr);
  Wire.write(0x75); // WHO_AM_I register
  if (Wire.endTransmission(false) != 0) return false;
  Wire.requestFrom((int)addr, 1);
  if (Wire.available()) {
    byte who = Wire.read();
    Serial.print("WHO_AM_I at 0x");
    Serial.print(addr, HEX);
    Serial.print(" = 0x");
    Serial.println(who, HEX);
    return true;
  }
  return false;
}

bool initializeMPU() {
  // Test default 0x69 first, fallback to 0x68 if needed
  if (checkMPUAtAddress(DEFAULT_MPU_ADDR)) {
    activeMpuAddr = DEFAULT_MPU_ADDR;
  } else if (checkMPUAtAddress(ALT_MPU_ADDR)) {
    activeMpuAddr = ALT_MPU_ADDR;
    Serial.println("MPU found on alternate address 0x68");
  } else {
    activeMpuAddr = DEFAULT_MPU_ADDR; // Default fallback
  }

  // Wake up MPU
  writeMPU(PWR_MGMT_1, 0x00);
  delay(100);

  // Accelerometer ±2g
  writeMPU(ACCEL_CONFIG, 0x00);

  // Gyroscope ±250 deg/sec
  writeMPU(GYRO_CONFIG, 0x00);
  delay(100);

  return checkMPUAtAddress(activeMpuAddr);
}

// =====================================================
// READ MPU DATA
// =====================================================
void readSensor(float &ax, float &ay, float &az, float &gx, float &gy, float &gz) {
  // Read Accelerometer
  Wire.beginTransmission(activeMpuAddr);
  Wire.write(ACCEL_XOUT_H);
  Wire.endTransmission(false);
  Wire.requestFrom((int)activeMpuAddr, 6);

  int16_t rawAx = readMPU16();
  int16_t rawAy = readMPU16();
  int16_t rawAz = readMPU16();

  ax = rawAx / 16384.0;
  ay = rawAy / 16384.0;
  az = rawAz / 16384.0;

  // Read Gyroscope
  Wire.beginTransmission(activeMpuAddr);
  Wire.write(GYRO_XOUT_H);
  Wire.endTransmission(false);
  Wire.requestFrom((int)activeMpuAddr, 6);

  int16_t rawGx = readMPU16();
  int16_t rawGy = readMPU16();
  int16_t rawGz = readMPU16();

  gx = rawGx / 131.0;
  gy = rawGy / 131.0;
  gz = rawGz / 131.0;
}

// =====================================================
// OLED DISPLAY FUNCTION
// =====================================================
void showOLED(String line1, String line2 = "", String line3 = "", String line4 = "") {
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(0, 0);

  display.println(line1);
  if (line2 != "") {
    display.println();
    display.println(line2);
  }
  if (line3 != "") {
    display.println();
    display.println(line3);
  }
  if (line4 != "") {
    display.println();
    display.println(line4);
  }
  display.display();
}

// =====================================================
// BUZZER FEEDBACK
// =====================================================
void beep(int duration) {
  digitalWrite(BUZZER_PIN, HIGH);
  delay(duration);
  digitalWrite(BUZZER_PIN, LOW);
}

// =====================================================
// COUNTDOWN SEQUENCE
// =====================================================
void startCountdown() {
  gameRunning = false;

  showOLED("GET READY", "3", currentGame);
  beep(100);
  delay(600);

  showOLED("GET READY", "2", currentGame);
  beep(100);
  delay(600);

  showOLED("GET READY", "1", currentGame);
  beep(100);
  delay(600);

  showOLED("GO!", "SHAKE SENSOR!", currentGame);
  beep(400);

  Serial.println("STARTED");
  gameRunning = true;
  lastSensorTime = millis();
}

// =====================================================
// STOP GAME
// =====================================================
void stopGame() {
  gameRunning = false;

  beep(150);
  delay(80);
  beep(150);

  showOLED("GAME COMPLETE", "", "NICE SHAKING!");
  Serial.println("STOPPED");
}

// =====================================================
// SELECT GAME
// =====================================================
void selectGame(String game) {
  currentGame = game;

  if (game == "GAME1") {
    showOLED("GAME 1", "WHY DID YOU", "MOVE LIKE THAT?", "READY TO SHAKE");
    Serial.println("GAME1_READY");
  } else if (game == "GAME2") {
    showOLED("GAME 2", "SHAKE THE CAR", "", "SHAKE TO DRIVE!");
    Serial.println("GAME2_READY");
  } else if (game == "GAME3") {
    showOLED("GAME 3", "SHAKE BATTLE", "", "DESTROY THEM!");
    Serial.println("GAME3_READY");
  }
}

// =====================================================
// SEND SENSOR DATA (CSV via Serial at 50Hz)
// FORMAT: DATA,ax,ay,az,gx,gy,gz,accelMag,gyroMag
// =====================================================
void sendSensorData() {
  float ax, ay, az, gx, gy, gz;
  readSensor(ax, ay, az, gx, gy, gz);

  float accelerationMagnitude = sqrt(ax * ax + ay * ay + az * az);
  float rotationMagnitude     = sqrt(gx * gx + gy * gy + gz * gz);

  Serial.print("DATA,");
  Serial.print(ax, 3); Serial.print(",");
  Serial.print(ay, 3); Serial.print(",");
  Serial.print(az, 3); Serial.print(",");
  Serial.print(gx, 3); Serial.print(",");
  Serial.print(gy, 3); Serial.print(",");
  Serial.print(gz, 3); Serial.print(",");
  Serial.print(accelerationMagnitude, 3); Serial.print(",");
  Serial.println(rotationMagnitude, 3);
}

// =====================================================
// HANDLE INCOMING COMMANDS FROM WEB SERIAL
// =====================================================
void handleCommand(String command) {
  command.trim();

  // Handshake Ping
  if (command == "PING") {
    Serial.println("PONG");
    showOLED("WEB CONNECTED", "", "ESP32 ONLINE", "READY FOR GAME");
    beep(80);
    return;
  }

  // Stream controls for live UI preview
  if (command == "STREAM_ON") {
    continuousStream = true;
    Serial.println("STREAM_ON_OK");
    return;
  }
  if (command == "STREAM_OFF") {
    continuousStream = false;
    Serial.println("STREAM_OFF_OK");
    return;
  }

  // Game selections
  if (command == "GAME1") { selectGame("GAME1"); return; }
  if (command == "GAME2") { selectGame("GAME2"); return; }
  if (command == "GAME3") { selectGame("GAME3"); return; }

  // Game actions
  if (command == "START") {
    if (currentGame == "NONE") {
      // Default to GAME1 if none selected
      currentGame = "GAME1";
    }
    startCountdown();
    return;
  }

  if (command == "STOP") {
    stopGame();
    return;
  }

  if (command == "RESET") {
    gameRunning = false;
    continuousStream = false;
    currentGame = "NONE";
    showOLED("WHY DID YOU", "MOVE LIKE THAT?", "", "READY");
    Serial.println("RESET_COMPLETE");
    return;
  }
}

// =====================================================
// SETUP
// =====================================================
void setup() {
  Serial.begin(115200);
  delay(800);

  // Buzzer
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);

  // I2C
  Wire.begin(SDA_PIN, SCL_PIN);

  // OLED
  if (display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR)) {
    Serial.println("OLED_OK");
    showOLED("STARTING...", "WHY DID YOU", "MOVE LIKE THAT?");
  } else {
    Serial.println("OLED_ERROR");
  }

  // MPU6050
  if (initializeMPU()) {
    Serial.println("MPU_OK");
  } else {
    Serial.println("MPU_ERROR");
  }

  // Startup Beep & Ready Banner
  beep(150);
  showOLED("WHY DID YOU", "MOVE LIKE THAT?", "", "CONNECT WEB USB");
  Serial.println("READY");
}

// =====================================================
// MAIN LOOP
// =====================================================
void loop() {
  // Receive commands from Web Serial
  if (Serial.available()) {
    String command = Serial.readStringUntil('\n');
    handleCommand(command);
  }

  // Stream 50 Hz sensor telemetry when game is running or continuous stream enabled
  if (gameRunning || continuousStream) {
    unsigned long currentTime = millis();
    if (currentTime - lastSensorTime >= 20) { // 50 Hz = 20ms interval
      lastSensorTime = currentTime;
      sendSensorData();
    }
  }
}

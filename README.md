<img width="1280" height="640" alt="Project banner" src="https://github.com/user-attachments/assets/8920b256-2ba8-4988-b824-5351134eb4bd" />

# Chatpate

## Basic Details
### Team Name: Chatpate

### Team Members
- Team Lead: Aksa Liz Abraham - Sahrdaya College of Engineering and Technology
- Member 2: Angel Shaju - Sahrdaya College of Engineering and Technology


### Project Description
Chatpate is an MPU-based shaking analyzer that reads motion data from an ESP32 and MPU6050 sensor to measure how strongly and accurately a person shakes. The system turns motion analysis into an engaging experience with playful arcade-style interactions and performance feedback.

### The Problem
People often do not have a simple and fun way to know how well they can shake, react, or control movement in real time. Traditional motion testing tools are usually technical, dull, or not interactive enough for everyday use.

### The Solution
Chatpate turns sensor-based motion analysis into a series of mini-games that challenge users to improve their control, rhythm, and reaction speed. By combining hardware sensing with a retro arcade interface, the project makes skill testing entertaining and motivating.

## Technical Details
### Technologies/Components Used
For Software:
- C++ / Arduino
- HTML, CSS, and JavaScript
- ESP32 serial communication
- Sensor data processing and motion analysis
- GitHub for project collaboration and documentation

For Hardware:
- ESP32 development board
- MPU6050 accelerometer and gyroscope sensor
- OLED display
- Active buzzer
- Breadboard and jumper wires
- USB cable and power supply

### Implementation
For Software:

# Installation
1. Open the Arduino IDE.
2. Load the firmware from `hardware/esp/esp.ino`.
3. Select the correct board: ESP32 Dev Module.
4. Install the required libraries if prompted.
5. Upload the code to the ESP32.

# Run
1. Open `index.html` in a browser, or serve the project locally using:

```bash
cd /workspaces/useless_project_temp
python3 -m http.server 8000
```

2. Open `http://localhost:8000` in the browser.
3. Connect the ESP32 and allow the browser UI to communicate with the hardware.

### Project Documentation
For Software:

# Screenshots
<img width="1649" height="958" alt="SS1" src="https://github.com/user-attachments/assets/7ae6daf9-9424-40ad-b5e0-05a8ea7cbc3b" />
*Main retro arcade screen showing the visual interface and game selection.*

<img width="1632" height="956" alt="SS2" src="https://github.com/user-attachments/assets/44315781-177b-44b1-982f-3d4f210870a9" />
*Game Dashboard*

<img width="1636" height="944" alt="SS3" src="https://github.com/user-attachments/assets/b199bc67-1010-4376-b4fa-a7a020be3543" />
*Game Interface*

For Hardware

# Diagrams
<img width="1536" height="1024" alt="workflow" src="https://github.com/user-attachments/assets/c8d39963-b268-45d2-b349-4b29f25a7d85" />
*This diagram shows how the MPU6050 sensor, ESP32, and browser interface work together.*

# Schematic & Circuit
<img width="1536" height="1024" alt="circuit" src="https://github.com/user-attachments/assets/3c0b7bbe-6ddd-4d32-aec6-17bd1a709b6b" />
*Connection diagram for ESP32, MPU6050, buzzer, and display.*



# Build Photos
<img width="3024" height="4032" alt="hardware circuit" src="https://github.com/user-attachments/assets/9139941c-d448-4be6-ad1c-35b610ea4f2a" />
*The hardware setup and wiring process during assembly.*

<img width="3024" height="4032" alt="circuit connected to lap" src="https://github.com/user-attachments/assets/81da3f0d-8d26-419e-9049-330fd24e71f1" />
*The completed motion-analysis project ready for demonstration.*

### Project Demo
# Video
(https://drive.google.com/file/d/1UbiqIaylccaH7zb8-MZZ7K7rIAHoEcMM/view?usp=sharing)
*This video demonstrates the motion input, game feedback, and final project working condition.*



## Team Contributions
- Aksa Liz Abraham: Equal contribution to project planning, concept development, sensor integration, and final system coordination.
- Angel Shaju: Equal contribution to motion analysis logic, gameplay design, testing, and debugging.


---
Made with ❤️ at TinkerHub Useless Projects

![Static Badge](https://img.shields.io/badge/TinkerHub-24?color=%23000000&link=https%3A%2F%2Fwww.tinkerhub.org%2F)
![Static Badge](https://img.shields.io/badge/UselessProjects--26-26?link=https%3A%2F%2Ftinkerhub.org%2Fevents%2F1M8ORET9A1%2Fuseless-projects-3.0)


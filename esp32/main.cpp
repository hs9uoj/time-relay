/*
 * ESP32_TimerRelay_Controller
 * Version: 1.3.1 (MQTT + Web API + EEPROM)
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <EEPROM.h>

// EEPROM Configuration
#define EEPROM_SIZE 128     // ขนาด EEPROM ที่ใช้ (ปรับตามความเหมาะสม)
#define SSID_ADDRESS 0      // ที่อยู่เริ่มต้นสำหรับเก็บ SSID
#define PASSWORD_ADDRESS 32 // ที่อยู่เริ่มต้นสำหรับเก็บ Password (เว้นระยะห่างจาก SSID)

// MQTT Configuration
const char* mqtt_server = "broker.hivemq.com";  
const int mqtt_port = 1883;
const char* mqtt_user = "";         
const char* mqtt_password = "";     
const char* device_id = "esp32_timer_relay_01"; 

// MQTT Topics
const char* topic_relay1_control = "home/relay1/control";
const char* topic_relay2_control = "home/relay2/control";
const char* topic_status = "home/relay/status";
const char* topic_command = "home/relay/command";

// Pin definitions
const int LED_PIN = 2;         // LED สำหรับแสดงสถานะทั้งหมด
const int SWITCH1_PIN = 22;    // สวิตช์ตัวที่ 1
const int SWITCH2_PIN = 23;    // สวิตช์ตัวที่ 2
const int RELAY1_PIN = 16;     // รีเลย์ตัวที่ 1
const int RELAY2_PIN = 19;     // รีเลย์ตัวที่ 2

// Timing configurations
const long EMERGENCY_BLINK = 100;   // กะพริบเร็วมาก (100ms) สำหรับ 30 วินาทีสุดท้าย
const long WARNING_BLINK = 500;     // กะพริบเร็ว (500ms) สำหรับ 3 นาทีสุดท้าย
const long WIFI_FAST_BLINK = 1000;  // กะพริบ 1 วินาที สำหรับไม่มี WiFi
const long WIFI_SLOW_BLINK = 3000;  // กะพริบช้า 3 วินาที สำหรับมี WiFi + Internet
const long CHECK_INTERVAL = 10000;         // ตรวจสอบสถานะทุก 10 วินาที
const long COUNTDOWN_TIME = 40 * 60 * 1000;  // 40 นาที
const long WARNING_TIME = 3 * 60 * 1000;     // 3 นาทีสุดท้าย
const long URGENT_TIME = 30 * 1000;          // 30 วินาทีสุดท้าย
const long DEBOUNCE_DELAY = 50;              // ดีเลย์ป้องกันการกระเด้ง
const long LONG_PRESS_TIME = 2500;           // เวลากดค้าง 2.5 วินาที

// JSON buffer size
const size_t JSON_DOC_SIZE = 512;

// Global objects
WiFiClient espClient;
PubSubClient mqtt(espClient);
AsyncWebServer server(80);

// Operating variables
unsigned long previousMillis = 0;
unsigned long lastMqttReconnectAttempt = 0;
const long MQTT_RECONNECT_INTERVAL = 5000;
bool ledState = LOW;
int connectionStatus = 0;
unsigned long relay1StartTime = 0;
unsigned long relay2StartTime = 0;
bool relay1Active = false;
bool relay2Active = false;
bool switch1LastState = HIGH;
bool switch2LastState = HIGH;
unsigned long lastDebounceTime1 = 0;
unsigned long lastDebounceTime2 = 0;
unsigned long switch1PressStart = 0;
unsigned long switch2PressStart = 0;
bool switch1LongPress = false;
bool switch2LongPress = false;

// Forward declarations
void publishStatus();
void activateRelay(int relay, bool state);
void resetTimer(int relay);
void updateLED(unsigned long currentMillis);
void handleRelay1(bool switchPressed);
void handleRelay2(bool switchPressed);
void setupWiFi();
void checkWiFiConnection();
void handleSwitch(bool reading, bool &lastState, bool &longPress, unsigned long &pressStart, 
                 unsigned long &lastDebounceTime, unsigned long currentMillis, int relayNum);

// EEPROM Functions
void readWifiCredentials(char* ssid, char* password) {
  EEPROM.begin(EEPROM_SIZE);  // เริ่มต้น EEPROM
  // อ่าน SSID
  for (int i = 0; i < 32; i++) {
    ssid[i] = char(EEPROM.read(SSID_ADDRESS + i));
  }
  ssid[31] = '\0'; // ใส่ null terminator
  // อ่าน Password
  for (int i = 0; i < 32; i++) {
    password[i] = char(EEPROM.read(PASSWORD_ADDRESS + i));
  }
  password[31] = '\0'; // ใส่ null terminator
  EEPROM.end();  // ปิด EEPROM
}

// WiFi setup and management
void setupWiFi() {
  char ssid[32];
  char password[32];
  readWifiCredentials(ssid, password);

  WiFi.begin(ssid, password);
  
  Serial.print("Connecting to WiFi");
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\nFailed to connect WiFi - Restarting");
    ESP.restart();
  }
}

// ... (โค้ดส่วนอื่นๆ เหมือนเดิม) ...
void checkWiFiConnection() {
    static unsigned long lastWiFiCheck = 0;
    const unsigned long WIFI_CHECK_INTERVAL = 30000;  // 30 seconds
    
    if (millis() - lastWiFiCheck >= WIFI_CHECK_INTERVAL) {
        lastWiFiCheck = millis();
        
        if (WiFi.status() != WL_CONNECTED) {
            Serial.println("WiFi connection lost. Reconnecting...");
            WiFi.disconnect();
            setupWiFi();
        }
    }
}

// Web Server setup
void setupWebServer() {
    DefaultHeaders::Instance().addHeader("Access-Control-Allow-Origin", "*");
    DefaultHeaders::Instance().addHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    DefaultHeaders::Instance().addHeader("Access-Control-Allow-Headers", "Content-Type");

    server.on("/api/status", HTTP_GET, [](AsyncWebServerRequest *request) {
        DynamicJsonDocument doc(JSON_DOC_SIZE);
        
        doc["device_id"] = device_id;
        doc["wifi_connected"] = (WiFi.status() == WL_CONNECTED);
        doc["wifi_rssi"] = WiFi.RSSI();
        
        JsonObject relay1 = doc.createNestedObject("relay1");
        relay1["active"] = relay1Active;
        if (relay1Active) {
            unsigned long remaining = (relay1StartTime + COUNTDOWN_TIME - millis()) / 1000;
            relay1["remaining_seconds"] = remaining;
        }
        
        JsonObject relay2 = doc.createNestedObject("relay2");
        relay2["active"] = relay2Active;
        if (relay2Active) {
            unsigned long remaining = (relay2StartTime + COUNTDOWN_TIME - millis()) / 1000;
            relay2["remaining_seconds"] = remaining;
        }

        String response;
        serializeJson(doc, response);
        request->send(200, "application/json", response);
    });

    server.on("/api/relay", HTTP_POST, [](AsyncWebServerRequest *request) {}, NULL,
        [](AsyncWebServerRequest *request, uint8_t *data, size_t len, size_t index, size_t total) {
        
        DynamicJsonDocument doc(JSON_DOC_SIZE);
        DeserializationError error = deserializeJson(doc, data);
        
        if (error) {
            Serial.print("JSON Parse Error: ");
            Serial.println(error.c_str());
            request->send(400, "text/plain", "Invalid JSON");
            return;
        }
        
        if (!doc.containsKey("relay") || !doc.containsKey("action")) {
            request->send(400, "text/plain", "Missing required fields");
            return;
        }
        
        int relay = doc["relay"];
        const char* action = doc["action"];
        
        if (relay != 1 && relay != 2) {
            request->send(400, "text/plain", "Invalid relay number");
            return;
        }
        
        if (strcmp(action, "ON") == 0) {
            activateRelay(relay, true);
        }
        else if (strcmp(action, "OFF") == 0) {
            activateRelay(relay, false);
        }
        else if (strcmp(action, "RESET") == 0) {
            resetTimer(relay);
        }
        else {
            request->send(400, "text/plain", "Invalid action");
            return;
        }
        
        request->send(200);
    });

    server.begin();
}

// Function implementations
bool checkInternet() {
    HTTPClient http;
    http.begin("http://www.google.com");
    int httpCode = http.GET();
    http.end();
    return httpCode > 0;
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
    String message;
    for (int i = 0; i < length; i++) {
        message += (char)payload[i];
    }
    
    Serial.printf("MQTT Message [%s]: %s\n", topic, message.c_str());

    DynamicJsonDocument doc(JSON_DOC_SIZE);
    DeserializationError error = deserializeJson(doc, message);
    
    if (error) {
        Serial.print("Failed to parse JSON: ");
        Serial.println(error.c_str());
        return;
    }

    try {
        if (String(topic) == topic_command) {
            String command = doc["command"].as<String>();
            if (command == "status") {
                publishStatus();

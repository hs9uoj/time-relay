/*
 * ESP32_TimerRelay_Controller
 * Version: 1.3.0 (MQTT + Web API)
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>

// WiFi credentials
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

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
const int LED_PIN = 2;         
const int SWITCH1_PIN = 22;    
const int SWITCH2_PIN = 23;    
const int RELAY1_PIN = 16;     
const int RELAY2_PIN = 19;     

// Timing configurations
const long EMERGENCY_BLINK = 100;   
const long WARNING_BLINK = 500;     
const long WIFI_FAST_BLINK = 1000;  
const long WIFI_SLOW_BLINK = 3000;  
const long CHECK_INTERVAL = 10000;        
const long COUNTDOWN_TIME = 40 * 60 * 1000; 
const long WARNING_TIME = 3 * 60 * 1000;    
const long URGENT_TIME = 30 * 1000;         
const long DEBOUNCE_DELAY = 50;             
const long LONG_PRESS_TIME = 2500;          

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

// Function declarations
void activateRelay(int relay, bool state);
void resetTimer(int relay);
void publishStatus();
void handleRelay1(bool switchPressed);
void handleRelay2(bool switchPressed);
void updateLED(unsigned long currentMillis);
void setupWebServer();
bool reconnectMQTT();

// Function implementations
bool checkInternet() {
    HTTPClient http;
    http.begin("http://www.google.com");
    int httpCode = http.GET();
    http.end();
    return httpCode > 0;
}

void publishStatus() {
    StaticJsonDocument<400> doc;
    
    doc["device_id"] = device_id;
    doc["wifi_connected"] = (WiFi.status() == WL_CONNECTED);
    doc["wifi_rssi"] = WiFi.RSSI();
    
    JsonObject relay1 = doc.createNeste

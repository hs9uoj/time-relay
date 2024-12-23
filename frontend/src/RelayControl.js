import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Wifi, WifiOff } from "lucide-react";

const RelayControl = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [relays, setRelays] = useState({
    relay1: { active: false, remainingSeconds: 0 },
    relay2: { active: false, remainingSeconds: 0 },
  });

  const ESP32_IP = "192.168.68.120"; // แก้ไขเป็น IP ของ ESP32

  // แปลงวินาทีเป็นรูปแบบ MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  // คำนวณเปอร์เซ็นต์เวลาที่เหลือ
  const calculateProgress = (seconds) => {
    const totalSeconds = 40 * 60; // 40 นาที
    return (seconds / totalSeconds) * 100;
  };

  // Component แสดงแถบเวลา
  const TimeBar = ({ seconds }) => {
    const progress = calculateProgress(seconds);
    return (
      <div className="w-full h-2 bg-gray-200 rounded-full mt-2">
        <div
          className="h-full bg-blue-500 rounded-full transition-all duration-1000 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
    );
  };

  // ฟังก์ชันดึงสถานะ
  const fetchStatus = async () => {
    try {
      const response = await fetch(`http://${ESP32_IP}/api/status`);
      const data = await response.json();

      setIsConnected(true);
      setRelays({
        relay1: {
          active: data.relay1.active,
          remainingSeconds: data.relay1.remaining_seconds || 0,
        },
        relay2: {
          active: data.relay2.active,
          remainingSeconds: data.relay2.remaining_seconds || 0,
        },
      });
    } catch (error) {
      console.error("Failed to fetch status:", error);
      setIsConnected(false);
    }
  };

  // ฟังก์ชันส่งคำสั่งควบคุม
  const controlRelay = async (relay, action) => {
    try {
      await fetch(`http://${ESP32_IP}/api/relay`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          relay: relay,
          action: action,
        }),
      });
      fetchStatus(); // อัพเดทสถานะหลังส่งคำสั่ง
    } catch (error) {
      console.error("Failed to control relay:", error);
      setIsConnected(false);
    }
  };

  // สำหรับการสลับสถานะรีเลย์
  const toggleRelay = (relayNum) => {
    const currentState = relays[`relay${relayNum}`].active;
    controlRelay(relayNum, currentState ? "OFF" : "ON");
  };

  // ดึงสถานะทุก 1 วินาที
  useEffect(() => {
    fetchStatus(); // ดึงสถานะครั้งแรก
    const interval = setInterval(fetchStatus, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-4 max-w-md mx-auto space-y-4">
      <div className="flex items-center justify-end space-x-2 text-sm">
        {isConnected ? (
          <>
            <Wifi className="w-4 h-4 text-green-500" />
            <span className="text-green-500">เชื่อมต่อแล้ว</span>
          </>
        ) : (
          <>
            <WifiOff className="w-4 h-4 text-red-500" />
            <span className="text-red-500">ไม่ได้เชื่อมต่อ</span>
          </>
        )}
      </div>

      {/* การ์ดควบคุมรีเลย์ 1 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-between items-center mb-4">
            <div className="font-medium">รีเลย์ 1</div>
            <Switch
              checked={relays.relay1.active}
              onCheckedChange={() => toggleRelay(1)}
            />
          </div>
          {relays.relay1.active && (
            <div>
              <div className="text-sm text-gray-600 mb-1">
                เวลาที่เหลือ: {formatTime(relays.relay1.remainingSeconds)}
              </div>
              <TimeBar seconds={relays.relay1.remainingSeconds} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* การ์ดควบคุมรีเลย์ 2 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-between items-center mb-4">
            <div className="font-medium">รีเลย์ 2</div>
            <Switch
              checked={relays.relay2.active}
              onCheckedChange={() => toggleRelay(2)}
            />
          </div>
          {relays.relay2.active && (
            <div>
              <div className="text-sm text-gray-600 mb-1">
                เวลาที่เหลือ: {formatTime(relays.relay2.remainingSeconds)}
              </div>
              <TimeBar seconds={relays.relay2.remainingSeconds} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RelayControl;

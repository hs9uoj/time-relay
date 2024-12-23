# src/app/page.js
```javascript
import RelayControl from '@/components/RelayControl';

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-100 py-8">
      <RelayControl />
    </main>
  );
}
```

# src/app/layout.js
```javascript
import './globals.css'

export const metadata = {
  title: 'Relay Control',
  description: 'ESP32 Timer Relay Controller',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

# src/components/ui/card.js
```javascript
import * as React from "react"

const Card = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={`rounded-lg border bg-card text-card-foreground shadow-sm ${className}`}
    {...props}
  />
))
Card.displayName = "Card"

const CardContent = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={`p-6 pt-0 ${className}`} {...props} />
))
CardContent.displayName = "CardContent"

export { Card, CardContent }
```

# src/components/ui/switch.js
```javascript
import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

const Switch = React.forwardRef(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={`peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-gray-200 ${className}`}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={`pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0`}
    />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
```

# src/components/RelayControl.js
```javascript
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Wifi, WifiOff } from 'lucide-react';

const RelayControl = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [relays, setRelays] = useState({
    relay1: { active: false, remainingSeconds: 0 },
    relay2: { active: false, remainingSeconds: 0 }
  });

  const ESP32_IP = '192.168.1.xxx'; // แก้ไขเป็น IP ของ ESP32

  // แปลงวินาทีเป็นรูปแบบ MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // คำนวณเปอร์เซ็นต์เวลาที่เหลือ
  const calculateProgress = (seconds) => {
    const totalSeconds = 40 * 60; // 40 นาที
    return Math.max(0, Math.min(100, (seconds / totalSeconds) * 100));
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
          remainingSeconds: data.relay1.remaining_seconds || 0
        },
        relay2: {
          active: data.relay2.active,
          remainingSeconds: data.relay2.remaining_seconds || 0
        }
      });
    } catch (error) {
      console.error('Failed to fetch status:', error);
      setIsConnected(false);
    }
  };

  // ฟังก์ชันส่งคำสั่งควบคุม
  const controlRelay = async (relay, action) => {
    try {
      await fetch(`http://${ESP32_IP}/api/relay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          relay: relay,
          action: action
        })
      });
      await fetchStatus(); // อัพเดทสถานะหลังส่งคำสั่ง
    } catch (error) {
      console.error('Failed to control relay:', error);
      setIsConnected(false);
    }
  };

  // สำหรับการสลับสถานะรีเลย์
  const toggleRelay = (relayNum) => {
    const currentState = relays[`relay${relayNum}`].active;
    controlRelay(relayNum, currentState ? 'OFF' : 'ON');
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
```

# tailwind.config.js
```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

# next.config.js
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
}

module.exports = nextConfig
```

# .gitignore
```
# dependencies
/node_modules
/.pnp
.pnp.js

# testing
/coverage

# next.js
/.next/
/out/

# production
/build

# misc
.DS_Store
*.pem

# debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# env files
.env
.env*.local

# vercel
.vercel
```

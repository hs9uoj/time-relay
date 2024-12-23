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

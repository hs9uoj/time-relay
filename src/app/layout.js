import './globals.css'

export const metadata = {
  title: 'Relay Control',
  description: 'ESP32 Timer Relay Controller',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-gray-100">
        {children}
      </body>
    </html>
  )
}

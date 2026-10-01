import './globals.css'

export const metadata = {
  title: 'SU Calendar Sync | Sonargaon University',
  description: 'Upload your Sonargaon University class routine and sync it to Google Calendar, phone, laptop and PC with class-time notifications.',
  manifest: '/manifest.json',
  themeColor: '#0b3d2e'
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body>{children}</body>
    </html>
  )
}

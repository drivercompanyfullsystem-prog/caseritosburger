import type { Metadata } from 'next';
import './globals.css';
import { CartProvider } from '@/context/CartContext';
import { AuthProvider } from '@/context/AuthContext';

export const metadata: Metadata = {
  title: 'Caseritos Burguer | Menú & Pedidos Web',
  description: 'Las mejores hamburguesas 100% caseras en Km 13.5. Realiza tu pedido por WhatsApp y descarga nuestra carta oficial en PDF.',
  icons: {
    icon: '/logo.jpg',
    shortcut: '/logo.jpg',
    apple: '/logo.jpg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="dark">
      <head>
        <link rel="icon" href="/logo.jpg" type="image/jpeg" />
      </head>
      <body className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
        <AuthProvider>
          <CartProvider>{children}</CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

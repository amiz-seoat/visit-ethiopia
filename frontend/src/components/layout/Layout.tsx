import React from 'react';
import { Header } from './Header';
import { Footer } from './Footer';
import { TravelAssistant } from '../assistant/TravelAssistant';
interface LayoutProps {
  children: React.ReactNode;
}
export function Layout({
  children
}: LayoutProps) {
  return <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow">{children}</main>
      <Footer />
      <TravelAssistant />
    </div>;
}
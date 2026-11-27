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
      <main id="main-content" tabIndex={-1} className="flex-grow outline-none">{children}</main>
      <Footer />
      <TravelAssistant />
    </div>;
}
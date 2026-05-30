import React from 'react';
import { Layout } from './components/layout/Layout';
import { HomePage } from './pages/HomePage';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ToursPage } from './pages/ToursPage';
import { TourDetailPage } from './pages/TourDetailPage';
import { HotelsPage } from './pages/HotelsPage';
import { HotelDetailPage } from './pages/HotelDetailPage';
import { DestinationsPage } from './pages/DestinationsPage';
import { DestinationDetailPage } from './pages/DestinationDetailPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { TransportPage } from './pages/TransportPage';
import { NewsPage } from './pages/NewsPage';
import { ContactPage } from './pages/ContactPage';
import { FAQPage } from './pages/FAQPage';
import { UserDashboardPage } from './pages/UserDashboardPage';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { AboutPage } from './pages/AboutPage';
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage';
import { TermsPage } from './pages/TermsPage';
import { BlogPage } from './pages/BlogPage';
import { BlogPostPage } from './pages/BlogPostPage';
export function App() {
  return <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout>
              <HomePage />
            </Layout>} />
        <Route path="/tours" element={<Layout>
              <ToursPage />
            </Layout>} />
        <Route path="/tours/:id" element={<Layout>
              <TourDetailPage />
            </Layout>} />
        <Route path="/hotels" element={<Layout>
              <HotelsPage />
            </Layout>} />
        <Route path="/hotels/:id" element={<Layout>
              <HotelDetailPage />
            </Layout>} />
        <Route path="/destinations" element={<Layout>
              <DestinationsPage />
            </Layout>} />
        <Route path="/destinations/:id" element={<Layout>
              <DestinationDetailPage />
            </Layout>} />
        <Route path="/transport" element={<Layout>
              <TransportPage />
            </Layout>} />
        <Route path="/news" element={<Layout>
              <NewsPage />
            </Layout>} />
        <Route path="/news/:id" element={<Layout>
              <BlogPostPage />
            </Layout>} />
        <Route path="/contact" element={<Layout>
              <ContactPage />
            </Layout>} />
        <Route path="/faq" element={<Layout>
              <FAQPage />
            </Layout>} />
        <Route path="/about" element={<Layout>
              <AboutPage />
            </Layout>} />
        <Route path="/privacy" element={<Layout>
              <PrivacyPolicyPage />
            </Layout>} />
        <Route path="/terms" element={<Layout>
              <TermsPage />
            </Layout>} />
        <Route path="/blog" element={<Layout>
              <BlogPage />
            </Layout>} />
        <Route path="/blog/:id" element={<Layout>
              <BlogPostPage />
            </Layout>} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <UserDashboardPage />
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>;
}
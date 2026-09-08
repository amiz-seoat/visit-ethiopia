import React from 'react'
import { Layout } from './components/layout/Layout'
import { HomePage } from './pages/HomePage'
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import { ToursPage } from './pages/ToursPage'
import { TourDetailPage } from './pages/TourDetailPage'
import { HotelsPage } from './pages/HotelsPage'
import { HotelDetailPage } from './pages/HotelDetailPage'
import { DestinationsPage } from './pages/DestinationsPage'
import { DestinationDetailPage } from './pages/DestinationDetailPage'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { TransportPage } from './pages/TransportPage'
import { TransportDetailPage } from './pages/TransportDetailPage'
import { NewsPage } from './pages/NewsPage'
import { ContactPage } from './pages/ContactPage'
import { FAQPage } from './pages/FAQPage'
import { UserDashboardPage } from './pages/UserDashboardPage'
import { BookingsPage } from './pages/BookingsPage'
import { BookingDetailPage } from './pages/BookingDetailPage'
import { AdminDashboardPage } from './pages/AdminDashboardPage'
import { SearchPage } from './pages/SearchPage'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { AboutPage } from './pages/AboutPage'
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage'
import { TermsPage } from './pages/TermsPage'
import { BlogPage } from './pages/BlogPage'
import { BlogPostPage } from './pages/BlogPostPage'
import { RestaurantsPage } from './pages/RestaurantsPage'
import { RestaurantDetailPage } from './pages/RestaurantDetailPage'
import { ProviderRegisterPage } from './pages/ProviderRegisterPage'
import { ProviderWorkspacePage } from './pages/ProviderWorkspacePage'
import { ProviderBookingsPage } from './pages/ProviderBookingsPage'
import { ProviderBookingDetailPage } from './pages/ProviderBookingDetailPage'
import { TravelCompaniesPage } from './pages/TravelCompaniesPage'
import { CompanyProfilePage } from './pages/CompanyProfilePage'

function ProviderBookingsRedirect() {
  const orgId = localStorage.getItem('activeOrganizationId')
  if (orgId) {
    return <Navigate to={`/provider/workspace/${orgId}/bookings`} replace />
  }
  return <Navigate to="/dashboard" replace />
}

function ProviderBookingDetailRedirect() {
  const { id } = useParams<{ id: string }>()
  const orgId = localStorage.getItem('activeOrganizationId')
  if (orgId && id) {
    return <Navigate to={`/provider/workspace/${orgId}/bookings/${id}`} replace />
  }
  return <Navigate to="/dashboard" replace />
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout><HomePage /></Layout>} />
        <Route path="/tours" element={<Layout><ToursPage /></Layout>} />
        <Route path="/tours/:id" element={<Layout><TourDetailPage /></Layout>} />
        <Route
          path="/bookings"
          element={
            <ProtectedRoute>
              <Layout><BookingsPage /></Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/bookings/:id"
          element={
            <ProtectedRoute>
              <Layout><BookingDetailPage /></Layout>
            </ProtectedRoute>
          }
        />
        <Route path="/companies" element={<Layout><TravelCompaniesPage /></Layout>} />
        <Route path="/companies/:slug" element={<Layout><CompanyProfilePage /></Layout>} />
        <Route path="/hotels" element={<Layout><HotelsPage /></Layout>} />
        <Route path="/hotels/:id" element={<Layout><HotelDetailPage /></Layout>} />
        <Route path="/destinations" element={<Layout><DestinationsPage /></Layout>} />
        <Route path="/destinations/:id" element={<Layout><DestinationDetailPage /></Layout>} />
        <Route path="/transport" element={<Layout><TransportPage /></Layout>} />
        <Route path="/transport/:id" element={<Layout><TransportDetailPage /></Layout>} />
        <Route path="/restaurants" element={<Layout><RestaurantsPage /></Layout>} />
        <Route path="/restaurants/:id" element={<Layout><RestaurantDetailPage /></Layout>} />
        <Route path="/news" element={<Layout><NewsPage /></Layout>} />
        <Route path="/news/:id" element={<Layout><BlogPostPage /></Layout>} />
        <Route path="/search" element={<Layout><SearchPage /></Layout>} />
        <Route path="/contact" element={<Layout><ContactPage /></Layout>} />
        <Route path="/faq" element={<Layout><FAQPage /></Layout>} />
        <Route path="/about" element={<Layout><AboutPage /></Layout>} />
        <Route path="/privacy" element={<Layout><PrivacyPolicyPage /></Layout>} />
        <Route path="/terms" element={<Layout><TermsPage /></Layout>} />
        <Route path="/blog" element={<Layout><BlogPage /></Layout>} />
        <Route path="/blog/:id" element={<Layout><BlogPostPage /></Layout>} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
        <Route
          path="/provider/register"
          element={
            <ProtectedRoute>
              <ProviderRegisterPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/provider/workspace/:organizationId"
          element={
            <ProtectedRoute>
              <ProviderWorkspacePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/provider/workspace/:organizationId/bookings"
          element={
            <ProtectedRoute>
              <Layout><ProviderBookingsPage /></Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/provider/workspace/:organizationId/bookings/:bookingId"
          element={
            <ProtectedRoute>
              <Layout><ProviderBookingDetailPage /></Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/provider/bookings"
          element={
            <ProtectedRoute>
              <ProviderBookingsRedirect />
            </ProtectedRoute>
          }
        />
        <Route
          path="/provider/bookings/:id"
          element={
            <ProtectedRoute>
              <ProviderBookingDetailRedirect />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <UserDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute
              roles={[
                'admin',
                'tour_operator',
                'hotel_manager',
                'transport_manager',
                'guide',
              ]}
            >
              <AdminDashboardPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

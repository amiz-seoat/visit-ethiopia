import React from 'react';
import { Link } from 'react-router-dom';
import { SITE } from '../config/site';
export function TermsPage() {
  return <div className="w-full bg-gray-50">
      {/* Hero Section */}
      <div className="bg-white py-12 border-b">
        <div className="container mx-auto px-4">
          <h1 className="text-3xl md:text-4xl font-bold text-center">
            Terms and Conditions
          </h1>
          <p className="text-gray-600 text-center mt-4 max-w-3xl mx-auto">
            Last updated: {SITE.policiesUpdated}
          </p>
        </div>
      </div>
      {/* Main Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-sm p-8">
          <div className="prose max-w-none">
            <p className="mb-6">
              Please read these Terms and Conditions ("Terms", "Terms and
              Conditions") carefully before using the visitethiopia.com website
              (the "Service") operated by Visit Ethiopia ("us", "we", or "our").
            </p>
            <p className="mb-6">
              Your access to and use of the Service is conditioned on your
              acceptance of and compliance with these Terms. These Terms apply
              to all visitors, users and others who access or use the Service.
            </p>
            <p className="mb-6">
              By accessing or using the Service you agree to be bound by these
              Terms. If you disagree with any part of the terms then you may not
              access the Service.
            </p>
            <h2 className="text-2xl font-bold mt-8 mb-4">Our role</h2>
            <p className="mb-6">
              Visit Ethiopia is a marketplace. Tours, accommodation, transport and restaurant services listed on the Service are
              provided by independent businesses (“Providers”), not by Visit Ethiopia. When you book, your agreement for the
              service itself is with the Provider. We operate the platform, review Provider profiles before their listings are
              published, and process payments on the Provider’s behalf.
            </p>
            <h2 className="text-2xl font-bold mt-8 mb-4">Booking and Reservations</h2>
            <p className="mb-6">
              When making a booking you agree to provide accurate, current and complete information. All bookings are subject
              to availability. The price, inclusions and any conditions shown on the listing at the time you book apply to your
              booking. You can see the status of every booking under My bookings.
            </p>
            <h2 className="text-2xl font-bold mt-8 mb-4">Payment</h2>
            <p className="mb-6">
              Prices are shown and charged in Ethiopian Birr (ETB). Payments are processed by our payment partner Chapa using the
              methods Chapa offers at checkout. A booking is only marked as paid after the payment has been verified with Chapa;
              returning to our site from the payment page does not by itself confirm payment. Your bank or payment method may
              charge its own fees.
            </p>
            <h2 className="text-2xl font-bold mt-8 mb-4">Cancellation and Refund Policy</h2>
            <p className="mb-4">
              You can request a cancellation from the booking’s page under My bookings. Whether a refund is due, and how much,
              depends on the Provider’s cancellation terms shown on the listing and on how close the cancellation is to the
              service date. Approved refunds are returned through Chapa to the original payment method; processing times depend
              on Chapa and your bank.
            </p>
            <p className="mb-6">
              If a Provider cancels a confirmed booking, or the service cannot be delivered for reasons within the Provider’s
              control, you are entitled to a full refund of the amount paid for that booking.
            </p>
            <h2 className="text-2xl font-bold mt-8 mb-4">Travel Insurance</h2>
            <p className="mb-6">
              Comprehensive travel insurance is mandatory for all clients
              traveling with Visit Ethiopia. Your travel insurance must cover
              accidents, medical expenses, emergency evacuation and
              repatriation, cancellation or curtailment of your trip, and loss
              of luggage and personal effects. We reserve the right to request
              proof of insurance prior to the commencement of your tour.
            </p>
            <h2 className="text-2xl font-bold mt-8 mb-4">
              Passports, Visas, and Health Requirements
            </h2>
            <p className="mb-6">
              It is your responsibility to ensure that you have a valid
              passport, necessary visas, and meet all health requirements for
              travel to Ethiopia. Your passport should be valid for at least six
              months beyond the end date of your trip. Visit Ethiopia is not
              liable for any issues arising from failure to comply with these
              requirements.
            </p>
            <h2 className="text-2xl font-bold mt-8 mb-4">
              Limitation of Liability
            </h2>
            <p className="mb-6">
              Visit Ethiopia acts as an intermediary between you and
              transportation carriers, hotels, and other suppliers. We are not
              liable for any injury, damage, loss, accident, delay, or
              irregularity which may be caused by defect of any vehicle or the
              negligence or default of any company or person engaged in carrying
              out or performing any of the services involved.
            </p>
            <p className="mb-6">
              Visit Ethiopia is not responsible for losses or additional
              expenses due to delay or changes in air schedules, defaults of any
              third parties, sickness, weather, strikes, war, quarantine, or
              other causes beyond our control. All such losses or expenses will
              be borne by the passenger.
            </p>
            <h2 className="text-2xl font-bold mt-8 mb-4">Force Majeure</h2>
            <p className="mb-6">
              Visit Ethiopia shall not be liable for any delay or failure to
              perform its obligations under these Terms resulting from a Force
              Majeure event, including but not limited to acts of God, natural
              disasters, war, terrorism, civil unrest, government actions,
              strikes, or other circumstances beyond our reasonable control.
            </p>
            <h2 className="text-2xl font-bold mt-8 mb-4">Health and Fitness</h2>
            <p className="mb-6">
              By booking with Visit Ethiopia, you confirm that you are in good
              physical and mental health and that there are no medical or other
              conditions that would make it dangerous for you to participate in
              the activities included in your itinerary. You must inform us at
              the time of booking of any health issues or disabilities that may
              affect your ability to participate in the tour.
            </p>
            <h2 className="text-2xl font-bold mt-8 mb-4">
              Photography and Marketing
            </h2>
            <p className="mb-6">
              Visit Ethiopia reserves the right to take photographs or videos
              during the operation of any tour and to use the resulting media
              for promotional purposes. By booking a tour with us, you consent
              to allow your image to be used in such photographs and videos,
              unless you specifically advise us in writing that you do not wish
              to be included.
            </p>
            <h2 className="text-2xl font-bold mt-8 mb-4">Governing Law</h2>
            <p className="mb-6">
              These Terms shall be governed by and construed in accordance with
              the laws of Ethiopia. Any disputes arising under these Terms shall
              be subject to the exclusive jurisdiction of the courts of
              Ethiopia.
            </p>
            <h2 className="text-2xl font-bold mt-8 mb-4">Changes to Terms</h2>
            <p className="mb-6">
              We reserve the right, at our sole discretion, to modify or replace
              these Terms at any time. If a revision is material we will try to
              provide at least 30 days' notice prior to any new terms taking
              effect. What constitutes a material change will be determined at
              our sole discretion.
            </p>
            <h2 className="text-2xl font-bold mt-8 mb-4">Contact Us</h2>
            <p className="mb-6">
              If you have any questions about these Terms, please contact us at:
            </p>
            <div className="mb-6">
              <p className="font-medium">Visit Ethiopia</p>
              {SITE.contactAddress && <p>{SITE.contactAddress}</p>}
              {SITE.contactEmail && <p>Email: <a href={`mailto:${SITE.contactEmail}`} className="text-amber-700 hover:underline">{SITE.contactEmail}</a></p>}
              {SITE.contactPhone && <p>Phone: {SITE.contactPhone}</p>}
              <p>Or use our <Link to="/contact" className="text-amber-700 hover:underline">contact form</Link> and choose “Other”.</p>
            </div>
          </div>
        </div>
      </div>
    </div>;
}
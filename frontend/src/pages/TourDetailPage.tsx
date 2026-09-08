import React, { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Clock, Users, Map, CheckCircle, XCircle, Star, ChevronRight, ChevronDown } from 'lucide-react'
import { getTourById, getTourReviews } from '../api/tours'
import { getTourBySlug, getPublicTourDepartures, type TourDeparture } from '../api/organizationTours'
import { TourBookingPanel } from '../components/booking/TourBookingPanel'
import { PageError, PageLoader } from '../components/ui/PageStatus'
import { ReviewForm } from '../components/reviews/ReviewForm'
import { getErrorMessage } from '../services/api'
import { formatTourDuration } from '../utils/apiHelpers'
import { availabilityLabel } from '../utils/bookingValidation'
import type { Review, Tour } from '../types'

export function TourDetailPage() {
  const { id } = useParams<{ id: string }>()

  const [tour, setTour] = useState<Tour | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [departures, setDepartures] = useState<TourDeparture[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [selectedImage, setSelectedImage] = useState(0)
  const [openAccordion, setOpenAccordion] = useState<number | null>(0)

  useEffect(() => {
    if (!id) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')
      try {
        let tourData: Tour | null = null
        try {
          tourData = await getTourById(id!)
        } catch {
          tourData = (await getTourBySlug(id!)) as Tour | null
        }
        const reviewData = tourData?._id
          ? await getTourReviews(tourData._id)
          : []
        let departureData: TourDeparture[] = []
        const departureKey = tourData?.slug || id!
        try {
          departureData = await getPublicTourDepartures(departureKey)
        } catch {
          if (tourData?._id && tourData._id !== departureKey) {
            try {
              departureData = await getPublicTourDepartures(tourData._id)
            } catch {
              departureData = []
            }
          }
        }
        if (!cancelled) {
          if (!tourData) {
            setError('Tour not found')
          } else {
            setTour(tourData)
            setDepartures(departureData)
            setReviews(
              (reviewData as Review[]).filter((r) => r.status === 'approved' || !r.status)
            )
          }
        }
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err, 'Failed to load tour'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [id])

  if (loading) return <PageLoader message="Loading tour..." />
  if (error || !tour) return <PageError message={error || 'Tour not found'} />

  const images = tour.images?.length ? tour.images : [tour.coverImage]
  const tourPath = `/tours/${id}`

  return (
    <div className="bg-white w-full">
      <div
        className="relative h-80 md:h-96 bg-cover bg-center"
        style={{ backgroundImage: `url(${tour.coverImage})` }}
      >
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative container mx-auto px-4 h-full flex flex-col justify-end pb-8">
          {tour.isFeatured && (
            <div className="bg-amber-600 text-white py-1 px-3 rounded-full inline-block mb-3 text-sm font-medium w-fit">
              Featured Tour
            </div>
          )}
          <h1 className="text-3xl md:text-5xl font-bold text-white mb-2">{tour.title}</h1>
          {tour.organization?.slug && (
            <Link
              to={`/companies/${tour.organization.slug}`}
              className="text-emerald-200 hover:text-white text-sm mb-2 inline-block"
            >
              by {tour.organization.name}
            </Link>
          )}
          <div className="flex flex-wrap items-center text-white gap-4">
            <div className="flex items-center">
              <Star size={18} fill="currentColor" className="mr-1" />
              <span>
                {(tour.averageRating ?? 0).toFixed(1)} ({reviews.length} reviews)
              </span>
            </div>
            <div className="flex items-center">
              <Clock size={18} className="mr-1" />
              <span>{formatTourDuration(tour.duration)}</span>
            </div>
            <div className="flex items-center">
              <Users size={18} className="mr-1" />
              <span>
                {tour.currentBookings ?? 0}/{tour.maxGroupSize ?? 12} spots taken
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="lg:w-2/3">
            <div className="mb-8">
              <div className="bg-gray-100 rounded-lg overflow-hidden mb-4">
                <img
                  src={images[selectedImage]}
                  alt={tour.title}
                  className="w-full h-96 object-cover"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                {images.map((image, index) => (
                  <button
                    type="button"
                    key={index}
                    className={`h-24 rounded-lg overflow-hidden ${
                      selectedImage === index ? 'ring-2 ring-amber-500' : ''
                    }`}
                    onClick={() => setSelectedImage(index)}
                  >
                    <img src={image} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-8">
              <h2 className="text-2xl font-bold mb-4">Tour Overview</h2>
              <p className="text-gray-700">{tour.description}</p>
            </div>

            {tour.itinerary && tour.itinerary.length > 0 && (
              <div className="mb-8">
                <h2 className="text-2xl font-bold mb-4">Itinerary</h2>
                <div className="border rounded-lg overflow-hidden">
                  {tour.itinerary.map((day, index) => (
                    <div key={index} className="border-b last:border-b-0">
                      <button
                        type="button"
                        className="w-full px-6 py-4 flex items-center justify-between text-left"
                        onClick={() =>
                          setOpenAccordion(openAccordion === index ? null : index)
                        }
                      >
                        <div>
                          <span className="text-amber-600 font-medium">Day {day.day}:</span>{' '}
                          <span className="font-medium">{day.title}</span>
                        </div>
                        {openAccordion === index ? (
                          <ChevronDown size={20} />
                        ) : (
                          <ChevronRight size={20} />
                        )}
                      </button>
                      {openAccordion === index && (
                        <div className="px-6 py-4 bg-gray-50">
                          <p className="text-gray-700">{day.description}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              {tour.inclusions && tour.inclusions.length > 0 && (
                <div>
                  <h2 className="text-xl font-bold mb-4">What&apos;s Included</h2>
                  <ul className="space-y-2">
                    {tour.inclusions.map((item, index) => (
                      <li key={index} className="flex items-start">
                        <CheckCircle
                          size={18}
                          className="text-green-500 mt-0.5 mr-2 flex-shrink-0"
                        />
                        <span className="text-gray-700">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {tour.exclusions && tour.exclusions.length > 0 && (
                <div>
                  <h2 className="text-xl font-bold mb-4">What&apos;s Not Included</h2>
                  <ul className="space-y-2">
                    {tour.exclusions.map((item, index) => (
                      <li key={index} className="flex items-start">
                        <XCircle
                          size={18}
                          className="text-red-500 mt-0.5 mr-2 flex-shrink-0"
                        />
                        <span className="text-gray-700">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {departures.length > 0 && (
              <div className="mb-8">
                <h2 className="text-2xl font-bold mb-4">Upcoming departures</h2>
                <div className="space-y-3">
                  {departures.map((dep) => (
                    <div
                      key={dep._id}
                      className="flex items-center justify-between border rounded-lg px-4 py-3"
                    >
                      <div>
                        <p className="font-medium">
                          {new Date(dep.departureDate).toLocaleDateString(undefined, {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </p>
                        <p className="text-sm text-gray-500">
                          {availabilityLabel(dep.availableSpots)} · capacity {dep.capacity}
                        </p>
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          dep.status === 'open'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {dep.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h2 className="text-2xl font-bold mb-4">Reviews</h2>
              {reviews.length === 0 ? (
                <p className="text-gray-500">No approved reviews yet.</p>
              ) : (
                <div className="space-y-6">
                  {reviews.map((review) => (
                    <div key={review._id} className="border-b pb-6 last:border-b-0">
                      <div className="flex justify-between mb-2">
                        <h3 className="font-medium">
                          {review.user?.FirstName} {review.user?.LastName}
                        </h3>
                        <span className="text-gray-500 text-sm">
                          {review.createdAt
                            ? new Date(review.createdAt).toLocaleDateString()
                            : ''}
                        </span>
                      </div>
                      <div className="flex text-amber-500 mb-2">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            size={16}
                            fill={i < review.rating ? 'currentColor' : 'none'}
                          />
                        ))}
                      </div>
                      <p className="text-gray-700">{review.comment}</p>
                    </div>
                  ))}
                </div>
              )}
              {id && (
                <ReviewForm
                  itemType="tour"
                  itemId={tour._id || id}
                  onSubmitted={() => {
                    getTourReviews(tour._id || id).then((data) =>
                      setReviews(
                        (data as Review[]).filter(
                          (r) => r.status === 'approved' || !r.status
                        )
                      )
                    )
                  }}
                />
              )}
            </div>
          </div>

          <div className="lg:w-1/3">
            <TourBookingPanel tour={tour} departures={departures} tourPath={tourPath} />
            <div className="mt-4 flex items-center text-gray-600 text-sm justify-center">
              <Map size={16} className="mr-1" />
              <span>Cancellation rules depend on departure cutoff and payment status</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

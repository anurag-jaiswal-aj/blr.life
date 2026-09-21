import Link from "next/link";
import { LocalityDetailResponse } from "@/lib/api";

interface StaticLocalityViewProps {
  locality: LocalityDetailResponse;
}

export function StaticLocalityView({ locality }: StaticLocalityViewProps) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <header className="mb-10">
        <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight sm:text-5xl">
          {locality.name}
        </h1>
        {locality.parent_zone && (
          <p className="mt-2 text-lg text-gray-600 font-medium">
            {locality.parent_zone}
          </p>
        )}
      </header>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:gap-12">
        <div className="space-y-8">
          {/* Metro Section */}
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 transition-all hover:shadow-md">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path>
              </svg>
              Metro Connectivity
            </h2>
            {locality.metro ? (
              <p className="text-gray-700 leading-relaxed">
                Nearest metro: <span className="font-semibold text-gray-900">{locality.metro.station_name}</span>
                {locality.metro.line && (
                  <span> &mdash; {locality.metro.line} Line</span>
                )}
                {", "}
                {(locality.metro.distance_m / 1000).toFixed(1)} km away
              </p>
            ) : (
              <p className="text-gray-500 italic">Metro data unavailable.</p>
            )}
          </section>

          {/* Rent Section */}
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 transition-all hover:shadow-md">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path>
              </svg>
              Observed Rent Range
            </h2>
            {locality.rent && (locality.rent.min_inr !== null || locality.rent.max_inr !== null) ? (
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {locality.rent.min_inr !== null && locality.rent.max_inr !== null ? (
                    <>&#8377;{locality.rent.min_inr.toLocaleString()} &ndash; &#8377;{locality.rent.max_inr.toLocaleString()}</>
                  ) : locality.rent.min_inr !== null ? (
                    <>From &#8377;{locality.rent.min_inr.toLocaleString()}</>
                  ) : (
                    <>Up to &#8377;{locality.rent.max_inr?.toLocaleString()}</>
                  )}
                  <span className="text-base font-normal text-gray-500 ml-1">/month</span>
                </p>
                {locality.rent.confidence && (
                  <p className="text-sm text-gray-500 mt-2 uppercase tracking-wide font-medium">
                    Confidence: {locality.rent.confidence}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-gray-500 italic">Rent data unavailable.</p>
            )}
          </section>
        </div>

        {/* Amenities Section */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 transition-all hover:shadow-md">
          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
            Amenities
          </h2>
          <ul className="divide-y divide-gray-100">
            <li className="py-3 flex justify-between items-center">
              <span className="text-gray-700 font-medium">Cafes</span>
              <span className="text-gray-900 font-bold bg-gray-50 px-3 py-1 rounded-full">
                {locality.amenities.cafes !== null ? locality.amenities.cafes : "-"}
              </span>
            </li>
            <li className="py-3 flex justify-between items-center">
              <span className="text-gray-700 font-medium">Restaurants</span>
              <span className="text-gray-900 font-bold bg-gray-50 px-3 py-1 rounded-full">
                {locality.amenities.restaurants !== null ? locality.amenities.restaurants : "-"}
              </span>
            </li>
            <li className="py-3 flex justify-between items-center">
              <span className="text-gray-700 font-medium">Parks</span>
              <span className="text-gray-900 font-bold bg-gray-50 px-3 py-1 rounded-full">
                {locality.amenities.parks !== null ? locality.amenities.parks : "-"}
              </span>
            </li>
            <li className="py-3 flex justify-between items-center">
              <span className="text-gray-700 font-medium">Healthcare</span>
              <span className="text-gray-900 font-bold bg-gray-50 px-3 py-1 rounded-full">
                {locality.amenities.healthcare !== null ? locality.amenities.healthcare : "-"}
              </span>
            </li>
            <li className="py-3 flex justify-between items-center">
              <span className="text-gray-700 font-medium">Nightlife</span>
              <span className="text-gray-900 font-bold bg-gray-50 px-3 py-1 rounded-full">
                {locality.amenities.nightlife !== null ? locality.amenities.nightlife : "-"}
              </span>
            </li>
          </ul>
        </section>
      </div>

      {/* CTA Section */}
      <section className="mt-12 bg-indigo-50 rounded-2xl p-8 text-center border border-indigo-100">
        <h2 className="text-2xl font-bold text-indigo-900 mb-4">
          Looking for a neighbourhood that matches your commute and lifestyle?
        </h2>
        <p className="text-indigo-700 mb-8 max-w-2xl mx-auto">
          Set your work location, rent budget, and preferences to receive a personalized, data-driven Bengaluru locality recommendation.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center px-8 py-4 text-base font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Find your best-fit Bengaluru locality
        </Link>
      </section>
    </div>
  );
}

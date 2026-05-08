/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { APIProvider, Map, Marker } from '@vis.gl/react-google-maps';
import { useState } from 'react';
import { ArrowLeft, Navigation, MapPin } from 'lucide-react';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY || '';

export function MapView({ onBack }: { onBack: () => void }) {
  const [center, setCenter] = useState({ lat: 51.5074, lng: -0.1278 }); // London

  return (
    <div className="fixed inset-0 bg-white z-[120] flex flex-col max-w-md mx-auto">
      <header className="p-4 bg-white border-b border-slate-100 flex items-center space-x-4 absolute top-0 left-0 right-0 z-10">
        <button onClick={onBack} className="p-2 bg-white rounded-xl shadow-sm border border-slate-100">
           <ArrowLeft size={20} />
        </button>
        <h1 className="font-bold">Nearby KonnectS</h1>
      </header>

      <div className="flex-1 w-full h-full relative">
        <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
          <Map
            defaultCenter={center}
            defaultZoom={13}
            gestureHandling={'greedy'}
            disableDefaultUI={true}
          >
            {/* Mock markers for mechanics and services */}
            <Marker position={{ lat: 51.5174, lng: -0.1178 }} title="Mechanic Nearby" />
            <Marker position={{ lat: 51.4974, lng: -0.1378 }} title="Plumber Nearby" />
          </Map>
        </APIProvider>

        {/* Floating controls */}
        <div className="absolute bottom-8 right-6 space-y-3">
           <button className="w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center text-slate-600">
              <Navigation size={20} />
           </button>
           <button className="w-12 h-12 bg-slate-900 text-white rounded-full shadow-lg flex items-center justify-center">
              <MapPin size={20} />
           </button>
        </div>
      </div>

      <div className="p-6 bg-white rounded-t-[40px] shadow-[0_-10px_25px_rgba(0,0,0,0.05)] -mt-10 relative z-20">
         <div className="w-12 h-1.5 bg-slate-100 rounded-full mx-auto mb-6"></div>
         <h3 className="font-bold text-lg mb-4">Recommended for you</h3>
         <div className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-2xl flex items-center justify-between">
               <div>
                  <p className="font-bold text-sm">Best Rated Mechanic</p>
                  <p className="text-xs text-slate-500">0.8 miles away • London Central</p>
               </div>
               <button className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold">Details</button>
            </div>
         </div>
      </div>
    </div>
  );
}

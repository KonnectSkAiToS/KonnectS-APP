export interface Worker {
  id: string;
  name: string;
  role: string;
  locationName: string;
  rating: number;
  reviews: number;
  price: number;
  status: 'available' | 'busy';
  category: string;
  verified: boolean;
  lat?: number;
  lng?: number;
  bio?: string;
}

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
  bio?: string;
  isDynamic?: boolean;
}

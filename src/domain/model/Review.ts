export interface Review {
  id: string;
  tripId: string;
  passengerId: string;
  rating: number; // 1..5
  tags: string[];
  comment: string;
  createdAt: number;
}

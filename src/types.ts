export interface PartReplacement {
  id: string;
  name: string;
  boughtFrom: string;
  price: number;
}

export interface PhotoItem {
  id: string;
  base64Data: string;
  mimeType: string;
  category: 'front' | 'back' | 'invoice' | 'work_done' | 'touch_up' | 'other';
  uploadedAt: string;
  notes?: string;
  isUploading?: boolean;
}

export interface HistoryItem {
  id: string;
  timestamp: string;
  action: string;
  user: string;
  details?: string;
}

export interface ChecklistItem {
  name: string;
  category: 'Interior' | 'Exterior' | 'Under Bonnet' | 'Under Vehicle';
  status: 'pass' | 'fail' | 'unchecked';
  comments?: string;
}

export interface VanJob {
  id?: string; // Firestore document ID
  registrationPlate: string;
  yard: 'Armagh' | 'Banbridge';
  dateIn: string; // ISO string or YYYY-MM-DD
  make: string;
  model: string;
  color: string;
  driver?: string; // Driver name from fleet data
  mileage?: number | string; // Odometer / mileage reading
  status: 'pending' | 'in_progress' | 'completed' | 'released';
  repairDetails: string;
  parts: PartReplacement[];
  photos: PhotoItem[];
  checklist?: ChecklistItem[];
  history: HistoryItem[];
  createdAt: string;
  updatedAt: string;
}

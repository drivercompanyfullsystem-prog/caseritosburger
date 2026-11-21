import { ImageSourceType, ProductCategoryId } from '../constants/categories';

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number; // en Guaraníes (PYG)
  comboPrice?: number; // Precio en combo (Papa frita + gaseosa 250ml)
  category: ProductCategoryId;
  imageUrl: string;
  imageSource?: ImageSourceType;
  available: boolean;
  isPopular?: boolean;
  tags?: string[];
}

export interface CartItem {
  product: Product;
  quantity: number;
  instructions?: string;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy?: number; // precisión en metros
}

export type LocationState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; coordinates: Coordinates }
  | { status: 'error'; message: string };

export interface CustomerOrder {
  customerName: string;
  phoneNumber: string;
  deliveryMethod: 'delivery' | 'pickup';
  address?: string;
  manualMapsUrl?: string;
  coordinates?: Coordinates;
  references?: string;
  paymentMethod: 'Efectivo' | 'Transferencia' | 'POS';
  cashAmount?: string;
  notes?: string;
  items: CartItem[];
  totalPrice: number;
}

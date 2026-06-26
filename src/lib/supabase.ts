import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'employee';
  created_at: string;
  updated_at: string;
};

export type Client = {
  id: string;
  client_number: string;
  last_name: string;
  first_name: string;
  birth_date: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  country: string;
  phone: string | null;
  email: string | null;
  license_number: string | null;
  license_date: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Vehicle = {
  id: string;
  vehicle_number: string;
  brand: string;
  model: string;
  registration: string;
  vin: string | null;
  year: number | null;
  color: string | null;
  fuel_type: 'essence' | 'diesel' | 'electrique' | 'hybride' | 'autre' | null;
  transmission: 'manuelle' | 'automatique' | null;
  seats: number | null;
  daily_rate: number;
  hourly_rate: number;
  deposit_amount: number;
  mileage: number;
  status: 'available' | 'rented' | 'maintenance' | 'inactive';
  category: 'economique' | 'compacte' | 'berline' | 'suv' | 'utilitaire' | 'premium' | 'vtc' | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Reservation = {
  id: string;
  reservation_number: string;
  client_id: string;
  vehicle_id: string;
  start_date: string;
  end_date: string;
  daily_rate: number;
  deposit_amount: number;
  total_amount: number | null;
  status: 'pending' | 'confirmed' | 'active' | 'completed' | 'cancelled';
  notes: string | null;
  created_at: string;
  updated_at: string;
  client?: Client;
  vehicle?: Vehicle;
};

export type AdditionalDriver = {
  first_name: string;
  last_name: string;
  birth_date: string;
  license_number: string;
  license_date: string;
};

export type Contract = {
  id: string;
  contract_number: string;
  reservation_id: string | null;
  client_id: string;
  vehicle_id: string;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  daily_rate: number;
  deposit_amount: number;
  mileage_limit: number | null;
  franchise_amount: number;
  additional_drivers: AdditionalDriver[];
  departure_location: string | null;
  return_location: string | null;
  options: string | null;
  client_signature: string | null;
  client_signed_at: string | null;
  pdf_url: string | null;
  status: 'draft' | 'signed' | 'active' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
  client?: Client;
  vehicle?: Vehicle;
  reservation?: Reservation;
};

export type Invoice = {
  id: string;
  invoice_number: string;
  contract_id: string | null;
  client_id: string;
  vehicle_id: string | null;
  issue_date: string;
  due_date: string | null;
  start_date: string | null;
  end_date: string | null;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  payment_date: string | null;
  payment_method: string | null;
  deposit_applied: boolean;
  deposit_amount_applied: number;
  notes: string | null;
  pdf_url: string | null;
  created_at: string;
  updated_at: string;
  client?: Client;
  vehicle?: Vehicle;
  contract?: Contract;
};

export type InvoiceItem = {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  created_at: string;
};

export type Inspection = {
  id: string;
  contract_id: string;
  vehicle_id: string;
  inspection_type: 'departure' | 'return';
  inspection_date: string;
  mileage: number | null;
  fuel_level: number | null;
  exterior_condition: 'excellent' | 'bon' | 'acceptable' | 'mauvais' | null;
  interior_condition: 'excellent' | 'bon' | 'acceptable' | 'mauvais' | null;
  damages: string | null;
  notes: string | null;
  client_signature: string | null;
  client_signed_at: string | null;
  pdf_url: string | null;
  created_at: string;
};

export type ClientDocument = {
  id: string;
  client_id: string;
  document_type: 'permis' | 'carte_identite' | 'passeport' | 'justificatif_domicile' | 'contrat' | 'caution' | 'autre';
  name: string;
  file_url: string;
  file_size: number | null;
  mime_type: string | null;
  expiry_date: string | null;
  version: number;
  notes: string | null;
  created_at: string;
};

export type VehicleDocument = {
  id: string;
  vehicle_id: string;
  document_type: 'carte_grise' | 'assurance' | 'controle_technique' | 'photo' | 'autre';
  name: string;
  file_url: string;
  expiry_date: string | null;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
};

export type Alert = {
  id: string;
  alert_type: 'insurance_expiry' | 'inspection_expiry' | 'maintenance' | 'invoice_overdue' | 'contract_ending';
  reference_type: 'vehicle' | 'contract' | 'invoice';
  reference_id: string | null;
  title: string;
  message: string | null;
  priority: 'low' | 'medium' | 'high';
  is_read: boolean;
  is_resolved: boolean;
  due_date: string | null;
  created_at: string;
  resolved_at: string | null;
};

export type CompanySettings = {
  id: string;
  company_name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  siret: string | null;
  logo_url: string | null;
  rate_per_km: number;
  created_at: string;
  updated_at: string;
};

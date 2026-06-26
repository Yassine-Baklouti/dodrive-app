-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create sequences first
CREATE SEQUENCE client_seq START 1;
CREATE SEQUENCE vehicle_seq START 1;
CREATE SEQUENCE reservation_seq START 1;
CREATE SEQUENCE contract_seq START 1;
CREATE SEQUENCE invoice_seq START 1;

-- Company settings table
CREATE TABLE company_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name TEXT NOT NULL DEFAULT 'DoDrive',
  address TEXT,
  phone TEXT,
  email TEXT,
  siret TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default company settings
INSERT INTO company_settings (company_name, address, phone, email, siret)
VALUES ('DoDrive', 'Adresse à compléter', 'Téléphone à compléter', 'contact@dodrive.fr', 'SIRET à compléter');

-- Profiles table (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('admin', 'employee')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Login history
CREATE TABLE login_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ip_address TEXT,
  user_agent TEXT,
  logged_in_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE login_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "login_history_select_own" ON login_history FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "login_history_insert_own" ON login_history FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

-- Clients table
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_number TEXT UNIQUE NOT NULL DEFAULT 'CLI-' || to_char(NOW(), 'YYYY') || '-' || LPAD(nextval('client_seq')::TEXT, 5, '0'),
  last_name TEXT NOT NULL,
  first_name TEXT NOT NULL,
  birth_date DATE,
  address TEXT,
  city TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'France',
  phone TEXT,
  email TEXT,
  license_number TEXT,
  license_date DATE,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clients_select_all" ON clients FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "clients_insert_all" ON clients FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "clients_update_all" ON clients FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "clients_delete_all" ON clients FOR DELETE
  TO authenticated USING (true);

-- Vehicles table
CREATE TABLE vehicles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_number TEXT UNIQUE NOT NULL DEFAULT 'VEH-' || to_char(NOW(), 'YYYY') || '-' || LPAD(nextval('vehicle_seq')::TEXT, 5, '0'),
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  registration TEXT UNIQUE NOT NULL,
  vin TEXT,
  year INTEGER,
  color TEXT,
  fuel_type TEXT CHECK (fuel_type IN ('essence', 'diesel', 'electrique', 'hybride', 'autre')),
  transmission TEXT CHECK (transmission IN ('manuelle', 'automatique')),
  seats INTEGER,
  daily_rate DECIMAL(10,2) NOT NULL DEFAULT 0,
  deposit_amount DECIMAL(10,2) DEFAULT 0,
  mileage INTEGER DEFAULT 0,
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'rented', 'maintenance', 'inactive')),
  category TEXT CHECK (category IN ('economique', 'compacte', 'berline', 'suv', 'utilitaire', 'premium', 'vtc')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vehicles_select_all" ON vehicles FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "vehicles_insert_all" ON vehicles FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "vehicles_update_all" ON vehicles FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "vehicles_delete_all" ON vehicles FOR DELETE
  TO authenticated USING (true);

-- Vehicle documents
CREATE TABLE vehicle_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('carte_grise', 'assurance', 'controle_technique', 'photo', 'autre')),
  name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  expiry_date DATE,
  file_size INTEGER,
  mime_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE vehicle_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vehicle_docs_select_all" ON vehicle_documents FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "vehicle_docs_insert_all" ON vehicle_documents FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "vehicle_docs_delete_all" ON vehicle_documents FOR DELETE
  TO authenticated USING (true);

-- Reservations table
CREATE TABLE reservations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reservation_number TEXT UNIQUE NOT NULL DEFAULT 'RES-' || to_char(NOW(), 'YYYY') || '-' || LPAD(nextval('reservation_seq')::TEXT, 5, '0'),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  daily_rate DECIMAL(10,2) NOT NULL,
  deposit_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'active', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reservations_select_all" ON reservations FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "reservations_insert_all" ON reservations FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "reservations_update_all" ON reservations FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "reservations_delete_all" ON reservations FOR DELETE
  TO authenticated USING (true);

-- Contracts table
CREATE TABLE contracts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_number TEXT UNIQUE NOT NULL DEFAULT 'CTR-' || to_char(NOW(), 'YYYY') || '-' || LPAD(nextval('contract_seq')::TEXT, 5, '0'),
  reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE RESTRICT,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  daily_rate DECIMAL(10,2) NOT NULL,
  deposit_amount DECIMAL(10,2) DEFAULT 0,
  mileage_limit INTEGER,
  franchise_amount DECIMAL(10,2) DEFAULT 0,
  client_signature TEXT,
  client_signed_at TIMESTAMPTZ,
  pdf_url TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'signed', 'active', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contracts_select_all" ON contracts FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "contracts_insert_all" ON contracts FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "contracts_update_all" ON contracts FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "contracts_delete_all" ON contracts FOR DELETE
  TO authenticated USING (true);

-- Invoices table
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number TEXT UNIQUE NOT NULL DEFAULT 'FAC-' || to_char(NOW(), 'YYYY') || '-' || LPAD(nextval('invoice_seq')::TEXT, 5, '0'),
  contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  start_date DATE,
  end_date DATE,
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  tax_rate DECIMAL(5,2) DEFAULT 20.00,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  payment_date DATE,
  payment_method TEXT,
  notes TEXT,
  pdf_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoices_select_all" ON invoices FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "invoices_insert_all" ON invoices FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "invoices_update_all" ON invoices FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "invoices_delete_all" ON invoices FOR DELETE
  TO authenticated USING (true);

-- Vehicle inspections
CREATE TABLE inspections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE RESTRICT,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
  inspection_type TEXT NOT NULL CHECK (inspection_type IN ('departure', 'return')),
  inspection_date TIMESTAMPTZ DEFAULT NOW(),
  mileage INTEGER,
  fuel_level INTEGER CHECK (fuel_level BETWEEN 0 AND 100),
  exterior_condition TEXT CHECK (exterior_condition IN ('excellent', 'bon', 'acceptable', 'mauvais')),
  interior_condition TEXT CHECK (interior_condition IN ('excellent', 'bon', 'acceptable', 'mauvais')),
  damages TEXT,
  notes TEXT,
  client_signature TEXT,
  client_signed_at TIMESTAMPTZ,
  pdf_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE inspections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inspections_select_all" ON inspections FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "inspections_insert_all" ON inspections FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "inspections_update_all" ON inspections FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "inspections_delete_all" ON inspections FOR DELETE
  TO authenticated USING (true);

-- Inspection photos
CREATE TABLE inspection_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  description TEXT,
  position TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE inspection_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inspection_photos_select_all" ON inspection_photos FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "inspection_photos_insert_all" ON inspection_photos FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "inspection_photos_delete_all" ON inspection_photos FOR DELETE
  TO authenticated USING (true);

-- Client documents
CREATE TABLE client_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('permis', 'carte_identite', 'passeport', 'justificatif_domicile', 'contrat', 'caution', 'autre')),
  name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  expiry_date DATE,
  version INTEGER DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE client_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_docs_select_all" ON client_documents FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "client_docs_insert_all" ON client_documents FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "client_docs_delete_all" ON client_documents FOR DELETE
  TO authenticated USING (true);

-- Alerts table
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alert_type TEXT NOT NULL CHECK (alert_type IN ('insurance_expiry', 'inspection_expiry', 'maintenance', 'invoice_overdue', 'contract_ending')),
  reference_type TEXT NOT NULL CHECK (reference_type IN ('vehicle', 'contract', 'invoice')),
  reference_id UUID,
  title TEXT NOT NULL,
  message TEXT,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  is_read BOOLEAN DEFAULT false,
  is_resolved BOOLEAN DEFAULT false,
  due_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alerts_select_all" ON alerts FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "alerts_insert_all" ON alerts FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "alerts_update_all" ON alerts FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "alerts_delete_all" ON alerts FOR DELETE
  TO authenticated USING (true);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_company_settings_updated_at BEFORE UPDATE ON company_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON vehicles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_reservations_updated_at BEFORE UPDATE ON reservations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_contracts_updated_at BEFORE UPDATE ON contracts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'), 'employee');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();
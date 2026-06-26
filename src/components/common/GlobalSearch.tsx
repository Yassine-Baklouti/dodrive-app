import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, X, Users, Truck, FileText, Receipt, CalendarDays } from 'lucide-react';
import type { Client, Vehicle, Contract, Invoice, Reservation } from '../../lib/supabase';

interface SearchResult {
  type: 'client' | 'vehicle' | 'contract' | 'invoice' | 'reservation';
  id: string;
  title: string;
  subtitle: string;
  number: string;
}

interface GlobalSearchProps {
  onSelect: (type: string, id: string) => void;
}

export function GlobalSearch({ onSelect }: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    const searchDelay = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => clearTimeout(searchDelay);
  }, [query]);

  const performSearch = async (searchQuery: string) => {
    setLoading(true);
    try {
      const term = `%${searchQuery.toLowerCase()}%`;

      const [clients, vehicles, contracts, invoices, reservations] = await Promise.all([
        supabase.from('clients').select('*').or(`last_name.ilike.${term},first_name.ilike.${term},client_number.ilike.${term},email.ilike.${term}`).limit(5),
        supabase.from('vehicles').select('*').or(`brand.ilike.${term},model.ilike.${term},registration.ilike.${term},vehicle_number.ilike.${term}`).limit(5),
        supabase.from('contracts').select('*, client:clients(first_name, last_name), vehicle:vehicles(brand, model)').or(`contract_number.ilike.${term}`).limit(5),
        supabase.from('invoices').select('*, client:clients(first_name, last_name)').or(`invoice_number.ilike.${term}`).limit(5),
        supabase.from('reservations').select('*, client:clients(first_name, last_name), vehicle:vehicles(brand, model, registration)').or(`reservation_number.ilike.${term}`).limit(5),
      ]);

      const searchResults: SearchResult[] = [];

      (clients.data || []).forEach((c: Client) => {
        searchResults.push({
          type: 'client',
          id: c.id,
          title: `${c.first_name} ${c.last_name}`,
          subtitle: c.email || c.phone || 'Client',
          number: c.client_number,
        });
      });

      (vehicles.data || []).forEach((v: Vehicle) => {
        searchResults.push({
          type: 'vehicle',
          id: v.id,
          title: `${v.brand} ${v.model}`,
          subtitle: v.registration,
          number: v.vehicle_number,
        });
      });

      (contracts.data || []).forEach((c: Contract & { client: { first_name: string; last_name: string }; vehicle: { brand: string; model: string } }) => {
        searchResults.push({
          type: 'contract',
          id: c.id,
          title: `${c.client?.first_name} ${c.client?.last_name}`,
          subtitle: `${c.vehicle?.brand} ${c.vehicle?.model}`,
          number: c.contract_number,
        });
      });

      (invoices.data || []).forEach((i: Invoice & { client: { first_name: string; last_name: string } }) => {
        searchResults.push({
          type: 'invoice',
          id: i.id,
          title: `${i.client?.first_name} ${i.client?.last_name}`,
          subtitle: `${i.total_amount.toLocaleString('fr-FR')} €`,
          number: i.invoice_number,
        });
      });

      (reservations.data || []).forEach((r: Reservation & { client: { first_name: string; last_name: string }; vehicle: { brand: string; model: string; registration: string } }) => {
        searchResults.push({
          type: 'reservation',
          id: r.id,
          title: `${r.client?.first_name} ${r.client?.last_name}`,
          subtitle: `${r.vehicle?.brand} ${r.vehicle?.model} - ${r.vehicle?.registration}`,
          number: r.reservation_number,
        });
      });

      setResults(searchResults);
      setShowResults(true);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'client':
        return <Users className="w-4 h-4 text-blue-600" />;
      case 'vehicle':
        return <Truck className="w-4 h-4 text-emerald-600" />;
      case 'contract':
        return <FileText className="w-4 h-4 text-purple-600" />;
      case 'invoice':
        return <Receipt className="w-4 h-4 text-amber-600" />;
      case 'reservation':
        return <CalendarDays className="w-4 h-4 text-rose-600" />;
      default:
        return <Search className="w-4 h-4 text-slate-400" />;
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      client: 'Client',
      vehicle: 'Véhicule',
      contract: 'Contrat',
      invoice: 'Facture',
      reservation: 'Réservation',
    };
    return labels[type] || type;
  };

  const handleSelect = (result: SearchResult) => {
    onSelect(result.type, result.id);
    setQuery('');
    setShowResults(false);
    inputRef.current?.blur();
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Rechercher clients, véhicules, factures..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.length >= 2 && setShowResults(true)}
          className="input pl-9 pr-8 w-64 lg:w-96"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setResults([]);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {showResults && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg border border-slate-200 shadow-lg max-h-96 overflow-y-auto z-50">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Search className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p>Aucun résultat</p>
            </div>
          ) : (
            <div className="py-1">
              {results.map((result) => (
                <button
                  key={`${result.type}-${result.id}`}
                  onClick={() => handleSelect(result)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                    {getTypeIcon(result.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900 truncate">{result.title}</span>
                      <span className="text-xs text-slate-400">{getTypeLabel(result.type)}</span>
                    </div>
                    <div className="text-sm text-slate-500 truncate">{result.subtitle}</div>
                  </div>
                  <span className="text-xs font-mono text-slate-400">{result.number}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

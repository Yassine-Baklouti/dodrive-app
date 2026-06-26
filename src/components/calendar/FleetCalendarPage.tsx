import { useEffect, useState, useRef } from 'react';
import { supabase, Vehicle, Reservation, Contract, Client } from '../../lib/supabase';
import { ChevronLeft, ChevronRight, CalendarDays, Circle } from 'lucide-react';

interface Booking {
  id: string;
  vehicle_id: string;
  start_date: string;
  end_date: string;
  type: 'reservation' | 'contract';
  status: string;
  client_name: string;
  color: string;
  textColor: string;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  // reservations
  pending:   { bg: '#fde68a', text: '#92400e' },
  confirmed: { bg: '#fed7aa', text: '#9a3412' },
  active:    { bg: '#bfdbfe', text: '#1e40af' },
  // contracts
  draft:     { bg: '#e2e8f0', text: '#475569' },
  signed:    { bg: '#c7d2fe', text: '#3730a3' },
  // active contract shares the reservation-active color
  completed: { bg: '#bbf7d0', text: '#166534' },
  cancelled: { bg: '#fee2e2', text: '#991b1b' },
};

const LEGEND = [
  { label: 'Réservation en attente', ...STATUS_COLORS.pending },
  { label: 'Réservation confirmée', ...STATUS_COLORS.confirmed },
  { label: 'Contrat actif', ...STATUS_COLORS.active },
  { label: 'Contrat terminé', ...STATUS_COLORS.completed },
];

function addDays(date: Date, n: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toYMD(d: Date) {
  return d.toISOString().split('T')[0];
}

export function FleetCalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-indexed
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<{ booking: Booking; x: number; y: number } | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(year, month, i + 1);
    return { date: d, ymd: toYMD(d), dayNum: i + 1, dow: d.getDay() };
  });

  const monthStart = toYMD(new Date(year, month, 1));
  const monthEnd = toYMD(new Date(year, month, daysInMonth));

  useEffect(() => {
    loadData();
  }, [year, month]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [vehiclesRes, reservationsRes, contractsRes] = await Promise.all([
        supabase.from('vehicles').select('id, brand, model, registration, status').order('brand').order('model'),
        supabase
          .from('reservations')
          .select('id, vehicle_id, start_date, end_date, status, client:clients(first_name, last_name)')
          .not('status', 'in', '("cancelled")')
          .lte('start_date', monthEnd)
          .gte('end_date', monthStart),
        supabase
          .from('contracts')
          .select('id, vehicle_id, start_date, end_date, status, client:clients(first_name, last_name)')
          .not('status', 'in', '("cancelled","draft")')
          .lte('start_date', monthEnd)
          .gte('end_date', monthStart),
      ]);

      setVehicles(vehiclesRes.data || []);

      const allBookings: Booking[] = [];

      (reservationsRes.data || []).forEach((r) => {
        const cl = (r as any).client;
        const name = cl ? `${cl.first_name} ${cl.last_name}`.trim() : '—';
        const colors = STATUS_COLORS[r.status] || STATUS_COLORS.pending;
        allBookings.push({
          id: r.id,
          vehicle_id: r.vehicle_id,
          start_date: r.start_date,
          end_date: r.end_date,
          type: 'reservation',
          status: r.status,
          client_name: name,
          color: colors.bg,
          textColor: colors.text,
        });
      });

      (contractsRes.data || []).forEach((c) => {
        const cl = (c as any).client;
        const name = cl ? `${cl.first_name} ${cl.last_name}`.trim() : '—';
        const colors = STATUS_COLORS[c.status] || STATUS_COLORS.active;
        allBookings.push({
          id: c.id,
          vehicle_id: c.vehicle_id,
          start_date: c.start_date,
          end_date: c.end_date,
          type: 'contract',
          status: c.status,
          client_name: name,
          color: colors.bg,
          textColor: colors.text,
        });
      });

      setBookings(allBookings);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };

  // For each vehicle+day, find the booking with highest priority
  const bookingGrid = new Map<string, Booking>();
  const bookingStartGrid = new Map<string, Booking>();

  bookings.forEach((b) => {
    // Clamp to visible month
    const start = b.start_date > monthStart ? b.start_date : monthStart;
    const end = b.end_date < monthEnd ? b.end_date : monthEnd;
    const startD = new Date(start + 'T00:00:00');
    const endD = new Date(end + 'T00:00:00');

    let cur = new Date(startD);
    let isFirst = true;
    while (cur <= endD) {
      const key = `${b.vehicle_id}:${toYMD(cur)}`;
      if (!bookingGrid.has(key)) {
        bookingGrid.set(key, b);
        if (isFirst) {
          bookingStartGrid.set(key, b);
          isFirst = false;
        }
      }
      cur = addDays(cur, 1);
    }
    // Mark first visible day
    const firstKey = `${b.vehicle_id}:${start}`;
    bookingStartGrid.set(firstKey, b);
  });

  const monthLabel = new Date(year, month, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const todayYMD = toYMD(today);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Calendrier flotte</h1>
          <p className="text-slate-500 mt-1">Vue globale des réservations et contrats</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
            <ChevronLeft className="w-4 h-4 text-slate-600" />
          </button>
          <span className="min-w-[160px] text-center font-semibold text-slate-800 capitalize">{monthLabel}</span>
          <button onClick={nextMonth} className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
            <ChevronRight className="w-4 h-4 text-slate-600" />
          </button>
          <button
            onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); }}
            className="ml-2 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
          >
            Aujourd'hui
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {LEGEND.map(l => (
          <div key={l.label} className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: l.bg, border: `1px solid ${l.text}40` }} />
            {l.label}
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : vehicles.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <CalendarDays className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p>Aucun véhicule enregistré</p>
        </div>
      ) : (
        <div ref={tableRef} className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse" style={{ tableLayout: 'fixed', minWidth: `${200 + daysInMonth * 36}px` }}>
              <thead>
                <tr>
                  <th
                    className="sticky left-0 z-20 bg-slate-50 border-b border-r border-slate-200 text-left px-3 py-2 font-semibold text-slate-700"
                    style={{ width: 200, minWidth: 200 }}
                  >
                    Véhicule
                  </th>
                  {days.map(({ dayNum, ymd, dow }) => {
                    const isToday = ymd === todayYMD;
                    const isWeekend = dow === 0 || dow === 6;
                    return (
                      <th
                        key={ymd}
                        className={`border-b border-r border-slate-200 text-center py-1 font-medium ${
                          isToday
                            ? 'bg-blue-600 text-white'
                            : isWeekend
                            ? 'bg-slate-100 text-slate-500'
                            : 'bg-slate-50 text-slate-600'
                        }`}
                        style={{ width: 36, minWidth: 36 }}
                      >
                        <div>{dayNum}</div>
                        <div className="text-[10px] font-normal opacity-70">
                          {new Date(year, month, dayNum).toLocaleDateString('fr-FR', { weekday: 'narrow' })}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {vehicles.map((vehicle, vi) => (
                  <tr key={vehicle.id} className={vi % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                    <td
                      className="sticky left-0 z-10 border-r border-b border-slate-100 px-3 py-2 font-medium text-slate-800"
                      style={{ backgroundColor: vi % 2 === 0 ? 'white' : 'rgb(248 250 252 / 0.5)', width: 200, minWidth: 200 }}
                    >
                      <div className="truncate">{vehicle.brand} {vehicle.model}</div>
                      <div className="text-[10px] text-slate-400 font-normal font-mono">{vehicle.registration}</div>
                    </td>
                    {days.map(({ ymd, dow }) => {
                      const key = `${vehicle.id}:${ymd}`;
                      const booking = bookingGrid.get(key);
                      const isStart = bookingStartGrid.get(key) === booking && booking !== undefined;
                      const isToday = ymd === todayYMD;
                      const isWeekend = dow === 0 || dow === 6;

                      return (
                        <td
                          key={ymd}
                          className={`border-r border-b border-slate-100 p-0 relative ${
                            isToday ? 'ring-1 ring-inset ring-blue-400' : ''
                          } ${!booking && isWeekend ? 'bg-slate-50/70' : ''}`}
                          style={{ width: 36, height: 36 }}
                          onMouseEnter={(e) => {
                            if (booking) {
                              const rect = (e.target as HTMLElement).closest('td')!.getBoundingClientRect();
                              const containerRect = tableRef.current!.getBoundingClientRect();
                              setTooltip({
                                booking,
                                x: rect.left - containerRect.left + rect.width / 2,
                                y: rect.top - containerRect.top,
                              });
                            }
                          }}
                          onMouseLeave={() => setTooltip(null)}
                        >
                          {booking && (
                            <div
                              className="absolute inset-0.5 rounded-sm flex items-center overflow-hidden cursor-default"
                              style={{ backgroundColor: booking.color }}
                            >
                              {isStart && (
                                <span
                                  className="truncate px-1 text-[10px] font-semibold leading-tight whitespace-nowrap"
                                  style={{ color: booking.textColor }}
                                >
                                  {booking.client_name}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Tooltip */}
          {tooltip && (
            <div
              className="absolute z-50 pointer-events-none bg-slate-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl -translate-x-1/2 -translate-y-full -mt-2 whitespace-nowrap"
              style={{ left: tooltip.x, top: tooltip.y - 8 }}
            >
              <p className="font-semibold">{tooltip.booking.client_name}</p>
              <p className="text-slate-300 mt-0.5">
                {tooltip.booking.type === 'contract' ? 'Contrat' : 'Réservation'}
                {' · '}
                {tooltip.booking.status}
              </p>
              <p className="text-slate-400 mt-0.5">
                {new Date(tooltip.booking.start_date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                {' → '}
                {new Date(tooltip.booking.end_date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

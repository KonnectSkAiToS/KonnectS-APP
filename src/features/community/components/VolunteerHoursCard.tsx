import { useState } from 'react';
import { useVolunteerHours } from '../hooks/useVolunteerHours';

export function VolunteerHoursCard({ charities }: { charities: string[] }) {
  const { entries, approvedHours, pendingHours, loading, logHours } = useVolunteerHours();
  const [charity, setCharity] = useState(charities[0] ?? '');
  const [hours, setHours] = useState('');
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await logHours(charity, Number(hours));
      setHours('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log hours');
    }
  };

  return (
    <div className="mt-6 p-4 bg-white rounded-2xl border border-slate-100">
      <h3 className="font-bold text-lg mb-1">Volunteer Hours</h3>
      <p className="text-xs text-slate-500 mb-3">
        {loading ? 'Loading…' : `${approvedHours}h approved · ${pendingHours}h pending`}
      </p>
      <form onSubmit={submit} className="flex gap-2">
        <select value={charity} onChange={e => setCharity(e.target.value)} className="flex-1 text-xs p-2 rounded-xl border border-slate-200">
          {charities.map(c => <option key={c}>{c}</option>)}
        </select>
        <input value={hours} onChange={e => setHours(e.target.value)} inputMode="decimal" placeholder="Hours" className="w-20 text-xs p-2 rounded-xl border border-slate-200" />
        <button className="px-3 text-xs font-bold bg-slate-900 text-white rounded-xl">Log</button>
      </form>
      {error && <p className="text-xs text-rose-600 mt-2">{error}</p>}
      <ul className="mt-3 space-y-1">
        {entries.slice(0, 5).map(e => (
          <li key={e.id} className="text-xs text-slate-600 flex justify-between">
            <span>{e.charityName}</span><span>{e.hours}h · {e.status}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

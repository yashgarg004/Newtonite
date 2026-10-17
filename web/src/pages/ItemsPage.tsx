import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useItems } from '../api/items';
import { ErrorBanner } from '../components/ErrorBanner';
import { ApiError } from '../api/client';

export function ItemsPage() {
  const [teamId, setTeamId] = useState('');
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [error, setError] = useState<ApiError | null>(null);

  // Idempotency key for create form
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const { data, isLoading, refetch } = useItems({ teamId: teamId || undefined, status: status || undefined, q: q || undefined, cursor, limit: 25 });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsCreating(true);
    try {
      // Assuming a createItem mutation or direct fetch for simplicity here
      // In a full app, this would be a useCreateItem hook matching the optimistic pattern
      await fetch('/api/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({ teamId: '10000000-0000-4000-8000-000000000001', title: newTitle, type: 'task' }), // Hardcoded team for demo
      }).then(async res => {
        if (!res.ok) {
          const body = await res.json();
          throw new ApiError(res.status, body.error.code, body.error.message, body.error.details);
        }
        setNewTitle('');
        refetch();
      });
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Work Items</h2>
      
      <ErrorBanner error={error} onDismiss={() => setError(null)} onReload={() => refetch()} />

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
        <input placeholder="Search (q)" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="awaiting_approval">Awaiting Approval</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
        <button onClick={() => { setCursor(undefined); refetch(); }}>Apply Filters</button>
      </div>

      <form onSubmit={handleCreate} style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #eee' }}>
        <h4>Create Item</h4>
        <input 
          value={newTitle} 
          onChange={(e) => setNewTitle(e.target.value)} 
          placeholder="Item title" 
          required 
          style={{ marginRight: '0.5rem' }} 
        />
        <button type="submit" disabled={isCreating}>
          {isCreating ? 'Creating...' : 'Create'}
        </button>
      </form>

      {isLoading ? (
        <div>Loading items...</div>
      ) : (
        <>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {data?.items.map((item) => (
              <li key={item.id} style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>
                <Link to={`/items/${item.id}`}>{item.title}</Link> - {item.status} - v{item.version}
              </li>
            ))}
          </ul>
          {data?.nextCursor && (
            <button onClick={() => { setCursor(data.nextCursor!); refetch(); }} style={{ marginTop: '1rem' }}>
              Load More
            </button>
          )}
        </>
      )}
    </div>
  );
}
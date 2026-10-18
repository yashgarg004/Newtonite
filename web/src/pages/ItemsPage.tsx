import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useItems, useCreateItem, WorkItem } from '../api/items';
import { useAuth } from '../auth/AuthProvider';
import { ErrorBanner } from '../components/ErrorBanner';
import { ApiError } from '../api/client';

export function ItemsPage() {
  const { user } = useAuth();
  
  // Available teams for the user
  const teams = user?.teams ?? [];
  const defaultTeamId = teams[0]?.id || '10000000-0000-4000-8000-000000000001';

  // Filter state
  const [teamId, setTeamId] = useState(defaultTeamId);
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [appliedQ, setAppliedQ] = useState('');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [error, setError] = useState<ApiError | null>(null);

  // Accumulated items across pagination pages
  const [itemsList, setItemsList] = useState<WorkItem[]>([]);

  // Create form state
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [createTeamId, setCreateTeamId] = useState(defaultTeamId);
  const [createTitle, setCreateTitle] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createType, setCreateType] = useState('task');
  const [createPriority, setCreatePriority] = useState('medium');

  // Update default team when user loads
  useEffect(() => {
    if (teams.length > 0 && !teams.some((t) => t.id === teamId)) {
      const first = teams[0];
      if (first) {
        setTeamId(first.id);
        setCreateTeamId(first.id);
      }
    }
  }, [teams, teamId]);

  const { data, isLoading, isFetching, refetch } = useItems({
    teamId: teamId || undefined,
    status: status || undefined,
    priority: priority || undefined,
    q: appliedQ || undefined,
    cursor,
    limit: 25,
  });

  // When data updates, accumulate or replace
  useEffect(() => {
    if (data?.items) {
      if (!cursor) {
        setItemsList(data.items);
      } else {
        setItemsList((prev) => {
          const existingIds = new Set(prev.map((i) => i.id));
          const newItems = data.items.filter((i) => !existingIds.has(i.id));
          return [...prev, ...newItems];
        });
      }
    }
  }, [data, cursor]);

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCursor(undefined);
    setAppliedQ(searchInput.trim());
  };

  const createMutation = useCreateItem((err) => setError(err));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createTitle.trim()) return;
    setError(null);

    createMutation.mutate(
      {
        teamId: createTeamId,
        title: createTitle.trim(),
        description: createDesc.trim() || undefined,
        type: createType,
        priority: createPriority,
        idempotencyKey,
      },
      {
        onSuccess: () => {
          setCreateTitle('');
          setCreateDesc('');
          // Cycle to a fresh idempotency key for the next request
          setIdempotencyKey(crypto.randomUUID());
          setCursor(undefined);
          refetch();
        },
      },
    );
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0 }}>Work Items</h2>
        <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>
          Idempotency Key: <code style={{ fontSize: '0.8rem' }}>{idempotencyKey.slice(0, 8)}...</code>
        </span>
      </div>

      <ErrorBanner
        error={error}
        onDismiss={() => setError(null)}
        onReload={() => {
          setError(null);
          refetch();
        }}
      />

      {/* Filter and Search Bar */}
      <form
        onSubmit={handleFilterSubmit}
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.75rem',
          padding: '1rem',
          backgroundColor: '#f9fafb',
          borderRadius: '6px',
          marginBottom: '1.5rem',
          border: '1px solid #e5e7eb',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#4b5563', marginBottom: '0.25rem' }}>Team</label>
          <select
            value={teamId}
            onChange={(e) => {
              setTeamId(e.target.value);
              setCursor(undefined);
            }}
            style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
          >
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.role})
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#4b5563', marginBottom: '0.25rem' }}>Status</label>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setCursor(undefined);
            }}
            style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
          >
            <option value="">All Statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="awaiting_approval">Awaiting Approval</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#4b5563', marginBottom: '0.25rem' }}>Priority</label>
          <select
            value={priority}
            onChange={(e) => {
              setPriority(e.target.value);
              setCursor(undefined);
            }}
            style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
          >
            <option value="">All Priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: '200px' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#4b5563', marginBottom: '0.25rem' }}>Search</label>
          <input
            type="text"
            placeholder="Search title and description..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem' }}>
          <button
            type="submit"
            style={{
              padding: '0.45rem 1rem',
              backgroundColor: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Filter
          </button>
          {(status || priority || appliedQ) && (
            <button
              type="button"
              onClick={() => {
                setStatus('');
                setPriority('');
                setSearchInput('');
                setAppliedQ('');
                setCursor(undefined);
              }}
              style={{
                padding: '0.45rem 0.75rem',
                backgroundColor: '#e5e7eb',
                color: '#374151',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Clear
            </button>
          )}
        </div>
      </form>

      {/* Create New Item Section */}
      <details
        style={{
          marginBottom: '2rem',
          padding: '1rem',
          backgroundColor: '#fff',
          borderRadius: '6px',
          border: '1px solid #e5e7eb',
        }}
      >
        <summary style={{ fontWeight: 600, cursor: 'pointer', color: '#1f2937' }}>+ Create New Work Item</summary>
        <form onSubmit={handleCreate} style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.25rem' }}>Team</label>
              <select
                value={createTeamId}
                onChange={(e) => setCreateTeamId(e.target.value)}
                style={{ width: '100%', padding: '0.4rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ width: '140px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.25rem' }}>Type</label>
              <select
                value={createType}
                onChange={(e) => setCreateType(e.target.value)}
                style={{ width: '100%', padding: '0.4rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
              >
                <option value="task">Task</option>
                <option value="incident">Incident</option>
                <option value="customer_issue">Customer Issue</option>
                <option value="payment">Payment</option>
                <option value="compliance">Compliance</option>
              </select>
            </div>
            <div style={{ width: '140px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.25rem' }}>Priority</label>
              <select
                value={createPriority}
                onChange={(e) => setCreatePriority(e.target.value)}
                style={{ width: '100%', padding: '0.4rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.25rem' }}>Title</label>
            <input
              type="text"
              value={createTitle}
              onChange={(e) => setCreateTitle(e.target.value)}
              placeholder="Summary of the issue or task"
              required
              style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.25rem' }}>Description</label>
            <textarea
              value={createDesc}
              onChange={(e) => setCreateDesc(e.target.value)}
              placeholder="Additional background context and steps to reproduce..."
              rows={3}
              style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={createMutation.isPending}
              style={{
                padding: '0.5rem 1.25rem',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: createMutation.isPending ? 'not-allowed' : 'pointer',
                fontWeight: 600,
              }}
            >
              {createMutation.isPending ? 'Submitting...' : 'Submit Work Item'}
            </button>
          </div>
        </form>
      </details>

      {/* Items List */}
      {isLoading && itemsList.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>Loading items...</div>
      ) : itemsList.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280', border: '1px dashed #d1d5db', borderRadius: '6px' }}>
          No work items found matching your filters.
        </div>
      ) : (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              <tr>
                <th style={{ padding: '0.75rem 1rem' }}>Title</th>
                <th style={{ padding: '0.75rem 1rem' }}>Type</th>
                <th style={{ padding: '0.75rem 1rem' }}>Priority</th>
                <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                <th style={{ padding: '0.75rem 1rem' }}>Version</th>
                <th style={{ padding: '0.75rem 1rem' }}>Created</th>
              </tr>
            </thead>
            <tbody>
              {itemsList.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <Link to={`/items/${item.id}`} style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}>
                      {item.title}
                    </Link>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', textTransform: 'capitalize', color: '#4b5563' }}>{item.type.replace('_', ' ')}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span
                      style={{
                        padding: '0.2rem 0.5rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        backgroundColor:
                          item.priority === 'urgent'
                            ? '#fee2e2'
                            : item.priority === 'high'
                            ? '#ffedd5'
                            : item.priority === 'medium'
                            ? '#fef3c7'
                            : '#f3f4f6',
                        color:
                          item.priority === 'urgent'
                            ? '#991b1b'
                            : item.priority === 'high'
                            ? '#9a3412'
                            : item.priority === 'medium'
                            ? '#92400e'
                            : '#374151',
                      }}
                    >
                      {item.priority}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span
                      style={{
                        padding: '0.2rem 0.5rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        backgroundColor:
                          item.status === 'resolved' || item.status === 'closed'
                            ? '#d1fae5'
                            : item.status === 'in_progress'
                            ? '#dbeafe'
                            : item.status === 'awaiting_approval'
                            ? '#ede9fe'
                            : '#f3f4f6',
                        color:
                          item.status === 'resolved' || item.status === 'closed'
                            ? '#065f46'
                            : item.status === 'in_progress'
                            ? '#1e40af'
                            : item.status === 'awaiting_approval'
                            ? '#5b21b6'
                            : '#374151',
                      }}
                    >
                      {item.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', color: '#6b7280', fontSize: '0.8rem' }}>v{item.version}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#6b7280', fontSize: '0.8rem' }}>
                    {new Date(item.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data?.nextCursor && (
        <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
          <button
            onClick={() => setCursor(data.nextCursor!)}
            disabled={isFetching}
            style={{
              padding: '0.5rem 1.5rem',
              backgroundColor: '#fff',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              cursor: isFetching ? 'not-allowed' : 'pointer',
              fontWeight: 500,
            }}
          >
            {isFetching ? 'Loading more...' : 'Load More Items'}
          </button>
        </div>
      )}
    </div>
  );
}
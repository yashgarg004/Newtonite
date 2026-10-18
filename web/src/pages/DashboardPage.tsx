import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { Link } from 'react-router-dom';

interface WorkItemSummary {
  id: string;
  team_id: string;
  title: string;
  status: string;
  priority: string;
  assignee_id: string | null;
  created_at: string;
}

interface DashboardData {
  assignedToMe: WorkItemSummary[];
  unassignedUrgent: WorkItemSummary[];
  awaitingApproval: WorkItemSummary[];
  recentlyResolved: WorkItemSummary[];
}

export function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => apiFetch<DashboardData>('/dashboard'),
  });

  if (isLoading) return <div>Loading dashboard...</div>;
  if (error) return <div role="alert">Failed to load dashboard.</div>;

  const renderList = (title: string, items: WorkItemSummary[]) => (
    <div style={{ marginBottom: '2rem' }}>
      <h3>{title}</h3>
      {items.length === 0 ? (
        <p>No items.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {items.map((item) => (
            <li key={item.id} style={{ padding: '0.5rem 0', borderBottom: '1px solid #eee' }}>
              <Link to={`/items/${item.id}`} style={{ textDecoration: 'none', color: '#2563eb' }}>
                {item.title}
              </Link>
              <span style={{ marginLeft: '0.5rem', fontSize: '0.85em', color: '#666' }}>
                ({item.priority}, {item.status})
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h2>Dashboard</h2>
      {renderList('Assigned to Me', data?.assignedToMe || [])}
      {renderList('Unassigned Urgent', data?.unassignedUrgent || [])}
      {renderList('Awaiting My Approval', data?.awaitingApproval || [])}
      {renderList('Recently Resolved', data?.recentlyResolved || [])}
    </div>
  );
}
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useItem, useActivity, useClaimItem, useTransitionItem, useUpdateItem, useAddComment } from '../api/items';
import { ErrorBanner } from '../components/ErrorBanner';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthProvider';

export function ItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const { data: item, isLoading, refetch } = useItem(id!);
  const { data: activity } = useActivity(id!);
  
  const [error, setError] = useState<ApiError | null>(null);
  const [commentBody, setCommentBody] = useState('');

  // Editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editPriority, setEditPriority] = useState('');

  const handleError = (err: ApiError) => {
    setError(err);
    if (err.code === 'VERSION_CONFLICT' || err.code === 'ALREADY_CLAIMED') {
      refetch();
    }
  };

  const claimMutation = useClaimItem(handleError, user?.id || '');
  const transitionMutation = useTransitionItem(handleError);
  const updateMutation = useUpdateItem(handleError);
  const commentMutation = useAddComment(handleError);

  if (isLoading) return <div style={{ padding: '2rem' }}>Loading item...</div>;
  if (!item) return <div style={{ padding: '2rem' }}>Item not found.</div>;

  const startEditing = () => {
    setEditTitle(item.title);
    setEditDesc(item.description);
    setEditPriority(item.priority);
    setIsEditing(true);
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(
      {
        id: item.id,
        version: item.version,
        title: editTitle,
        description: editDesc,
        priority: editPriority,
      },
      {
        onSuccess: () => {
          setIsEditing(false);
          setError(null);
        },
      }
    );
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <button onClick={() => navigate('/items')} style={{ marginBottom: '1rem', cursor: 'pointer' }}>
        &larr; Back to Items
      </button>
      
      <ErrorBanner 
        error={error} 
        onDismiss={() => setError(null)} 
        onReload={() => { setError(null); refetch(); }} 
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2>{item.title} <span style={{ fontSize: '0.7em', color: '#666' }}>(v{item.version})</span></h2>
          <p>
            <strong>Status:</strong> <span style={{ textTransform: 'capitalize' }}>{item.status.replace('_', ' ')}</span> |{' '}
            <strong>Priority:</strong> <span style={{ textTransform: 'capitalize' }}>{item.priority}</span> |{' '}
            <strong>Type:</strong> <span style={{ textTransform: 'capitalize' }}>{item.type.replace('_', ' ')}</span>
          </p>
          <p><strong>Assignee:</strong> {item.assignee_id ? `Assigned (${item.assignee_id.slice(0, 8)}...)` : 'Unassigned'}</p>
          <p style={{ marginTop: '1rem', whiteSpace: 'pre-wrap' }}>{item.description || 'No description provided.'}</p>
        </div>
        {!isEditing && (
          <button onClick={startEditing} style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>
            Edit
          </button>
        )}
      </div>

      {isEditing && (
        <form onSubmit={handleUpdate} style={{ marginTop: '1.5rem', padding: '1rem', border: '1px solid #ccc', borderRadius: '4px' }}>
          <h4>Edit Item (v{item.version})</h4>
          <div style={{ marginBottom: '0.75rem' }}>
            <label style={{ display: 'block', marginBottom: '0.25rem' }}>Title:</label>
            <input 
              value={editTitle} 
              onChange={(e) => setEditTitle(e.target.value)} 
              required 
              style={{ width: '100%', padding: '0.5rem' }} 
            />
          </div>
          <div style={{ marginBottom: '0.75rem' }}>
            <label style={{ display: 'block', marginBottom: '0.25rem' }}>Description:</label>
            <textarea 
              value={editDesc} 
              onChange={(e) => setEditDesc(e.target.value)} 
              rows={3} 
              style={{ width: '100%', padding: '0.5rem' }} 
            />
          </div>
          <div style={{ marginBottom: '0.75rem' }}>
            <label style={{ display: 'block', marginBottom: '0.25rem' }}>Priority:</label>
            <select value={editPriority} onChange={(e) => setEditPriority(e.target.value)} style={{ padding: '0.5rem' }}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="submit" disabled={updateMutation.isPending} style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
            <button type="button" onClick={() => setIsEditing(false)} style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '4px', border: '1px solid #e5e7eb' }}>
        <h3>Workflow Actions</h3>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {!item.assignee_id && item.status === 'open' && (
            <button 
              onClick={() => claimMutation.mutate(item.id)}
              disabled={claimMutation.isPending}
              style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}
            >
              {claimMutation.isPending ? 'Claiming...' : 'Claim Item'}
            </button>
          )}
          
          {item.status === 'in_progress' && (
            <button 
              onClick={() => transitionMutation.mutate({ id: item.id, to: 'awaiting_approval', version: item.version })}
              disabled={transitionMutation.isPending}
              style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}
            >
              {transitionMutation.isPending ? 'Submitting...' : 'Submit for Approval'}
            </button>
          )}

          {item.status === 'awaiting_approval' && (
            <>
              <button 
                onClick={() => transitionMutation.mutate({ id: item.id, to: 'resolved', version: item.version })}
                disabled={transitionMutation.isPending}
                style={{ padding: '0.5rem 1rem', cursor: 'pointer', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '4px' }}
              >
                Approve (Resolve)
              </button>
              <button 
                onClick={() => transitionMutation.mutate({ id: item.id, to: 'in_progress', version: item.version })}
                disabled={transitionMutation.isPending}
                style={{ padding: '0.5rem 1rem', cursor: 'pointer', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '4px' }}
              >
                Reject (Back to In Progress)
              </button>
            </>
          )}

          {item.status === 'resolved' && (
            <button 
              onClick={() => transitionMutation.mutate({ id: item.id, to: 'closed', version: item.version })}
              disabled={transitionMutation.isPending}
              style={{ padding: '0.5rem 1rem', cursor: 'pointer', backgroundColor: '#4b5563', color: 'white', border: 'none', borderRadius: '4px' }}
            >
              Close Item
            </button>
          )}

          {item.status === 'closed' && (
            <span style={{ color: '#6b7280', fontStyle: 'italic' }}>This work item is closed and cannot be transitioned further.</span>
          )}
        </div>
      </div>

      <div style={{ marginTop: '2rem' }}>
        <h3>Activity History & Comments</h3>
        {activity && activity.length === 0 && <p style={{ color: '#666' }}>No activity recorded yet.</p>}
        {activity?.map((ev) => (
          <div key={ev.id.toString()} style={{ padding: '0.5rem 0', borderBottom: '1px solid #eee' }}>
            <span style={{ fontWeight: 'bold' }}>{ev.event_type.replace('_', ' ')}</span>{' '}
            <span style={{ color: '#666', fontSize: '0.85em' }}>
              by {ev.actor_id ? `${ev.actor_id.slice(0, 8)}...` : 'System'} at {new Date(ev.created_at).toLocaleString()}
            </span>
            {ev.from_value && ev.to_value && (
              <div style={{ fontSize: '0.9em', color: '#444' }}>
                Changed from <code>{ev.from_value}</code> to <code>{ev.to_value}</code>
              </div>
            )}
          </div>
        ))}

        <form 
          onSubmit={(e) => {
            e.preventDefault();
            if (!commentBody.trim()) return;
            commentMutation.mutate({ id: item.id, body: commentBody }, {
              onSuccess: () => setCommentBody('')
            });
          }}
          style={{ marginTop: '1.5rem' }}
        >
          <textarea 
            value={commentBody} 
            onChange={(e) => setCommentBody(e.target.value)} 
            placeholder="Write a comment..." 
            rows={3} 
            style={{ width: '100%', marginBottom: '0.5rem', padding: '0.5rem' }} 
          />
          <button type="submit" disabled={commentMutation.isPending} style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>
            {commentMutation.isPending ? 'Posting...' : 'Post Comment'}
          </button>
        </form>
      </div>
    </div>
  );
}

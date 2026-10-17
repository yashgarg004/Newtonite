import React, { useState } from 'react';
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

  if (isLoading) return <div>Loading item...</div>;
  if (!item) return <div>Item not found.</div>;

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <button onClick={() => navigate(-1)}>&larr; Back</button>
      
      <ErrorBanner 
        error={error} 
        onDismiss={() => setError(null)} 
        onReload={() => { setError(null); refetch(); }} 
      />

      <h2>{item.title} <span style={{ fontSize: '0.8em', color: '#666' }}>(v{item.version})</span></h2>
      <p><strong>Status:</strong> {item.status} | <strong>Priority:</strong> {item.priority}</p>
      <p><strong>Assignee:</strong> {item.assignee_id || 'Unassigned'}</p>
      <p>{item.description}</p>

      <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '4px' }}>
        <h3>Actions</h3>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {!item.assignee_id && item.status === 'open' && (
            <button 
              onClick={() => claimMutation.mutate(item.id)}
              disabled={claimMutation.isPending}
            >
              {claimMutation.isPending ? 'Claiming...' : 'Claim Item'}
            </button>
          )}
          
          {item.status === 'in_progress' && (
            <button 
              onClick={() => transitionMutation.mutate({ id: item.id, to: 'awaiting_approval', version: item.version })}
              disabled={transitionMutation.isPending}
            >
              {transitionMutation.isPending ? 'Transitioning...' : 'Submit for Approval'}
            </button>
          )}

          {item.status === 'awaiting_approval' && (
            <>
              <button 
                onClick={() => transitionMutation.mutate({ id: item.id, to: 'resolved', version: item.version })}
                disabled={transitionMutation.isPending}
              >
                Approve (Resolve)
              </button>
              <button 
                onClick={() => transitionMutation.mutate({ id: item.id, to: 'in_progress', version: item.version })}
                disabled={transitionMutation.isPending}
              >
                Reject (Back to In Progress)
              </button>
            </>
          )}
        </div>
      </div>

      <div style={{ marginTop: '2rem' }}>
        <h3>Activity & Comments</h3>
        {activity?.map((ev) => (
          <div key={ev.id.toString()} style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>
            <strong>{ev.event_type}</strong> by {ev.actor_id ? 'User' : 'System'} at {new Date(ev.created_at).toLocaleString()}
            {ev.from_value && ev.to_value && <span>: {ev.from_value} &rarr; {ev.to_value}</span>}
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
          style={{ marginTop: '1rem' }}
        >
          <textarea 
            value={commentBody} 
            onChange={(e) => setCommentBody(e.target.value)} 
            placeholder="Add a comment..." 
            rows={3} 
            style={{ width: '100%', marginBottom: '0.5rem' }} 
          />
          <button type="submit" disabled={commentMutation.isPending}>
            {commentMutation.isPending ? 'Posting...' : 'Post Comment'}
          </button>
        </form>
      </div>
    </div>
  );
}
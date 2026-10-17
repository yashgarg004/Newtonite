import { Routes, Route, Navigate } from 'react-router-dom';

function Placeholder({ title }: { title: string }) {
  return <div style={{ padding: '2rem' }}><h1>{title}</h1><p>Coming in Task 7</p></div>;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Placeholder title="Login" />} />
      <Route path="/dashboard" element={<Placeholder title="Dashboard" />} />
      <Route path="/items" element={<Placeholder title="Work Items" />} />
      <Route path="/items/:id" element={<Placeholder title="Item Detail" />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

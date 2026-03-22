import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface User {
  id: number;
  username: string;
  displayName: string | null;
  role: string;
}

export function DashboardPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.success) setUser(d.data.user);
        else navigate('/');
      })
      .catch(() => navigate('/'));
  }, [navigate]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    navigate('/');
  };

  if (!user) return <div className="p-8 text-center text-gray-500">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-indigo-600">Obligate</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">
            {user.displayName || user.username}
            {user.role === 'admin' && (
              <span className="ml-2 text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">admin</span>
            )}
          </span>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-8">
        <h2 className="text-2xl font-semibold mb-6">Dashboard</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <DashCard title="Connected Apps" description="Manage applications connected to Obligate" />
          <DashCard title="Permission Groups" description="Configure role and access mappings" />
          <DashCard title="Users" description="Manage user accounts and group assignments" />
        </div>
      </main>
    </div>
  );
}

function DashCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="bg-white rounded-xl border p-6 hover:shadow-md transition-shadow cursor-pointer">
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <p className="text-gray-500 text-sm">{description}</p>
    </div>
  );
}

import { Outlet, Link } from 'react-router-dom';

export function MainLayout() {
  return (
    <div>
      <nav>
        <Link to="/">Dashboard</Link>
        <Link to="/transactions">Transactions</Link>
        <Link to="/settings">Settings</Link>
      </nav>
      <main>
        <Outlet />
      </main>
    </div>
  );
}

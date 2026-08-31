import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MainLayout } from '@/components/layouts/MainLayout';
import { AuthLayout } from '@/components/layouts/AuthLayout';
import { Login } from '@/components/screens/Login';
import { Dashboard } from '@/components/screens/Dashboard';
import { Transactions } from '@/components/screens/Transactions';
import { Wallets } from '@/components/screens/Wallets';
import { Categories } from '@/components/screens/Categories';
import { Reports } from '@/components/screens/Reports';
import { Settings } from '@/components/screens/Settings';

const queryClient = new QueryClient();

const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    path: '/',
    element: <AuthLayout />,
    children: [
      {
        element: <MainLayout />,
        children: [
          { index: true, element: <Dashboard /> },
          { path: 'transactions', element: <Transactions /> },
          { path: 'wallets', element: <Wallets /> },
          { path: 'categories', element: <Categories /> },
          { path: 'reports', element: <Reports /> },
          { path: 'settings', element: <Settings /> },
        ],
      },
    ],
  },
]);

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}

export default App;

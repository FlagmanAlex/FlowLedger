import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { MainLayout } from '@/components/layouts/MainLayout';
import { Dashboard } from '@/components/screens/Dashboard';
import { Transactions } from '@/components/screens/Transactions';
import { Settings } from '@/components/screens/Settings';
import { transactionsAction } from '@/routes/transactions.action';

const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      {
        path: 'transactions',
        element: <Transactions />,
        action: transactionsAction,
      },
      { path: 'settings', element: <Settings /> },
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;

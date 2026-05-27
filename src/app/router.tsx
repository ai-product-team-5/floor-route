import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from './AppShell';
import { AccountPage } from '../pages/AccountPage';
import { HelpPage } from '../pages/HelpPage';
import { HistoryPage } from '../pages/HistoryPage';
import { HomePage } from '../pages/HomePage';
import { PurchaseHistoryPage } from '../pages/PurchaseHistoryPage';
import { UpdatePage } from '../pages/UpdatePage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      {
        index: true,
        element: <Navigate to="/home" replace />,
      },
      {
        path: 'home',
        element: <HomePage />,
      },
      {
        path: 'history',
        element: <HistoryPage />,
      },
      {
        path: 'account',
        element: <AccountPage />,
      },
      {
        path: 'help',
        element: <HelpPage />,
      },
      {
        path: 'purchase-history',
        element: <PurchaseHistoryPage />,
      },
      {
        path: 'update',
        element: <UpdatePage />,
      },
      {
        path: '*',
        element: <Navigate to="/home" replace />,
      },
    ],
  },
]);

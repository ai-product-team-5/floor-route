import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from './AppShell';
import { AccountPage } from '../pages/AccountPage';
import { HistoryPage } from '../pages/HistoryPage';
import { HomePage } from '../pages/HomePage';

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
        path: '*',
        element: <Navigate to="/home" replace />,
      },
    ],
  },
]);

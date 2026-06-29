import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CharacterProvider } from './context/CharacterContext';
import { CampaignProvider } from './context/CampaignContext';
import LandingPage    from './pages/LandingPage';
import AuthPage       from './pages/AuthPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import CharacterSelect from './pages/CharacterSelect';
import CharacterSetup from './pages/CharacterSetup';
import GameView       from './pages/GameView';
import CampaignsPage  from './pages/CampaignsPage';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',color:'var(--text-secondary)'}}>Loading...</div>;
  return user ? children : <Navigate to="/auth" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/"        element={<LandingPage />} />
      <Route path="/auth"    element={<AuthPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/characters" element={<PrivateRoute><CharacterSelect /></PrivateRoute>} />
      <Route path="/setup"   element={<PrivateRoute><CharacterSetup /></PrivateRoute>} />
      <Route path="/play/:id" element={<PrivateRoute><GameView /></PrivateRoute>} />
      <Route path="/campaigns" element={<PrivateRoute><CampaignsPage /></PrivateRoute>} />
      <Route path="*"        element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <CampaignProvider>
        <CharacterProvider>
          <AppRoutes />
        </CharacterProvider>
      </CampaignProvider>
    </AuthProvider>
  );
}

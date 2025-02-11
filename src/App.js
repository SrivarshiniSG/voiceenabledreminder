import React from 'react';
import './App.css';
import MedicationReminder from './components/MedicationReminder';
import Login from './components/Login';
import { AuthProvider, useAuth } from './context/AuthContext';

const AppContent = () => {
  const { user } = useAuth();
  return user ? <MedicationReminder /> : <Login />;
};

const App = () => {
  return (
    <AuthProvider>
      <div className="App">
        <AppContent />
      </div>
    </AuthProvider>
  );
};

export default App;

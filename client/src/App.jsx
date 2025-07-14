import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Home from './pages/Home';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Protected from './components/Protected';

export default function App() {
  return (
    <div className="w-full h-screen">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/register" element={<Register />} />
            <Route path="/dashboard" element={
              <Protected>
                <Dashboard />
              </Protected>
            } />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}
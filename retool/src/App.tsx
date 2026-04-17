import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ReToolProvider } from './context/ReToolContext';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Dispositivos } from './pages/Dispositivos';
import { DispositivoForm } from './pages/DispositivoForm';
import { DispositivoDetails } from './pages/DispositivoDetails';
import { Categorias } from './pages/Categorias';
import { Utilizacoes } from './pages/Utilizacoes';

function App() {
  return (
    <ReToolProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            
            <Route path="dispositivos" element={<Dispositivos />}>
              <Route path="novo" element={<DispositivoForm />} />
              <Route path=":id/editar" element={<DispositivoForm />} />
            </Route>
            
            <Route path="dispositivos/:id" element={<DispositivoDetails />} />
            
            <Route path="categorias" element={<Categorias />} />
            <Route path="utilizacoes" element={<Utilizacoes />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ReToolProvider>
  );
}

export default App;

import React from 'react';
import { createRoot } from 'react-dom/client';
import './estilo.css';
import { AoVivo } from '../src/components/admin/AoVivo';
createRoot(document.getElementById('r')!).render(<AoVivo />);

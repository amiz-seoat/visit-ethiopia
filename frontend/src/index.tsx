import React from 'react';
import './index.css';
import { render } from 'react-dom';
import { App } from './App';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { installImageFallback } from './utils/imageFallback';

installImageFallback();

render(
  <ThemeProvider>
    <AuthProvider>
      <App />
    </AuthProvider>
  </ThemeProvider>,
  document.getElementById('root')
);

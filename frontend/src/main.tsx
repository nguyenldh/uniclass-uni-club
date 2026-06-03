import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { IconSprites } from './design-system/icons';
import './design-system/index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <IconSprites />
    <App />
  </React.StrictMode>,
);

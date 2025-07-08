import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import './index.css'

import Homepage from './Homepage'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Homepage />
    </BrowserRouter>
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => console.log("SW registered", reg))
      .catch((err) => console.error("SW registration failed", err));
  });
}

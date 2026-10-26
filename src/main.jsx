import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import App from './App'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {import.meta.env.VITE_DEMO === '1'
      ? <HashRouter><App /></HashRouter>
      : <BrowserRouter><App /></BrowserRouter>}
  </React.StrictMode>
)

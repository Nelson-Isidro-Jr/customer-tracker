import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { applyCachedTheme } from './theme'
import './index.css'

// Paint the last-used theme before the first frame so there is no color flash
applyCachedTheme()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

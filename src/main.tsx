import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Workbench } from './workbench/Workbench'
import { TimelinePage } from './pages/TimelinePage'
import { Dashboard } from './pages/Dashboard'
import { EventAnalysisPage } from './pages/EventAnalysisPage'
import { CostDebugPage } from './pages/CostDebugPage'
import { ProjectProvider } from './context/ProjectContext'
import { ThemeProvider } from './context/ThemeContext'
import './index.css'

// Dev-only flag: conditionally register Cost Debug route
// The page itself also checks this flag and shows a disabled message if accessed in production
const SHOW_COST_DEBUG = import.meta.env.MODE === 'development';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <ProjectProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/workbench" element={<Workbench />} />
            <Route path="/timeline" element={<TimelinePage />} />
            <Route path="/event-analysis" element={<EventAnalysisPage />} />
            {SHOW_COST_DEBUG && <Route path="/cost-debug" element={<CostDebugPage />} />}
          </Routes>
        </BrowserRouter>
      </ProjectProvider>
    </ThemeProvider>
  </React.StrictMode>,
)


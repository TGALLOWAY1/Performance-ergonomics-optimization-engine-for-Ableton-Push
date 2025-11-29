import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Workbench } from './workbench/Workbench'
import { TimelinePage } from './pages/TimelinePage'
import { Dashboard } from './pages/Dashboard'
import { EventAnalysisPage } from './pages/EventAnalysisPage'
import { ProjectProvider } from './context/ProjectContext'
import { ThemeProvider } from './context/ThemeContext'
import './index.css'

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
          </Routes>
        </BrowserRouter>
      </ProjectProvider>
    </ThemeProvider>
  </React.StrictMode>,
)


import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Workbench } from './workbench/Workbench'
import { TimelinePage } from './pages/TimelinePage'
import { ProjectProvider } from './context/ProjectContext'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ProjectProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Workbench />} />
          <Route path="/timeline" element={<TimelinePage />} />
        </Routes>
      </BrowserRouter>
    </ProjectProvider>
  </React.StrictMode>,
)


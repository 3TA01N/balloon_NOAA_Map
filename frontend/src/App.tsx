
import './App.css'
import HomeDashboard from './pages/homeDashboard'
import {BrowserRouter as Router, Routes, Route } from 'react-router-dom';

function App() {

  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomeDashboard />} />
      </Routes>
    </Router>
  )
}

export default App

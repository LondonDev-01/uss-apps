import React from 'react'
import { Routes, Route, Link } from 'react-router-dom'
import Home from './pages/home'
import Auth from './pages/auth'
import Account from './pages/account'
import Admin from './pages/admin'

export default function App(){
  return (
    <div style={{padding:20}}>
      <nav>
        <Link to="/">Home</Link> | <Link to="/auth">Auth</Link> | <Link to="/account">Account</Link>
      </nav>
      <Routes>
        <Route path="/" element={<Home/>} />
        <Route path="/auth" element={<Auth/>} />
        <Route path="/account" element={<Account/>} />
        <Route path="/admin" element={<Admin/>} />
      </Routes>
    </div>
  )
}

import React, { useState } from 'react'

export default function Admin(){
  const [adminKey, setAdminKey] = useState('')
  const [username, setUsername] = useState('')
  const [days, setDays] = useState(365)
  const [keys, setKeys] = useState<any[]>([])
  const [error, setError] = useState('')

  const list = async () => {
    setError('')
    try{
      const resp = await fetch(`/keys?username=${encodeURIComponent(username)}`, { headers: {'X-ADMIN-KEY': adminKey} })
      if(!resp.ok) throw new Error(await resp.text())
      const data = await resp.json()
      setKeys(data)
    }catch(e:any){ setError(String(e)) }
  }

  const gen = async () => {
    setError('')
    try{
      const resp = await fetch('/keys', { method: 'POST', headers: {'Content-Type':'application/json','X-ADMIN-KEY': adminKey}, body: JSON.stringify({username, days}) })
      if(!resp.ok) throw new Error(await resp.text())
      const data = await resp.json()
      setKeys(prev => [data, ...prev])
    }catch(e:any){ setError(String(e)) }
  }

  const del = async (k:string) => {
    setError('')
    try{
      const resp = await fetch('/keys/'+encodeURIComponent(k), { method: 'DELETE', headers: {'X-ADMIN-KEY': adminKey} })
      if(!resp.ok) throw new Error(await resp.text())
      setKeys(prev => prev.filter(x=>x.key!==k))
    }catch(e:any){ setError(String(e)) }
  }

  return (
    <div style={{padding:20}}>
      <h2>Admin - Gestión de claves temporales</h2>
      <p>este panel se conecta a <code>http://localhost:8001</code> admin API. Define `ADMIN_KEY` en el servidor y ponlo aquí para autorizar.</p>
      <div style={{display:'flex',gap:10}}>
        <input placeholder="Admin Key" value={adminKey} onChange={e=>setAdminKey(e.target.value)} style={{width:380}} />
        <input placeholder="Usuario" value={username} onChange={e=>setUsername(e.target.value)} />
        <input placeholder="Días" value={String(days)} onChange={e=>setDays(Number(e.target.value))} style={{width:80}} />
        <button onClick={list}>Listar</button>
        <button onClick={gen}>Generar</button>
      </div>

      {error && <div style={{color:'red'}}>{error}</div>}

      <table style={{width:'100%', marginTop:10}}>
        <thead><tr><th>Key</th><th>User</th><th>Valid until</th><th></th></tr></thead>
        <tbody>
          {keys.map(k => (
            <tr key={k.key}>
              <td style={{fontFamily:'monospace'}}>{k.key}</td>
              <td>{k.user||'-'}</td>
              <td>{k.valid_until||'-'}</td>
              <td><button onClick={()=>del(k.key)}>Eliminar</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

"use client"

import { useState } from "react"

export default function Home() {

  const [file, setFile] = useState(null)
  const [msg, setMsg] = useState("")

  async function handleUpload() {
    const formData = new FormData()
    formData.append("file", file)

    const res = await fetch("http://localhost:8000/upload", {
      method: "POST",
      body: formData
    })

    const data = await res.json()
    setMsg(data.message)
  }

  return (
    <div>
      <h1>DARS Uploader</h1>
      <input type="file" onChange={e => setFile(e.target.files[0])} />
      <button onClick={handleUpload} disabled={!file}>Upload</button>
      <p>{msg}</p>
    </div>
  )
}

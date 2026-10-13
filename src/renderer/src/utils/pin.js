// The Points Check exit PIN is stored only as a SHA-256 hash in settings
export async function hashPin(pin) {
  const data = new TextEncoder().encode(`ct-pin:${String(pin)}`)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
}

export const isValidPin = pin => /^\d{4,8}$/.test(String(pin || ''))

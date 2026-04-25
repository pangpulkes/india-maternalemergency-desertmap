export interface Facility {
  name: string
  city: string
  state: string
  latitude: number
  longitude: number
  has_emergency_ob: boolean
  trust_score: number
  evidence: string[]
  red_flags: string[]
  reasoning: string
  phone: string | null
}

export interface StateData {
  state: string
  total_facilities: number
  verified: number
  gaps: number
  gap_rate: number
  latitude: number
  longitude: number
}

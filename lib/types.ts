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

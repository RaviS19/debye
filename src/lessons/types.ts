import type { ReactNode } from 'react'
import type { Flashcard, Problem } from '../components/Learning'

export interface Lesson {
  id: string
  title: string
  subtitle: string
  minutes: number
  refs: string[]
  objectives: string[]
  sections: { id: string; label: string }[]
  body: () => ReactNode
  problems: Problem[]
  cards: Flashcard[]
}

export interface ModuleInfo {
  id: string
  track: 'L' | 'A' | 'B' | 'C'
  title: string
  prereqs: string[]
}

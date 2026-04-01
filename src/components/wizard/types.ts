import type { ReactNode } from 'react'

export type WizardContextValue<T extends Record<string, unknown>> = {
  currentStepIndex: number
  totalSteps: number
  wizardData: T
  setWizardData: (data: T) => void
  updateWizardData: (updates: Partial<T>) => void
  goNext: () => void
  goBack: () => void
  goToStep: (index: number) => void
  cancel: () => void
  title?: string
  showStepCounter: boolean
}

export type WizardProviderProps<T extends Record<string, unknown>> = {
  steps: Array<React.ComponentType<any>>
  initialData?: T
  onComplete: (data: T) => void | Promise<void>
  onCancel?: () => void
  children?: ReactNode
  title?: string
  showStepCounter?: boolean
}
export type WizardStepComponent = any;

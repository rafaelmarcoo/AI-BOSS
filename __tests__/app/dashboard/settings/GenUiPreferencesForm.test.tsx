import { fireEvent, render, screen } from '@testing-library/react'
import { GenUiPreferencesForm } from '@/app/dashboard/settings/GenUiPreferencesForm'
import type { GenUiPersonalization } from '@/lib/gen-ui/preferences-types'

const basePreferences: GenUiPersonalization = {
  businessSize: 'medium',
  canEditBusinessSize: true,
  decisionRole: 'owner',
  priorityTopics: ['cash_runway'],
  detailLevel: 'balanced',
  planningHorizon: 6,
  learnFromHistory: false,
}

describe('GenUiPreferencesForm account-type controls', () => {
  it('shows shared company controls to admins', () => {
    render(<GenUiPreferencesForm initialPreferences={basePreferences} />)

    expect(screen.getByText('Company profile')).toBeInTheDocument()
    expect(screen.getByLabelText('Company planning horizon')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Medium business' })).toBeInTheDocument()
  })

  it('hides shared controls and shows worker roles to workers', () => {
    render(
      <GenUiPreferencesForm
        initialPreferences={{
          ...basePreferences,
          canEditBusinessSize: false,
          decisionRole: 'accountant',
        }}
      />
    )

    expect(screen.queryByText('Company profile')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Company planning horizon')).not.toBeInTheDocument()
    expect(screen.queryByText('Learn from my recent questions')).not.toBeInTheDocument()
    fireEvent.mouseDown(screen.getByLabelText('Your decision role'))
    expect(screen.getByRole('option', { name: 'Finance team member' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Operations or team lead' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'General team member' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Owner or founder' })).not.toBeInTheDocument()
  })
})

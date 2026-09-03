import { render, screen } from '@testing-library/react'
import { GenUiCanvas } from '@/app/dashboard/runway/gen-ui/GenUiCanvas'

describe('GenUiCanvas right rail', () => {
  it('shows only generated-widget context and follow-ups when no plan exists', () => {
    render(
      <GenUiCanvas
        plan={null}
        onAskChatbot={jest.fn()}
      />
    )

    expect(screen.getByText('Generated workspace')).toBeInTheDocument()
    expect(screen.getByText('Ask a follow-up')).toBeInTheDocument()
    expect(screen.queryByText('Runway summary')).not.toBeInTheDocument()
    expect(screen.queryByText('Financial metrics')).not.toBeInTheDocument()
    expect(screen.queryByText('Why this matters')).not.toBeInTheDocument()
    expect(screen.queryByText('Feature testing context')).not.toBeInTheDocument()
    expect(screen.queryByText('Financial trend and forecast')).not.toBeInTheDocument()
  })
})

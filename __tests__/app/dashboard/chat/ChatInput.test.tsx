import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChatInput } from '@/app/dashboard/chat/ChatInput'

describe('ChatInput', () => {
  it('uploads the selected document file', async () => {
    const onUploadDocument = jest.fn().mockResolvedValue(undefined)
    const file = new File(['metric,value\ncash,1000'], 'metrics.csv', {
      type: 'text/csv',
    })

    const { container } = render(
      <ChatInput onSend={jest.fn()} onUploadDocument={onUploadDocument} />
    )

    const input = container.querySelector('input[type="file"]')
    expect(input).toBeInTheDocument()

    await userEvent.upload(input as HTMLInputElement, file)

    await waitFor(() => {
      expect(onUploadDocument).toHaveBeenCalledWith(file)
    })
  })

  it('does not open file selection while upload is disabled', () => {
    const { container } = render(
      <ChatInput
        onSend={jest.fn()}
        onUploadDocument={jest.fn()}
        uploadDisabled
      />
    )
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    const clickSpy = jest.spyOn(input, 'click')

    fireEvent.click(screen.getByLabelText('Upload document'))

    expect(clickSpy).not.toHaveBeenCalled()
  })
})

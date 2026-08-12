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

  it('defaults to company visibility and lets an employee choose private', async () => {
    const user = userEvent.setup()
    const onVisibilityChange = jest.fn()
    render(
      <ChatInput
        onSend={jest.fn()}
        onUploadDocument={jest.fn()}
        userType="employee"
        visibility="company"
        onVisibilityChange={onVisibilityChange}
      />
    )

    await user.click(
      screen.getByRole('button', { name: 'Chat visibility: Company' })
    )
    expect(screen.queryByText('Admins only')).not.toBeInTheDocument()
    await user.click(screen.getByText('Private'))

    expect(onVisibilityChange).toHaveBeenCalledWith('private')
  })

  it('shows admins-only visibility to company admins', async () => {
    const user = userEvent.setup()
    const onVisibilityChange = jest.fn()
    render(
      <ChatInput
        onSend={jest.fn()}
        onUploadDocument={jest.fn()}
        userType="admin"
        visibility="company"
        onVisibilityChange={onVisibilityChange}
      />
    )

    await user.click(
      screen.getByRole('button', { name: 'Chat visibility: Company' })
    )
    await user.click(screen.getByText('Admins only'))

    expect(onVisibilityChange).toHaveBeenCalledWith('admins')
  })
})

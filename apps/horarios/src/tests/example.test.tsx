import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import Home from '../pages/home'

describe('Home', () => {
  it('renders welcome text', () => {
    const { getByText } = render(<Home />)
    expect(getByText(/Bienvenido/i)).toBeTruthy()
  })
})

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import '@testing-library/jest-dom';
import Home from '../page';

describe('Home Page Foundation', () => {
  it('renders application foundation title and status', () => {
    render(<Home />);
    expect(screen.getByText('blr.life')).toBeInTheDocument();
    expect(screen.getByText('Bengaluru, made easier.')).toBeInTheDocument();
    expect(screen.getByText('Application foundation is running.')).toBeInTheDocument();
  });
});

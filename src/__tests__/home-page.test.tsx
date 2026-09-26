import { render, screen } from '@testing-library/react';

import HomePage from '../app/page';

describe('HomePage', () => {
  it('renders the placeholder heading', () => {
    render(<HomePage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Focus Forest Admin' })).toBeDefined();
  });
});

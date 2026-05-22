import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

// Un composant simple pour tester si l'environnement fonctionne
const HelloWorld = () => <div>Hello World</div>;

describe('Basic Setup Test', () => {
  it('should render Hello World', () => {
    render(<HelloWorld />);
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });
});

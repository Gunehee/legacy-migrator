/** Proves the dual-target harness: @app resolves, JSX-in-.js transforms, jsdom renders. */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import commonReducer from '@app/reducers/common';
import Banner from '@app/components/Home/Banner';

describe('harness smoke', () => {
  it('reduces APP_LOAD on the real reducer from @app', () => {
    const state = commonReducer(undefined, { type: 'APP_LOAD', token: 't', payload: { user: { username: 'u' } } });
    expect(state).toMatchObject({ appName: 'Conduit', token: 't', appLoaded: true, currentUser: { username: 'u' } });
  });

  it('renders a real component from @app under jsdom', () => {
    render(<Banner appName="Conduit" token={null} />);
    expect(screen.getByText('conduit')).toBeInTheDocument();
    expect(screen.getByText('A place to share your knowledge.')).toBeInTheDocument();
  });
});

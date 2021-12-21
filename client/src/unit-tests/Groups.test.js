import React from 'react';
import { render } from '@testing-library/react';
import renderer from 'react-test-renderer';
import { BrowserRouter as Router } from 'react-router-dom';
import Groups from '../groups-page/Groups';

/**
 * @jest-environment jsdom
 */

const changeLink = jest.fn();

describe('Test Group Page UI', () => {
  test('Group page renders correctly', () => {
    const component = renderer.create(<Groups changeState={changeLink} state={{username: 'me'}} />);
    const tree = component.toJSON();
    expect(tree).toMatchSnapshot();
  });
});
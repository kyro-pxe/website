import { render } from 'preact';
import Generator from './Generator';

const root = document.getElementById('generator-app');
if (root) {
  root.replaceChildren();
  render(<Generator />, root);
}

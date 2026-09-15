import './index.css';
import 'antd/dist/reset.css';

import ReactDOM from 'react-dom/client';

import App from './App';
import { hydratePersistentRuntimeStorage } from './storage/runtime.storage';

const rootElement = document.getElementById('root');

const renderApp = () => {
  if (!rootElement) return;
  ReactDOM.createRoot(rootElement).render(<App />);
};

void hydratePersistentRuntimeStorage().finally(renderApp);

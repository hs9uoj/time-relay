import React from 'react';
import ReactDOM from 'react-dom/client';
import RelayControl from './RelayControl'; // Assuming RelayControl.js is in the same directory

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <RelayControl />
  </React.StrictMode>
);

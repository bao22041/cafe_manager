// frontend/src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// Vá lỗi "Failed to execute 'removeChild' on 'Node'" do xung đột Text Node trong React
if (typeof Node === 'function' && Node.prototype) {
  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function (child) {
    if (child.parentNode !== this) {
      if (console) {
        console.warn('Bỏ qua removeChild trên node không còn thuộc parent:', child, this);
      }
      return child;
    }
    return originalRemoveChild.apply(this, arguments);
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function (newNode, referenceNode) {
    if (referenceNode && referenceNode.parentNode !== this) {
      if (console) {
        console.warn('Bỏ qua insertBefore do referenceNode không thuộc parent:', referenceNode, this);
      }
      return newNode;
    }
    return originalInsertBefore.apply(this, arguments);
  };
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
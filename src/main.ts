import { App } from './App.js';

const app = new App(document.getElementById('app')!);
app.initialize().catch(err => {
  console.error('Failed to initialize monitor-forge:', err);
  document.getElementById('app')!.innerHTML = `
    <div style="padding: 2rem; color: #ff6b6b; font-family: monospace;">
      <h2>Initialization Error</h2>
      <p>${err.message}</p>
      <p>Make sure to run <code>forge build</code> to generate manifests.</p>
    </div>
  `;
});

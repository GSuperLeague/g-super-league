import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './LeagueApp';
import './styles.css';
import './analytics.css';
import './singles.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);

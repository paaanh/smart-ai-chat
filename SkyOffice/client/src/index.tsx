import React from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { ThemeProvider } from '@mui/material/styles'

import './index.scss'
import './PhaserGame'
import muiTheme from './MuiTheme'
import App from './App'
import store from './stores'

const ReduxProvider = Provider as unknown as React.ComponentType<
  React.PropsWithChildren<{ store: typeof store }>
>

const container = document.getElementById('root')
const root = createRoot(container!)
root.render(
  <React.StrictMode>
    <ReduxProvider store={store}>
      <ThemeProvider theme={muiTheme}>
        <App />
      </ThemeProvider>
    </ReduxProvider>
  </React.StrictMode>
)

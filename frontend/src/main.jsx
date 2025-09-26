import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from 'react-oidc-context';
import App from './App.jsx';
import './index.css';

// --- Authentication Configuration ---
// This setup uses environment variables to configure the connection to your Cognito User Pool.
// It ensures that your application knows where to send users to sign in and how to validate their session.

const cognitoAuthConfig = {
  // The 'authority' is the unique endpoint for your Cognito User Pool.
  authority: `https://cognito-idp.${import.meta.env.VITE_AWS_REGION}.amazonaws.com/${import.meta.env.VITE_COGNITO_USER_POOL_ID}`,
  
  // The 'client_id' is the unique identifier for your application within the User Pool.
  // This value MUST match the variable in your .env file.
  client_id: import.meta.env.VITE_COGNITO_CLIENT_ID,
  
  // 'redirect_uri' is the URL where Cognito will send the user back to after they sign in.
  redirect_uri: window.location.origin,
  
  // 'response_type' specifies that we are using the Authorization Code flow for security.
  response_type: 'code',
  
  // 'scope' defines what user information we are requesting access to.
  scope: 'openid email profile',
};

// --- Application Rendering ---
// We find the root HTML element and render our React application into it.
const rootElement = document.getElementById('root');
const root = createRoot(rootElement);

// By wrapping the <App /> component with <AuthProvider>, we make the authentication context
// (like user info and login status) available to all child components.
root.render(
  <StrictMode>
    <AuthProvider {...cognitoAuthConfig}>
      <App />
    </AuthProvider>
  </StrictMode>
);

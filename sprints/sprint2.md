# Sprint 2 — Frontend: PDF Viewer & Upload Flow

**Goal:** Build the user interface that allows an authenticated user to upload a PDF and view it in the browser. This sprint focuses on the core frontend functionality without any AI or voice integration.

**Date Completed:** September 26, 2025

---

## Summary of Work Completed

This sprint successfully delivered a functional React application with the following key features:

1.  **React Application Scaffolding:**
    * A new frontend application was created using **Vite** (`npm create vite@latest frontend -- --template react`), providing a fast and modern development environment.

2.  **User Authentication:**
    * Integrated the Cognito User Pool created in Sprint 1 using the `react-oidc-context` library.
    * The application now requires users to **Sign In** before accessing the main functionality.
    * Once authenticated, the UI displays a welcome message with the user's email.

3.  **PDF Upload Functionality:**
    * Created a `FileUpload.jsx` component that allows users to select a PDF file from their local machine.
    * This component securely uploads the file by first requesting a **presigned URL** from the backend Lambda and then sending the file directly to the S3 bucket.
    * User feedback is provided throughout the upload process.

4.  **PDF Viewing Functionality:**
    * Created a `PdfViewer.jsx` component using the `pdfjs-dist` library.
    * This component renders the pages of the uploaded PDF onto a `<canvas>` element.
    * Basic **pagination controls** (Previous/Next Page) have been implemented to navigate the document.

5.  **Component Integration & State Management:**
    * The main `App.jsx` component was refactored to manage the application's state, including the URL of the uploaded PDF and the user's authentication status.
    * It orchestrates the flow between the `FileUpload` and `PdfViewer` components.

6.  **Environment and Build Configuration:**
    * A `.env` file was configured in the project root to manage frontend-specific environment variables (e.g., Cognito IDs, API Gateway URL).
    * The `vite.config.js` file was updated to correctly load these variables and to target modern browsers, resolving initial build errors.

---

## How to Run the Frontend

### 1. Install Dependencies

Navigate to the `frontend` directory and install the required npm packages.

```bash
cd frontend
npm install
```

### 2\. Configure Environment Variables

Create a `.env` file in the **root directory** of your project (the same level as the `frontend` and `backend` folders). Copy the contents from `.env-example` and fill in your specific AWS resource details.

**File: `/.env`**

```bash
# Frontend Vite Environment Variables
# These MUST start with VITE_ to be exposed to the browser

# -- Cognito Details --
VITE_COGNITO_USER_POOL_ID="ap-south-1_rTpac4isd" # Your User Pool ID
VITE_COGNITO_CLIENT_ID="your_app_client_id"  # Your App Client ID
VITE_AWS_REGION="ap-south-1"

# -- API and S3 Details --
VITE_API_GATEWAY_ENDPOINT_URL="https://your-api-id.execute-api.ap-south-1.amazonaws.com/presign"
VITE_S3_BUCKET_NAME="pdf-talker-pds-your-suffix-pdfs"
```

### 3\. Start the Development Server

Once dependencies are installed and the environment is configured, run the development server.

```bash
# Make sure you are in the 'frontend' directory
npm run dev
```

The application will now be running on `http://localhost:3000` (or the next available port).

-----

## Sprint 2 Acceptance Criteria (Checklist)

  * [x] A user can visit the application and is prompted to **Sign In**.
  * [x] After signing in with a valid Cognito user, the user is redirected to the main application.
  * [x] The main UI displays a file upload area and an empty PDF viewing area.
  * [x] A user can select a **PDF file** and click "Upload."
  * [x] The selected PDF is successfully uploaded to the designated S3 bucket.
  * [x] After a successful upload, the PDF is rendered in the `PdfViewer` component.
  * [x] The user can navigate between the pages of the rendered PDF.
  * [x] A placeholder for the 3D avatar is visible on the page.

All acceptance criteria for Sprint 2 have been met. The project is now ready to proceed to Sprint 3: The PDF Ingestion Pipeline.
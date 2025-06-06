# Email Service Frontend

A React-based web interface for the Resilient Email Service, providing a modern and intuitive dashboard for managing email operations.

## Features

- **Send Single Email** - User-friendly form for sending individual emails
- **Bulk Email Sending** - Interface for sending multiple emails at once
- **Status Tracking** - Check the status of sent emails using idempotency keys
- **Service Health Monitoring** - Real-time dashboard showing service health and metrics
- **Responsive Design** - Works seamlessly on desktop and mobile devices
- **Material-UI Design** - Modern, professional interface with Material Design components

## Prerequisites

- Node.js 16+ and npm
- Running Email Service backend (see main README)

## Quick Start

1. **Install Dependencies**
   ```bash
   cd frontend
   npm install
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env to point to your backend API
   ```

3. **Start Development Server**
   ```bash
   npm start
   ```

The application will be available at `http://localhost:3001` (or another port if 3001 is busy).

## Environment Variables

Create a `.env` file in the frontend directory:

```env
REACT_APP_API_URL=http://localhost:3000/api
REACT_APP_DEBUG=false
REACT_APP_TITLE=Email Service Dashboard
```

## Application Structure

```
src/
├── components/          # Reusable UI components
│   └── Navbar.js       # Navigation bar
├── pages/              # Main application pages
│   ├── Home.js         # Dashboard home page
│   ├── SendEmail.js    # Single email sending form
│   ├── BulkEmail.js    # Bulk email interface
│   ├── StatusCheck.js  # Email status checker
│   └── ServiceHealth.js # Service monitoring dashboard
├── services/           # API communication
│   └── emailApi.js     # Backend API client
└── App.js             # Main application component
```

## Available Scripts

- `npm start` - Start development server
- `npm build` - Build for production
- `npm test` - Run tests
- `npm run eject` - Eject from Create React App

## Usage Guide

### Sending Email

1. Navigate to "Send Email" page
2. Fill in recipient email, subject, and message
3. Select priority level (High/Normal/Low)
4. Click "Send Email"
5. Note the idempotency key for status tracking

### Bulk Email

1. Go to "Bulk Email" page
2. Fill in details for multiple emails
3. Use "Add Another Email" to include more recipients
4. Click "Send" to process all emails
5. View results table showing success/failure status

### Status Checking

1. Visit "Status Check" page
2. Enter the idempotency key from a sent email
3. Click "Check" to see current status
4. Use "Refresh" to update the status

### Service Health

1. Access "Service Health" page for:
   - Overall service status
   - Email provider health
   - Circuit breaker states
   - Rate limiting information
   - Service metrics and statistics

## API Integration

The frontend communicates with the backend through RESTful APIs:

- `POST /api/email/send` - Send single email
- `POST /api/email/bulk-send` - Send bulk emails
- `GET /api/email/status/:key` - Get email status
- `GET /health` - Basic health check
- `GET /health/detailed` - Detailed health information

## Production Build

To create a production build:

```bash
npm run build
```

This creates a `build/` directory with optimized static files ready for deployment.

## Docker Support

The frontend can be containerized using the main project's Docker setup. See the main README for Docker deployment instructions.

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)

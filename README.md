# superblocks

---

superblocks is a modern web application built with Next.js that provides a powerful development environment with integrated WebContainer technology and AI. The platform offers an intuitive interface for building, testing, and collaborating on web projects with real-time browser-based development capabilities.

## TODO - Development Status

This project is currently in early development and requires significant work before being production-ready. Here are the key areas that need attention:

### Critical Integration Tasks

- **Terminal Integration**: Proper integration of XTerm.js with WebContainer for reliable command execution

### Feature Completion

- **Project Templates**: Add support for various project templates
- **Git Integration**: Implement full Git workflow support

## Features

### Core Features

- **Authentication**: Supports multiple authentication providers including GitHub, Google, and credentials-based login
- **Project Management**: Create and manage multiple UI projects
- **Team Collaboration**: Settings for team management and collaboration
- **Subscription Management**: Premium features with Polar integration for subscriptions

### WebContainer Integration

- **Browser-Based Development Environment**: Full development environment running directly in your browser
- **Real-time File System**: Live file system operations with automatic updates
- **Integrated Terminal**: Full-featured terminal emulation using XTerm.js
- **Monaco Editor Integration**: Advanced code editing capabilities
- **Live Preview**: Real-time preview of your web applications
- **File System Operations**: Complete file system capabilities including:
  - File creation and modification
  - Directory management
  - File watching for changes
  - Recursive file operations

### Development Features

- **AI-Powered Development**: Integrated AI capabilities for enhanced development experience
- **Command Execution**: Execute terminal commands directly in the browser
- **Multi-Terminal Support**: Work with multiple terminal instances
- **Project Hot-Reload**: Automatic updates as you modify code

## Tech Stack

### Frontend

- **Framework**: Next.js 14 with App Router
- **Styling**: Tailwind CSS
- **State Management**: Redux Toolkit
- **UI Components**: Headless UI
- **Animations**: Framer Motion
- **Data Fetching**: TanStack Query

### Development Environment

- **WebContainer**: @webcontainer/api for browser-based development
- **Terminal**: @xterm/xterm for terminal emulation
- **Editor**: Monaco Editor for code editing
- **TypeScript**: For type-safe development
- **ESLint**: Code quality and consistency

### Analytics and Monitoring

- **Analytics**: PostHog for product analytics and user behavior tracking
- **Event Tracking**: Custom event tracking for feature usage and user interactions

## Getting Started

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:
   Create a `.env` file with the following variables:

```env
NEXT_PUBLIC_NEXTAUTH_SECRET=your_secret
# Add other required environment variables
```

4. Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Project Structure

```
app/
├── (pages)/           # Route groups for different sections
├── _components/       # Shared components
├── _services/         # API services
├── api/               # API routes
├── config/            # Configuration files
├── helpers/           # Utility functions and WebContainer setup
└── redux/             # State management
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build production bundle
- `npm start` - Start production server

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is proprietary software. All rights reserved.

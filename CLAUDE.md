# 1-Stop MCP Shop Development Guide

## Commands
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run build-no-lint` - Build for production skipping linting
- `npm run start` - Start production server 
- `npm run lint` - Run ESLint
- `npm test` - Run all tests
- `npm test -- --testPathPattern=<path>` - Run specific test file

## Code Style
- **Imports**: Use `@/` path alias for internal imports (e.g., `import { cn } from "@/lib/utils"`)
- **TypeScript**: Use strict typing with interfaces/types in `src/lib/types.ts`
- **Components**: Use functional components with explicit typing
- **CSS**: Use Tailwind with `class-variance-authority` for variants
- **Naming**: 
  - PascalCase for components (Button.tsx)
  - camelCase for utilities/functions (utils.ts)
  - kebab-case for multi-word filenames
- **Error Handling**: Use try/catch with proper error typing
- **State Management**: React hooks for local state, API clients for remote data
- **Formatting**: 2-space indentation, consistent line breaks
- **ESLint**: Some rules disabled: no-unused-vars, no-explicit-any, no-unescaped-entities, exhaustive-deps
- **Zod**: Use for runtime validation of external data

## Project Structure
- `/src/components` - Reusable UI components
- `/src/app` - Next.js app router pages
- `/src/lib` - Utilities, types, and API clients
  - `/lib/api` - API client implementations
  - `/lib/utils` - Helper functions and utilities

## Special Rules
- 🍂 Begin every response with a leaf emoji when using Windsurf
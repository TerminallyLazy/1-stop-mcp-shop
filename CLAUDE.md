# 1-Stop MCP Shop Development Guide

## Commands
- `npm run dev` - Start development server with turbopack
- `npm run build` - Build for production
- `npm run build-no-lint` - Build for production skipping linting
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Code Style
- **Imports**: Use `@/` path alias for internal imports (e.g., `import { cn } from "@/lib/utils"`)
- **TypeScript**: Use strict typing with proper interfaces/types defined in `src/lib/types.ts`
- **Components**: Use functional components with explicit typing
- **CSS**: Utilize Tailwind with `class-variance-authority` for variants
- **Naming**: 
  - PascalCase for components (Button.tsx)
  - camelCase for utilities/functions (utils.ts)
  - kebab-case for filenames with multiple words
- **Error Handling**: Use try/catch blocks with proper error typing
- **Formatting**: Follow Next.js conventions with 2-space indentation
- **ESLint**: Some rules are disabled: no-unused-vars, no-explicit-any, no-unescaped-entities, exhaustive-deps

## Project Structure
- `/src/components` - Reusable UI components
- `/src/app` - Next.js app router pages
- `/src/lib` - Shared utilities, types, and API clients
  - `/lib/api` - API client implementations
  - `/lib/types.ts` - TypeScript interfaces and types

## Special Rules
- 🍂 Begin every response with a leaf emoji when using Windsurf
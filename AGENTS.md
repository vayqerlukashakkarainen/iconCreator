# AGENTS.md - Icon Creator Project Guidelines

## Build/Test Commands
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run test` - Run all tests
- `npm run test -- --testNamePattern="test name"` - Run single test
- `npm run lint` - Run ESLint
- `npm run typecheck` - Run TypeScript compiler check

## Code Style Guidelines
- Use TypeScript for all new files
- Import order: external libraries, internal modules, relative imports
- Use named exports over default exports
- Function names: camelCase, components: PascalCase
- Use `const` for immutable values, `let` for mutable
- Prefer template literals over string concatenation
- Use async/await over Promises when possible
- Error handling: throw specific Error types, catch at boundaries
- Files: kebab-case for utilities, PascalCase for components
- No console.log in production code - use proper logging
- Prefer functional components with hooks over class components
- Use proper TypeScript types, avoid `any`
- Format with Prettier (2-space indentation)
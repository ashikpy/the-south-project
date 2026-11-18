import { defineConfig } from 'shaders/config'

export default defineConfig({
  // Components are imported from 'shaders/react'
  framework: 'react',
  // Shaders project this codebase is connected to
  project: '42db483e-6dc9-42f2-b713-7c78ac77acfc',
  // Where `npx shaders install` writes component files
  outDir: 'components/shaders',
})

export const Deps = {
  "@headlessui/react": "^2.2.0",
  "@heroicons/react": "^2.2.0",
  "@reduxjs/toolkit": "^2.6.1",
  "@tanstack/react-query": "^5.69.0",
  "@tanstack/react-table": "^8.21.2",
  axios: "^1.8.4",
  clsx: "^2.1.1",
  "date-fns": "^4.1.0",
  "framer-motion": "^12.5.0",
  jotai: "^2.12.2",
  lodash: "^4.17.21",
  moment: "^2.30.1",
  "radix-ui": "^1.1.3",
  react: "^19.0.0",
  "react-dom": "^19.0.0",
  "react-hook-form": "^7.54.2",
  "react-hot-toast": "^2.5.2",
  "react-query": "^3.39.3",
  "react-redux": "^9.2.0",
  "react-router-dom": "^7.4.0",
  "react-toastify": "^11.0.5",
  recoil: "^0.7.7",
  redux: "^5.0.1",
  sass: "^1.86.0",
  "shadcn-ui": "^0.9.5",
  "styled-components": "^6.1.16",
  swr: "^2.3.3",
  "tailwind-merge": "^3.0.2",
  tailwindcss: "^4.0.15",
  yup: "^1.6.1",
  zod: "^3.24.2",
  zustand: "^5.0.3",
};

export const DevDeps = {
  autoprefixer: "^10.4.21",
  "cross-env": "^7.0.3",
  eslint: "^9.23.0",
  "eslint-config-prettier": "^10.1.1",
  "eslint-plugin-jsx-a11y": "^6.10.2",
  "eslint-plugin-react": "^7.37.4",
  "eslint-plugin-react-hooks": "^5.2.0",
  husky: "^9.1.7",
  "lint-staged": "^15.5.0",
  postcss: "^8.5.3",
  prettier: "^3.5.3",
};

export const DefaultReactFiles = {
  "/App.js": {
    code: `export default function App() { 
    return <h1>Hello world</h1>; 
    }`,
  },
  "/index.js": {
    code: `import React, { StrictMode } from "react";
  import { createRoot } from "react-dom/client";
  import "./styles.css";
  import App from "./App";
  
  const root = createRoot(document.getElementById("root"));
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  );`,
  },
  "/package.json": {
    code: `{
    "main": "/index.js",
    "dependencies": {
      "react": "^19.0.0",
      "react-dom": "^19.0.0",
      "react-scripts": "^5.0.0",
      "@headlessui/react": "^2.2.0",
      "@heroicons/react": "^2.2.0",
      "@reduxjs/toolkit": "^2.6.1",
      "@tanstack/react-query": "^5.69.0",
      "@tanstack/react-table": "^8.21.2",
      "axios": "^1.8.4",
      "clsx": "^2.1.1",
      "date-fns": "^4.1.0",
      "framer-motion": "^12.5.0",
      "jotai": "^2.12.2",
      "lodash": "^4.17.21",
      "moment": "^2.30.1",
      "radix-ui": "^1.1.3",
      "react-hook-form": "^7.54.2",
      "react-hot-toast": "^2.5.2",
      "react-query": "^3.39.3",
      "react-redux": "^9.2.0",
      "react-router-dom": "^7.4.0",
      "react-toastify": "^11.0.5",
      "recoil": "^0.7.7",
      "redux": "^5.0.1",
      "sass": "^1.86.0",
      "shadcn-ui": "^0.9.5",
      "styled-components": "^6.1.16",
      "swr": "^2.3.3",
      "tailwind-merge": "^3.0.2",
      "tailwindcss": "^4.0.15",
      "yup": "^1.6.1",
      "zod": "^3.24.2",
      "zustand": "^5.0.3"
    },
    "main": "/index.js",
    "devDependencies": {
      "autoprefixer": "^10.4.21",
      "cross-env": "^7.0.3",
      "eslint": "^9.23.0",
      "eslint-config-prettier": "^10.1.1",
      "eslint-plugin-jsx-a11y": "^6.10.2",
      "eslint-plugin-react": "^7.37.4",
      "eslint-plugin-react-hooks": "^5.2.0",
      "husky": "^9.1.7",
      "lint-staged": "^15.5.0",
      "postcss": "^8.5.3",
      "prettier": "^3.5.3"
    }
  }`,
  },
  "/public/index.html": {
    code: `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Made with superblocks</title>
    </head>
    <body>
      <div id="root"></div>
    </body>
  </html>`,
  },
  "/styles.css": {
    code: `body {
    font-family: sans-serif;
    -webkit-font-smoothing: auto;
    -moz-font-smoothing: auto;
    -moz-osx-font-smoothing: grayscale;
    font-smoothing: auto;
    text-rendering: optimizeLegibility;
    font-smooth: always;
    -webkit-tap-highlight-color: transparent;
    -webkit-touch-callout: none;
  }
  
  h1 {
    font-size: 1.5rem;
  }`,
  },
};

export const DefaultNextFiles = {
  "/pages/_app.js": {
    code: `
    import '../styles.css'

    export default function MyApp({ Component, pageProps }) {
      return <Component {...pageProps} />
    }`,
  },
  "/pages/index.js": {
    code: `
    export default function Home({ data }) {
      return (
        <div>
          <h1>Hello {data}</h1>
        </div>
      );
    }
      
    export function getServerSideProps() {
      return {
        props: { data: "world" },
      }
    }
    `,
  },
  "/next.config.js": {
    code: `
    /** @type {import('next').NextConfig} */
    const nextConfig = {
      reactStrictMode: true,
      swcMinify: true,
    }

    module.exports = nextConfig
    `,
  },
  "/package.json": {
    code: `
    {
    "name": "my-app",
    "version": "0.1.0",
    "private": true,
    "scripts": {
      "dev": "NEXT_TELEMETRY_DISABLED=1 next dev",
      "build": "next build",
      "start": "next start",
      "lint": "next lint"
    },
    "dependencies": {
      "next": "12.1.6",
      "react": "18.2.0",
      "react-dom": "18.2.0",
      "@next/swc-wasm-nodejs": "12.1.6"
    },
    "devDependencies": {}
    }`,
  },
  "/styles.css": {
    code: `
    body {
    font-family: sans-serif;
    -webkit-font-smoothing: auto;
    -moz-font-smoothing: auto;
    -moz-osx-font-smoothing: grayscale;
    font-smoothing: auto;
    text-rendering: optimizeLegibility;
    font-smooth: always;
    -webkit-tap-highlight-color: transparent;
    -webkit-touch-callout: none;
  }

  h1 {
    font-size: 1.5rem;
  }`,
  },
};

export const DefaultVueFiles = {
  "/pages/index.html": {
    code: `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta http-equiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width,initial-scale=1.0" />
        <title>Made with superblocks</title>
      </head>
      <body>
        <noscript>
          <strong
            >We're sorry superblocks doesn't work properly without JavaScript
            enabled. Please enable it to continue.</strong
          >
        </noscript>
        <div id="app"></div>
        <!-- built files will be auto injected -->
      </body>
    </html>
`,
  },
  "/src/App.vue": {
    code: `
    <template>
    <h1>Hello {{ msg }}</h1>
    </template>

    <script setup>
    import { ref } from 'vue';
    const msg = ref('world');
    </script>
    `,
  },
  "/src/main.js": {
    code: `
    import { createApp } from 'vue'
    import App from './App.vue'
    import "./styles.css";

    createApp(App).mount('#app')
    `,
  },
  "/src/styles.css": {
    code: `
    body {
    font-family: sans-serif;
    -webkit-font-smoothing: auto;
    -moz-font-smoothing: auto;
    -moz-osx-font-smoothing: grayscale;
    font-smoothing: auto;
    text-rendering: optimizeLegibility;
    font-smooth: always;
    -webkit-tap-highlight-color: transparent;
    -webkit-touch-callout: none;
    }

    h1 {
      font-size: 1.5rem;
    }
    `,
  },
  "/package.json": {
    code: `
  {
    "name": "vue3",
    "version": "0.1.0",
    "private": true,
    "main": "/src/main.js",
    "scripts": {
      "serve": "vue-cli-service serve",
      "build": "vue-cli-service build"
    },
    "dependencies": {
      "core-js": "^3.26.1",
      "vue": "^3.2.45"
    },
    "devDependencies": {
      "@vue/cli-plugin-babel": "^5.0.8",
      "@vue/cli-service": "^5.0.8"
    }
  }
    `,
  },
};

export const DefaultHTMLFiles = {
  "/index.html": {
    code: `
    <!DOCTYPE html>
    <html>

    <head>
      <title>Made with superblocks</title>
      <meta charset="UTF-8" />
      <link rel="stylesheet" href="/styles.css" />
    </head>

    <body>
      <h1>Hello world</h1>
    </body>

    </html>
    `,
  },
  "/package.json": {
    code: `
    {
    "dependencies": {},
    "main": "/index.html",
    "devDependencies": {}
    },
    "author":"superblocks"
    `,
  },
  "/styles.css": {
    code: `
    body {
    font-family: sans-serif;
    -webkit-font-smoothing: auto;
    -moz-font-smoothing: auto;
    -moz-osx-font-smoothing: grayscale;
    font-smoothing: auto;
    text-rendering: optimizeLegibility;
    font-smooth: always;
    -webkit-tap-highlight-color: transparent;
    -webkit-touch-callout: none;
    }

    h1 {
      font-size: 1.5rem;
    }
    `,
  },
};

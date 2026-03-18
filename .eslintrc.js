// .eslintrc.js
module.exports = {
  extends: [
    "next",
    "next/core-web-vitals",
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "plugin:prettier/recommended", // Make sure this is the last element
  ],
  rules: {
    "react/react-in-jsx-scope": "off", // Not needed with Next.js
    "react/prop-types": "off", // We're using TypeScript
  },
};

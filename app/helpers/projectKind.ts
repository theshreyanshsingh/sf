export const isCodeProjectData = (data: unknown): boolean => {
  if (!data || typeof data !== "object") return false;
  const paths = Object.keys(data as Record<string, unknown>).map((path) =>
    path.replace(/^\/+/, "")
  );
  const hasPackageJson = paths.some((path) => path.endsWith("package.json"));
  const hasCodeEntry = paths.some((path) =>
    /^(?:workspace\/)?(src|app)\/(main|index|App)\.(js|jsx|ts|tsx)$/i.test(path)
  );
  const hasAnySourceFile = paths.some((path) =>
    /^(?:workspace\/)?(src|app)\/.+\.(js|jsx|ts|tsx)$/i.test(path)
  );
  return hasPackageJson || hasCodeEntry || hasAnySourceFile;
};

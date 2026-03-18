"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LuLoaderCircle } from "react-icons/lu";
import { useAuthenticated } from "./useAuthenticated";
const PROTECTED_ROUTES = [{ path: "/projects", type: "startsWith" }];

const RouteProtector: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated } = useAuthenticated();
  // null means not initialized, true/false indicates loading state
  const [isLoading, setIsLoading] = useState<boolean | null>(null);
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);

  useEffect(() => {
    // Function to check if current path matches protected route patterns
    const isProtectedRoute = (): boolean => {
      return PROTECTED_ROUTES.some((route) => {
        if (route.type === "startsWith") {
          return pathname.startsWith(route.path);
        }
        return pathname === route.path; // exact match
      });
    };

    const validateSession = async () => {
      try {
        // If not a protected route, render content immediately
        if (!isProtectedRoute()) {
          setIsAuthorized(true);
          setIsLoading(false);
          return;
        }

        // Set loading state for protected routes
        setIsLoading(true);

        // Authentication logic
        // Replace this with your actual auth check when ready
        // const sessionId = localStorage.getItem("session") || "";
        // const email = localStorage.getItem("email") || "";

        // Uncomment for real authentication
        // const authResult = await sessionHelper({ session: sessionId, email });
        // const isSessionValid = authResult.success;

        // For development/testing
        const isSessionValid = isAuthenticated.value; // Replace with actual check

        if (!isSessionValid) {
          // Redirect to login if session is invalid
          // router.push("/"); // Or your authentication page
          return;
        }

        // If session is valid, allow content to render
        setIsAuthorized(true);
      } catch (error) {
        console.error("Authentication error:", error);
        router.push("/");
      } finally {
        setIsLoading(false);
      }
    };

    validateSession();
  }, [pathname, router, isAuthenticated.value]);

  // Show loading spinner only when explicitly loading (for protected routes)
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen bg-[#141415]">
        <LuLoaderCircle className="text-white text-3xl animate-spin" />
      </div>
    );
  }

  // Render children only if authorized or loading hasn't started yet
  return isAuthorized || isLoading === null ? children : null;
};

export default RouteProtector;

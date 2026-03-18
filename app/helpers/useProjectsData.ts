"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/app/redux/store";
import { fetchAllProjects } from "@/app/redux/reducers/basicData";

/**
 * Custom hook to fetch and manage all projects data efficiently
 * Prevents multiple fetches when component re-renders or when navigating back to the page
 */
export function useProjectsData(email: string | null | undefined) {
  const { projects, loading } = useSelector(
    (state: RootState) => state.basicData
  );
  const dispatch: AppDispatch = useDispatch();

  // Use a ref to track if we've already fetched projects
  const fetchedRef = useRef<boolean>(false);
  // Use a ref to store the last email we fetched for
  const lastEmailRef = useRef<string | null | undefined>(null);
  // Use a state to track if we're currently fetching
  const [isFetching, setIsFetching] = useState(false);

  // Function to fetch all projects data
  const fetchProjectsData = useCallback(() => {
    // Skip if already fetched or no email or currently fetching
    if (
      !email ||
      isFetching ||
      fetchedRef.current ||
      (projects?.length > 0 &&
        loading === "success" &&
        lastEmailRef.current === email)
    ) {
      return;
    }

    // Set fetching state to prevent duplicate calls
    setIsFetching(true);
    // Update ref to prevent duplicate fetches
    fetchedRef.current = true;
    // Store the email we're fetching for
    lastEmailRef.current = email;

    dispatch(fetchAllProjects({ email }));
  }, [email, dispatch, projects, loading, isFetching]);

  // Reset the fetching state when loading state changes
  useEffect(() => {
    if (loading !== "loading") {
      setIsFetching(false);
    }
  }, [loading]);

  // Reset the fetchedRef when email changes
  useEffect(() => {
    if (email && email !== lastEmailRef.current) {
      // Only reset if email changes and we have a new email
      fetchedRef.current = false;
      fetchProjectsData();
    }
  }, [email, fetchProjectsData]);

  return {
    projects,
    loading,
    fetchProjectsData,
  };
}

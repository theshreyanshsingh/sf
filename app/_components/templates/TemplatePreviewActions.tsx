"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useDispatch } from "react-redux";

import { useAuthenticated } from "@/app/helpers/useAuthenticated";
import { forkProjectFromTemplateSlug } from "@/app/_services/templatesApi";
import { setNotification } from "@/app/redux/reducers/NotificationModalReducer";

export default function TemplatePreviewActions({
  templateSlug,
}: {
  templateSlug: string;
}) {
  const router = useRouter();
  const dispatch = useDispatch();
  const { isAuthenticated, email } = useAuthenticated();
  const [busy, setBusy] = useState(false);

  const handleUseTemplate = async () => {
    if (!isAuthenticated.value) {
      router.push("/login");
      return;
    }
    const em = email.value?.trim();
    if (!em) {
      router.push("/login");
      return;
    }
    setBusy(true);
    try {
      const res = await forkProjectFromTemplateSlug({
        email: em,
        templateSlug,
      });
      if (res.ok) {
        window.location.href = `/projects/${res.projectId}`;
        return;
      }
      dispatch(
        setNotification({
          modalOpen: true,
          status: "error",
          text: res.message,
        }),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
      <button
        type="button"
        onClick={() => void handleUseTemplate()}
        disabled={busy}
        className="inline-flex w-full cursor-pointer items-center justify-center rounded-md bg-white px-2 py-1 text-xs font-medium text-black transition hover:bg-white/90 disabled:opacity-60 sm:w-auto"
      >
        {busy ? "Starting…" : "Use Template"}
      </button>
    </div>
  );
}

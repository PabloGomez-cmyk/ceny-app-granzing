"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { driver, type Driver } from "driver.js";
import "driver.js/dist/driver.css";
import { useTourStore, hasSeenTour, markTourSeen } from "@/stores/tourStore";
import { getTourSteps, resolveStepSelector } from "@/lib/tour/steps";
import { waitForElement } from "@/lib/tour/waitForElement";

export default function TourProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const role = session?.role;
  const userId = session?.userId;
  const pathname = usePathname();
  const router = useRouter();
  const { active, stepIndex, start, stop, next, prev } = useTourStore();
  const driverRef = useRef<Driver | null>(null);
  const autoStartedRef = useRef(false);

  const steps = getTourSteps(role);

  function finish() {
    driverRef.current?.destroy();
    driverRef.current = null;
    stop();
    if (userId) markTourSeen(userId);
  }

  // Auto-arranque en el primer login + disparo manual vía ?tour=1
  useEffect(() => {
    if (!userId || pathname !== "/dashboard" || active) return;
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("tour") === "1") {
      router.replace("/dashboard");
      start();
      return;
    }
    if (!autoStartedRef.current && !hasSeenTour(userId)) {
      autoStartedRef.current = true;
      const t = setTimeout(() => start(), 600);
      return () => clearTimeout(t);
    }
  }, [userId, pathname, active, start, router]);

  // Motor del tour: navega a la página del paso actual, espera el elemento y resalta
  useEffect(() => {
    if (!active) return;
    const step = steps[stepIndex];
    if (!step) {
      finish();
      return;
    }
    if (pathname !== step.path) {
      router.push(step.path as never);
      return;
    }

    let cancelled = false;
    const selector = resolveStepSelector(step, role);
    waitForElement(selector).then((el) => {
      if (cancelled) return;
      if (!el) {
        // El elemento no apareció (ej. tenant sin productos aún) — no colgarse.
        next();
        return;
      }
      if (!driverRef.current) {
        driverRef.current = driver({ allowClose: true });
      }
      const isLast = stepIndex === steps.length - 1;
      driverRef.current.highlight({
        element: el as HTMLElement,
        popover: {
          title: `${step.title} · Paso ${stepIndex + 1} de ${steps.length}`,
          description: step.description,
          showButtons: [...(stepIndex > 0 ? (["previous"] as const) : []), "next", "close"],
          nextBtnText: isLast ? "Finalizar" : "Siguiente →",
          prevBtnText: "← Anterior",
          onNextClick: () => {
            if (isLast) {
              finish();
            } else {
              driverRef.current?.destroy();
              next();
            }
          },
          onPrevClick: () => {
            driverRef.current?.destroy();
            prev();
          },
          onCloseClick: () => {
            finish();
          },
        },
      });
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, stepIndex, pathname]);

  useEffect(() => {
    return () => {
      driverRef.current?.destroy();
    };
  }, []);

  return <>{children}</>;
}

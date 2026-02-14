"use client";

import { Suspense } from "react";
import LoginClient from "./view";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginClient />
    </Suspense>
  );
}

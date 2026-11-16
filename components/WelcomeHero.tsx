"use client";

import React from "react";
import { UserProfile } from "@/lib/types";
import { extractFirstName } from "@/lib/authClient";

interface WelcomeHeroProps {
  userProfile?: UserProfile;
}

export const WelcomeHero: React.FC<WelcomeHeroProps> = ({ userProfile }) => {
  const firstName = extractFirstName(userProfile?.name, userProfile?.email);
  const isExistingUser =
    userProfile && userProfile.isLoggedIn && firstName && userProfile.id !== "guest";

  return (
    <div className="flex flex-col items-center justify-center flex-1 w-full max-w-4xl px-4 py-8 mx-auto text-center select-none">
      <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-normal tracking-tight text-white font-sans leading-snug break-words">
        {isExistingUser ? `${firstName}, where should we begin?` : "Where should we begin?"}
      </h1>
    </div>
  );
};

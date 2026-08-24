"use client";

import React from "react";
import { UserProfile } from "@/lib/types";

interface WelcomeHeroProps {
  userProfile?: UserProfile;
}

export const WelcomeHero: React.FC<WelcomeHeroProps> = ({ userProfile }) => {
  const isExistingUser =
    userProfile && userProfile.isLoggedIn && userProfile.name && userProfile.id !== "guest";
  const displayName = isExistingUser ? userProfile.name.split(" ")[0] : "";

  return (
    <div className="flex flex-col items-center justify-center flex-1 w-full max-w-4xl px-4 py-8 mx-auto text-center select-none">
      <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-normal tracking-tight text-white font-sans leading-snug break-words">
        {isExistingUser ? `Hello ${displayName}, where should we begin?` : "Where should we begin?"}
      </h1>
    </div>
  );
};
